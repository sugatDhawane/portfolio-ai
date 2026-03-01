import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";
import { NextRequest, NextResponse } from "next/server";

// ── Clients ───────────────────────────────────────────────
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Rate Limiter ──────────────────────────────────────────
const rateLimit = new Map<string, { count: number; reset: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimit.get(ip);
  if (limit && now < limit.reset) {
    if (limit.count >= 10) return false;
    limit.count++;
  } else {
    rateLimit.set(ip, { count: 1, reset: now + 60_000 });
  }
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, limit] of rateLimit.entries()) {
    if (now > limit.reset) rateLimit.delete(ip);
  }
}, 5 * 60 * 1000);

// ── Answer Cache ──────────────────────────────────────────
const answerCache = new Map<string, { answer: string; expires: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

function normalizeQuestion(question: string): string {
  return question.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");
}

function getCachedAnswer(question: string): string | null {
  const key = normalizeQuestion(question);
  const cached = answerCache.get(key);
  if (!cached) return null;
  if (Date.now() > cached.expires) { answerCache.delete(key); return null; }
  return cached.answer;
}

function setCachedAnswer(question: string, answer: string): void {
  const key = normalizeQuestion(question);
  answerCache.set(key, { answer, expires: Date.now() + CACHE_TTL });
}

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of answerCache.entries()) {
    if (now > value.expires) answerCache.delete(key);
  }
}, 60 * 60 * 1000);

// ── Visitor Logger ────────────────────────────────────────
function parseDevice(userAgent: string): string {
  if (/mobile/i.test(userAgent)) return "Mobile";
  if (/tablet|ipad/i.test(userAgent)) return "Tablet";
  return "Desktop";
}

// Geo cache — avoid repeated lookups for same IP
const geoCache = new Map<string, { country: string; city: string }>();

async function getGeoInfo(ip: string, req: NextRequest): Promise<{ country: string; city: string }> {
  // 1. Return from geo cache if available
  if (geoCache.has(ip)) return geoCache.get(ip)!;

  // 2. Try Vercel headers first (fast, no extra request)
  const vercelCountry = req.headers.get("x-vercel-ip-country");
  const vercelCity = req.headers.get("x-vercel-ip-city");

  if (vercelCountry && vercelCity && vercelCity !== "unknown") {
    // Decode URL-encoded city names e.g. "San%20Francisco" → "San Francisco"
    const geo = {
      country: vercelCountry,
      city: decodeURIComponent(vercelCity)
    };
    geoCache.set(ip, geo);
    return geo;
  }

  // 3. Fallback to ip-api.com (free, no key needed, 1000 req/min)
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=country,city,status`, {
      signal: AbortSignal.timeout(2000) // 2 second timeout — never block main response
    });
    const data = await res.json();
    if (data.status === "success") {
      const geo = { country: data.country ?? "unknown", city: data.city ?? "unknown" };
      geoCache.set(ip, geo);
      return geo;
    }
  } catch {
    // Silently fail — geo is nice to have, not critical
  }

  return { country: "unknown", city: "unknown" };
}

async function logVisitor({
  req, question, answer, fromCache = false
}: {
  req: NextRequest; question: string; answer: string; fromCache?: boolean;
}) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const userAgent = req.headers.get("user-agent") ?? "unknown";
    const device = parseDevice(userAgent);

    // Get geo — tries Vercel headers first, falls back to ip-api.com
    const { country, city } = await getGeoInfo(ip, req);

    await supabase.from("visitor_logs").insert({
      ip, country, city, user_agent: userAgent, device, question, answer, from_cache: fromCache
    });
  } catch (err) {
    console.error("Logging error:", err);
  }
}

// ── Portfolio Data ────────────────────────────────────────
const portfolioPath = join(process.cwd(), "data", "portfolio.json");
const portfolio = JSON.parse(readFileSync(portfolioPath, "utf-8"));

// ── Tools ─────────────────────────────────────────────────
const tools: Anthropic.Tool[] = [
  {
    name: "get_bio",
    description: "Get personal bio and contact information",
    input_schema: { type: "object" as const, properties: {}, required: [] }
  },
  {
    name: "get_skills",
    description: "Get technical skills grouped by category — languages, frontend, testing, devops",
    input_schema: { type: "object" as const, properties: {}, required: [] }
  },
  {
    name: "get_experience",
    description: "Get full work experience history",
    input_schema: { type: "object" as const, properties: {}, required: [] }
  },
  {
    name: "get_projects",
    description: "Get key projects with tech stack and highlights",
    input_schema: { type: "object" as const, properties: {}, required: [] }
  },
  {
    name: "get_qualifications",
    description: "Get educational qualifications",
    input_schema: { type: "object" as const, properties: {}, required: [] }
  },
  {
    name: "get_awards",
    description: "Get awards and recognitions",
    input_schema: { type: "object" as const, properties: {}, required: [] }
  },
  {
    name: "get_availability",
    description: "Get current job availability and work preferences",
    input_schema: { type: "object" as const, properties: {}, required: [] }
  },
  {
    name: "get_contact",
    description: "Get contact details — email, phone, LinkedIn, GitHub",
    input_schema: { type: "object" as const, properties: {}, required: [] }
  },
  {
    name: "get_all",
    description: "Get complete portfolio information",
    input_schema: { type: "object" as const, properties: {}, required: [] }
  }
];

// ── Tool Handler ──────────────────────────────────────────
function handleToolCall(toolName: string): string {
  switch (toolName) {
    case "get_bio":            return JSON.stringify(portfolio.bio, null, 2);
    case "get_skills":         return JSON.stringify(portfolio.skills, null, 2);
    case "get_experience":     return JSON.stringify(portfolio.experience, null, 2);
    case "get_projects":       return JSON.stringify(portfolio.projects, null, 2);
    case "get_qualifications": return JSON.stringify(portfolio.qualifications, null, 2);
    case "get_awards":         return JSON.stringify(portfolio.awards, null, 2);
    case "get_availability":   return JSON.stringify(portfolio.availability, null, 2);
    case "get_contact":        return JSON.stringify({
      email: portfolio.bio.email,
      phone: portfolio.bio.phone,
      linkedin: portfolio.bio.linkedin,
      github: portfolio.bio.github,
      portfolio: portfolio.bio.portfolio
    }, null, 2);
    case "get_all":            return JSON.stringify(portfolio, null, 2);
    default:                   return "Tool not found";
  }
}

// ── POST Handler ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  try {
    const { messages } = await req.json();
    const trimmedMessages = messages.slice(-10);

    const latestQuestion = trimmedMessages
      .filter((m: { role: string }) => m.role === "user")
      .at(-1)?.content ?? "";

    const isFirstMessage = trimmedMessages
      .filter((m: { role: string }) => m.role === "user").length === 1;

    // Cache check — only for standalone first questions
    if (isFirstMessage) {
      const cachedAnswer = getCachedAnswer(latestQuestion);
      if (cachedAnswer) {
        logVisitor({ req, question: latestQuestion, answer: cachedAnswer, fromCache: true });
        return NextResponse.json({ message: cachedAnswer });
      }
    }

    // First Claude call
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `You are a friendly assistant representing ${portfolio.bio.name}, a ${portfolio.bio.title} with 15+ years of experience.

For casual or conversational messages like greetings ("how are you", "hello", "hi", "what's up") — respond naturally and briefly like a real person. Keep it warm and short. Do NOT turn it into a portfolio pitch or list sections.

For questions about his work, skills, projects, experience, awards, availability, or contact — use the available tools to fetch real data and answer accurately.

Do not make up any information. Only use tools when answering professional questions about Sugat.`,
      tools,
      messages: trimmedMessages
    });

    // Handle tool use
    if (response.stop_reason === "tool_use") {
      const toolUseBlock = response.content.find(b => b.type === "tool_use");

      if (toolUseBlock && toolUseBlock.type === "tool_use") {
        const toolResult = handleToolCall(toolUseBlock.name);

        const finalResponse = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          system: `You are a helpful assistant representing ${portfolio.bio.name}, a ${portfolio.bio.title}.
Be conversational, friendly, and concise. Do not make up any information.`,
          tools,
          messages: [
            ...trimmedMessages,
            { role: "assistant", content: response.content },
            {
              role: "user",
              content: [{
                type: "tool_result",
                tool_use_id: toolUseBlock.id,
                content: toolResult
              }]
            }
          ]
        });

        const textBlock = finalResponse.content.find(b => b.type === "text");
        const answer = textBlock?.type === "text" ? textBlock.text : "No response";

        if (isFirstMessage) setCachedAnswer(latestQuestion, answer);
        logVisitor({ req, question: latestQuestion, answer, fromCache: false });

        return NextResponse.json({ message: answer });
      }
    }

    // Direct text response
    const textBlock = response.content.find(b => b.type === "text");
    const answer = textBlock?.type === "text" ? textBlock.text : "No response";

    if (isFirstMessage) setCachedAnswer(latestQuestion, answer);
    logVisitor({ req, question: latestQuestion, answer, fromCache: false });

    return NextResponse.json({ message: answer });

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
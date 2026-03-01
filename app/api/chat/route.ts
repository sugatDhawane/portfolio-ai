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

// ── Visitor Logger ────────────────────────────────────────
function parseDevice(userAgent: string): string {
  if (/mobile/i.test(userAgent)) return "Mobile";
  if (/tablet|ipad/i.test(userAgent)) return "Tablet";
  return "Desktop";
}

async function logVisitor({
  req,
  question,
  answer,
}: {
  req: NextRequest;
  question: string;
  answer: string;
}) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const userAgent = req.headers.get("user-agent") ?? "unknown";

    // Geo info from Vercel headers (auto-populated when deployed on Vercel)
    const country = req.headers.get("x-vercel-ip-country") ?? "unknown";
    const city = req.headers.get("x-vercel-ip-city") ?? "unknown";

    const device = parseDevice(userAgent);

    await supabase.from("visitor_logs").insert({
      ip,
      country,
      city,
      user_agent: userAgent,
      device,
      question,
      answer,
    });
  } catch (err) {
    // Log silently — never let analytics break the main response
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
    description: "Get list of technical skills",
    input_schema: { type: "object" as const, properties: {}, required: [] }
  },
  {
    name: "get_experience",
    description: "Get work experience history",
    input_schema: { type: "object" as const, properties: {}, required: [] }
  },
  {
    name: "get_projects",
    description: "Get list of projects",
    input_schema: { type: "object" as const, properties: {}, required: [] }
  },
  {
    name: "get_qualifications",
    description: "Get educational qualifications and certifications",
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
    case "get_all":            return JSON.stringify(portfolio, null, 2);
    default:                   return "Tool not found";
  }
}

// ── POST Handler ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  // 1. Rate limit check
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  try {
    const { messages } = await req.json();

    // 2. Trim to last 10 messages
    const trimmedMessages = messages.slice(-10);

    // 3. Get the latest user question for logging
    const latestQuestion = trimmedMessages
      .filter((m: { role: string }) => m.role === "user")
      .at(-1)?.content ?? "";

    // 4. First Claude call
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `You are a helpful assistant representing ${portfolio.bio.name}, a ${portfolio.bio.title}.
Answer questions about them based on their portfolio data using the available tools.
Only answer questions related to their work, skills, projects, and experience.
Be conversational, friendly, and concise.
Do not make up any information — only use data from the tools.`,
      tools,
      messages: trimmedMessages
    });

    // 5. Handle tool use
    if (response.stop_reason === "tool_use") {
      const toolUseBlock = response.content.find(b => b.type === "tool_use");

      if (toolUseBlock && toolUseBlock.type === "tool_use") {
        const toolResult = handleToolCall(toolUseBlock.name);

        // 6. Second Claude call with tool result
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

        // 7. Log to Supabase (fire and forget — don't await)
        logVisitor({ req, question: latestQuestion, answer });

        return NextResponse.json({ message: answer });
      }
    }

    // 8. Direct text response (no tool needed)
    const textBlock = response.content.find(b => b.type === "text");
    const answer = textBlock?.type === "text" ? textBlock.text : "No response";

    // 9. Log to Supabase (fire and forget)
    logVisitor({ req, question: latestQuestion, answer });

    return NextResponse.json({ message: answer });

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
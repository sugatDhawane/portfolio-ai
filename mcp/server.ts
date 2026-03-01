import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSync } from "fs";
import { join } from "path";
import { z } from "zod";

// Read portfolio data
const portfolioPath = join(process.cwd(), "data", "portfolio.json");
const portfolio = JSON.parse(readFileSync(portfolioPath, "utf-8"));

// Create MCP server
const server = new McpServer({
  name: "portfolio-mcp",
  version: "1.0.0"
});

// Tool 1 — Get Bio
server.tool(
  "get_bio",
  "Get personal bio and contact information",
  {},
  async () => ({
    content: [{
      type: "text",
      text: JSON.stringify(portfolio.bio, null, 2)
    }]
  })
);

// Tool 2 — Get Skills
server.tool(
  "get_skills",
  "Get list of technical skills",
  {},
  async () => ({
    content: [{
      type: "text",
      text: JSON.stringify(portfolio.skills, null, 2)
    }]
  })
);

// Tool 3 — Get Experience
server.tool(
  "get_experience",
  "Get work experience history",
  {},
  async () => ({
    content: [{
      type: "text",
      text: JSON.stringify(portfolio.experience, null, 2)
    }]
  })
);

// Tool 4 — Get Projects
server.tool(
  "get_projects",
  "Get list of projects",
  {},
  async () => ({
    content: [{
      type: "text",
      text: JSON.stringify(portfolio.projects, null, 2)
    }]
  })
);

// Tool 5 — Get Everything (useful for broad questions)
server.tool(
  "get_all",
  "Get complete portfolio information",
  {},
  async () => ({
    content: [{
      type: "text",
      text: JSON.stringify(portfolio, null, 2)
    }]
  })
);

// Tool 6 - Get Qualifications/Education
server.tool(
  "get_qualifications",
  "Get educational background and qualifications",
  {},
  async () => ({
    content: [{
      type: "text",
      text: JSON.stringify(portfolio.qualifications, null, 2)
    }]
  })
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Portfolio MCP Server running...");
}

main().catch(console.error);


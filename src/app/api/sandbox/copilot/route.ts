import { generateText } from "ai";
import { NextResponse } from "next/server";
import { analyzeSandbox, SANDBOX_MAX_HOLDINGS, type SandboxHolding } from "@/lib/portfolio/sandbox";

export const runtime = "nodejs";

function validHoldings(value: unknown): value is SandboxHolding[] {
  return Array.isArray(value) && value.length <= SANDBOX_MAX_HOLDINGS && value.every((holding) => {
    if (!holding || typeof holding !== "object") return false;
    const row = holding as Record<string, unknown>;
    return typeof row.ticker === "string" && /^[A-Z0-9.-]{1,12}$/.test(row.ticker)
      && typeof row.weight === "number" && Number.isFinite(row.weight) && row.weight >= 0 && row.weight <= 100;
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { question?: unknown; holdings?: unknown };
    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question || question.length > 800 || !validHoldings(body.holdings)) {
      return NextResponse.json({ error: "Add a valid question and up to 10 holdings." }, { status: 400 });
    }

    const holdings = body.holdings.map(({ ticker, weight }) => ({ ticker, weight }));
    const analysis = analyzeSandbox(holdings);
    const { text } = await generateText({
      // Finance-tuned and available on AI Gateway's free tier. Paid projects can
      // override this without a deploy through IQ_COPILOT_MODEL.
      model: process.env.IQ_COPILOT_MODEL ?? "inclusionai/ling-3.0-flash-fin-free",
      maxOutputTokens: 450,
      system: `You are IQ, a calm portfolio construction copilot for a novice investor.
Use only the supplied allocation and calculated diagnostics. Never invent prices, returns, correlations, forecasts, or personal facts.
Explain trade-offs in simple language. Do not tell the user to buy or sell. If useful, suggest one reversible hypothetical change they can try in the sandbox.
State important limitations. Respond as concise plain text in 2-4 short paragraphs with no markdown headings or bullet symbols.`,
      prompt: `Sandbox (fictional $100,000): ${JSON.stringify(holdings)}
Calculated diagnostics: ${JSON.stringify(analysis)}
Question: ${question}`,
    });
    return NextResponse.json({ answer: text });
  } catch (error) {
    console.error("Sandbox copilot failed", error);
    return NextResponse.json({ error: "Ask IQ is taking a breather. The sandbox still works without it." }, { status: 503 });
  }
}

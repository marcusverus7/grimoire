import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildAiRecapPrompt } from "@grimoire/core";
import type { AiRecapInput } from "@grimoire/core";
import { guardRecapRequest, checkPayloadSize } from "@/lib/api-guard";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "AI recap generation is not configured" },
      { status: 503 },
    );
  }

  // App token + per-IP rate limit before we touch the body or spend credits.
  const gate = guardRecapRequest(req.headers);
  if (gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

  let input: AiRecapInput;
  try {
    input = (await req.json()) as AiRecapInput;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!input.campaignName || !input.sessionNotesMarkdown) {
    return NextResponse.json(
      { error: "campaignName and sessionNotesMarkdown are required" },
      { status: 400 },
    );
  }

  // Bound input size so one request can't inflate the prompt (and the bill).
  const tooBig = checkPayloadSize(input);
  if (tooBig) return NextResponse.json({ error: tooBig.error }, { status: tooBig.status });

  const { system, user } = buildAiRecapPrompt(input);

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system,
      messages: [{ role: "user", content: user }],
    });

    const recapText = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    return NextResponse.json({ recapText });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { text, voice = "nova" } = await req.json() as { text?: string; voice?: string };
  if (!text?.trim()) return NextResponse.json({ error: "text required" }, { status: 400 });
  if (!process.env.OPENAI_API_KEY)
    return NextResponse.json({ error: "OpenAI not configured" }, { status: 503 });

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const mp3 = await openai.audio.speech.create({
    model: "tts-1",
    voice: voice as "nova" | "alloy" | "echo" | "fable" | "onyx" | "shimmer",
    input: text.slice(0, 4096),
  });
  const buffer = Buffer.from(await mp3.arrayBuffer());
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(buffer.length),
    },
  });
}

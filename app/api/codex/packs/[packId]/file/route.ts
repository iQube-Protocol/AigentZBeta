/**
 * GET /api/codex/packs/:packId/file?path=...
 *
 * Serves files from codexes/packs/:packId (markdown or JSON).
 */

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

function isValidPackId(packId: string): boolean {
  return /^[a-z0-9-]+$/i.test(packId);
}

function sanitizePath(filePath: string): string | null {
  if (path.isAbsolute(filePath)) return null;
  const normalized = path.normalize(filePath);
  if (normalized.startsWith("..")) return null;
  return normalized;
}

export async function GET(request: NextRequest, context: { params: { packId: string } }) {
  const { packId } = context.params;

  if (!isValidPackId(packId)) {
    return NextResponse.json({ ok: false, error: "Invalid packId." }, { status: 400 });
  }

  const filePath = request.nextUrl.searchParams.get("path");
  if (!filePath) {
    return NextResponse.json({ ok: false, error: "Missing path query." }, { status: 400 });
  }

  const safePath = sanitizePath(filePath);
  if (!safePath) {
    return NextResponse.json({ ok: false, error: "Invalid path." }, { status: 400 });
  }

  if (!safePath.endsWith(".md") && !safePath.endsWith(".json")) {
    return NextResponse.json({ ok: false, error: "Unsupported file type." }, { status: 400 });
  }

  const packRoot = path.join(process.cwd(), "codexes", "packs", packId);
  const fullPath = path.join(packRoot, safePath);

  if (!fullPath.startsWith(packRoot + path.sep)) {
    return NextResponse.json({ ok: false, error: "Path out of bounds." }, { status: 400 });
  }

  try {
    const raw = await fs.readFile(fullPath, "utf-8");
    if (safePath.endsWith(".json")) {
      try {
        const data = JSON.parse(raw);
        return NextResponse.json({ ok: true, format: "json", path: safePath, data });
      } catch (error) {
        return NextResponse.json(
          { ok: false, error: "Invalid JSON file.", details: String(error) },
          { status: 500 }
        );
      }
    }
    return NextResponse.json({ ok: true, format: "markdown", path: safePath, content: raw });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "File not found.", details: String(error) },
      { status: 404 }
    );
  }
}

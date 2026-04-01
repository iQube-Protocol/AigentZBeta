/**
 * POST /api/codex/chat/aigentiq/write-doc
 *
 * Enables Aigent Z to write new documentation files to the AgentiQ Codex.
 * Commits the file directly to the dev branch of the GitHub repo via the
 * GitHub REST API — no local filesystem write required (works in Lambda).
 *
 * Security model:
 * - Writes are restricted to codexes/packs/aigency/items/ subtree only
 * - Filenames are sanitized (alphanumeric, hyphens, underscores, .md only)
 * - File size capped at 64KB
 * - Existing files are NOT overwritten (must explicitly pass overwrite: true)
 * - Uses GITHUB_TOKEN (server-only env var, never NEXT_PUBLIC_)
 */

import { NextRequest, NextResponse } from "next/server";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPOSITORY || "iQube-Protocol/AigentZBeta";
const CODEX_ITEMS_PREFIX = "codexes/packs/aigency/items/";
const MAX_CONTENT_BYTES = 64 * 1024; // 64KB

function sanitizeDocPath(rawPath: string): string | null {
  // Strip any leading slashes or traversal
  const clean = rawPath.replace(/^[./\\]+/, "").replace(/\.\./g, "");
  // Must be under items/ and end in .md
  if (!clean.startsWith("items/") && !clean.startsWith("architecture/") && !clean.startsWith("knowledge/") && !clean.startsWith("repos/") && !clean.startsWith("build_/")) {
    return null;
  }
  if (!clean.endsWith(".md")) return null;
  // Each path segment: only alphanumeric, hyphens, underscores, dots
  const segments = clean.split("/");
  for (const seg of segments) {
    if (!seg) continue;
    if (!/^[a-zA-Z0-9._-]+$/.test(seg)) return null;
  }
  return clean;
}

async function githubGetFile(filePath: string): Promise<{ sha: string } | null> {
  if (!GITHUB_TOKEN) return null;
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}?ref=dev`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { sha: data.sha };
}

async function githubPutFile(
  filePath: string,
  content: string,
  message: string,
  sha?: string,
): Promise<{ html_url: string }> {
  if (!GITHUB_TOKEN) throw new Error("GITHUB_TOKEN not configured");
  const body: Record<string, string> = {
    message,
    content: Buffer.from(content, "utf-8").toString("base64"),
    branch: "dev",
  };
  if (sha) body.sha = sha;

  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub PUT ${res.status}: ${errText}`);
  }
  const data = await res.json();
  return { html_url: data.content?.html_url ?? `https://github.com/${GITHUB_REPO}/blob/dev/${filePath}` };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    if (!GITHUB_TOKEN) {
      return NextResponse.json(
        { ok: false, error: "GITHUB_TOKEN not configured on this server — doc writes unavailable." },
        { status: 503 },
      );
    }

    const body = await request.json();
    const { path: rawPath, content, overwrite = false } = body;

    if (!rawPath || typeof rawPath !== "string") {
      return NextResponse.json({ ok: false, error: "path is required (e.g. architecture/dvn.md)" }, { status: 400 });
    }
    if (!content || typeof content !== "string") {
      return NextResponse.json({ ok: false, error: "content is required" }, { status: 400 });
    }

    const safeRelPath = sanitizeDocPath(rawPath);
    if (!safeRelPath) {
      return NextResponse.json(
        { ok: false, error: "Invalid path. Must be a .md file under items/, architecture/, knowledge/, repos/, or build_/. No path traversal allowed." },
        { status: 400 },
      );
    }

    const contentBytes = Buffer.byteLength(content, "utf-8");
    if (contentBytes > MAX_CONTENT_BYTES) {
      return NextResponse.json(
        { ok: false, error: `Content exceeds 64KB limit (${contentBytes} bytes).` },
        { status: 400 },
      );
    }

    const fullPath = `${CODEX_ITEMS_PREFIX}${safeRelPath}`;
    const existing = await githubGetFile(fullPath);

    if (existing && !overwrite) {
      return NextResponse.json(
        {
          ok: false,
          error: `File already exists: ${fullPath}. Pass overwrite: true to update it.`,
          exists: true,
          path: fullPath,
        },
        { status: 409 },
      );
    }

    const commitMessage = existing
      ? `update codex doc: ${safeRelPath}`
      : `add codex doc: ${safeRelPath}`;

    const result = await githubPutFile(fullPath, content, commitMessage, existing?.sha);

    return NextResponse.json({
      ok: true,
      path: fullPath,
      github_url: result.html_url,
      action: existing ? "updated" : "created",
      message: commitMessage,
    });
  } catch (err) {
    console.error("[AgentiQ write-doc] Error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

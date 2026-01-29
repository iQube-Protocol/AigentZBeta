import { NextRequest, NextResponse } from "next/server";
import {
  listExperiencesLocal,
  listSessionsLocal,
  deleteExperienceLocal,
  deleteSessionLocal,
} from "@/services/composer/composerLocalDb";
import { clearAll as clearComposerStore } from "@/services/composer/composerStore";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenant_id = searchParams.get("tenant_id") || undefined;
    const user_id = searchParams.get("user_id") || undefined;
    const status = searchParams.get("status") || undefined;
    const category = searchParams.get("category") || undefined;

    const [sessions, experiences] = await Promise.all([
      listSessionsLocal({ tenant_id, user_id, status }),
      listExperiencesLocal({ tenant_id, creator_id: user_id, status, category }),
    ]);

    return NextResponse.json({
      success: true,
      sessions,
      experiences,
      totals: {
        sessions: sessions.length,
        experiences: experiences.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to load local composer DB" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const id = searchParams.get("id");

    if (type === "all") {
      // Clear in-memory store and local JSON file
      clearComposerStore();
      const localDir = path.join(process.cwd(), "apps", "metame", ".local");
      const localPath = path.join(localDir, "composer-db.json");
      try {
        await fs.unlink(localPath);
      } catch {
        // ignore if missing
      }
      return NextResponse.json({ success: true, deleted: true });
    }

    if (!type || !id) {
      return NextResponse.json(
        { success: false, error: "type and id are required" },
        { status: 400 }
      );
    }

    if (type === "session") {
      const deleted = await deleteSessionLocal(id);
      return NextResponse.json({ success: deleted, deleted });
    }

    if (type === "experience") {
      const deleted = await deleteExperienceLocal(id);
      return NextResponse.json({ success: deleted, deleted });
    }

    return NextResponse.json(
      { success: false, error: "type must be session or experience" },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to delete local record" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { DEMO_CONTENTS } from "../../../../services/content/demoRegistry";

export async function GET() {
  return NextResponse.json({ success: true, data: DEMO_CONTENTS });
}

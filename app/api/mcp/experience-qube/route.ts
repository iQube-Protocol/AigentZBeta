import { NextRequest, NextResponse } from 'next/server';
import {
  type ExperienceMcpRequest,
  runExperienceQubeTool,
} from '@/services/mcp/experienceQubeTools';

export const runtime = 'nodejs';

const SUPPORTED_TOOLS = new Set([
  'pill.get',
  'capsule.get',
  'mini_runtime.get',
  'codex.entry',
  'invite.create',
  'share.compose',
  'next.best',
]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tool = String(body?.tool || '').trim();

    if (!tool || !SUPPORTED_TOOLS.has(tool)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unsupported MCP tool for ExperienceQube app.',
          supportedTools: Array.from(SUPPORTED_TOOLS),
        },
        { status: 400 }
      );
    }

    const response = runExperienceQubeTool({
      tool: tool as ExperienceMcpRequest['tool'],
      input: body?.input && typeof body.input === 'object' ? body.input : {},
      tenantId: typeof body?.tenantId === 'string' ? body.tenantId : undefined,
      personaId: typeof body?.personaId === 'string' ? body.personaId : undefined,
    });

    return NextResponse.json({ success: true, response });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to execute ExperienceQube MCP tool.',
      },
      { status: 500 }
    );
  }
}

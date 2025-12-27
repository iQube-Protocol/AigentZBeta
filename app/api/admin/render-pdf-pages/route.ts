import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import path from 'node:path';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { limit = 3 } = await req.json();
    const scriptPath = path.join(process.cwd(), 'scripts', 'render-pdf-pages.mjs');
    
    const result = await new Promise<string>((resolve, reject) => {
      const proc = spawn('node', [scriptPath], {
        env: { ...process.env, LIMIT: String(limit) },
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let output = '';
      proc.stdout.on('data', d => output += d.toString());
      proc.stderr.on('data', d => output += d.toString());
      
      proc.on('close', code => {
        if (code === 0) resolve(output);
        else reject(new Error(`Script failed: ${output}`));
      });
      
      setTimeout(() => {
        proc.kill();
        reject(new Error('Timeout after 4 minutes'));
      }, 240000);
    });
    
    return NextResponse.json({ success: true, output: result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

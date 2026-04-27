export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

function send(res: WritableStreamDefaultWriter<Uint8Array>, data: any) {
  const enc = new TextEncoder();
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  return res.write(enc.encode(payload));
}

export async function GET() {
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  // Initial event
  await writer.write(encoder.encode('event: hello\n'));
  await writer.write(encoder.encode('data: {"ok":true,"msg":"connected"}\n\n'));

  const interval = setInterval(() => {
    const evt = { t: Date.now(), type: 'heartbeat' };
    writer.write(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
  }, 10000);

  const close = () => {
    clearInterval(interval);
    writer.close();
  };

  // Return SSE response
  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

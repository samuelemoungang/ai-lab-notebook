/**
 * POST /api/lmstudio
 *
 * Proxy server-side verso LM Studio.
 * Il browser non chiama mai direttamente LM Studio (niente CORS, niente errori
 * di rete dal client). Tutto passa da questo endpoint Next.js.
 */

export const runtime = 'nodejs'

export async function POST(req: Request): Promise<Response> {
  const lmstudioUrl = process.env.NEXT_PUBLIC_LMSTUDIO_URL?.trim()

  if (!lmstudioUrl) {
    return Response.json(
      { error: 'NEXT_PUBLIC_LMSTUDIO_URL non configurato nel file .env.local' },
      { status: 503 }
    )
  }

  const body = await req.json()

  let upstream: Response
  try {
    upstream = await fetch(`${lmstudioUrl}/v1/chat/completions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(120_000),  // 2 min max
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return Response.json(
      { error: `LM Studio non raggiungibile (${lmstudioUrl}): ${msg}` },
      { status: 502 }
    )
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => '')
    return Response.json(
      { error: `LM Studio ha risposto con ${upstream.status}: ${text}` },
      { status: upstream.status }
    )
  }

  // Passa lo stream SSE direttamente al browser
  return new Response(upstream.body, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  })
}

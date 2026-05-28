/**
 * GET /api/lmstudio-health
 *
 * Proxied server-side health check for LM Studio running on the user's home PC.
 * Returns:
 *   { status: 'online' | 'no_model' | 'offline' | 'not_configured', models: string[], latencyMs: number }
 *
 * Why server-side?
 *   - Avoids CORS issues if the browser and LM Studio are on different network segments
 *   - Hides the private IP from the public bundle
 */

export const runtime = 'nodejs'

export interface HealthResponse {
  status:    'online' | 'no_model' | 'offline' | 'not_configured' | 'error'
  models:    string[]
  latencyMs: number
}

export async function GET(): Promise<Response> {
  const url = process.env.NEXT_PUBLIC_LMSTUDIO_URL?.trim()

  if (!url) {
    return Response.json({ status: 'not_configured', models: [], latencyMs: 0 } satisfies HealthResponse)
  }

  const start = Date.now()

  try {
    const res = await fetch(`${url}/v1/models`, {
      signal:  AbortSignal.timeout(4000),   // 4 s timeout — PC might be slow to wake
      cache:   'no-store',
      headers: { Accept: 'application/json' },
    })

    const latencyMs = Date.now() - start

    if (!res.ok) {
      return Response.json({ status: 'error', models: [], latencyMs } satisfies HealthResponse)
    }

    const data = await res.json()
    const models: string[] = (data.data ?? []).map((m: { id: string }) => m.id)

    return Response.json({
      status:    models.length > 0 ? 'online' : 'no_model',
      models,
      latencyMs,
    } satisfies HealthResponse)

  } catch {
    return Response.json({
      status:    'offline',
      models:    [],
      latencyMs: Date.now() - start,
    } satisfies HealthResponse)
  }
}

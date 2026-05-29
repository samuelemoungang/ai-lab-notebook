export const runtime = 'nodejs'

export async function GET(): Promise<Response> {
  const url   = process.env.NEXT_PUBLIC_JUPYTER_URL?.trim()
  const token = process.env.NEXT_PUBLIC_JUPYTER_TOKEN?.trim() ?? ''

  if (!url) return Response.json({ ok: false, kernels: 0 })

  try {
    const res = await fetch(`${url}/api/kernels`, {
      headers: token ? { Authorization: `token ${token}` } : {},
      signal:  AbortSignal.timeout(4000),
      cache:   'no-store',
    })
    if (!res.ok) return Response.json({ ok: false, kernels: 0 })
    const kernels = await res.json() as unknown[]
    return Response.json({ ok: true, kernels: kernels.length })
  } catch {
    return Response.json({ ok: false, kernels: 0 })
  }
}

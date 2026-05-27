import type { AIMessage } from '@/types/notebook'

export type AIProvider = 'claude' | 'ollama'

export interface AIConfig {
  provider:    AIProvider
  ollamaUrl?:  string
  ollamaModel?: string
}

export function getDefaultConfig(): AIConfig {
  const ollamaUrl = process.env.NEXT_PUBLIC_OLLAMA_URL
  return {
    provider:    ollamaUrl ? 'ollama' : 'claude',
    ollamaUrl,
    ollamaModel: process.env.NEXT_PUBLIC_OLLAMA_MODEL ?? 'qwen2.5-coder:14b',
  }
}

/** Stream AI response. Yields text chunks as they arrive. */
export async function* streamAI(
  messages: AIMessage[],
  systemPrompt: string,
  config?: Partial<AIConfig>
): AsyncGenerator<string> {
  const cfg = { ...getDefaultConfig(), ...config }

  if (cfg.provider === 'ollama' && cfg.ollamaUrl) {
    yield* streamOllama(messages, systemPrompt, cfg.ollamaUrl, cfg.ollamaModel!)
  } else {
    yield* streamClaude(messages, systemPrompt)
  }
}

// ── Claude (via /api/ai proxy) ────────────────────────────────────────────────
async function* streamClaude(
  messages: AIMessage[],
  systemPrompt: string
): AsyncGenerator<string> {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, systemPrompt }),
  })

  if (!res.ok) throw new Error(`AI API error: ${res.statusText}`)
  if (!res.body) throw new Error('No response body')

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    // Server sends `data: <text>\n\n` (SSE-style)
    for (const line of chunk.split('\n')) {
      if (line.startsWith('data: ')) {
        const text = line.slice(6)
        if (text && text !== '[DONE]') yield text
      }
    }
  }
}

// ── Ollama (local Qwen) ───────────────────────────────────────────────────────
async function* streamOllama(
  messages: AIMessage[],
  systemPrompt: string,
  baseUrl: string,
  model: string
): AsyncGenerator<string> {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
  })

  if (!res.ok || !res.body) throw new Error(`Ollama error: ${res.statusText}`)

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let   buffer  = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const json = JSON.parse(line)
        if (json.message?.content) yield json.message.content
      } catch {
        // ignore malformed chunks
      }
    }
  }
}

// ── System prompt factory ─────────────────────────────────────────────────────
export function buildSystemPrompt(context?: {
  dataColumns?: string[]
  recentOutput?: string
}): string {
  return `You are an AI assistant embedded in a scientific data analysis notebook.
You help with:
1. Data cleaning and filtering (pandas, numpy)
2. Numerical methods and statistical analysis
3. Mathematical modelling with clear explanations
4. Interpreting results and plots

${context?.dataColumns ? `Current dataset columns: ${context.dataColumns.join(', ')}` : ''}
${context?.recentOutput ? `Recent cell output:\n${context.recentOutput.slice(0, 500)}` : ''}

Rules:
- Always write Python code that works inside the shared notebook namespace
- Available libraries: pandas, numpy, scipy, matplotlib (pre-installed)
- For plots: use matplotlib (figures are captured automatically)
  OR set __fig__ = plotly_figure for interactive Plotly charts
- When suggesting a mathematical model, ALWAYS explain:
  • What it models and its assumptions
  • Each parameter and its physical meaning
  • Whether it is appropriate for the user's data
- Be concise. Use markdown for formatting.
- If uncertain, say so.`
}

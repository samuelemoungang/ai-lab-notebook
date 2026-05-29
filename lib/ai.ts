import type { AIMessage } from '@/types/notebook'

export type AIProvider = 'lmstudio' | 'ollama'

export interface AIConfig {
  provider:       AIProvider
  lmstudioUrl?:   string
  lmstudioModel?: string
  ollamaUrl?:     string
  ollamaModel?:   string
}

export function getDefaultConfig(): AIConfig {
  const lmstudioUrl = process.env.NEXT_PUBLIC_LMSTUDIO_URL
  const ollamaUrl   = process.env.NEXT_PUBLIC_OLLAMA_URL

  // Priority: LM Studio → Ollama
  if (lmstudioUrl) {
    return {
      provider:       'lmstudio',
      lmstudioUrl,
      lmstudioModel:  process.env.NEXT_PUBLIC_LMSTUDIO_MODEL ?? 'qwen2.5-7b-instruct',
    }
  }
  return {
    provider:    'ollama',
    ollamaUrl:   ollamaUrl ?? '',
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

  if (cfg.provider === 'lmstudio' && cfg.lmstudioUrl) {
    yield* streamLMStudio(messages, systemPrompt, cfg.lmstudioUrl, cfg.lmstudioModel!)
  } else if (cfg.provider === 'ollama' && cfg.ollamaUrl) {
    yield* streamOllama(messages, systemPrompt, cfg.ollamaUrl, cfg.ollamaModel!)
  } else {
    throw new Error('Nessun provider AI configurato. Imposta NEXT_PUBLIC_LMSTUDIO_URL nel file .env.local')
  }
}

// ── LM Studio — via proxy Next.js /api/lmstudio (evita CORS) ─────────────────
async function* streamLMStudio(
  messages: AIMessage[],
  systemPrompt: string,
  _baseUrl: string,
  model: string
): AsyncGenerator<string> {
  const res = await fetch('/api/lmstudio', {
    method:  'POST',
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

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? `Errore ${res.status}`)
  }
  if (!res.body) throw new Error('Nessuna risposta dal proxy')

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
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') return
      try {
        const json    = JSON.parse(data)
        const content = json.choices?.[0]?.delta?.content
        if (content) yield content
      } catch {
        // ignore malformed SSE chunks
      }
    }
  }
}

// ── Ollama (fallback) ─────────────────────────────────────────────────────────
async function* streamOllama(
  messages: AIMessage[],
  systemPrompt: string,
  baseUrl: string,
  model: string
): AsyncGenerator<string> {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method:  'POST',
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
  return `You are an AI assistant embedded in an interactive scientific notebook called AI Lab Notebook.

## Your environment
This is NOT Jupyter. It is a custom web notebook where:
- The user writes and runs Python cells directly in the browser (via Pyodide)
- You are an AI cell: you chat with the user and suggest code
- When you write a Python code block, a button "Insert as code cell" appears below your reply — the user clicks it to add your code as a runnable cell
- You do NOT run code yourself; you only suggest it
- All Python cells share the same namespace (variables persist across cells)

## Your expertise
You help with:
1. Data loading and cleaning (pandas, numpy)
2. Numerical methods, curve fitting, ODE solving (scipy)
3. Statistical analysis and visualisation (matplotlib, plotly)
4. Mathematical modelling — Luedeking-Piret, logistic growth, Gompertz, etc.
5. Interpreting outputs, errors and plots

${context?.dataColumns ? `## Loaded dataset\nColumns: ${context.dataColumns.join(', ')}` : ''}
${context?.recentOutput ? `## Last cell output\n\`\`\`\n${context.recentOutput.slice(0, 500)}\n\`\`\`` : ''}

## Rules
- **Always reply in English**, regardless of the language the user writes in
- When writing Python, always use fenced code blocks: \`\`\`python ... \`\`\`
- Code must work inside the shared Pyodide namespace; do not use pip install or file I/O
- If running on Jupyter kernel (remote PC): ALL pip packages are available — torch, opencv, transformers, polars, plotly, etc. Use regular imports directly.
- If running on Pyodide (browser): pre-loaded packages are pandas, numpy, scipy, matplotlib, scikit-learn, statsmodels, sympy, seaborn. For others use: import micropip; await micropip.install('pkg')
- **Pyodide networking:** urllib, requests and http.client do NOT work in the browser sandbox. To load a remote CSV use: from pyodide.http import open_url then pd.read_csv(open_url("https://...")). For binary files use pyfetch: from pyodide.http import pyfetch; r = await pyfetch(url); data = await r.bytes().
- For plots: use matplotlib (auto-captured) OR assign \`__fig__ = fig\` for interactive Plotly
- When suggesting a model, briefly explain: what it models, its parameters, when to use it
- Be concise and direct. Use markdown for formatting.
- If you are unsure, say so clearly.`
}

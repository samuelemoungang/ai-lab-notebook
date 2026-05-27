'use client'

import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Bot, Send, Trash2, PlusCircle } from 'lucide-react'
import type { Cell, AIMessage } from '@/types/notebook'
import { streamAI, buildSystemPrompt } from '@/lib/ai'

interface Props {
  cell:         Cell
  onChange:     (id: string, content: string) => void
  onDelete:     (id: string) => void
  onInsertCode: (code: string) => void  // adds a code cell with AI suggestion
}

export default function AICell({ cell, onChange, onDelete, onInsertCode }: Props) {
  const [messages,  setMessages]  = useState<AIMessage[]>(() => {
    try { return JSON.parse(cell.metadata.messages as string ?? '[]') } catch { return [] }
  })
  const [input,     setInput]     = useState(cell.content)
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    if (!input.trim() || streaming) return
    const userMsg: AIMessage = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    onChange(cell.id, '')
    setStreaming(true)

    let reply = ''
    const assistantMsg: AIMessage = { role: 'assistant', content: '' }
    setMessages([...newMessages, assistantMsg])

    try {
      const stream = streamAI(newMessages, buildSystemPrompt())
      for await (const chunk of stream) {
        reply += chunk
        setMessages([...newMessages, { role: 'assistant', content: reply }])
      }
    } catch (e) {
      reply = `⚠️ Error: ${e instanceof Error ? e.message : 'Unknown error'}`
      setMessages([...newMessages, { role: 'assistant', content: reply }])
    }
    setStreaming(false)
  }

  /** Extract first fenced Python code block from a message */
  function extractCode(text: string): string | null {
    const m = text.match(/```python\n([\s\S]*?)```/)
    return m ? m[1].trim() : null
  }

  return (
    <div className="rounded-lg border border-notebook-border bg-notebook-cell cell-border-ai overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-notebook-border bg-notebook-bg/40">
        <Bot size={14} className="text-accent-ai" />
        <span className="text-xs px-1.5 py-0.5 rounded bg-accent-ai/20 text-accent-ai">
          AI Assistant
        </span>
        <button
          onClick={() => onDelete(cell.id)}
          className="ml-auto p-1 rounded text-notebook-muted hover:text-red-400"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Conversation */}
      <div className="max-h-96 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-xs text-notebook-muted italic">
            Ask anything: &ldquo;How do I clean this CSV?&rdquo; &nbsp;·&nbsp;
            &ldquo;Which model fits my pH data?&rdquo; &nbsp;·&nbsp;
            &ldquo;Explain Luedeking-Piret in simple words&rdquo;
          </p>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div className={`
              max-w-[88%] rounded-lg px-3 py-2 text-sm
              ${msg.role === 'user'
                ? 'bg-accent-ai/20 text-notebook-text'
                : 'bg-notebook-bg text-notebook-text border border-notebook-border'
              }
            `}>
              <div className="prose-notebook">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              </div>
              {/* Insert code button */}
              {msg.role === 'assistant' && extractCode(msg.content) && (
                <button
                  onClick={() => onInsertCode(extractCode(msg.content)!)}
                  className="mt-2 flex items-center gap-1 text-xs text-accent-code hover:underline"
                >
                  <PlusCircle size={11} /> Insert as code cell
                </button>
              )}
            </div>
          </div>
        ))}

        {streaming && messages[messages.length - 1]?.role === 'assistant' && (
          <span className="text-xs text-notebook-muted animate-pulse ml-2">▊</span>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-notebook-border p-3 flex gap-2">
        <textarea
          value={input}
          onChange={e => { setInput(e.target.value); onChange(cell.id, e.target.value) }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Ask AI… (Enter to send, Shift+Enter for new line)"
          rows={2}
          className="
            flex-1 bg-notebook-bg border border-notebook-border rounded px-3 py-2
            text-sm text-notebook-text placeholder:text-notebook-muted
            resize-none focus:outline-none focus:border-accent-ai/60
          "
        />
        <button
          onClick={send}
          disabled={!input.trim() || streaming}
          className="
            px-3 py-2 rounded bg-accent-ai/20 text-accent-ai
            hover:bg-accent-ai/30 disabled:opacity-40 transition-colors
          "
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  )
}

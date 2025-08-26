'use client'

import React, { useRef, useEffect, useState } from 'react'
import { Send, Loader2, User, Bot } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
}

export default function RAGChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const initialMessages: Message[] = [
      { id: 'initial-1', content: 'Welcome to the Math 1000A tutor. Ask a question or paste a problem.', role: 'assistant' },
    ]
    setMessages(initialMessages)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = { id: `${Date.now()}`, content: input.trim(), role: 'user' }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      const assistantMessage: Message = {
        id: `${Date.now()}-assistant`,
        content: data.content || 'Sorry, I could not generate a response.',
        role: 'assistant',
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch (err) {
      const errorMessage: Message = {
        id: `${Date.now()}-error`,
        content: 'There was an error. Please try again.',
        role: 'assistant',
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const normalizeMath = (text: string) => {
    let t = text
    t = t.replace(/\\\[([\s\S]*?)\\\]/g, (_m, expr) => `$$${expr}$$`)
    t = t.replace(/\\\(([^\)]*?)\\\)/g, (_m, expr) => `$${expr}$`)
    t = t.replace(/(^|\n)\s*\[\s*([^\]]+?)\s*\](?=\s*($|\n))/g, (_m, p1, expr) => `${p1}$$${expr}$$`)
    return t
  }

  const normalizeLists = (text: string) => {
    const lines = text.split(/\n/)
    const out: string[] = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const subpart = /^\s*(?:\(([a-zA-Z0-9]+)\)|([a-zA-Z0-9]+)[\.)])\s+/.exec(line)
      if (subpart) {
        if (!/^\s*[-*+]\s+/.test(line) && !/^\s*\d+\./.test(line)) {
          out.push(line.replace(/^\s*/, '- '))
          continue
        }
      }
      out.push(line)
    }
    return out.join('\n')
  }

  const prettify = (text: string) => normalizeLists(normalizeMath(text))

  return (
    <div className="flex h-[60vh] flex-col rounded-xl bg-gray-50 shadow-inner">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((m) => (
          <div key={m.id} className={`mb-4 flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex max-w-[80%] items-start rounded-2xl px-4 py-3 ${m.role === 'user' ? 'bg-blue-500 text-white' : 'bg-white text-gray-800 shadow'}`}>
              {m.role === 'user' ? (
                <User className="mr-2 h-5 w-5 shrink-0 mt-1" />
              ) : (
                <Bot className="mr-2 h-5 w-5 shrink-0 mt-1" />
              )}
              <div className={`${m.role === 'user' ? 'prose-invert' : ''} prose prose-sm max-w-none [&_.katex-display]:my-3 [&_.katex-display]:text-center`}>
                {m.role === 'user' ? (
                  <>{m.content}</>
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {prettify(m.content)}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start items-center mb-4">
            <div className="flex items-center rounded-full bg-white px-4 py-2 text-gray-800 shadow">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              AI is thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-gray-200 bg-white p-4">
        <div className="flex rounded-full bg-gray-100 shadow-inner">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about Math 1000A..."
            disabled={isLoading}
            className="flex-1 rounded-l-full bg-transparent px-6 py-3 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={`flex items-center rounded-r-full px-6 py-3 font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 ${input.trim() && !isLoading ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-400 cursor-not-allowed'}`}
          >
            <Send className="mr-2 h-5 w-5" />
            <span className="sr-only">Send message</span>
            <span aria-hidden="true">Send</span>
          </button>
        </div>
      </form>
    </div>
  )
}



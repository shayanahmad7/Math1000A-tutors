'use client'

import React, { useRef, useEffect, useState } from 'react'
import { Send, Loader2, User, Bot, Mic, MicOff, Volume2, VolumeX } from 'lucide-react'
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
  const [threadId, setThreadId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Speech-to-text states
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessingAudio, setIsProcessingAudio] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Text-to-speech states
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [currentlySpeakingId, setIsCurrentlySpeakingId] = useState<string | null>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const initialMessages: Message[] = [
      {
        id: 'initial-1',
        content: "Your conversation with this tutor is being recorded. Data collected will not be published but will be analyzed to enhance the user experience in the future.",
        role: 'assistant'
      },
      {
        id: 'initial-2',
        content: "What's on your mind?",
        role: 'assistant'
      }
    ]
    setMessages(initialMessages)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Speech-to-text functionality
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }
      
      mediaRecorder.onstop = async () => {
        setIsProcessingAudio(true)
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
          const formData = new FormData()
          formData.append('audio', audioBlob)
          
          const response = await fetch('/api/speech-to-text', {
            method: 'POST',
            body: audioBlob
          })
          
          if (response.ok) {
            const data = await response.json()
            if (data.success) {
              setInput(data.text)
            }
          }
        } catch (error) {
          console.error('Error processing audio:', error)
        } finally {
          setIsProcessingAudio(false)
        }
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
      }
      
      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Error starting recording:', error)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const handleRecording = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  // Text-to-speech functionality
  const speakText = async (text: string, messageId: string) => {
    if (isSpeaking && currentlySpeakingId === messageId) {
      // Stop current speech
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current = null
      }
      setIsSpeaking(false)
      setIsCurrentlySpeakingId(null)
      return
    }

    try {
      setIsSpeaking(true)
      setIsCurrentlySpeakingId(messageId)

      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: text, voice: 'nova' })
      })

      if (response.ok) {
        const audioBlob = await response.blob()
        const audioUrl = URL.createObjectURL(audioBlob)
        const audio = new Audio(audioUrl)
        
        currentAudioRef.current = audio
        
        audio.onended = () => {
          setIsSpeaking(false)
          setIsCurrentlySpeakingId(null)
          currentAudioRef.current = null
        }
        
        audio.play()
      }
    } catch (error) {
      console.error('Error with text-to-speech:', error)
      setIsSpeaking(false)
      setIsCurrentlySpeakingId(null)
    }
  }

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
          body: JSON.stringify({ 
            messages: [...messages, userMessage],
            threadId 
          }),
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        
        // Update threadId if we get one back
        if (data.threadId && !threadId) {
          setThreadId(data.threadId)
        }
        
        const assistantMessage: Message = {
          id: `${Date.now()}-assistant`,
          content: data.content || 'Sorry, I could not generate a response.',
          role: 'assistant',
        }
        setMessages(prev => [...prev, assistantMessage])
      } catch {
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

  const renderMessage = (content: string) => {
    const normalizeMath = (text: string) => {
      let t = text;
      t = t.replace(/\\\[([\s\S]*?)\\\]/g, (_m, expr) => `$$${expr}$$`);
      t = t.replace(/\\\(([^\)]*?)\\\)/g, (_m, expr) => `$${expr}$`);
      t = t.replace(/(^|\n)\s*\[\s*([^\]]+?)\s*\](?=\s*($|\n))/g, (_m, p1, expr) => `${p1}$$${expr}$$`);
      return t;
    };
    const normalizeLists = (text: string) => {
      const lines = text.split(/\n/);
      const out: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const subpart = /^\s*(?:\(([a-zA-Z0-9]+)\)|([a-zA-Z0-9]+)[\.)])\s+/.exec(line);
        if (subpart) {
          if (!/^\s*[-*+]\s+/.test(line) && !/^\s*\d+\./.test(line)) {
            out.push(line.replace(/^\s*/, '- '));
            continue;
          }
        }
        out.push(line);
      }
      return out.join('\n');
    };
    const prettify = (text: string) => normalizeLists(normalizeMath(text));
    return (
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        className="prose prose-sm dark:prose-invert max-w-none"
        components={{
          h1: ({ ...props }) => (
            <h1 className="text-2xl font-bold my-4 text-center" {...props} />
          ),
          h2: ({ ...props }) => (
            <h2 className="text-xl font-bold my-3 text-center" {...props} />
          ),
          h3: ({ ...props }) => (
            <h3 className="text-lg font-bold my-3" {...props} />
          ),
          p: ({ ...props }) => (
            <p className="my-2" {...props} />
          ),
          ul: ({ ...props }) => (
            <ul className="my-2 space-y-1 list-disc pl-6" {...props} />
          ),
          ol: ({ ...props }) => (
            <ol className="my-2 space-y-1 list-decimal pl-6" {...props} />
          ),
          li: ({ ...props }) => (
            <li className="leading-normal" {...props} />
          ),
          blockquote: ({ ...props }) => (
            <blockquote className="border-l-4 border-gray-300 pl-4 my-2" {...props} />
          )
        }}
      >
        {prettify(content)}
      </ReactMarkdown>
    )
  }

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
                                   <div 
                       className={`${m.role === 'user' ? 'prose-invert' : ''} 
                         prose-headings:text-inherit prose-p:text-inherit
                         prose-strong:text-inherit prose-ol:text-inherit prose-ul:text-inherit
                         [&_.katex-display]:my-3 [&_.katex-display]:text-center
                       `}
                     >
                       {m.role === 'user' ? <>{m.content}</> : renderMessage(m.content)}
                     </div>
                     
                     {/* Text-to-speech button for assistant messages */}
                     {m.role === 'assistant' && (
                       <button
                         onClick={() => speakText(m.content, m.id)}
                         className={`ml-2 p-2 rounded-full transition-colors ${
                           currentlySpeakingId === m.id
                             ? 'bg-red-100 text-red-600 hover:bg-red-200'
                             : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                         }`}
                         title={currentlySpeakingId === m.id ? 'Stop speaking' : 'Listen to this message'}
                       >
                         {currentlySpeakingId === m.id ? (
                           <VolumeX className="h-4 w-4" />
                         ) : (
                           <Volume2 className="h-4 w-4" />
                         )}
                       </button>
                     )}
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
          {/* Mic button for speech-to-text */}
          <button
            type="button"
            onClick={handleRecording}
            title={isRecording ? 'Stop recording' : 'Record your message'}
            className={`p-3 rounded-l-full focus:outline-none transition-colors ${
              isRecording
                ? 'animate-pulse ring-2 ring-red-500 bg-red-100 text-red-600'
                : isProcessingAudio
                ? 'bg-yellow-100 text-yellow-600 cursor-wait'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
            }`}
            disabled={isProcessingAudio || isLoading}
          >
            {isProcessingAudio ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isRecording ? (
              <Mic className="h-5 w-5" />
            ) : (
              <MicOff className="h-5 w-5" />
            )}
          </button>

          {/* Text input field */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about real numbers..."
            disabled={isLoading}
            className="flex-1 bg-transparent px-6 py-3 focus:outline-none"
          />

          {/* Send button */}
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={`flex items-center rounded-r-full px-6 py-3 font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 ${
              input.trim() && !isLoading ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-400 cursor-not-allowed'
            }`}
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




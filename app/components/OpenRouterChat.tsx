'use client'

import React, { useRef, useEffect, useState } from 'react'
import { Send, Loader2, User, Bot, Mic, MicOff, Volume2, VolumeX, ChevronDown, Paperclip, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

// Latest models on OpenRouter (expanded with newest models)
const AVAILABLE_MODELS = {
  openai: [
    { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
    { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI' },
    { id: 'openai/gpt-4o-2024-08-06', name: 'GPT-4o (Aug 2024)', provider: 'OpenAI' },
    { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI' }
  ],
  anthropic: [
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
    { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku', provider: 'Anthropic' },
    { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic' },
    { id: 'anthropic/claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'Anthropic' },
    { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', provider: 'Anthropic' },
    { id: 'anthropic/claude-2.1', name: 'Claude 2.1', provider: 'Anthropic' }
  ],
  google: [
    { id: 'google/gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', provider: 'Google' },
    { id: 'google/gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google' },
    { id: 'google/gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'Google' },
    { id: 'google/gemini-1.5-pro-002', name: 'Gemini 1.5 Pro (Latest)', provider: 'Google' },
    { id: 'google/gemini-1.0-pro', name: 'Gemini 1.0 Pro', provider: 'Google' }
  ],
  meta: [
    { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B', provider: 'Meta' },
    { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', provider: 'Meta' },
    { id: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', provider: 'Meta' },
    { id: 'meta-llama/llama-3.2-90b-vision-instruct', name: 'Llama 3.2 90B Vision', provider: 'Meta' },
    { id: 'meta-llama/llama-3.2-11b-vision-instruct', name: 'Llama 3.2 11B Vision', provider: 'Meta' },
    { id: 'meta-llama/llama-3.2-3b-instruct', name: 'Llama 3.2 3B', provider: 'Meta' }
  ],
  mistral: [
    { id: 'mistralai/mistral-large', name: 'Mistral Large', provider: 'Mistral' },
    { id: 'mistralai/mixtral-8x7b-instruct', name: 'Mixtral 8x7B', provider: 'Mistral' },
    { id: 'mistralai/mixtral-8x22b-instruct', name: 'Mixtral 8x22B', provider: 'Mistral' },
    { id: 'mistralai/mistral-7b-instruct', name: 'Mistral 7B', provider: 'Mistral' },
    { id: 'mistralai/mistral-nemo', name: 'Mistral Nemo', provider: 'Mistral' }
  ],
  microsoft: [
    { id: 'microsoft/phi-4-multimodal-instruct', name: 'Phi-4 Multimodal Instruct', provider: 'Microsoft' },
    { id: 'microsoft/phi-4-mini-instruct', name: 'Phi-4 Mini', provider: 'Microsoft' },
    { id: 'microsoft/phi-4-mini-vision-instruct', name: 'Phi-4 Mini Vision', provider: 'Microsoft' },
    { id: 'microsoft/phi-3-medium-128k-instruct', name: 'Phi-3 Medium', provider: 'Microsoft' },
    { id: 'microsoft/phi-3-mini-128k-instruct', name: 'Phi-3 Mini', provider: 'Microsoft' },
    { id: 'microsoft/phi-3.5-mini-instruct', name: 'Phi-3.5 Mini', provider: 'Microsoft' }
  ],
  gemma: [
    { id: 'google/gemma-3-27b-it', name: 'Gemma 3 27B', provider: 'Google' },
    { id: 'google/gemma-3-9b-it', name: 'Gemma 3 9B', provider: 'Google' },
    { id: 'google/gemma-2-27b-it', name: 'Gemma 2 27B', provider: 'Google' },
    { id: 'google/gemma-2-9b-it', name: 'Gemma 2 9B', provider: 'Google' },
    { id: 'google/gemma-2-2b-it', name: 'Gemma 2 2B', provider: 'Google' }
  ],
  deepseek: [
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', provider: 'DeepSeek' },
    { id: 'deepseek/deepseek-coder', name: 'DeepSeek Coder', provider: 'DeepSeek' },
    { id: 'deepseek/deepseek-math', name: 'DeepSeek Math', provider: 'DeepSeek' }
  ],
  cohere: [
    { id: 'cohere/command-r-plus', name: 'Command R+', provider: 'Cohere' },
    { id: 'cohere/command-r', name: 'Command R', provider: 'Cohere' },
    { id: 'cohere/command-light', name: 'Command Light', provider: 'Cohere' }
  ],
  qwen: [
    { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', provider: 'Qwen' },
    { id: 'qwen/qwen-2.5-32b-instruct', name: 'Qwen 2.5 32B', provider: 'Qwen' },
    { id: 'qwen/qwen-2.5-14b-instruct', name: 'Qwen 2.5 14B', provider: 'Qwen' },
    { id: 'qwen/qwen-2.5-7b-instruct', name: 'Qwen 2.5 7B', provider: 'Qwen' }
  ]
}

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
}

interface FileAttachment {
  name: string;
  data: string;
  type: string;
  size: number;
}

interface ImageAttachment {
  name: string;
  data: string;
  type: string;
  size: number;
}

export default function OpenRouterChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Model selection state
  const [selectedModel, setSelectedModel] = useState('openai/gpt-4o')
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)

  // File upload state
  const [attachedFiles, setAttachedFiles] = useState<FileAttachment[]>([])
  const [attachedImages, setAttachedImages] = useState<ImageAttachment[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isDragOverChat, setIsDragOverChat] = useState(false)

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
        content: "Welcome to the OpenRouter AI Chat! You can chat with 400+ AI models from various providers. Choose your preferred model from the dropdown above and start chatting.",
        role: 'assistant'
      },
      {
        id: 'initial-2',
        content: "You can upload PDF files by clicking the paperclip icon, dragging and dropping them into the chat area, or pasting them directly. What would you like to explore?",
        role: 'assistant'
      }
    ]
    setMessages(initialMessages)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // File upload handling
  const handleFileUpload = async (files: FileList) => {
    const newFiles: FileAttachment[] = []
    const newImages: ImageAttachment[] = []
    
    for (const file of Array.from(files)) {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          resolve(result)
        }
        reader.readAsDataURL(file)
      })
      
      if (file.type === 'application/pdf') {
        newFiles.push({
          name: file.name,
          data: base64,
          type: file.type,
          size: file.size
        })
      } else if (file.type.startsWith('image/')) {
        newImages.push({
          name: file.name,
          data: base64,
          type: file.type,
          size: file.size
        })
      }
    }
    
    if (newFiles.length > 0) {
      setAttachedFiles(prev => [...prev, ...newFiles])
    }
    if (newImages.length > 0) {
      setAttachedImages(prev => [...prev, ...newImages])
    }
  }

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOverChat(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOverChat(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOverChat(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileUpload(files)
    }
  }

  // Paste handler
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    const files: File[] = []
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.kind === 'file' && (item.type === 'application/pdf' || item.type.startsWith('image/'))) {
        const file = item.getAsFile()
        if (file) files.push(file)
      }
    }
    
    if (files.length > 0) {
      const fileList = new DataTransfer()
      files.forEach(file => fileList.items.add(file))
      handleFileUpload(fileList.files)
    }
  }

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const removeImage = (index: number) => {
    setAttachedImages(prev => prev.filter((_, i) => i !== index))
  }

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
      alert('Error starting recording. Please check microphone permissions.')
    }
  }

  const handleRecording = () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop()
      setIsRecording(false)
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: text,
          voice: 'alloy',
          model: 'tts-1',
        }),
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
          URL.revokeObjectURL(audioUrl)
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
    if (!input.trim() && attachedFiles.length === 0 && attachedImages.length === 0) return

    setIsLoading(true)

    try {
      const userMessage: Message = {
        id: Date.now().toString(),
        content: input.trim(),
        role: 'user',
      }

      setMessages(prev => [...prev, userMessage])
      setInput('')

      // Create assistant message for streaming
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: '',
        role: 'assistant',
      }
      setMessages(prev => [...prev, assistantMessage])

      const response = await fetch('/api/openrouter-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          selectedModel,
          files: attachedFiles,
          images: attachedImages,
        }),
      })

      if (response.ok) {
        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No response body')
        }

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.content) {
                  setMessages(prev => 
                    prev.map(msg => 
                      msg.id === assistantMessage.id 
                        ? { ...msg, content: msg.content + data.content }
                        : msg
                    )
                  )
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }

        // Clear attached files and images after sending
        setAttachedFiles([])
        setAttachedImages([])
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.details || errorData.error || `HTTP ${response.status}`)
      }
    } catch (error) {
      console.error('Error:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `Error: ${error instanceof Error ? error.message : 'Something went wrong'}`,
        role: 'assistant',
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleModelSelect = (modelId: string) => {
    setSelectedModel(modelId)
    setIsModelDropdownOpen(false)
  }

  const getCurrentModelInfo = () => {
    const allModels = Object.values(AVAILABLE_MODELS).flat()
    return allModels.find(model => model.id === selectedModel) || AVAILABLE_MODELS.openai[0]
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
    <div 
      className={`flex h-[60vh] flex-col rounded-xl bg-gray-50 shadow-inner transition-colors ${
        isDragOverChat ? 'bg-blue-50 border-2 border-dashed border-blue-300' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
      {/* Model Selection Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 rounded-t-xl">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Currently using: <span className="font-medium">{getCurrentModelInfo()?.name}</span>
          </div>
          
          {/* Model Selection Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              className="flex items-center space-x-2 px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <span className="font-medium text-gray-700">
                {getCurrentModelInfo()?.name}
              </span>
              <ChevronDown className="w-3 h-3 text-gray-500" />
            </button>
            
            {isModelDropdownOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-96 overflow-y-auto">
                <div className="p-2">
                  {Object.entries(AVAILABLE_MODELS).map(([provider, models]) => (
                    <div key={provider}>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-3">
                        {provider.charAt(0).toUpperCase() + provider.slice(1)} Models
                      </div>
                      {models.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => handleModelSelect(model.id)}
                          className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 ${
                            selectedModel === model.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                          }`}
                        >
                          <div className="font-medium">{model.name}</div>
                          <div className="text-xs text-gray-500">{model.provider}</div>
                        </button>
                      ))}
                      <div className="border-t border-gray-200 my-2"></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 relative">
        {isDragOverChat && (
          <div className="absolute inset-0 flex items-center justify-center bg-blue-50/90 backdrop-blur-sm z-10 rounded-xl">
            <div className="text-center bg-white p-8 rounded-lg shadow-lg border-2 border-dashed border-blue-300">
              <Paperclip className="h-12 w-12 text-blue-500 mx-auto mb-4" />
              <p className="text-blue-600 font-semibold text-lg">Drop PDF files or images anywhere to upload</p>
              <p className="text-blue-500 text-sm mt-2">You can also paste files with Ctrl+V</p>
            </div>
          </div>
        )}
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

      {/* File attachments display */}
      {(attachedFiles.length > 0 || attachedImages.length > 0) && (
        <div className="px-4 py-2 bg-gray-100 border-t border-gray-200">
          <div className="flex flex-wrap gap-2">
            {attachedFiles.map((file, index) => (
              <div key={`file-${index}`} className="flex items-center bg-white rounded-lg px-3 py-2 text-sm border">
                <Paperclip className="h-4 w-4 mr-2 text-gray-500" />
                <span className="text-gray-700">{file.name}</span>
                <button
                  onClick={() => removeFile(index)}
                  className="ml-2 text-gray-400 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            {attachedImages.map((image, index) => (
              <div key={`image-${index}`} className="flex items-center bg-white rounded-lg px-3 py-2 text-sm border">
                <img src={image.data} alt={image.name} className="h-6 w-6 mr-2 object-cover rounded" />
                <span className="text-gray-700">{image.name}</span>
                <button
                  onClick={() => removeImage(index)}
                  className="ml-2 text-gray-400 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="border-t border-gray-200 bg-white p-4 rounded-b-xl">
        <div className="flex rounded-full bg-gray-100 shadow-inner">
          {/* File upload button */}
          <label className="p-3 rounded-l-full bg-gray-200 hover:bg-gray-300 text-gray-600 cursor-pointer transition-colors">
            <Paperclip className="h-5 w-5" />
            <input
              type="file"
              accept=".pdf,image/*"
              multiple
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
              className="hidden"
            />
          </label>

          {/* Mic button for speech-to-text */}
          <button
            type="button"
            onClick={handleRecording}
            title={isRecording ? 'Stop recording' : 'Record your message'}
            className={`p-3 focus:outline-none transition-colors ${
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
            placeholder="Ask anything to any AI model..."
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

      {/* Hidden audio element for TTS */}
      <audio ref={currentAudioRef} style={{ display: 'none' }} />
    </div>
  )
}

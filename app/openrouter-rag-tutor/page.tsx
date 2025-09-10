import OpenRouterRAGChat from '@/app/components/OpenRouterRAGChat'
import Link from 'next/link'
import { Home } from 'lucide-react'

export default function OpenRouterRAGTutorPage() {
  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-br from-indigo-100 via-white to-purple-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-end">
            <Link href="/" className="flex items-center space-x-2 text-blue-600 hover:text-blue-800">
              <Home className="h-5 w-5" />
              <span>Home</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Chat Interface */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-6xl rounded-2xl bg-white p-6 shadow-2xl">
          <div className="text-center mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">OpenRouter RAG Tutor</h2>
            <p className="text-gray-600">Access 400+ AI models with RAG-powered course material assistance</p>
          </div>

          <OpenRouterRAGChat />
        </div>
      </div>
    </main>
  )
}

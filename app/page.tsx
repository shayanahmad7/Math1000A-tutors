import RAGChat from './components/RAGChat'
import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-100 via-white to-purple-100 p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="text-center mb-4">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">Chapter 1: Real Numbers</h1>
          <p className="text-gray-600 mt-1">Your specialized tutor for mastering real numbers in precalculus</p>
        </div>
        
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4">
          <h3 className="text-lg font-semibold">Multi-Model RAG Tutor</h3>
          <p className="text-sm text-gray-700 mb-3">Choose between OpenAI and Google Gemini models for your tutoring experience. Compare different AI capabilities!</p>
          <Link href="/multi-model-tutor" className="inline-block rounded-full bg-green-600 px-5 py-2 text-white hover:bg-green-700 transition">Open Multi-Model Tutor</Link>
        </div>
        
        <RAGChat />
      </div>
    </main>
  )
}

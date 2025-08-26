import RAGChat from './components/RAGChat'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-100 via-white to-purple-100 p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="text-center mb-4">
          <h1 className="text-2xl md:text-3xl font-bold">Math 1000A Tutor (RAG)</h1>
          <p className="text-gray-600 mt-1">Single chat interface with RAG backend. Add your PDFs and run scripts to enable retrieval.</p>
        </div>
        <RAGChat />
      </div>
    </main>
  )
}

# Math1000A Tutors (RAG)

A minimal Next.js + MongoDB Atlas Vector Search + OpenAI project to test a Math 1000A tutor using Retrieval-Augmented Generation.

## Setup

1. Copy `.env.example` to `.env.local` and fill values:

```
OPENAI_API_KEY=...
MONGODB_URI=...
EMBED_MODEL=text-embedding-3-large
```

2. Install dependencies:

```
npm install
```

3. Create Atlas Vector Search indexes:

```
npm run rag:create-index
```

4. Add your PDF to `public/bookchapters/chapter.pdf` and ingest:

```
npm run rag:ingest
```

5. Start the dev server:

```
npm run dev
```

Open http://localhost:3000 and use the single chat.

## Notes

- Collections used: `resources`, `embeddings`, `chat_threads`, `chat_memory` in database `math1000a_tutors`.
- Index names: `embedding_index` (on `embeddings.embedding`), `chat_memory_index` (on `chat_memory.embedding`).
- The API route is at `app/api/rag/route.ts`.

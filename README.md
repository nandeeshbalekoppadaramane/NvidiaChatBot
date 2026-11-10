# NVIDIA ChatBot

A personal chat web app for NVIDIA NIM models: sign in, pick a model, and chat with history, document context, markdown/code rendering, and export. Built with Next.js (App Router), React, TypeScript, Prisma and PostgreSQL.

## Features

- **Curated multi-model chat** - models are defined in `lib/model-config.ts` with per-model display names, token limits, categories (`chat` / `vision`) and descriptions; vision models enable image upload in the UI. `nvidia-models-list.txt` is a captured reference of the available NVIDIA model IDs, refreshed with `fetch-models.js`.
- **Accounts and history** - email/password auth (NextAuth + bcrypt), per-user chat history, and user settings stored in PostgreSQL via Prisma (`User`, `UserSettings`, `Chat`, `Message`, `Collection`, `DocumentChunk`).
- **Document context (RAG)** - upload PDF (`pdfjs-dist`) or DOCX (`mammoth`) files; parsed text is chunked (`DocumentChunk`) and retrieved with NVIDIA embedding (`nvidia/nv-embedqa-e5-v5`) and reranking (`nvidia/nv-rerankqa-mistral-4b-v3`) models.
- **Rich rendering** - GitHub-flavored markdown with syntax-highlighted code blocks.
- **Export** - save chats as PDF (`jspdf`) or image (`html2canvas` / `html-to-image`).
- **Web search in chat** - optional SearXNG integration (`SEARXNG_URL`; see the companion `my-searxng-instance` repo) plus page fetching/parsing (`cheerio`).
- **Per-user API key** - each user enters their own NVIDIA API key in Settings; it is stored per user, not in environment variables.
- **Model tooling** - API routes for benchmarking and testing models (`app/api/benchmark`, `app/api/test-models`), plus helper scripts `fast-bench.js`, `fetch-models.js` and `test-alts.js`.

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| AI | NVIDIA NIM (OpenAI-compatible API) via Vercel AI SDK (`ai`, `@ai-sdk/openai`, `openai`) |
| Auth | NextAuth v4 + bcryptjs |
| DB | PostgreSQL, Prisma 7 (`@prisma/client` + `@prisma/adapter-pg`) |
| UI | Tailwind CSS, lucide-react, framer-motion, react-markdown + remark-gfm, react-syntax-highlighter |

## Project structure

```text
├── app/                  # App Router pages (chat, login) and API routes
│   └── api/              # auth, chat, chats, collections, models, settings, benchmark, test-models
├── components/           # React UI components
├── lib/                  # auth.ts, model-config.ts (curated models), prisma.ts, utils.ts
├── prisma/               # Prisma schema (User, UserSettings, Chat, Message, Collection, DocumentChunk)
├── public/               # Static assets
├── fetch-models.js       # Refresh nvidia-models-list.txt from the NVIDIA API
├── fast-bench.js         # Quick model latency benchmark
├── test-alts.js          # Try alternative model IDs
├── nvidia-models-list.txt# Captured list of available NVIDIA model IDs
└── AGENTS.md / CLAUDE.md # Notes for coding agents working in this repo
```

## Setup

1. **Install dependencies** (this also runs `prisma generate` via `postinstall`):
   ```bash
   npm install
   ```
2. **Configure environment** - create `.env` with at least:
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/nvidia_chatbot
   NEXTAUTH_SECRET=<random secret>
   NEXTAUTH_URL=http://localhost:3000
   SEARXNG_URL=https://<your-searxng-instance>/   # optional, enables web search in chat
   ```
   The NVIDIA API key is **not** an env var - each user adds their own key (from build.nvidia.com) in the app's Settings.
3. **Prepare the database**:
   ```bash
   npx prisma db push
   ```
4. **Run**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` and sign up / log in.

## Notes

- Personal, single-owner project; not a template.
- Model availability depends on your NVIDIA NIM account; rerun `node fetch-models.js` to refresh the local list and curate what appears in the sidebar in `lib/model-config.ts`.

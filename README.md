# Opencode Web

Your open-source AI coding agent, in the browser — no terminal required.

## Run it

1. Install dependencies: `bun install`
2. Add a key: copy `.env.example` to `.env` and set `OPENAI_API_KEY` (or set it in your environment).
3. Start dev server: `bun run dev`
4. Build for production: `bun run build`
5. Preview the build: `bun run preview`

## Backend

The chat backend is OpenAI-compatible and works with any provider that exposes `/chat/completions` (OpenAI, Groq, OpenRouter, Ollama, ...).

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | — | Required. API key for the provider. |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Provider base URL. |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model name. |

## Stack

- Vite with vanilla HTML/CSS/JavaScript — no UI framework.
- Zero-dependency backend mounted into Vite's dev and preview servers.

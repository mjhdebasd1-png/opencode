const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"
const DEFAULT_MODEL = "openai/gpt-4o-mini"

const MAX_BODY_BYTES = 1_000_000

export function apiMiddleware(req, res, next) {
  const path = new URL(req.url, "http://localhost").pathname

  if (path === "/api/health") return handleHealth(req, res)
  if (path === "/api/chat") return handleChat(req, res)

  next()
}

function handleHealth(req, res) {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" })

  sendJson(res, 200, {
    ok: true,
    configured: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
    provider: process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL,
  })
}

async function handleChat(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return sendJson(res, 503, {
      error: "No API key configured. Set OPENAI_API_KEY in your environment to start chatting.",
    })
  }

  const body = await readJson(req).catch(() => null)
  const messages = Array.isArray(body?.messages) ? body.messages : []
  if (messages.length === 0) return sendJson(res, 400, { error: "messages must be a non-empty array." })

  const baseUrl = (body.baseUrl || process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "")
  const model = body.model || process.env.OPENAI_MODEL || DEFAULT_MODEL

  const upstream = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, stream: true }),
  }).catch((error) => null)

  if (!upstream) {
    return sendJson(res, 502, { error: "Could not reach the model provider." })
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "")
    return sendJson(res, upstream.status, { error: detail || `Provider error (${upstream.status}).` })
  }

  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  })

  const decoder = new TextDecoder()
  const reader = upstream.body.getReader()
  let buffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith("data:")) continue
        const payload = trimmed.slice(5).trim()
        if (!payload || payload === "[DONE]") continue

        let parsed
        try {
          parsed = JSON.parse(payload)
        } catch {
          continue
        }

        const delta = parsed?.choices?.[0]?.delta?.content
        if (delta) write(res, { text: delta })
      }
    }
    write(res, { done: true })
  } catch (error) {
    write(res, { error: error instanceof Error ? error.message : "Stream interrupted." })
  } finally {
    res.end()
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = ""
    let size = 0

    req.on("data", (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request body too large."))
        req.destroy()
        return
      }
      raw += chunk
    })
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"))
      } catch (error) {
        reject(error)
      }
    })
    req.on("error", reject)
  })
}

function write(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json" })
  res.end(JSON.stringify(payload))
}

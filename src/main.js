import "./style.css"
import { renderMarkdown } from "./markdown.js"

const STORAGE_KEY = "opencode-web:sessions:v1"
const THEME_KEY = "opencode-web:theme:v1"
const MODEL_KEY = "opencode-web:model:v1"
const MODELS_KEY = "opencode-web:models:v1"

const FREE_MODELS = new Set([
  "cohere/north-mini-code:free",
  "dots-studio/dots-3-note-preview:free",
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
  "liquid/lfm-2.5-2.6b:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3.5-content-safety:free",
  "nvidia/nemotron-3.5-lightning:free",
  "nvidia/nemotron-nano-12b-v2-vl:free",
  "nvidia/nemotron-nano-9b-v2:free",
  "openai/gpt-oss-20b:free",
  "openrouter/free",
  "poolside/laguna-s-2.1:free",
  "poolside/laguna-xs-2.1:free",
  "stealth/ox-alpha",
  "thinkingmachines/inkling-small:free",
  "thinkingmachines/inkling:free",
  "z-ai/glm-5.2:free",
])

const DEFAULT_MODELS = [
  "openai/gpt-4o-mini",
  "openai/gpt-4o",
  "openai/gpt-4.1",
  "openai/o3-mini",
  "anthropic/claude-3.5-sonnet",
  "anthropic/claude-3.7-sonnet",
  "anthropic/claude-3-5-haiku",
  "google/gemini-2.0-flash-001",
  "google/gemini-2.5-pro",
  "deepseek/deepseek-chat",
  "deepseek/deepseek-r1",
  "meta-llama/llama-3.3-70b-instruct",
  "qwen/qwen2.5-coder-32b-instruct",
  "mistralai/mistral-small-3.1-24b-instruct",
  ...FREE_MODELS,
]

const botIcon = `<svg viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="8" fill="currentColor" opacity="0.1"/><path d="M9 12l4 4-4 4" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 20h7" stroke="var(--gold)" stroke-width="2.5" stroke-linecap="round"/></svg>`
const userIcon = `<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5.5" r="2.6" fill="currentColor"/><path d="M3.5 13.5a4.5 4.5 0 0 1 9 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`
const trashIcon = `<svg viewBox="0 0 16 16" fill="none"><path d="M2.5 4.5h11M6.5 4.5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5M4 4.5l.6 8a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9l.6-8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`

const sessionList = document.querySelector("#sessionList")
const messagesEl = document.querySelector("#messages")
const emptyState = document.querySelector("#emptyState")
const input = document.querySelector("#input")
const sendBtn = document.querySelector("#send")
const stopBtn = document.querySelector("#stop")
const newChatBtn = document.querySelector("#newChat")
const themeToggle = document.querySelector("#themeToggle")
const clearAllBtn = document.querySelector("#clearAll")
const statusDot = document.querySelector("#statusDot")
const statusText = document.querySelector("#statusText")
const sessionTitle = document.querySelector("#sessionTitle")
const modelSelect = document.querySelector("#modelSelect")
const regenerateBtn = document.querySelector("#regenerate")
const thinking = document.querySelector("#thinking")
const setupBanner = document.querySelector("#setupBanner")
const settingsBtn = document.querySelector("#settingsBtn")
const settingsModal = document.querySelector("#settingsModal")
const settingsClose = document.querySelector("#settingsClose")
const modelListEl = document.querySelector("#modelList")
const addModelForm = document.querySelector("#addModelForm")
const newModelInput = document.querySelector("#newModelInput")
const resetModelsBtn = document.querySelector("#resetModels")

let sessions = loadSessions()
let currentId = null
let streaming = false
let controller = null

init()

function init() {
  applyTheme(localStorage.getItem(THEME_KEY) || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"))
  renderModelSelect()

  if (sessions.length === 0) sessions = [createSession()]
  currentId = sessions[0].id

  renderSidebar()
  renderMessages()
  bindEvents()
  checkHealth()
  input.focus()
}

function bindEvents() {
  sendBtn.addEventListener("click", () => sendMessage(input.value))
  newChatBtn.addEventListener("click", () => selectSession(createSession().id))
  regenerateBtn.addEventListener("click", regenerate)
  settingsBtn.addEventListener("click", openSettings)
  settingsClose.addEventListener("click", closeSettings)
  settingsModal.addEventListener("click", (event) => {
    if (event.target === settingsModal) closeSettings()
  })
  addModelForm.addEventListener("submit", (event) => {
    event.preventDefault()
    addModel(newModelInput.value)
  })
  resetModelsBtn.addEventListener("click", resetModels)
  themeToggle.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light"
    applyTheme(next)
  })
  clearAllBtn.addEventListener("click", () => {
    if (!confirm("Delete all conversations?")) return
    sessions = [createSession()]
    currentId = sessions[0].id
    saveSessions()
    renderSidebar()
    renderMessages()
  })
  stopBtn.addEventListener("click", () => controller?.abort())
  modelSelect.addEventListener("change", () => {
    localStorage.setItem(MODEL_KEY, modelSelect.value)
  })

  input.addEventListener("input", () => {
    resizeInput()
    sendBtn.disabled = !input.value.trim()
  })

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      sendMessage(input.value)
    }
  })

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSettings()
    if (event.key === "/" && !isEditable(document.activeElement)) {
      event.preventDefault()
      input.focus()
    }
  })

  document.querySelectorAll(".suggestion").forEach((button) => {
    button.addEventListener("click", () => sendMessage(button.dataset.prompt))
  })

  messagesEl.addEventListener("click", (event) => {
    const copyButton = event.target.closest(".code-copy")
    if (copyButton) return copyCode(copyButton)

    const previewButton = event.target.closest(".code-preview")
    if (previewButton) return togglePreview(previewButton)
  })
}

/* ---------- Sessions ---------- */

function loadSessions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveSessions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
}

function createSession() {
  const session = { id: crypto.randomUUID(), title: "New conversation", createdAt: Date.now(), messages: [] }
  sessions.unshift(session)
  saveSessions()
  return session
}

function currentSession() {
  return sessions.find((session) => session.id === currentId) ?? sessions[0] ?? null
}

function selectSession(id) {
  currentId = id
  saveSessions()
  renderSidebar()
  renderMessages()
}

function deleteSession(id) {
  sessions = sessions.filter((session) => session.id !== id)
  if (sessions.length === 0) sessions = [createSession()]
  if (currentId === id) currentId = sessions[0].id
  saveSessions()
  renderSidebar()
  renderMessages()
}

function renderSidebar() {
  sessionList.innerHTML = ""
  for (const session of sessions) {
    const item = document.createElement("button")
    item.type = "button"
    item.className = "session-item" + (session.id === currentId ? " active" : "")

    const label = document.createElement("span")
    label.className = "session-label"
    label.textContent = session.title

    const del = document.createElement("span")
    del.className = "session-delete"
    del.title = "Delete conversation"
    del.innerHTML = trashIcon
    del.addEventListener("click", (event) => {
      event.stopPropagation()
      deleteSession(session.id)
    })

    item.append(label, del)
    item.addEventListener("click", () => selectSession(session.id))
    sessionList.appendChild(item)
  }

  sessionTitle.textContent = currentSession()?.title ?? "New conversation"
}

/* ---------- Rendering ---------- */

function renderMessages() {
  messagesEl.querySelectorAll(".msg").forEach((node) => node.remove())

  const session = currentSession()
  const messages = session?.messages ?? []
  emptyState.classList.toggle("hidden", messages.length > 0)

  for (const message of messages) {
    if (!message.content) continue
    messagesEl.appendChild(renderMessage(message))
  }
  regenerateBtn.disabled = !canRegenerate()
  scrollToBottom(true)
}

function renderMessage(message) {
  const wrapper = document.createElement("div")
  wrapper.className = `msg ${message.role}`

  const avatar = document.createElement("div")
  avatar.className = "msg-avatar"
  avatar.innerHTML = message.role === "user" ? userIcon : botIcon

  const body = document.createElement("div")
  body.className = "msg-body"

  const bubble = document.createElement("div")
  bubble.className = "bubble"

  if (message.role === "assistant") {
    const markdown = document.createElement("div")
    markdown.className = "markdown"
    markdown.innerHTML = renderMarkdown(message.content)
    bubble.appendChild(markdown)
  } else {
    bubble.textContent = message.content
    bubble.style.whiteSpace = "pre-wrap"
  }

  body.appendChild(bubble)
  wrapper.append(avatar, body)
  return wrapper
}

function scrollToBottom(force) {
  const distance = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight
  if (force || distance < 120) messagesEl.scrollTop = messagesEl.scrollHeight
}

/* ---------- Chat ---------- */

async function sendMessage(text) {
  const trimmed = text.trim()
  if (!trimmed || streaming) return

  const session = currentSession()
  if (session.title === "New conversation") {
    session.title = trimmed.slice(0, 46) + (trimmed.length > 46 ? "…" : "")
  }

  session.messages.push({ role: "user", content: trimmed, time: Date.now() })
  saveSessions()
  input.value = ""
  resizeInput()
  sendBtn.disabled = true
  renderSidebar()
  renderMessages()

  await runAssistantTurn(session)
}

async function runAssistantTurn(session) {
  const assistant = { role: "assistant", content: "", time: Date.now() }
  session.messages.push(assistant)

  const node = renderMessage(assistant)
  node.classList.add("streaming")
  messagesEl.appendChild(node)
  const markdown = node.querySelector(".markdown")
  scrollToBottom(true)

  setStreaming(true)
  controller = new AbortController()

  const history = session.messages
    .filter((message) => message.role !== "assistant" || message.content)
    .map((message) => ({ role: message.role, content: message.content }))

  try {
    for await (const event of streamChat(history, currentModel(), controller.signal)) {
      if (event.text) {
        assistant.content += event.text
        markdown.innerHTML = renderMarkdown(assistant.content)
        scrollToBottom(false)
      }
      if (event.error) {
        assistant.content = assistant.content || `⚠️ ${event.error}`
        markdown.innerHTML = renderMarkdown(assistant.content)
      }
      if (event.done) break
    }
  } catch (error) {
    if (error?.name !== "AbortError") {
      assistant.content = assistant.content || "⚠️ The request failed. Check the backend connection and try again."
      markdown.innerHTML = renderMarkdown(assistant.content)
    }
  } finally {
    node.classList.remove("streaming")
    setStreaming(false)
    controller = null

    if (!assistant.content) {
      session.messages.pop()
      node.remove()
    } else if (node.isConnected) {
      renderQuestions(node, extractQuestions(assistant.content))
    }
    saveSessions()
    renderSidebar()
    regenerateBtn.disabled = !canRegenerate()
    scrollToBottom(false)
  }
}

async function regenerate() {
  if (streaming) return
  const session = currentSession()
  const last = session?.messages[session.messages.length - 1]
  if (!last || last.role !== "assistant") return

  session.messages.pop()
  saveSessions()
  renderMessages()
  await runAssistantTurn(session)
}

async function* streamChat(messages, model, signal) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages, model }),
    signal,
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: `Request failed (${response.status}).` }))
    yield { error: data.error }
    yield { done: true }
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let separator
    while ((separator = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, separator).trim()
      buffer = buffer.slice(separator + 1)
      if (!line.startsWith("data:")) continue
      const payload = line.slice(5).trim()
      if (!payload) continue
      try {
        yield JSON.parse(payload)
      } catch {
        // skip malformed chunks
      }
    }
  }
}

function setStreaming(active) {
  streaming = active
  sendBtn.classList.toggle("hidden", active)
  stopBtn.hidden = !active
  thinking.hidden = !active
  regenerateBtn.disabled = active || !canRegenerate()
}

function canRegenerate() {
  const session = currentSession()
  const last = session?.messages[session.messages.length - 1]
  return Boolean(last && last.role === "assistant")
}

/* ---------- Code preview ---------- */

function copyCode(button) {
  const code = button.closest(".code-block")?.querySelector("code")?.textContent ?? ""
  navigator.clipboard.writeText(code).then(() => {
    button.textContent = "Copied!"
    setTimeout(() => (button.textContent = "Copy"), 1500)
  })
}

function togglePreview(button) {
  const block = button.closest(".code-block")
  const existing = block.nextElementSibling
  if (existing?.classList.contains("preview-pane")) {
    existing.remove()
    button.textContent = "Preview"
    return
  }

  const lang = block.querySelector(".code-lang")?.textContent ?? ""
  const code = block.querySelector("code")?.textContent ?? ""
  const doc = buildPreviewDoc(code, lang)

  const pane = document.createElement("div")
  pane.className = "preview-pane"

  if (doc == null) {
    pane.innerHTML = `<div class="preview-empty">Preview isn't available for ${escapeHtml(lang) || "this"} code.</div>`
  } else {
    const iframe = document.createElement("iframe")
    iframe.className = "preview-frame"
    iframe.sandbox = "allow-scripts"
    iframe.srcdoc = doc
    iframe.title = "Code preview"
    pane.appendChild(iframe)
  }

  block.insertAdjacentElement("afterend", pane)
  button.textContent = "Hide"
}

function buildPreviewDoc(code, lang) {
  const language = (lang || "").toLowerCase()

  if (["html", "htm", "svg", "xml"].includes(language)) return code

  if (language === "css") {
    return `<!doctype html><html><head><meta charset="utf-8"><style>${code}</style></head><body>
<div style="padding:20px;font-family:system-ui,sans-serif"><h1>Heading</h1><p>A paragraph with a <a href="#">link</a> and <strong>strong</strong> text.</p><button>Button</button><div class="card">Card</div><input placeholder="Input"></div></body></html>`
  }

  if (["js", "javascript", "mjs", "jsx"].includes(language)) {
    const safe = code.replace(/<\/script>/gi, "<\\/script>")
    return `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:ui-monospace,monospace;padding:16px;background:#0c0e12;color:#d7dce4;white-space:pre-wrap}</style></head><body><script>
const __out = [];
const __log = console.log;
console.log = (...a) => { __out.push(a.map(v => typeof v === "object" ? JSON.stringify(v) : String(v)).join(" ")); __log(...a); };
try {
${safe}
} catch (e) {
  document.body.insertAdjacentHTML("beforeend", '<div style="color:#f87171;margin-top:12px">' + e.name + ': ' + e.message + '</div>');
}
if (__out.length) document.body.insertAdjacentHTML("beforeend", '<div style="color:#7ee0a3;border-top:1px solid #262c36;margin-top:12px;padding-top:12px">' + __out.join("\\n").replace(/&/g,"&amp;").replace(/</g,"&lt;") + '</div>');
<\/script></body></html>`
  }

  if (["md", "markdown"].includes(language)) {
    return `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;padding:20px;max-width:760px;margin:0 auto;background:#0c0e12;color:#e8eaee;line-height:1.6}pre{background:#13161c;padding:12px;border-radius:8px;overflow:auto}code{font-family:ui-monospace,monospace}h1,h2,h3{line-height:1.2}</style></head><body>${renderMarkdown(code)}</body></html>`
  }

  return null
}

/* ---------- Clarifying questions ---------- */

function extractQuestions(text) {
  const withoutCode = String(text).replace(/```[\s\S]*?```/g, "")
  const questions = []

  for (const line of withoutCode.split("\n")) {
    const trimmed = line.trim().replace(/^\d+[.)]\s*/, "").replace(/^[-*+]\s*/, "")
    if (
      trimmed.endsWith("?") &&
      trimmed.length > 8 &&
      trimmed.length < 300 &&
      !/^[#>]/.test(trimmed)
    ) {
      questions.push(trimmed)
    }
  }
  return questions.slice(0, 3)
}

function renderQuestions(node, questions) {
  if (questions.length === 0) return

  const body = node.querySelector(".msg-body")
  const panel = document.createElement("div")
  panel.className = "question-panel"

  const heading = document.createElement("div")
  heading.className = "question-heading"
  heading.textContent = "Clarify to continue"
  panel.appendChild(heading)

  const form = document.createElement("form")
  form.className = "question-form"

  for (const question of questions) {
    const field = document.createElement("div")
    field.className = "question-field"

    const label = document.createElement("label")
    label.textContent = question

    const answer = document.createElement("input")
    answer.type = "text"
    answer.placeholder = "Your answer…"
    answer.dataset.question = question

    field.append(label, answer)
    form.appendChild(field)
  }

  const actions = document.createElement("div")
  actions.className = "question-actions"

  const submit = document.createElement("button")
  submit.type = "submit"
  submit.className = "question-submit"
  submit.textContent = "Send answers"

  const skip = document.createElement("button")
  skip.type = "button"
  skip.className = "question-skip"
  skip.textContent = "Skip"
  skip.addEventListener("click", () => panel.remove())

  actions.append(submit, skip)
  form.appendChild(actions)

  form.addEventListener("submit", (event) => {
    event.preventDefault()
    const answers = [...form.querySelectorAll("input")]
      .map((field) => ({ question: field.dataset.question, answer: field.value.trim() }))
      .filter((entry) => entry.answer)

    if (answers.length === 0) return
    const text = answers.map((entry) => `**${entry.question}**\n${entry.answer}`).join("\n\n")
    panel.remove()
    sendMessage(text)
  })

  panel.appendChild(form)
  body.appendChild(panel)
}

/* ---------- Theme & status ---------- */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
  localStorage.setItem(THEME_KEY, theme)
}

function getModelList() {
  try {
    const parsed = JSON.parse(localStorage.getItem(MODELS_KEY) || "[]")
    if (Array.isArray(parsed) && parsed.length) return parsed
  } catch {
    // fall through to defaults
  }
  return [...DEFAULT_MODELS]
}

function setModelList(models) {
  localStorage.setItem(MODELS_KEY, JSON.stringify(models))
}

function renderModelSelect() {
  const models = getModelList()
  const saved = localStorage.getItem(MODEL_KEY)
  modelSelect.innerHTML = ""

  for (const model of models) {
    const option = document.createElement("option")
    option.value = model
    option.textContent = model
    modelSelect.appendChild(option)
  }
  modelSelect.value = models.includes(saved) ? saved : models[0]
}

function ensureModelOption(model) {
  if (!model || [...modelSelect.options].some((option) => option.value === model)) return
  const option = document.createElement("option")
  option.value = model
  option.textContent = model
  modelSelect.appendChild(option)
}

function currentModel() {
  return modelSelect.value || DEFAULT_MODELS[0]
}

function openSettings() {
  renderModelList()
  settingsModal.hidden = false
  newModelInput.focus()
}

function closeSettings() {
  settingsModal.hidden = true
}

function renderModelList() {
  modelListEl.innerHTML = ""
  for (const model of getModelList()) {
    const row = document.createElement("li")
    row.className = "model-row"

    const left = document.createElement("div")
    left.className = "model-row-left"

    const name = document.createElement("span")
    name.className = "model-row-name"
    name.textContent = model
    left.appendChild(name)

    if (FREE_MODELS.has(model)) {
      const badge = document.createElement("span")
      badge.className = "model-badge"
      badge.textContent = "free"
      left.appendChild(badge)
    }

    const remove = document.createElement("button")
    remove.type = "button"
    remove.className = "model-remove"
    remove.title = "Remove model"
    remove.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`
    remove.addEventListener("click", () => removeModel(model))

    row.append(left, remove)
    modelListEl.appendChild(row)
  }
}

function addModel(value) {
  const model = value.trim()
  if (!model) return
  const models = getModelList()
  if (models.includes(model)) {
    newModelInput.value = ""
    return
  }
  models.push(model)
  setModelList(models)
  newModelInput.value = ""
  renderModelSelect()
  renderModelList()
}

function removeModel(model) {
  const remaining = getModelList().filter((item) => item !== model)
  const models = remaining.length ? remaining : [...DEFAULT_MODELS]
  setModelList(models)
  if (localStorage.getItem(MODEL_KEY) === model) localStorage.removeItem(MODEL_KEY)
  renderModelSelect()
  renderModelList()
}

function resetModels() {
  setModelList([...DEFAULT_MODELS])
  localStorage.removeItem(MODEL_KEY)
  renderModelSelect()
  renderModelList()
}

async function checkHealth() {
  try {
    const data = await (await fetch("/api/health")).json()
    if (data.model) {
      ensureModelOption(data.model)
      if (!localStorage.getItem(MODEL_KEY)) modelSelect.value = data.model
    }
    if (data.configured) {
      setStatus("online", "connected")
      setupBanner.hidden = true
    } else {
      setStatus("offline", "no API key")
      setupBanner.hidden = false
    }
  } catch {
    setStatus("offline", "backend offline")
  }
}

function setStatus(state, label) {
  statusDot.className = `status-dot ${state}`
  statusText.textContent = label
}

function resizeInput() {
  input.style.height = "auto"
  input.style.height = `${Math.min(input.scrollHeight, 200)}px`
}

function isEditable(element) {
  return Boolean(
    element &&
      (element.tagName === "INPUT" ||
        element.tagName === "TEXTAREA" ||
        element.tagName === "SELECT" ||
        element.isContentEditable),
  )
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

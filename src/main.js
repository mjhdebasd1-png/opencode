import "./style.css"
import { renderMarkdown } from "./markdown.js"

const STORAGE_KEY = "opencode-web:sessions:v1"
const THEME_KEY = "opencode-web:theme:v1"

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
const modelBadge = document.querySelector("#modelBadge")
const setupBanner = document.querySelector("#setupBanner")

let sessions = loadSessions()
let currentId = null
let streaming = false
let controller = null

init()

function init() {
  applyTheme(localStorage.getItem(THEME_KEY) || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"))

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

  document.querySelectorAll(".suggestion").forEach((button) => {
    button.addEventListener("click", () => sendMessage(button.dataset.prompt))
  })

  messagesEl.addEventListener("click", (event) => {
    const copyButton = event.target.closest(".code-copy")
    if (!copyButton) return
    const code = copyButton.closest(".code-block")?.querySelector("code")?.textContent ?? ""
    navigator.clipboard.writeText(code).then(() => {
      copyButton.textContent = "Copied!"
      setTimeout(() => (copyButton.textContent = "Copy"), 1500)
    })
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
    for await (const event of streamChat(history, controller.signal)) {
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
    }
    saveSessions()
    renderSidebar()
    scrollToBottom(false)
  }
}

async function* streamChat(messages, signal) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages }),
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
}

/* ---------- Theme & status ---------- */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
  localStorage.setItem(THEME_KEY, theme)
}

async function checkHealth() {
  try {
    const data = await (await fetch("/api/health")).json()
    modelBadge.textContent = data.model || "ready"
    if (data.configured) {
      setStatus("online", "connected")
      setupBanner.hidden = true
    } else {
      setStatus("offline", "no API key")
      setupBanner.hidden = false
    }
  } catch {
    setStatus("offline", "backend offline")
    modelBadge.textContent = "unavailable"
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

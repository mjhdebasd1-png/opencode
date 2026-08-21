const HASH_LANGS = new Set([
  "python", "py", "ruby", "rb", "bash", "sh", "shell", "zsh", "yaml", "yml", "toml",
  "dockerfile", "makefile", "perl", "pl", "r",
])
const NO_SLASH_LANGS = new Set([
  "python", "py", "ruby", "rb", "yaml", "yml", "toml", "json", "sql",
])
const NO_BLOCK_LANGS = new Set([
  "python", "py", "ruby", "rb", "bash", "sh", "shell", "zsh", "yaml", "yml", "toml",
  "json", "dockerfile", "makefile", "sql",
])

const KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for", "while", "do",
  "switch", "case", "break", "continue", "new", "class", "extends", "super", "this",
  "typeof", "instanceof", "in", "of", "async", "await", "yield", "import", "export",
  "from", "default", "try", "catch", "finally", "throw", "delete", "void", "null",
  "undefined", "true", "false", "static", "get", "set", "public", "private",
  "protected", "readonly", "type", "interface", "enum", "implements", "declare",
  "abstract", "namespace", "as", "is", "assert", "debugger",
  "def", "none", "and", "or", "not", "pass", "elif", "lambda", "with", "raise",
  "global", "nonlocal", "del",
  "fn", "pub", "use", "mut", "impl", "trait", "struct", "match", "where", "loop",
  "move", "ref", "dyn", "mod", "crate",
  "go", "chan", "select", "defer", "range", "package", "func",
  "echo", "local", "source", "exit", "then", "fi", "done", "esac", "require",
  "rescue", "ensure", "begin", "end",
])

export function renderMarkdown(text) {
  const src = String(text ?? "")
  if (!src.trim()) return ""

  const blocks = []
  const withPlaceholders = src.replace(/```([^\n`]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const index = blocks.push({ lang: lang.trim(), code: code.replace(/\n$/, "") }) - 1
    return `\n\n\u0000${index}\u0000\n\n`
  })

  const html = withPlaceholders
    .split(/\n{2,}/)
    .map((block) => renderBlock(block))
    .join("")

  return html.replace(/\u0000(\d+)\u0000/g, (_, index) => renderCodeBlock(blocks[Number(index)]))
}

function renderBlock(block) {
  const lines = block.split("\n").filter((line) => line.trim() !== "")
  if (lines.length === 0) return ""

  if (lines.length === 1 && /^\u0000\d+\u0000$/.test(lines[0])) return lines[0]

  if (/^(?:---+|\*\*\*+|___+)$/.test(lines[0]) && lines.length === 1) return "<hr>"

  const heading = lines[0].match(/^(#{1,6})\s+(.*)$/)
  if (heading && lines.length === 1) {
    const level = heading[1].length
    const text = heading[2]
    return `<h${level} id="${slug(text)}">${inline(text)}</h${level}>`
  }

  if (lines.every((line) => /^>\s?/.test(line))) {
    const content = lines.map((line) => line.replace(/^>\s?/, "")).join(" ")
    return `<blockquote>${inline(content)}</blockquote>`
  }

  if (lines.every(isListItem)) return renderList(lines)

  return `<p>${lines.map(inline).join("<br>")}</p>`
}

function isListItem(line) {
  return /^[-*+]\s+/.test(line) || /^\d+\.\s+/.test(line)
}

function renderList(lines) {
  let html = ""
  let listType = null

  for (const line of lines) {
    const ordered = line.match(/^\d+\.\s+(.*)/)
    const unordered = line.match(/^[-*+]\s+(.*)/)
    const type = ordered ? "ol" : "ul"
    const content = (ordered || unordered)[1]

    if (type !== listType) {
      if (listType) html += `</${listType}>`
      html += `<${type}>`
      listType = type
    }
    html += `<li>${inline(content)}</li>`
  }

  if (listType) html += `</${listType}>`
  return html
}

function inline(text) {
  const codes = []
  let s = escapeHtml(text)

  s = s.replace(/`([^`\n]+)`/g, (_, code) => {
    const index = codes.push(code) - 1
    return `\u0001${index}\u0001`
  })

  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, href) => {
    return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`
  })
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  s = s.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>")
  s = s.replace(/(?<![\w])_([^_\n]+)_(?![\w])/g, "<em>$1</em>")
  s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>")

  return s.replace(/\u0001(\d+)\u0001/g, (_, index) => {
    return `<code class="inline-code">${codes[Number(index)]}</code>`
  })
}

function renderCodeBlock({ lang, code }) {
  return `<div class="code-block">
    <div class="code-head">
      <span class="code-lang">${escapeHtml(lang || "code")}</span>
      <button class="code-copy" type="button">Copy</button>
    </div>
    <pre><code class="hl">${highlight(code, lang)}</code></pre>
  </div>`
}

function highlight(code, lang) {
  const language = (lang || "").toLowerCase()
  const hashComment = HASH_LANGS.has(language)
  const slashComment = !NO_SLASH_LANGS.has(language)
  const blockComment = !NO_BLOCK_LANGS.has(language)

  const types = []
  const parts = []
  if (blockComment) {
    types.push("comment")
    parts.push("(/\\*[\\s\\S]*?\\*/)")
  }
  if (slashComment) {
    types.push("comment")
    parts.push("(//[^\\n]*)")
  }
  if (hashComment) {
    types.push("comment")
    parts.push("(#[^\\n]*)")
  }
  types.push("string", "string", "string", "number", "identifier")
  parts.push(
    "(`(?:\\\\.|[^`\\\\])*`)",
    "('(?:\\\\.|[^'\\\\\\n])*')",
    "(\"(?:\\\\.|[^\"\\\\\\n])*\")",
    "\\b(\\d[\\d_]*(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)\\b",
    "\\b([A-Za-z_$][\\w$]*)\\b",
  )

  const tokenRe = new RegExp(parts.join("|"), "g")
  let out = ""
  let last = 0
  let match

  while ((match = tokenRe.exec(code))) {
    out += escapeHtml(code.slice(last, match.index))
    const token = match[0]
    const groupIndex = match.slice(1).findIndex((group) => group !== undefined)
    const type = types[groupIndex] ?? "plain"
    out += renderToken(token, type, code, match.index)
    last = match.index + token.length
  }
  out += escapeHtml(code.slice(last))
  return out
}

function renderToken(token, type, code, index) {
  const escaped = escapeHtml(token)
  if (type === "comment") return `<span class="tok-comment">${escaped}</span>`
  if (type === "string") return `<span class="tok-string">${escaped}</span>`
  if (type === "number") return `<span class="tok-number">${escaped}</span>`
  if (type === "identifier") {
    const lowered = token.toLowerCase()
    if (KEYWORDS.has(token) || KEYWORDS.has(lowered)) {
      return `<span class="tok-keyword">${escaped}</span>`
    }
    if (code[index + token.length] === "(") return `<span class="tok-func">${escaped}</span>`
  }
  return escaped
}

function slug(text) {
  return text
    .toLowerCase()
    .replace(/`[^`]*`/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

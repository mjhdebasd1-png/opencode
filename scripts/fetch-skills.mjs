// Downloads the design skills used by opencode-web into skills/.
// Run from the project root: node scripts/fetch-skills.mjs

import { writeFileSync, mkdirSync } from "node:fs"
import path from "node:path"

const SKILLS = {
  "frontend-design":
    "https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/SKILL.md",
  "web-design-guidelines":
    "https://raw.githubusercontent.com/vercel-labs/agent-skills/main/skills/web-design-guidelines/SKILL.md",
  "design-taste-frontend":
    "https://raw.githubusercontent.com/leonxlnx/taste-skill/main/skills/taste-skill/SKILL.md",
  "high-end-visual-design":
    "https://raw.githubusercontent.com/leonxlnx/taste-skill/main/skills/soft-skill/SKILL.md",
  "redesign-existing-projects":
    "https://raw.githubusercontent.com/leonxlnx/taste-skill/main/skills/redesign-skill/SKILL.md",
  "anti-ui-slop":
    "https://raw.githubusercontent.com/uizze/uizze/main/skills/anti-ui-slop/SKILL.md",
  "ui-ux-pro-max":
    "https://raw.githubusercontent.com/nextlevelbuilder/ui-ux-pro-max-skill/main/.claude/skills/ui-ux-pro-max/SKILL.md",
}

const outDir = path.resolve(process.cwd(), "skills")
mkdirSync(outDir, { recursive: true })

for (const [id, url] of Object.entries(SKILLS)) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${id}: ${response.status} ${url}`)
  const text = await response.text()
  writeFileSync(path.join(outDir, `${id}.md`), text)
  console.log(`${id}: ${text.length} chars`)
}

console.log(`Wrote ${Object.keys(SKILLS).length} skills to skills/`)

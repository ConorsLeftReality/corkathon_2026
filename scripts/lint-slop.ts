import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export type Finding = { path: string; line: number; column: number; message: string }

const CHECKED = /\.(ts|tsx|js|jsx|mjs|cjs|md|mdx|css|html|json|ya?ml|toml|rs|luau|py)$/
const CODE = /\.(ts|tsx|js|jsx|mjs|cjs|rs|luau|py)$/
// the linter fixtures have to contain the banned text they test for
const SKIPPED =
  /(^|\/)(slop-words\.txt|lint-slop\.test\.ts|lint-commit-msg\.test\.ts|bun\.lock|package-lock\.json|CHANGELOG\.md)$/

const CHARACTERS: { pattern: RegExp; message: string; codeOnly?: boolean }[] = [
  { pattern: /\u2014/g, message: 'em dash, use a comma, a colon or a new sentence' },
  { pattern: /\u2013/g, message: 'en dash, use a hyphen for ranges or the word to' },
  { pattern: /\u2026/g, message: 'ellipsis character, use three dots' },
  { pattern: /[\u201C\u201D\u2018\u2019]/g, message: 'curly quote in code', codeOnly: true },
  { pattern: /\p{Extended_Pictographic}/gu, message: 'emoji in code', codeOnly: true },
]

export function loadWords(file: string): string[] {
  return readFileSync(file, 'utf8')
    .split('\n')
    .map((word) => word.trim().toLowerCase())
    .filter((word) => word !== '' && !word.startsWith('#'))
}

function wordPattern(words: string[]): RegExp {
  const escaped = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  // hyphens count as word characters so hyphenated entries only match whole
  return new RegExp(`(?<![\\w-])(${escaped.join('|')})(?![\\w-])`, 'gi')
}

// blank out allowlisted names with spaces so columns still line up
function maskAllowed(line: string, allow: string[]): string {
  return allow.reduce((masked, name) => masked.split(name).join(' '.repeat(name.length)), line)
}

export function findSlop(
  path: string,
  text: string,
  words: string[],
  allow: string[] = [],
): Finding[] {
  const normalised = path.replace(/\\/g, '/')
  if (SKIPPED.test(normalised) || !CHECKED.test(normalised)) return []
  const isCode = CODE.test(normalised)
  const isMarkdown = /\.mdx?$/.test(normalised)
  const wordRegex = wordPattern(words)
  const findings: Finding[] = []
  let exempt = false

  text.split('\n').forEach((line, index) => {
    // docs that name the banned items wrap them in a slop-ok block
    if (isMarkdown && line.includes('<!-- slop-ok-start -->')) exempt = true
    if (isMarkdown && line.includes('<!-- slop-ok-end -->')) {
      exempt = false
      return
    }
    if (exempt) return

    const report = (column: number, message: string) =>
      findings.push({ path: normalised, line: index + 1, column: column + 1, message })

    for (const { pattern, message, codeOnly } of CHARACTERS) {
      if (codeOnly && !isCode) continue
      for (const match of line.matchAll(pattern)) report(match.index, message)
    }
    for (const match of maskAllowed(line, allow).matchAll(wordRegex)) {
      report(match.index, `slop word "${match[0]}", say it plainly`)
    }
  })
  return findings
}

function listFiles(root: string): string[] {
  const run = (args: string[]) =>
    Bun.spawnSync(['git', ...args], { cwd: root })
      .stdout.toString()
      .split('\n')
      .filter(Boolean)
  return [...run(['ls-files']), ...run(['ls-files', '--others', '--exclude-standard'])]
}

if (import.meta.main) {
  const root = process.cwd()
  // a repo can carry its own list, otherwise the global one next to this script
  const localWords = join(root, 'scripts/slop-words.txt')
  const wordsFile = existsSync(localWords) ? localWords : join(import.meta.dir, 'slop-words.txt')
  const words = loadWords(wordsFile)
  // product and proper names that contain a slop word, matched case sensitive
  const allow = [join(import.meta.dir, 'slop-allow.txt'), join(root, 'scripts/slop-allow.txt')]
    .filter((file) => existsSync(file))
    .flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .map((name) => name.trim()),
    )
    .filter((name) => name !== '' && !name.startsWith('#'))
  const args = process.argv.slice(2)
  const files = args.length > 0 ? args : listFiles(root)
  const findings = files.flatMap((file) => {
    try {
      return findSlop(file, readFileSync(resolve(root, file), 'utf8'), words, allow)
    } catch {
      // a staged delete or a binary we can't read has nothing to check
      return []
    }
  })
  for (const f of findings) console.error(`${f.path}:${f.line}:${f.column}  ${f.message}`)
  if (findings.length > 0) {
    console.error(`\n${findings.length} slop finding(s), see D:/dev/skills/writing-without-slop`)
    process.exit(1)
  }
}

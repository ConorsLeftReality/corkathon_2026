import { readFileSync } from 'node:fs'

export const TYPES = [
  'feat',
  'fix',
  'test',
  'refactor',
  'perf',
  'docs',
  'style',
  'chore',
  'ci',
  'build',
  'revert',
] as const

// scope is optional so single package repos can write fix: thing
const SUBJECT = /^([a-z]+)(?:\(([a-z0-9-]+)\))?(!)?: (.+)$/
const TRAILER = /^[A-Z][\w-]*: /
const GIT_GENERATED = /^(Merge |Revert ")/
const AUTOSQUASH = /^(fixup|squash|amend)! /
// a body can name an ai sdk but a trailer crediting one is a footprint
const AI_TRAILER = /(claude|anthropic|openai|chatgpt|copilot|gemini|codex)/i
const AI_FOOTER = /(generated (with|by)|ai[- ]assisted|written by (an )?ai|\u{1F916})/iu

export type LintOptions = { scopes?: string[]; strict?: boolean }

// FeltError and USDC keep their case but Added does not
function hasCapitalisedWord(text: string): boolean {
  return text
    .replace(/`[^`]*`/g, '')
    .split(/\s+/)
    .some((word) => /^[A-Z]/.test(word) && !/[A-Z0-9_$]/.test(word.slice(1)))
}

function punctuationProblems(text: string, where: string): string[] {
  const problems: string[] = []
  if (/[\u2013\u2014]/.test(text)) problems.push(`${where} has an em or en dash`)
  if (/\p{Extended_Pictographic}/u.test(text)) problems.push(`${where} has an emoji`)
  if (text.includes(';')) problems.push(`${where} has a semicolon`)
  if (/!(\s|$)/.test(text)) problems.push(`${where} has an exclamation mark`)
  if (/[.,:?]$/.test(text)) problems.push(`${where} ends in punctuation`)
  if (/[^\s.]\.\s+\S/.test(text)) problems.push(`${where} has a full stop mid line`)
  if (hasCapitalisedWord(text)) problems.push(`${where} should be lowercase`)
  return problems
}

export function cleanMessage(raw: string): string {
  const scissors = raw.indexOf('# ------------------------ >8 ------------------------')
  const kept = scissors === -1 ? raw : raw.slice(0, scissors)
  return kept
    .split('\n')
    .filter((line) => !line.startsWith('#'))
    .join('\n')
    .trim()
}

export function lintCommitMessage(raw: string, opts: LintOptions = {}): string[] {
  const message = cleanMessage(raw)
  const [subject = '', separator, ...body] = message.split('\n')

  if (GIT_GENERATED.test(subject)) return []
  if (AUTOSQUASH.test(subject)) {
    return opts.strict ? ['squash fixup commits before merging'] : []
  }

  const problems: string[] = []
  const match = SUBJECT.exec(subject)
  if (!match) {
    return [`subject must look like type(scope): what changed, got "${subject}"`]
  }
  const [, type = '', scope, , description = ''] = match
  if (!(TYPES as readonly string[]).includes(type)) {
    problems.push(`type must be one of ${TYPES.join(' ')}`)
  }
  if (scope !== undefined && opts.scopes && !opts.scopes.includes(scope)) {
    problems.push(`scope must be one of ${opts.scopes.join(' ')}`)
  }
  if (subject.length > 60) problems.push(`subject is ${subject.length} chars, keep it to 60`)
  if (/^(wip|updates?|various|cleanup|misc|stuff)\b/.test(description)) {
    problems.push('subject says nothing, name what changed')
  }
  problems.push(...punctuationProblems(description, 'subject'))

  if (separator !== undefined && separator !== '') {
    problems.push('leave a blank line between the subject and the body')
  }

  const trailerStart = body.findIndex((line) => TRAILER.test(line))
  const prose = trailerStart === -1 ? body : body.slice(0, trailerStart)
  const trailers = trailerStart === -1 ? [] : body.slice(trailerStart)
  prose.forEach((line, index) => {
    if (line === '') return
    const where = `body line ${index + 3}`
    if (line.length > 72 && !/https?:\/\//.test(line)) {
      problems.push(`${where} is ${line.length} chars, wrap at 72`)
    }
    problems.push(...punctuationProblems(line, where))
  })
  for (const line of prose) {
    if (AI_FOOTER.test(line)) problems.push(`no ai attribution, drop "${line.trim()}"`)
  }
  for (const line of trailers) {
    if (AI_FOOTER.test(line) || AI_TRAILER.test(line)) {
      problems.push(`no ai attribution, drop "${line.trim()}"`)
    }
  }
  return problems
}

function git(args: string[]): string {
  return Bun.spawnSync(['git', ...args]).stdout.toString()
}

if (import.meta.main) {
  const [flag, value] = process.argv.slice(2)
  const failures: string[] = []

  const report = (label: string, problems: string[]) => {
    if (problems.length === 0) return
    failures.push(label)
    console.error(`${label}\n${problems.map((p) => `  - ${p}`).join('\n')}`)
  }

  if (flag === '--range') {
    const range = value ?? 'origin/main..HEAD'
    for (const sha of git(['rev-list', range]).split('\n').filter(Boolean)) {
      const message = git(['log', '-1', '--format=%B', sha])
      report(`${sha.slice(0, 7)} ${message.split('\n')[0] ?? ''}`, lintCommitMessage(message, { strict: true }))
    }
  } else if (flag) {
    report('commit message', lintCommitMessage(readFileSync(flag, 'utf8')))
  } else {
    console.error('usage: lint-commit-msg.ts <message-file> | --range <a..b>')
    process.exit(2)
  }

  if (failures.length > 0) {
    console.error('\nsee D:/dev/skills/committing-cleanly')
    process.exit(1)
  }
}

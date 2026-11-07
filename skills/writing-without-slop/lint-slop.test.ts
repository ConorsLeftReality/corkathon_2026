import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'
import { findSlop, loadWords } from './lint-slop'

const words = loadWords(join(import.meta.dir, 'slop-words.txt'))
const messages = (path: string, text: string) => findSlop(path, text, words).map((f) => f.message)

describe('lint slop', () => {
  it('flags an em dash in docs', () => {
    expect(messages('a.md', 'fast — and clean')).toEqual([
      'em dash, use a comma, a colon or a new sentence',
    ])
  })

  it('flags an en dash range', () => {
    expect(messages('a.md', 'pages 6–12')).toHaveLength(1)
  })

  it('flags emoji and curly quotes in code only', () => {
    expect(messages('a.ts', "const a = '\u{1F680}' // “hi”")).toHaveLength(3)
    expect(messages('a.md', 'ship it \u{1F680}')).toEqual([])
  })

  it('flags a banned word case insensitive', () => {
    expect(messages('a.md', 'A Robust design')).toEqual(['slop word "Robust", say it plainly'])
  })

  it('matches multi word entries', () => {
    expect(messages('a.md', 'we did it in order to win')).toHaveLength(1)
  })

  it('leaves words that only contain a banned word alone', () => {
    expect(messages('a.md', 'robustness and unlocked and pre-elevate')).toEqual([])
  })

  it('skips slop-ok blocks in markdown', () => {
    const text = ['<!-- slop-ok-start -->', 'delve —', '<!-- slop-ok-end -->', 'fine'].join('\n')
    expect(messages('a.md', text)).toEqual([])
  })

  it('does not honour slop-ok blocks in code', () => {
    const text = ['// <!-- slop-ok-start -->', '// delve', '// <!-- slop-ok-end -->'].join('\n')
    expect(messages('a.ts', text)).toHaveLength(1)
  })

  it('reports line and column', () => {
    const [finding] = findSlop('docs/a.md', 'ok\nso seamless', words)
    expect(finding).toMatchObject({ path: 'docs/a.md', line: 2, column: 4 })
  })

  it('ignores unchecked file types and the word list', () => {
    expect(messages('a.png', 'delve')).toEqual([])
    expect(messages('skills/slop-words.txt', 'delve')).toEqual([])
  })

  it('lets allowlisted names through but still flags the bare word', () => {
    const allow = ['Elevate Tweaks']
    expect(findSlop('a.md', 'Elevate Tweaks app', words, allow)).toEqual([])
    expect(findSlop('a.md', 'elevate your code', words, allow)).toHaveLength(1)
  })

  it('passes plain text', () => {
    expect(messages('a.ts', '// floor not round so the house never pays the extra unit')).toEqual([])
  })
})

import { describe, expect, it } from 'bun:test'
import { lintCommitMessage } from './lint-commit-msg'

describe('lint commit msg', () => {
  it('passes a scoped subject with a body', () => {
    const message = 'feat(games): mines cashout\n\nplayers can bank mid round now\n'
    expect(lintCommitMessage(message)).toEqual([])
  })

  it('passes an unscoped subject', () => {
    expect(lintCommitMessage('fix: drop the outline round the bunny eyes')).toEqual([])
  })

  it('passes a breaking change and real case identifiers', () => {
    expect(lintCommitMessage('feat(core)!: throw FeltError on a zero USDC amount')).toEqual([])
  })

  it('rejects a subject with no type', () => {
    expect(lintCommitMessage('Fixed the bug.')).toHaveLength(1)
  })

  it('rejects an unknown type', () => {
    expect(lintCommitMessage('feature: thing')).toEqual([
      expect.stringContaining('type must be one of'),
    ])
  })

  it('rejects capitals and trailing punctuation', () => {
    const problems = lintCommitMessage('feat(games): Add Mines Cashout.')
    expect(problems).toContain('subject ends in punctuation')
    expect(problems).toContain('subject should be lowercase')
  })

  it('rejects dashes and emoji', () => {
    const problems = lintCommitMessage('feat: cashout — partial \u{1F680}')
    expect(problems).toContain('subject has an em or en dash')
    expect(problems).toContain('subject has an emoji')
  })

  it('rejects a subject over 60 chars', () => {
    const problems = lintCommitMessage(`fix: ${'a'.repeat(60)}`)
    expect(problems).toEqual([expect.stringContaining('keep it to 60')])
  })

  it('rejects an empty subject like wip or updates', () => {
    expect(lintCommitMessage('chore: wip')).toEqual(['subject says nothing, name what changed'])
    expect(lintCommitMessage('fix: various fixes')).toHaveLength(1)
  })

  it('rejects a missing blank line before the body', () => {
    expect(lintCommitMessage('fix: a\nbody')).toContain(
      'leave a blank line between the subject and the body',
    )
  })

  it('rejects ai attribution in trailers and body', () => {
    const coAuthor = 'feat: a\n\nCo-Authored-By: Codex <codex@example.com>'
    expect(lintCommitMessage(coAuthor)).toEqual([expect.stringContaining('no ai attribution')])
    const footer = 'feat: a\n\ngenerated with claude code'
    expect(lintCommitMessage(footer)).toEqual([expect.stringContaining('no ai attribution')])
  })

  it('allows a body that names an ai sdk', () => {
    const message = 'fix(api): retry on rate limits\n\nthe openai client gives up after one 429'
    expect(lintCommitMessage(message)).toEqual([])
  })

  it('allows human trailers', () => {
    expect(lintCommitMessage('fix: a\n\nRefs: #42')).toEqual([])
  })

  it('checks scopes only when a list is given', () => {
    expect(lintCommitMessage('fix(web): a', { scopes: ['api'] })).toEqual([
      'scope must be one of api',
    ])
  })

  it('lets git generated and fixup subjects through unless strict', () => {
    expect(lintCommitMessage('Merge branch main')).toEqual([])
    expect(lintCommitMessage('fixup! feat: a')).toEqual([])
    expect(lintCommitMessage('fixup! feat: a', { strict: true })).toHaveLength(1)
  })

  it('ignores comment lines git adds', () => {
    expect(lintCommitMessage('fix: a\n# Please enter the commit message')).toEqual([])
  })
})

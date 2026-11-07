import { describe, expect, it } from 'bun:test'
import {
  dueStatus,
  formatDate,
  formatPenalty,
  formatRowCount,
} from '#src/features/radar/radar-format.ts'

describe('formatDate', () => {
  it('writes a register date the way people say it', () => {
    expect(formatDate('2026-11-14')).toBe('14 Nov 2026')
  })

  it('does not shift a date across midnight in any time zone', () => {
    expect(formatDate('2026-01-01')).toBe('1 Jan 2026')
  })

  it('rejects text that is not a calendar date', () => {
    expect(() => formatDate('14/11/2026')).toThrow('not an iso date')
  })
})

describe('formatPenalty', () => {
  it('hedges the estimate and groups thousands', () => {
    expect(formatPenalty(1200)).toBe('about €1,200')
  })

  it('says nothing when there is no penalty', () => {
    expect(formatPenalty(0)).toBe('')
  })
})

describe('dueStatus', () => {
  it('counts days late for an overdue company', () => {
    expect(dueStatus({ days_overdue: 140, days_to_deadline: -140 })).toEqual({
      figure: '140',
      unit: 'days late',
      tone: 'overdue',
    })
  })

  it('uses the singular for one day late', () => {
    expect(dueStatus({ days_overdue: 1, days_to_deadline: -1 }).unit).toBe('day late')
  })

  it('marks a deadline today as due today', () => {
    expect(dueStatus({ days_overdue: 0, days_to_deadline: 0 })).toEqual({
      figure: '0',
      unit: 'due today',
      tone: 'soon',
    })
  })

  it('treats two weeks or less as soon', () => {
    expect(dueStatus({ days_overdue: 0, days_to_deadline: 14 }).tone).toBe('soon')
    expect(dueStatus({ days_overdue: 0, days_to_deadline: 15 }).tone).toBe('later')
  })

  it('uses the singular for one day left', () => {
    expect(dueStatus({ days_overdue: 0, days_to_deadline: 1 }).unit).toBe('day left')
  })
})

describe('formatRowCount', () => {
  it('says how many matched and how many are shown when the list is cut', () => {
    expect(formatRowCount(42, 10)).toBe('42 companies matched, showing the first 10')
  })

  it('uses the singular for one company', () => {
    expect(formatRowCount(1, 1)).toBe('1 company matched')
  })

  it('reads naturally when nothing matched', () => {
    expect(formatRowCount(0, 0)).toBe('No companies matched')
  })
})

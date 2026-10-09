import { describe, expect, it } from 'vitest'
import { applyPatch, buildPatch, DiffError, formatPatch, parsePatch } from './patch'

describe('buildPatch', () => {
  it('produces a unified header and a hunk for a single change', () => {
    const patch = buildPatch('a\nb\nc\n', 'a\nB\nc\n', 'old.txt', 'new.txt')
    expect(patch.oldPath).toBe('old.txt')
    expect(patch.newPath).toBe('new.txt')
    expect(patch.hunks).toHaveLength(1)
    expect(formatPatch(patch)).toBe(
      ['--- old.txt', '+++ new.txt', '@@ -1,3 +1,3 @@', ' a', '-b', '+B', ' c', ''].join('\n'),
    )
  })

  it('records additions and removals with the right counts', () => {
    const patch = buildPatch('one\ntwo\n', 'one\ntwo\nthree\n')
    const hunk = patch.hunks[0]
    expect(hunk.oldCount).toBe(2)
    expect(hunk.newCount).toBe(3)
    expect(hunk.lines.filter((line) => line.op === 'add').map((line) => line.text)).toEqual(['three'])
  })

  it('returns no hunks for identical input', () => {
    expect(buildPatch('same\n', 'same\n').hunks).toHaveLength(0)
  })

  it('keeps one hunk when changes are close and splits them when far apart', () => {
    const near = buildPatch('a\nb\nc\nd\ne\n', 'A\nb\nc\nd\nE\n')
    expect(near.hunks).toHaveLength(1)
    const farLines = Array.from({ length: 40 }, (_, i) => `line ${i}`)
    const changed = [...farLines]
    changed[0] = 'first'
    changed[39] = 'last'
    const far = buildPatch(`${farLines.join('\n')}\n`, `${changed.join('\n')}\n`)
    expect(far.hunks).toHaveLength(2)
  })

  it('treats a missing final newline as a change', () => {
    const patch = buildPatch('a\nb', 'a\nb\n')
    expect(patch.hunks).toHaveLength(0)
    expect(patch.finalNewline).toBe(true)
    expect(applyPatch('a\nb', parsePatch(formatPatch(patch))).text).toBe('a\nb\n')
  })
})

describe('round trips', () => {
  const cases: Array<[string, string]> = [
    ['a\nb\nc\n', 'a\nb\nc\n'],
    ['a\nb\nc\n', 'a\nc\n'],
    ['a\nb\nc\n', 'a\nx\nb\nc\n'],
    ['one\ntwo\nthree\nfour\nfive\n', 'one\nthree\nfour\nFIVE\n'],
    ['single line\n', 'single line changed\n'],
    ['no trailing newline', 'no trailing newline, changed'],
  ]

  it.each(cases)('build → format → parse → apply reproduces the new text', (before, after) => {
    const patch = buildPatch(before, after)
    const applied = applyPatch(before, parsePatch(formatPatch(patch)))
    expect(applied.text).toBe(after)
  })

  it('handles a file that starts empty by creation', () => {
    const patch = buildPatch('', 'brand new\n')
    expect(patch.hunks[0]).toMatchObject({ oldStart: 1, oldCount: 0, newStart: 1, newCount: 1 })
  })
})

describe('parsePatch', () => {
  it('reads headers and hunk coordinates', () => {
    const patch = parsePatch(['--- a/x', '+++ b/x', '@@ -2,3 +2,4 @@', ' keep', '-drop', '+add', '+extra', ' tail'].join('\n'))
    expect(patch.oldPath).toBe('a/x')
    expect(patch.hunks[0]).toMatchObject({ oldStart: 2, oldCount: 3, newStart: 2, newCount: 4 })
  })

  it('tolerates the no-newline marker', () => {
    const patch = parsePatch(['@@ -1,1 +1,1 @@', '-old', '\\ No newline at end of file', '+new'].join('\n'))
    expect(patch.hunks[0].lines.map((line) => line.op)).toEqual(['remove', 'add'])
  })

  it('rejects a hunk whose counts do not add up', () => {
    expect(() => parsePatch('@@ -1,5 +1,5 @@\n only one line\n')).toThrow(/contains/)
  })

  it('rejects input that is not a patch', () => {
    expect(() => parsePatch('just some text')).toThrow(DiffError)
  })
})

describe('applyPatch', () => {
  it('finds a hunk that has drifted from its recorded line', () => {
    const source = 'extra\nprepended\na\nb\nc\n'
    const patch = parsePatch(['@@ -1,3 +1,3 @@', ' a', '-b', '+B', ' c'].join('\n'))
    expect(applyPatch(source, patch).text).toBe('extra\nprepended\na\nB\nc\n')
  })

  it('reports the line when the context cannot be found', () => {
    const patch = parsePatch(['@@ -1,3 +1,3 @@', ' a', '-b', '+B', ' c'].join('\n'))
    expect(() => applyPatch('totally\ndifferent\n', patch)).toThrow(/does not match/)
  })

  it('reports the line when a removal does not match', () => {
    const patch = parsePatch(['@@ -1,2 +1,1 @@', ' a', '-nope'].join('\n'))
    expect(() => applyPatch('a\nb\n', patch)).toThrow(DiffError)
  })

  it('rejects a hunk whose declared counts do not add up', () => {
    expect(() => parsePatch(['@@ -1,2 +1,2 @@', ' a', '-nope'].join('\n'))).toThrow(/contains/)
  })
})

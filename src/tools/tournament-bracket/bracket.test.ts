import { describe, expect, it } from 'vitest'
import { champion, createBracket, nextPowerOfTwo, pickWinner, roundName, seedPositions } from './bracket'

describe('nextPowerOfTwo', () => {
  it('rounds up to the next power of two', () => {
    expect(nextPowerOfTwo(3)).toBe(4)
    expect(nextPowerOfTwo(5)).toBe(8)
    expect(nextPowerOfTwo(8)).toBe(8)
    expect(nextPowerOfTwo(9)).toBe(16)
  })

  it('handles the small cases', () => {
    expect(nextPowerOfTwo(0)).toBe(1)
    expect(nextPowerOfTwo(1)).toBe(1)
    expect(nextPowerOfTwo(2)).toBe(2)
  })
})

describe('seedPositions', () => {
  it('produces the classic 4-slot order', () => {
    // 1v4 and 2v3: the top seed meets the lowest.
    expect(seedPositions(4)).toEqual([1, 4, 2, 3])
  })

  it('produces the classic 8-slot order', () => {
    expect(seedPositions(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6])
  })

  it('keeps every seed exactly once', () => {
    const order = seedPositions(16)
    expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1))
  })

  it('pairs each seed with one that sums to size + 1', () => {
    const size = 16
    const order = seedPositions(size)
    for (let i = 0; i < order.length; i += 2) {
      expect(order[i] + order[i + 1]).toBe(size + 1)
    }
  })

  it('rejects a non-power-of-two size', () => {
    expect(() => seedPositions(6)).toThrow()
  })
})

describe('roundName', () => {
  it('names the closing rounds', () => {
    expect(roundName(1)).toBe('Final')
    expect(roundName(2)).toBe('Semi-finals')
    expect(roundName(4)).toBe('Quarter-finals')
  })

  it('falls back to the round of N', () => {
    expect(roundName(8)).toBe('Round of 16')
    expect(roundName(16)).toBe('Round of 32')
  })
})

describe('createBracket', () => {
  it('builds the right shape for a clean power of two', () => {
    const bracket = createBracket(['A', 'B', 'C', 'D'])
    expect(bracket.size).toBe(4)
    expect(bracket.byes).toBe(0)
    expect(bracket.rounds.map((r) => r.matches.length)).toEqual([2, 1])
    expect(bracket.rounds[0].name).toBe('Semi-finals')
    expect(bracket.rounds[1].name).toBe('Final')
  })

  it('gives byes to the top seeds when the count is not a power of two', () => {
    const bracket = createBracket(['A', 'B', 'C', 'D', 'E'])
    expect(bracket.size).toBe(8)
    expect(bracket.byes).toBe(3)
    // The top seed in a seeded bracket has no opponent, so it advances.
    const first = bracket.rounds[0].matches
    expect(first[0].a.name).toBe('A')
    expect(first[0].b.name).toBeNull()
    expect(first[0].winner).toBe('a')
  })

  it('advances a bye into the next round so nobody is stranded', () => {
    const bracket = createBracket(['A', 'B', 'C'])
    // A plays a bye and should already appear in the final.
    const final = bracket.rounds[1].matches[0]
    const names = [final.a.name, final.b.name].filter(Boolean)
    expect(names).toContain('A')
  })

  it('applies a custom order before seeding', () => {
    const bracket = createBracket(['A', 'B', 'C', 'D'], [3, 2, 1, 0])
    // Seed 1 is now 'D'.
    expect(bracket.rounds[0].matches[0].a.name).toBe('D')
  })

  it('refuses fewer than two entrants', () => {
    expect(() => createBracket(['solo'])).toThrow()
  })
})

describe('pickWinner', () => {
  it('advances the chosen side into the next round', () => {
    // Seeded pairs: seed 1 (A) plays seed 4 (D); seed 2 (B) plays seed 3 (C).
    const bracket = createBracket(['A', 'B', 'C', 'D'])
    expect(bracket.rounds[0].matches.map((m) => [m.a.name, m.b.name])).toEqual([
      ['A', 'D'],
      ['B', 'C'],
    ])
    pickWinner(bracket, 0, 0, 'a') // A beats D
    pickWinner(bracket, 0, 1, 'b') // C beats B
    const final = bracket.rounds[1].matches[0]
    expect([final.a.name, final.b.name]).toEqual(['A', 'C'])
  })

  it('clears a stale result when an earlier pick changes', () => {
    const bracket = createBracket(['A', 'B', 'C', 'D'])
    pickWinner(bracket, 0, 0, 'a') // A beats D
    pickWinner(bracket, 0, 1, 'a') // B beats C
    pickWinner(bracket, 1, 0, 'a') // A wins the final
    expect(champion(bracket)).toBe('A')

    // D now wins the first semi, so the old champion must not survive.
    pickWinner(bracket, 0, 0, 'b')
    expect(champion(bracket)).toBeNull()
    const final = bracket.rounds[1].matches[0]
    expect([final.a.name, final.b.name]).toEqual(['D', 'B'])
  })

  it('rejects a pick on an empty side', () => {
    const bracket = createBracket(['A', 'B', 'C'])
    // The last first-round match has a bye on the B side.
    const byeMatchIndex = bracket.rounds[0].matches.findIndex((m) => m.b.name === null)
    expect(() => pickWinner(bracket, 0, byeMatchIndex, 'b')).toThrow()
  })
})

describe('champion', () => {
  it('is null until the final is decided', () => {
    const bracket = createBracket(['A', 'B'])
    expect(champion(bracket)).toBeNull()
    pickWinner(bracket, 0, 0, 'a')
    expect(champion(bracket)).toBe('A')
  })

  it('works out a bye-heavy bracket', () => {
    const bracket = createBracket(['A', 'B', 'C'])
    expect(bracket.rounds[1].matches[0].winner === null || champion(bracket) === null).toBe(true)
  })
})

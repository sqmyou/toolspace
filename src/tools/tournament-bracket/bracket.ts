/**
 * Single-elimination bracket generation.
 *
 * The interesting part is byes. When the entrant count is not a power of two,
 * the standard approach is to give the top seeds a free pass into round two and
 * spread those byes out so no seed gets two. That is what `seedPositions`
 * encodes: it returns the classic bracket order (1 vs 16, 8 vs 9, …) as a list
 * of seed numbers, and pairing them adjacent gives a fair bracket.
 */

/** The smallest power of two at or above `n`. */
export function nextPowerOfTwo(n: number): number {
  if (n <= 1) return 1
  let size = 1
  while (size < n) size *= 2
  return size
}

/**
 * The standard seed order for a bracket of `size` slots.
 *
 * The result has one entry per slot: `result[0]` is the seed that plays
 * `result[1]` in the first match, and so on. It is built by recursively
 * interleaving, which is why the top seed meets the weakest possible seed in
 * every round.
 */
export function seedPositions(size: number): number[] {
  if (size < 1 || (size & (size - 1)) !== 0) throw new Error('Bracket size must be a power of two.')
  let order = [1]
  while (order.length < size) {
    const round = order.length * 2
    const next: number[] = []
    for (const seed of order) {
      next.push(seed)
      next.push(round + 1 - seed)
    }
    order = next
  }
  return order
}

export interface Slot {
  name: string | null
  seed: number | null
}

export interface Match {
  id: string
  a: Slot
  b: Slot
  winner: 'a' | 'b' | null
}

export interface Round {
  name: string
  matches: Match[]
}

export interface Bracket {
  rounds: Round[]
  entrants: string[]
  size: number
  byes: number
}

/**
 * A label for a round, derived from how many matches it holds: one match can
 * only be the final, two the semis, four the quarters, and anything wider is
 * the "round of N" for the N players still in it.
 */
export function roundName(matchCount: number): string {
  if (matchCount === 1) return 'Final'
  if (matchCount === 2) return 'Semi-finals'
  if (matchCount === 4) return 'Quarter-finals'
  return `Round of ${matchCount * 2}`
}

const emptySlot = (): Slot => ({ name: null, seed: null })

/**
 * Build a bracket from entrant names.
 *
 * `order` is applied before seeding, so a caller can shuffle entrants (with
 * crypto randomness) and still get a properly seeded bracket.
 */
export function createBracket(entrants: string[], order?: number[]): Bracket {
  const names = order ? order.map((index) => entrants[index]) : entrants.slice()
  const count = names.length
  if (count < 2) throw new Error('A bracket needs at least two entrants.')
  const size = nextPowerOfTwo(count)
  const positions = seedPositions(size)

  // Slot the entrants by seed. Seeds beyond the entrant count are byes, so a
  // top seed facing one walks into round two.
  const seeded: Slot[] = positions.map((seed) => ({
    name: seed <= count ? names[seed - 1] : null,
    seed: seed <= count ? seed : null,
  }))

  const byes = seeded.filter((slot) => slot.name === null).length
  const firstRound: Match[] = []
  for (let i = 0; i < seeded.length; i += 2) {
    firstRound.push({
      id: `r0m${i / 2}`,
      a: seeded[i],
      b: seeded[i + 1],
      winner: null,
    })
  }

  const rounds: Round[] = [{ name: roundName(firstRound.length), matches: firstRound }]
  let matchCount = firstRound.length / 2
  let round = 1
  while (matchCount >= 1) {
    const matches: Match[] = Array.from({ length: matchCount }, (_, i) => ({
      id: `r${round}m${i}`,
      a: emptySlot(),
      b: emptySlot(),
      winner: null,
    }))
    rounds.push({ name: roundName(matchCount), matches })
    matchCount = Math.floor(matchCount / 2)
    round += 1
  }

  const bracket: Bracket = { rounds, entrants: names, size, byes }
  recompute(bracket)
  return bracket
}

/**
 * Rebuild every slot and byes-free winner from the round-one results.
 *
 * Recomputing from scratch, rather than patching one match forward, is what
 * makes changing an early pick safe: a new result simply overwrites the slots
 * it feeds and any stale downstream winner disappears on its own. `alive`
 * marks which first-round matches hold a player, which is how a genuine bye is
 * told apart from a match that is only waiting on a result.
 */
function recompute(bracket: Bracket): void {
  const rounds = bracket.rounds
  const alive: boolean[] = rounds[0].matches.map((m) => m.a.name !== null || m.b.name !== null)

  // Round one: a match with exactly one player is a bye and resolves itself.
  for (const match of rounds[0].matches) {
    if (match.winner) continue
    if (match.a.name !== null && match.b.name === null) match.winner = 'a'
    else if (match.b.name !== null && match.a.name === null) match.winner = 'b'
  }

  const winnerSlot = (match: Match | undefined): Slot | null => {
    if (!match || match.winner === null) return null
    return match.winner === 'a' ? match.a : match.b
  }

  let previousAlive = alive
  for (let r = 1; r < rounds.length; r += 1) {
    const currentAlive = rounds[r].matches.map((_, m) => Boolean(previousAlive[2 * m] || previousAlive[2 * m + 1]))
    rounds[r].matches.forEach((match, m) => {
      const top = winnerSlot(rounds[r - 1].matches[2 * m])
      const bottom = winnerSlot(rounds[r - 1].matches[2 * m + 1])
      applySlot(match, 'a', top)
      applySlot(match, 'b', bottom)
      // A side whose whole sub-bracket has nobody left can never be filled, so
      // a lone player on the other side goes through without a game.
      const topDead = !previousAlive[2 * m]
      const bottomDead = !previousAlive[2 * m + 1]
      if (match.winner === null) {
        if (match.a.name !== null && topDead) match.winner = 'a'
        else if (match.b.name !== null && bottomDead) match.winner = 'b'
      }
    })
    previousAlive = currentAlive
  }
}

/** Write a winner into a slot, clearing the recorded winner if it changes. */
function applySlot(match: Match, side: 'a' | 'b', slot: Slot | null): void {
  const next = slot ?? emptySlot()
  const target = match[side]
  if (target.name === next.name && target.seed === next.seed) return
  target.name = next.name
  target.seed = next.seed
  if (match.winner === side) match.winner = null
}

/**
 * Record a winner and rebuild the bracket. Any later result that depended on
 * the old outcome is dropped as a side effect, so a stale champion is
 * impossible.
 */
export function pickWinner(bracket: Bracket, roundIndex: number, matchIndex: number, side: 'a' | 'b'): void {
  const match = bracket.rounds[roundIndex]?.matches[matchIndex]
  if (!match) throw new Error('No such match.')
  const chosen = side === 'a' ? match.a : match.b
  if (chosen.name === null) throw new Error('That side is empty.')
  match.winner = side
  recompute(bracket)
}

/** The champion, once the final has been decided. */
export function champion(bracket: Bracket): string | null {
  const final = bracket.rounds[bracket.rounds.length - 1].matches[0]
  if (!final || final.winner === null) return null
  return final.winner === 'a' ? final.a.name : final.b.name
}

/** A shuffled index list drawn from the platform CSPRNG (Fisher–Yates). */
export function shuffledOrder(count: number): number[] {
  const order = Array.from({ length: count }, (_, i) => i)
  const buffer = new Uint32Array(1)
  for (let i = order.length - 1; i > 0; i -= 1) {
    crypto.getRandomValues(buffer)
    const j = buffer[0] % (i + 1)
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

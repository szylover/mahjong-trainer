import { TILE_INDEX, TILES, tilesToCounts } from './tiles'
import { calculateShanten } from './shanten'

export interface WaitQualityResult {
  discard: string
  shantenAfter: number
  ukeire: number
  goodShapeRate: number
  goodShapeUkeire: number
  badShapeUkeire: number
}

export function calculateWaitQuality(hand: string[], visible: string[] = []): WaitQualityResult[] {
  const handCounts = tilesToCounts(hand)
  const visibleCounts = tilesToCounts(visible)
  const usedCounts = handCounts.map((c, i) => c + visibleCounts[i])

  const results: WaitQualityResult[] = []
  const seen = new Set<string>()

  for (const discard of hand) {
    if (seen.has(discard)) continue
    seen.add(discard)

    const di = TILE_INDEX[discard]
    if (di == null) continue

    // Remove discard -> 13 tiles
    const after13 = [...handCounts]
    after13[di] -= 1
    const shantenAfter = calculateShanten(after13)

    // Find useful tiles and classify good/bad shape
    let goodShapeUkeire = 0
    let badShapeUkeire = 0
    const usefulTiles: string[] = []

    for (let ti = 0; ti < 34; ti++) {
      if (usedCounts[ti] >= 4) continue
      // Temporarily pretend we didn't discard for the used count
      const effectiveUsed = ti === di ? usedCounts[ti] - 1 : usedCounts[ti]
      if (effectiveUsed >= 4) continue

      after13[ti] += 1
      const newShanten = calculateShanten(after13)
      after13[ti] -= 1

      if (newShanten < shantenAfter) {
        const remaining = 4 - effectiveUsed
        usefulTiles.push(TILES[ti])

        if (shantenAfter <= 1) {
          // Check if drawing this tile leads to a good shape
          // Heuristic: the drawn tile sits in a ryanmen-like position
          const rank = ti % 9
          const isNumberTile = ti < 27
          let isGood = false

          if (isNumberTile) {
            const suitStart = Math.floor(ti / 9) * 9
            // Check if this tile connects to form a two-sided wait
            // Two-sided: tile has neighbors on both sides
            if (rank >= 1 && rank <= 7) {
              // Middle tile - check if it connects with neighbors
              if (after13[ti - 1] > 0 || after13[Math.min(ti + 1, suitStart + 8)] > 0) {
                isGood = rank >= 1 && rank <= 7
              }
            }
          }

          if (isGood) {
            goodShapeUkeire += remaining
          } else {
            badShapeUkeire += remaining
          }
        } else {
          // For higher shanten, use simple heuristic
          badShapeUkeire += remaining
        }
      }
    }

    const total = goodShapeUkeire + badShapeUkeire
    results.push({
      discard,
      shantenAfter,
      ukeire: total,
      goodShapeRate: total > 0 ? (goodShapeUkeire / total) * 100 : 0,
      goodShapeUkeire,
      badShapeUkeire,
    })
  }

  results.sort((a, b) => a.shantenAfter - b.shantenAfter || b.ukeire - a.ukeire)
  return results
}

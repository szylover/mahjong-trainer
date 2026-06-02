import { calculateEfficiency } from './efficiency'
import { countsToTiles, TILE_INDEX, tilesToCounts } from './tiles'

export interface WaitQualityResult {
  discard: string
  shantenAfter: number
  ukeire: number
  goodShapeRate: number
  goodShapeUkeire: number
  badShapeUkeire: number
}

function isGoodShape(nextHand: string[], currentShanten: number, visible: string[]) {
  const followUp = calculateEfficiency(nextHand, visible)
  const best = followUp[0]
  if (!best) {
    return false
  }

  const targetShanten = Math.max(currentShanten - 1, 0)
  return best.shantenAfter <= targetShanten && best.ukeire >= 6
}

export function calculateWaitQuality(hand: string[], visible: string[] = []): WaitQualityResult[] {
  const baseOptions = calculateEfficiency(hand, visible)
  const visibleCounts = tilesToCounts(visible)
  const handCounts = tilesToCounts(hand)

  return baseOptions.map((option) => {
    const discardIndex = TILE_INDEX[option.discard]
    if (discardIndex == null) {
      return {
        discard: option.discard,
        shantenAfter: option.shantenAfter,
        ukeire: option.ukeire,
        goodShapeRate: 0,
        goodShapeUkeire: 0,
        badShapeUkeire: option.ukeire,
      }
    }

    handCounts[discardIndex] -= 1
    let goodShapeUkeire = 0
    let badShapeUkeire = 0

    for (const tile of option.usefulTiles) {
      const tileIndex = TILE_INDEX[tile]
      if (tileIndex == null) {
        continue
      }

      const remaining = Math.max(4 - handCounts[tileIndex] - visibleCounts[tileIndex], 0)
      if (remaining === 0) {
        continue
      }

      handCounts[tileIndex] += 1
      const nextHand = countsToTiles(handCounts)
      const good = isGoodShape(nextHand, option.shantenAfter, visible)
      handCounts[tileIndex] -= 1

      if (good) {
        goodShapeUkeire += remaining
      } else {
        badShapeUkeire += remaining
      }
    }

    handCounts[discardIndex] += 1

    const total = goodShapeUkeire + badShapeUkeire
    return {
      discard: option.discard,
      shantenAfter: option.shantenAfter,
      ukeire: option.ukeire,
      goodShapeRate: total > 0 ? (goodShapeUkeire / total) * 100 : 0,
      goodShapeUkeire,
      badShapeUkeire,
    }
  })
}

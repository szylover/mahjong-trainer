import { calculateShanten } from './shanten'
import { TILE_INDEX, TILES, tilesToCounts } from './tiles'

export interface EfficiencyResult {
  discard: string
  shantenAfter: number
  ukeire: number
  usefulTiles: string[]
}

function getVisibleCounts(visible: string[] = []) {
  return tilesToCounts(visible)
}

export function calculateEfficiency(hand: string[], visible: string[] = []): EfficiencyResult[] {
  const handCounts = tilesToCounts(hand)
  const visibleCounts = getVisibleCounts(visible)
  const discards = [...new Set(hand)]

  return discards
    .map((discard) => {
      const discardIndex = TILE_INDEX[discard]
      if (discardIndex == null || handCounts[discardIndex] === 0) {
        return null
      }

      handCounts[discardIndex] -= 1
      const shantenAfter = calculateShanten(handCounts)
      let ukeire = 0
      const usefulTiles: string[] = []

      for (let index = 0; index < TILES.length; index += 1) {
        const remaining = Math.max(4 - handCounts[index] - visibleCounts[index], 0)
        if (remaining === 0) {
          continue
        }

        handCounts[index] += 1
        const nextShanten = calculateShanten(handCounts)
        handCounts[index] -= 1

        if (nextShanten < shantenAfter) {
          usefulTiles.push(TILES[index])
          ukeire += remaining
        }
      }

      handCounts[discardIndex] += 1

      return {
        discard,
        shantenAfter,
        ukeire,
        usefulTiles,
      }
    })
    .filter((item): item is EfficiencyResult => item != null)
    .sort((left, right) => {
      if (left.shantenAfter !== right.shantenAfter) {
        return left.shantenAfter - right.shantenAfter
      }
      if (left.ukeire !== right.ukeire) {
        return right.ukeire - left.ukeire
      }
      return left.discard.localeCompare(right.discard)
    })
}

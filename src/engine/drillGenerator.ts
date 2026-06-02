import type { DiscardAnalysisOption, DrillProblem, ModeKey, UsefulTile } from '../types'
import { calculateEfficiency } from './efficiency'
import { generateExplanation } from './explanation'
import { analyzeHandStructure } from './structure'
import { TILES, TILE_INDEX, ALL_TILES, tilesToCounts } from './tiles'
import { calculateWaitQuality } from './waitQuality'

const PROMPTS: Record<ModeKey, string> = {
  shanten: '判断最优切牌，优先保证向听效率。',
  ukeire: '比较所有打牌后的受入，找出最优切牌。',
  shape: '这题需要兼顾受入与好形率。',
  sim: '按实战感觉作答，但最优解仍以牌效为准。',
  speed: '快速选择最优切牌，稳定命中牌效答案。',
}

interface RankedOption extends DiscardAnalysisOption {
  usefulTileCodes: string[]
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

function compareOptions(left: Pick<RankedOption, 'discard' | 'shanten' | 'ukeire' | 'quality'>, right: Pick<RankedOption, 'discard' | 'shanten' | 'ukeire' | 'quality'>) {
  if (left.shanten !== right.shanten) {
    return left.shanten - right.shanten
  }

  const leftUkeire = left.ukeire ?? -1
  const rightUkeire = right.ukeire ?? -1
  const leftQuality = left.quality ?? -1
  const rightQuality = right.quality ?? -1
  const ukeireGap = Math.abs(leftUkeire - rightUkeire)

  if (ukeireGap <= 2 && leftQuality !== rightQuality) {
    return rightQuality - leftQuality
  }

  if (leftUkeire !== rightUkeire) {
    return rightUkeire - leftUkeire
  }

  if (leftQuality !== rightQuality) {
    return rightQuality - leftQuality
  }

  return left.discard.localeCompare(right.discard)
}

function buildRankedOptions(hand: string[]): RankedOption[] {
  const efficiency = calculateEfficiency(hand)
  const qualityMap = new Map(calculateWaitQuality(hand).map((item) => [item.discard, item]))

  const merged = efficiency.map((item) => {
    const quality = qualityMap.get(item.discard)
    return {
      discard: item.discard,
      shanten: item.shantenAfter,
      ukeire: item.ukeire,
      quality: quality?.goodShapeRate ?? null,
      usefulTileCodes: item.usefulTiles,
    }
  })

  const sorted = merged.sort(compareOptions)
  return sorted.map((item, index) => ({ ...item, isBest: index === 0 }))
}

function removeTile(hand: string[], tile: string) {
  const next = [...hand]
  const index = next.indexOf(tile)
  if (index >= 0) {
    next.splice(index, 1)
  }
  return next
}

function toUsefulTiles(hand: string[], discard: string, usefulTileCodes: string[]): UsefulTile[] {
  const counts = tilesToCounts(hand)
  const discardIndex = TILE_INDEX[discard]
  if (discardIndex != null) {
    counts[discardIndex] -= 1
  }

  return usefulTileCodes.map((tile) => {
    const tileIndex = TILE_INDEX[tile]
    const count = tileIndex == null ? 0 : Math.max(4 - counts[tileIndex], 0)
    return { tile, count }
  })
}

function hasComplexTaatsu(hand13: string[]) {
  const suitMap = new Map<string, number[]>()
  hand13.forEach((tile) => {
    if (!/^[1-9][mps]$/.test(tile)) {
      return
    }
    const suit = tile.at(-1) ?? ''
    const rank = Number(tile[0])
    const ranks = suitMap.get(suit) ?? []
    ranks.push(rank)
    suitMap.set(suit, ranks)
  })

  return [...suitMap.values()].some((ranks) => {
    const uniqueRanks = [...new Set(ranks)].sort((left, right) => left - right)
    let adjacentPairs = 0
    for (let index = 1; index < uniqueRanks.length; index += 1) {
      if (uniqueRanks[index] - uniqueRanks[index - 1] <= 2) {
        adjacentPairs += 1
      }
    }
    return adjacentPairs >= 2
  })
}

function classifyTags(hand: string[], best: RankedOption, second: RankedOption | undefined) {
  const hand13 = removeTile(hand, best.discard)
  const tags: string[] = []
  const ukeireGap = best.ukeire != null && second?.ukeire != null ? Math.abs(best.ukeire - second.ukeire) : 0
  const qualityGap = best.quality != null && second?.quality != null ? Math.abs(best.quality - second.quality) : 0

  if (hasComplexTaatsu(hand13)) {
    tags.push('複合搭子')
  }
  if (hand.some((tile) => !/^[1-9][mps]$/.test(tile)) || !/^[1-9][mps]$/.test(best.discard)) {
    tags.push('字牌処理')
  }
  if (ukeireGap > 0 && ukeireGap <= 8) {
    tags.push('受入比較')
  }
  if (qualityGap >= 10 || (best.quality ?? 0) >= 60) {
    tags.push('好形判断')
  }

  return [...new Set(tags)]
}

function matchesDifficulty(difficulty: number, options: RankedOption[]) {
  const best = options[0]
  const second = options[1]
  if (!best) {
    return false
  }

  const gap = best.ukeire != null && second?.ukeire != null ? best.ukeire - second.ukeire : 99
  const qualityGap = best.quality != null && second?.quality != null ? best.quality - second.quality : 0
  const pureUkeireBest = [...options].sort((left, right) => {
    if (left.shanten !== right.shanten) {
      return left.shanten - right.shanten
    }
    return (right.ukeire ?? -1) - (left.ukeire ?? -1)
  })[0]

  switch (difficulty) {
    case 1:
      return best.shanten === 1 && gap > 8
    case 2:
      return best.shanten === 1 && gap >= 2 && gap <= 8
    case 3:
      return best.shanten === 2
    case 4:
      return best.shanten === 1 && gap <= 4 && qualityGap >= 10 && pureUkeireBest?.discard !== best.discard
    default:
      return best.shanten === 1
  }
}

function generateSingleProblem(mode: ModeKey, difficulty: number, index: number): DrillProblem {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const hand = shuffle(ALL_TILES).slice(0, 14)
    const options = buildRankedOptions(hand)

    if (!matchesDifficulty(difficulty, options)) {
      continue
    }

    const best = options[0]
    if (!best) {
      continue
    }

    const second = options[1]
    const hand13 = removeTile(hand, best.discard)
    const structure = analyzeHandStructure(hand13)
    const tags = classifyTags(hand, best, second)
    const explanation = generateExplanation({
      mode,
      bestDiscard: best.discard,
      options,
      structure,
      tags,
    })

    return {
      id: `${mode}-${difficulty}-${index}-${attempt}-${Date.now()}`,
      mode,
      difficulty,
      hand,
      tags,
      prompt: PROMPTS[mode],
      bestDiscard: best.discard,
      analysisOptions: options.map(({ usefulTileCodes, ...option }) => option),
      usefulTiles: toUsefulTiles(hand, best.discard, best.usefulTileCodes),
      explanation,
    }
  }

  const fallbackHand = shuffle(ALL_TILES).slice(0, 14)
  const fallbackOptions = buildRankedOptions(fallbackHand)
  const fallbackBest = fallbackOptions[0]
  const hand13 = fallbackBest ? removeTile(fallbackHand, fallbackBest.discard) : fallbackHand.slice(0, 13)
  const structure = analyzeHandStructure(hand13)
  const tags = fallbackBest ? classifyTags(fallbackHand, fallbackBest, fallbackOptions[1]) : ['受入比較']

  return {
    id: `${mode}-${difficulty}-${index}-fallback-${Date.now()}`,
    mode,
    difficulty,
    hand: fallbackHand,
    tags,
    prompt: PROMPTS[mode],
    bestDiscard: fallbackBest?.discard,
    analysisOptions: fallbackOptions.map(({ usefulTileCodes, ...option }) => option),
    usefulTiles: fallbackBest ? toUsefulTiles(fallbackHand, fallbackBest.discard, fallbackBest.usefulTileCodes) : [],
    explanation: generateExplanation({
      mode,
      bestDiscard: fallbackBest?.discard ?? TILES[0],
      options: fallbackOptions,
      structure,
      tags,
    }),
  }
}

export function generateDrillProblems(mode: ModeKey, difficulty: number, count: number): DrillProblem[] {
  return Array.from({ length: count }, (_, index) => generateSingleProblem(mode, difficulty, index))
}

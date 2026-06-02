import type {
  DailyStat,
  DiscardAnalysisOption,
  DrillEvaluateRequest,
  DrillEvaluationResponse,
  DrillGenerateRequest,
  DrillGenerateResponse,
  ModeKey,
  RecordStatsRequest,
  StatsSummaryResponse,
  TileCode,
  WeaknessResponse,
} from './types'
import {
  calculateEfficiency,
  calculateWaitQuality,
  generateDrillProblems,
  generateExplanation,
  analyzeHandStructure,
  tilesToCounts,
  TILE_INDEX,
} from './engine'

interface StoredRecord {
  date: string
  mode: ModeKey
  difficulty: number
  isCorrect: boolean
  timeMs: number
  tags: string[]
}

const STORAGE_KEY = 'mahjong-trainer:stats'

interface RankedOption extends DiscardAnalysisOption {
  usefulTileCodes: string[]
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function readStoredRecords(): StoredRecord[] {
  if (!canUseStorage()) {
    return []
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .map((item) => item as Partial<StoredRecord>)
      .filter((item): item is StoredRecord => typeof item.date === 'string' && typeof item.mode === 'string')
      .map((item) => ({
        date: item.date,
        mode: item.mode,
        difficulty: Number(item.difficulty ?? 1),
        isCorrect: Boolean(item.isCorrect),
        timeMs: Number(item.timeMs ?? 0),
        tags: Array.isArray(item.tags) ? item.tags.map((tag) => String(tag)) : [],
      }))
  } catch {
    return []
  }
}

function writeStoredRecords(records: StoredRecord[]) {
  if (!canUseStorage()) {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
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

function buildRankedOptions(hand: TileCode[]): RankedOption[] {
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

function removeTile(hand: TileCode[], tile: TileCode) {
  const next = [...hand]
  const index = next.indexOf(tile)
  if (index >= 0) {
    next.splice(index, 1)
  }
  return next
}

function toUsefulTiles(hand: TileCode[], discard: TileCode, usefulTileCodes: string[]) {
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

function toRecentDates(days: number) {
  const result: string[] = []
  const today = new Date()
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const current = new Date(today)
    current.setDate(today.getDate() - offset)
    result.push(current.toISOString().slice(0, 10))
  }
  return result
}

function getStoredRecordsInRange(days: number) {
  const dates = new Set(toRecentDates(days))
  return readStoredRecords().filter((record) => dates.has(record.date))
}

export async function generateDrill(payload: DrillGenerateRequest): Promise<DrillGenerateResponse> {
  // Calculations run synchronously on the main thread for now; a Web Worker can be added later if needed.
  return {
    problems: generateDrillProblems(payload.mode, payload.difficulty, payload.count),
  }
}

export async function evaluateDrill(payload: DrillEvaluateRequest): Promise<DrillEvaluationResponse> {
  const options = buildRankedOptions(payload.hand)
  const best = options[0]
  const userOption = options.find((item) => item.discard === payload.discard)

  if (!best) {
    throw new Error('Unable to evaluate hand')
  }

  const structure = analyzeHandStructure(removeTile(payload.hand, best.discard))
  const tags: string[] = []
  if (payload.hand.some((tile) => !/^[1-9][mps]$/.test(tile))) {
    tags.push('字牌処理')
  }
  if ((best.quality ?? 0) >= 60) {
    tags.push('好形判断')
  }
  const explanation = generateExplanation({
    bestDiscard: best.discard,
    options,
    structure,
    tags,
  })

  return {
    correct: payload.discard === best.discard,
    analysis: {
      bestDiscard: best.discard,
      userDiscard: payload.discard,
      scoreGap: Math.max((best.ukeire ?? 0) - (userOption?.ukeire ?? 0), 0),
      options: options.map(({ usefulTileCodes, ...option }) => option),
      usefulTiles: toUsefulTiles(payload.hand, best.discard, best.usefulTileCodes),
    },
    explanation,
  }
}

export async function getStatsSummary(days = 30): Promise<StatsSummaryResponse> {
  const records = getStoredRecordsInRange(days)
  const dateMap = new Map<string, StoredRecord[]>()

  for (const date of toRecentDates(days)) {
    dateMap.set(date, [])
  }

  records.forEach((record) => {
    dateMap.get(record.date)?.push(record)
  })

  const daily: DailyStat[] = [...dateMap.entries()].map(([date, items]) => {
    const total = items.length
    const correct = items.filter((item) => item.isCorrect).length
    const avgTime = total > 0 ? items.reduce((sum, item) => sum + item.timeMs, 0) / total / 1000 : 0
    return {
      date,
      total,
      correct,
      accuracy: total > 0 ? correct / total : 0,
      avgTime,
    }
  })

  const total = records.length
  const correct = records.filter((item) => item.isCorrect).length
  const avgTime = total > 0 ? records.reduce((sum, item) => sum + item.timeMs, 0) / total / 1000 : 0

  return {
    total,
    correct,
    accuracy: total > 0 ? correct / total : 0,
    avgTime,
    daily,
  }
}

export async function getWeaknessStats(): Promise<WeaknessResponse> {
  const records = readStoredRecords()
  const grouped = new Map<string, { total: number; correct: number }>()

  records.forEach((record) => {
    record.tags.forEach((tag) => {
      const current = grouped.get(tag) ?? { total: 0, correct: 0 }
      current.total += 1
      if (record.isCorrect) {
        current.correct += 1
      }
      grouped.set(tag, current)
    })
  })

  return {
    weaknesses: [...grouped.entries()]
      .map(([tag, stats]) => ({
        tag,
        total: stats.total,
        correct: stats.correct,
        rate: stats.total > 0 ? stats.correct / stats.total : 0,
      }))
      .sort((left, right) => left.rate - right.rate || right.total - left.total),
  }
}

export async function recordStats(payload: RecordStatsRequest): Promise<void> {
  const records = readStoredRecords()
  records.push({
    date: new Date().toISOString().slice(0, 10),
    mode: payload.mode,
    difficulty: payload.difficulty,
    isCorrect: payload.is_correct,
    timeMs: payload.time_ms,
    tags: payload.tags,
  })
  writeStoredRecords(records)
}

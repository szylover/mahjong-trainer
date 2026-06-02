import type {
  DailyStat,
  DefenseEvaluationResponse,
  DefenseProblem,
  DrillEvaluateRequest,
  DrillEvaluationResponse,
  DrillGenerateRequest,
  DrillGenerateResponse,
  ExplanationSections,
  ModeKey,
  RecordStatsRequest,
  StatsSummaryResponse,
  TileCode,
  WeaknessResponse,
} from './types'

/* ── Pre-generated problem bank ── */

interface ProblemOption {
  discard: string
  shanten: number
  ukeire: number
  quality: number | null
  isBest: boolean
  usefulTiles: { tile: string; count: number }[]
}

interface Problem {
  id: string
  category: string
  categoryLabel: string
  difficulty: number
  hand: TileCode[]
  bestDiscard: string
  options: ProblemOption[]
  explanation: ExplanationSections | string
  tags: string[]
}

const problemCache = new Map<number, Problem[]>()

async function loadProblems(difficulty: number): Promise<Problem[]> {
  const cached = problemCache.get(difficulty)
  if (cached) return cached

  const resp = await fetch(`/data/problems-L${difficulty}.json?v=${Date.now()}`)
  if (!resp.ok) throw new Error(`Failed to load L${difficulty} problems (${resp.status})`)
  const text = await resp.text()
  if (text.startsWith('<!')) throw new Error('Got HTML instead of JSON — clear browser cache and reload')
  const problems = JSON.parse(text) as Problem[]
  problemCache.set(difficulty, problems)
  return problems
}

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

const defenseCache = new Map<number, DefenseProblem[]>()

async function loadDefenseProblems(difficulty: number): Promise<DefenseProblem[]> {
  const cached = defenseCache.get(difficulty)
  if (cached) return cached

  const resp = await fetch(`/data/defense-problems-L${difficulty}.json?v=${Date.now()}`)
  if (!resp.ok) throw new Error(`Failed to load defense L${difficulty} (${resp.status})`)
  const text = await resp.text()
  if (text.startsWith('<!')) throw new Error('Got HTML instead of JSON — clear browser cache and reload')
  const problems = JSON.parse(text) as DefenseProblem[]
  defenseCache.set(difficulty, problems)
  return problems
}

function parseExplanation(raw: unknown): ExplanationSections {
  if (typeof raw === 'object' && raw !== null && 'handStructure' in raw) {
    return raw as ExplanationSections
  }
  const text = String(raw ?? '')
  const lines = text.split('\n').filter(Boolean)
  return {
    handStructure: lines[0] ?? '',
    bestReason: lines.slice(1).join('\n') || (lines[0] ?? ''),
  }
}

/* ── localStorage stats ── */

interface StoredRecord {
  date: string
  mode: ModeKey
  difficulty: number
  isCorrect: boolean
  timeMs: number
  tags: string[]
}

const STORAGE_KEY = 'mahjong-trainer:stats'

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function readStoredRecords(): StoredRecord[] {
  if (!canUseStorage()) return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
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
  if (!canUseStorage()) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
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

/* ── API functions ── */

export async function generateDrill(payload: DrillGenerateRequest): Promise<DrillGenerateResponse> {
  const problems = await loadProblems(payload.difficulty)
  const selected = pickRandom(problems, payload.count)
  return {
    problems: selected.map((p) => ({
      id: p.id,
      hand: p.hand,
      mode: payload.mode,
      difficulty: payload.difficulty,
      tags: p.tags,
      bestDiscard: p.bestDiscard as TileCode,
      analysisOptions: p.options.map((o) => ({
        discard: o.discard,
        shanten: o.shanten,
        ukeire: o.ukeire,
        quality: o.quality,
        isBest: o.isBest,
      })),
      usefulTiles: p.options.find((o) => o.isBest)?.usefulTiles ?? [],
      explanation: parseExplanation(p.explanation),
    })),
  }
}

export async function evaluateDrill(payload: DrillEvaluateRequest): Promise<DrillEvaluationResponse> {
  // Find the matching problem from cache by hand signature
  const handKey = [...payload.hand].sort().join(',')
  let matched: Problem | undefined

  for (const [, problems] of problemCache) {
    matched = problems.find((p) => [...p.hand].sort().join(',') === handKey)
    if (matched) break
  }

  if (!matched) {
    // Fallback: load all levels and search
    for (const lvl of [1, 2, 3, 4]) {
      const problems = await loadProblems(lvl)
      matched = problems.find((p) => [...p.hand].sort().join(',') === handKey)
      if (matched) break
    }
  }

  if (!matched) {
    throw new Error('Problem not found in bank')
  }

  const best = matched.options.find((o) => o.isBest)
  const userOption = matched.options.find((o) => o.discard === payload.discard)

  return {
    correct: payload.discard === matched.bestDiscard,
    analysis: {
      bestDiscard: matched.bestDiscard,
      userDiscard: payload.discard,
      scoreGap: Math.max((best?.ukeire ?? 0) - (userOption?.ukeire ?? 0), 0),
      options: matched.options.map((o) => ({
        discard: o.discard,
        shanten: o.shanten,
        ukeire: o.ukeire,
        quality: o.quality,
        isBest: o.isBest,
      })),
      usefulTiles: best?.usefulTiles ?? [],
    },
    explanation: parseExplanation(matched.explanation),
  }
}

/* ── Defense API ── */

export async function generateDefenseDrill(difficulty: number, count: number): Promise<DefenseProblem[]> {
  const problems = await loadDefenseProblems(difficulty)
  return pickRandom(problems, count)
}

export async function evaluateDefense(hand: TileCode[], _riichiRiver: TileCode[], discard: TileCode): Promise<DefenseEvaluationResponse> {
  const handKey = [...hand].sort().join(',')
  let matched: DefenseProblem | undefined

  for (const [, problems] of defenseCache) {
    matched = problems.find((p) => [...p.hand].sort().join(',') === handKey)
    if (matched) break
  }

  if (!matched) {
    for (const lvl of [1, 2, 3, 4]) {
      const problems = await loadDefenseProblems(lvl)
      matched = problems.find((p) => [...p.hand].sort().join(',') === handKey)
      if (matched) break
    }
  }

  if (!matched) throw new Error('Defense problem not found')

  const userOption = matched.options.find((o) => o.tile === discard)

  return {
    correct: discard === matched.safestDiscard,
    safestTile: matched.safestDiscard,
    userTile: discard,
    userSafety: userOption?.safety ?? 'unknown',
    options: matched.options,
    explanation: matched.explanation,
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
      if (record.isCorrect) current.correct += 1
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

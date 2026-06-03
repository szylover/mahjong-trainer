import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

type TileCode = string

type SafetyLabel = 'safe' | 'relatively_safe' | 'moderate' | 'dangerous' | 'very_dangerous'
type DefenseCategory = 'genbutsu' | 'suji' | 'kabe' | 'one_chance' | 'mixed'

interface DefenseOption {
  tile: TileCode
  safety: SafetyLabel
  reason: string
}

interface DefenseProblem {
  id: string
  difficulty: number
  turn: number
  hand: TileCode[]
  riichiRiver: TileCode[]
  riichiTurnIndex: number
  dora: TileCode
  safestDiscard: TileCode
  options: DefenseOption[]
  explanation: string
  category: DefenseCategory
}

interface EvaluatedOption extends DefenseOption {
  score: number
}

interface ScenarioBuild {
  category: DefenseCategory
  intendedBest: TileCode
  hand: TileCode[]
  river: TileCode[]
  dora: TileCode
}

const SUITS = ['m', 'p', 's'] as const
const HONORS = ['E', 'S', 'W', 'N', 'P', 'F', 'C'] as const
const NUMBER_TILES = SUITS.flatMap((suit) => Array.from({ length: 9 }, (_, index) => `${index + 1}${suit}`))
const ALL_UNIQUE_TILES = [...NUMBER_TILES, ...HONORS]
const TILE_ORDER = new Map(ALL_UNIQUE_TILES.map((tile, index) => [tile, index]))

const LEVEL_COUNTS: Record<number, number> = {
  1: 500,
  2: 800,
  3: 1200,
  4: 500,
}

const LEVEL_CATEGORIES: Record<number, DefenseCategory[]> = {
  1: Array(500).fill('genbutsu'),
  2: [...Array(400).fill('genbutsu'), ...Array(400).fill('suji')],
  3: [...Array(500).fill('kabe'), ...Array(400).fill('one_chance'), ...Array(300).fill('mixed')],
  4: Array(500).fill('mixed'),
}

function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function sample<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function isHonor(tile: TileCode) {
  return !tile.includes('m') && !tile.includes('p') && !tile.includes('s')
}

function tileSuit(tile: TileCode) {
  return isHonor(tile) ? '' : tile.at(-1) ?? ''
}

function tileRank(tile: TileCode) {
  return isHonor(tile) ? null : Number(tile[0])
}

function makeTile(rank: number, suit: string) {
  return `${rank}${suit}`
}

function sortTiles(tiles: TileCode[]) {
  return [...tiles].sort((left, right) => (TILE_ORDER.get(left) ?? 999) - (TILE_ORDER.get(right) ?? 999))
}

function createCounts() {
  return Object.fromEntries(ALL_UNIQUE_TILES.map((tile) => [tile, 4])) as Record<TileCode, number>
}

function consumeTile(counts: Record<TileCode, number>, tile: TileCode) {
  if ((counts[tile] ?? 0) <= 0) {
    return false
  }
  counts[tile] -= 1
  return true
}

function consumeTiles(counts: Record<TileCode, number>, tiles: TileCode[]) {
  const snapshot = { ...counts }
  for (const tile of tiles) {
    if (!consumeTile(snapshot, tile)) {
      return false
    }
  }
  Object.assign(counts, snapshot)
  return true
}

function visibleCounts(hand: TileCode[], river: TileCode[], dora: TileCode) {
  const counts = Object.fromEntries(ALL_UNIQUE_TILES.map((tile) => [tile, 0])) as Record<TileCode, number>
  for (const tile of [...hand, ...river, dora]) {
    counts[tile] += 1
  }
  return counts
}

function riverSet(river: TileCode[]) {
  return new Set(river)
}

function labelFromScore(score: number): SafetyLabel {
  if (score >= 95) return 'safe'
  if (score >= 70) return 'relatively_safe'
  if (score >= 45) return 'moderate'
  if (score >= 20) return 'dangerous'
  return 'very_dangerous'
}

function noSujiBaseScore(rank: number) {
  if (rank === 4 || rank === 5 || rank === 6) return 10
  if (rank === 3 || rank === 7) return 16
  if (rank === 2 || rank === 8) return 22
  return 28
}

function sujiAnchors(tile: TileCode) {
  const rank = tileRank(tile)
  const suit = tileSuit(tile)
  if (rank == null || !suit) return []
  return [rank - 3, rank + 3]
    .filter((value) => value >= 1 && value <= 9)
    .map((value) => makeTile(value, suit))
}

function adjacentTiles(tile: TileCode) {
  const rank = tileRank(tile)
  const suit = tileSuit(tile)
  if (rank == null || !suit) return []
  return [rank - 1, rank + 1]
    .filter((value) => value >= 1 && value <= 9)
    .map((value) => makeTile(value, suit))
}

function chooseReason(flags: {
  genbutsu: boolean
  suji: boolean
  kabe: boolean
  oneChance: boolean
  honor: boolean
}) {
  if (flags.genbutsu) return '現物'
  if (flags.kabe && flags.suji) return '筋＋壁'
  if (flags.suji && flags.oneChance) return '筋＋ONE CHANCE'
  if (flags.kabe) return '壁'
  if (flags.suji) return '筋'
  if (flags.oneChance) return 'ONE CHANCE'
  if (flags.honor) return '字牌'
  return '无筋危险牌'
}

function evaluateTile(tile: TileCode, hand: TileCode[], river: TileCode[], dora: TileCode): EvaluatedOption {
  const counts = visibleCounts(hand, river, dora)
  const handCount = hand.filter((value) => value === tile).length
  const inRiver = riverSet(river).has(tile)

  if (inRiver) {
    return {
      tile,
      score: 100,
      safety: 'safe',
      reason: '現物',
    }
  }

  if (isHonor(tile)) {
    const score = handCount === 1 ? 52 : 44
    return {
      tile,
      score,
      safety: labelFromScore(score),
      reason: '字牌',
    }
  }

  const rank = tileRank(tile) ?? 5
  const suji = sujiAnchors(tile).some((anchor) => river.includes(anchor))
  const adjacentVisible = adjacentTiles(tile).map((neighbor) => counts[neighbor])
  const kabe = adjacentVisible.some((count) => count >= 4)
  const oneChance = adjacentVisible.some((count) => count === 3)

  let score = noSujiBaseScore(rank)

  if (oneChance) {
    score = Math.max(score, rank === 1 || rank === 9 ? 60 : 56)
  }
  if (suji) {
    score = Math.max(score, rank === 1 || rank === 9 ? 74 : 70)
  }
  if (kabe) {
    score = Math.max(score, rank === 1 || rank === 9 ? 82 : 78)
  }
  if (suji && oneChance) {
    score = Math.max(score, 76)
  }
  if (suji && kabe) {
    score = Math.max(score, 86)
  }

  const reason = chooseReason({
    genbutsu: false,
    suji,
    kabe,
    oneChance,
    honor: false,
  })

  return {
    tile,
    score,
    safety: labelFromScore(score),
    reason,
  }
}

function evaluateHand(hand: TileCode[], river: TileCode[], dora: TileCode) {
  const uniqueTiles = [...new Set(hand)]
  return uniqueTiles
    .map((tile) => evaluateTile(tile, hand, river, dora))
    .sort((left, right) => right.score - left.score || (TILE_ORDER.get(left.tile) ?? 999) - (TILE_ORDER.get(right.tile) ?? 999))
}

function getOtherSuits(focusSuit: string) {
  return SUITS.filter((suit) => suit !== focusSuit)
}

function run(start: number, suit: string) {
  return [makeTile(start, suit), makeTile(start + 1, suit), makeTile(start + 2, suit)]
}

function buildCoreTiles(focusSuit: string) {
  const [suitA, suitB] = shuffle(getOtherSuits(focusSuit))
  const honor = sample(HONORS)
  return [
    ...run(randomInt(1, 5), suitA),
    ...run(randomInt(2, 6), suitA),
    ...run(randomInt(1, 7), suitB),
    honor,
    honor,
  ]
}

function buildRiverFiller(
  counts: Record<TileCode, number>,
  hand: TileCode[],
  reserved: TileCode[],
  length: number,
  blockedHonor: TileCode,
) {
  const excluded = new Set([...new Set(hand), blockedHonor, ...reserved])
  const fillerCandidates = ALL_UNIQUE_TILES.filter((tile) => !excluded.has(tile) && counts[tile] > 0)
  const weighted = fillerCandidates.flatMap((tile) => Array(counts[tile]).fill(tile))

  if (weighted.length < length) {
    const relaxed = ALL_UNIQUE_TILES
      .filter((tile) => tile !== blockedHonor && !new Set(hand).has(tile) && counts[tile] > 0)
      .flatMap((tile) => Array(counts[tile]).fill(tile))
    if (relaxed.length < length) {
      return null
    }
    return shuffle(relaxed).slice(0, length)
  }

  return shuffle(weighted).slice(0, length)
}

function chooseDora(counts: Record<TileCode, number>, hand: TileCode[]) {
  const preferred = ALL_UNIQUE_TILES.filter((tile) => counts[tile] > 0 && !hand.includes(tile))
  const candidates = preferred.length > 0 ? preferred : ALL_UNIQUE_TILES.filter((tile) => counts[tile] > 0)
  return sample(candidates)
}

function buildGenbutsuScenario(difficulty: number, focusSuit: string, counts: Record<TileCode, number>) {
  const core = buildCoreTiles(focusSuit)
  const basePatterns = [
    { safe: 1, others: [5, 6] },
    { safe: 2, others: [6, 7] },
    { safe: 8, others: [3, 4] },
    { safe: 9, others: [4, 5] },
  ]
  const versusSujiPatterns = [
    { safe: 1, alt: 7, tail: 8, anchor: 4 },
    { safe: 9, alt: 3, tail: 4, anchor: 6 },
    { safe: 2, alt: 8, tail: 7, anchor: 5 },
    { safe: 8, alt: 2, tail: 3, anchor: 5 },
  ]

  const pattern = difficulty === 1 ? sample(basePatterns) : sample(versusSujiPatterns)
  const optionTiles = difficulty === 1
    ? [makeTile(pattern.safe, focusSuit), ...pattern.others.map((rank) => makeTile(rank, focusSuit))]
    : [
        makeTile(pattern.safe, focusSuit),
        makeTile(pattern.alt, focusSuit),
        makeTile(pattern.tail, focusSuit),
      ]

  if (!consumeTiles(counts, [...core, ...optionTiles])) {
    return null
  }

  const requiredRiver = difficulty === 1
    ? [makeTile(pattern.safe, focusSuit)]
    : [makeTile(pattern.safe, focusSuit), makeTile(pattern.anchor, focusSuit)]

  const riverLength = difficulty === 1 ? randomInt(6, 10) : randomInt(8, 12)
  const filler = buildRiverFiller(counts, [...core, ...optionTiles], requiredRiver, riverLength - requiredRiver.length, core.at(-1) ?? 'E')
  if (!filler) return null
  const river = shuffle([...requiredRiver, ...filler])

  if (!consumeTiles(counts, river)) {
    return null
  }

  const dora = chooseDora(counts, [...core, ...optionTiles])
  if (!consumeTile(counts, dora)) {
    return null
  }

  return {
    category: 'genbutsu' as const,
    intendedBest: makeTile(pattern.safe, focusSuit),
    hand: sortTiles([...core, ...optionTiles]),
    river,
    dora,
  }
}

function buildSujiScenario(focusSuit: string, counts: Record<TileCode, number>) {
  const core = buildCoreTiles(focusSuit)
  const patterns = [
    { safe: 1, others: [5, 6], anchor: 4 },
    { safe: 7, others: [8, 9], anchor: 4 },
    { safe: 2, others: [6, 7], anchor: 5 },
    { safe: 8, others: [3, 4], anchor: 5 },
    { safe: 3, others: [7, 8], anchor: 6 },
    { safe: 9, others: [4, 5], anchor: 6 },
  ]
  const pattern = sample(patterns)
  const optionTiles = [makeTile(pattern.safe, focusSuit), ...pattern.others.map((rank) => makeTile(rank, focusSuit))]

  if (!consumeTiles(counts, [...core, ...optionTiles])) {
    return null
  }

  const requiredRiver = [makeTile(pattern.anchor, focusSuit)]
  const riverLength = randomInt(8, 13)
  const filler = buildRiverFiller(counts, [...core, ...optionTiles], requiredRiver, riverLength - requiredRiver.length, core.at(-1) ?? 'E')
  if (!filler) return null
  const river = shuffle([...requiredRiver, ...filler])

  if (!consumeTiles(counts, river)) {
    return null
  }

  const dora = chooseDora(counts, [...core, ...optionTiles])
  if (!consumeTile(counts, dora)) {
    return null
  }

  return {
    category: 'suji' as const,
    intendedBest: makeTile(pattern.safe, focusSuit),
    hand: sortTiles([...core, ...optionTiles]),
    river,
    dora,
  }
}

function buildKabeScenario(focusSuit: string, counts: Record<TileCode, number>) {
  const core = buildCoreTiles(focusSuit)
  const patterns = [
    { safe: 1, others: [5, 6], blocker: 2 },
    { safe: 9, others: [4, 5], blocker: 8 },
    { safe: 2, others: [6, 7], blocker: 3 },
    { safe: 8, others: [3, 4], blocker: 7 },
  ]
  const pattern = sample(patterns)
  const optionTiles = [makeTile(pattern.safe, focusSuit), ...pattern.others.map((rank) => makeTile(rank, focusSuit))]

  if (!consumeTiles(counts, [...core, ...optionTiles])) {
    return null
  }

  const blockerTile = makeTile(pattern.blocker, focusSuit)
  const requiredRiver = Array(4).fill(blockerTile)
  const riverLength = randomInt(10, 15)
  const filler = buildRiverFiller(counts, [...core, ...optionTiles], requiredRiver, riverLength - requiredRiver.length, core.at(-1) ?? 'E')
  if (!filler) return null
  const river = shuffle([...requiredRiver, ...filler])

  if (!consumeTiles(counts, river)) {
    return null
  }

  const dora = chooseDora(counts, [...core, ...optionTiles])
  if (!consumeTile(counts, dora)) {
    return null
  }

  return {
    category: 'kabe' as const,
    intendedBest: makeTile(pattern.safe, focusSuit),
    hand: sortTiles([...core, ...optionTiles]),
    river,
    dora,
  }
}

function buildOneChanceScenario(focusSuit: string, counts: Record<TileCode, number>) {
  const core = buildCoreTiles(focusSuit)
  const patterns = [
    { safe: 1, others: [5, 6], blocker: 2 },
    { safe: 9, others: [4, 5], blocker: 8 },
    { safe: 2, others: [6, 7], blocker: 3 },
    { safe: 8, others: [3, 4], blocker: 7 },
  ]
  const pattern = sample(patterns)
  const optionTiles = [makeTile(pattern.safe, focusSuit), ...pattern.others.map((rank) => makeTile(rank, focusSuit))]

  if (!consumeTiles(counts, [...core, ...optionTiles])) {
    return null
  }

  const blockerTile = makeTile(pattern.blocker, focusSuit)
  const requiredRiver = Array(3).fill(blockerTile)
  const riverLength = randomInt(10, 15)
  const filler = buildRiverFiller(counts, [...core, ...optionTiles], requiredRiver, riverLength - requiredRiver.length, core.at(-1) ?? 'E')
  if (!filler) return null
  const river = shuffle([...requiredRiver, ...filler])

  if (!consumeTiles(counts, river)) {
    return null
  }

  const dora = chooseDora(counts, [...core, ...optionTiles])
  if (!consumeTile(counts, dora)) {
    return null
  }

  return {
    category: 'one_chance' as const,
    intendedBest: makeTile(pattern.safe, focusSuit),
    hand: sortTiles([...core, ...optionTiles]),
    river,
    dora,
  }
}

function buildMixedScenario(difficulty: number, focusSuit: string, counts: Record<TileCode, number>) {
  const core = buildCoreTiles(focusSuit)
  const patterns = [
    { best: 1, alt: 7, tail: 8, anchor: 4, blocker: 2 },
    { best: 9, alt: 3, tail: 4, anchor: 6, blocker: 8 },
    { best: 2, alt: 8, tail: 7, anchor: 5, blocker: 3 },
    { best: 8, alt: 2, tail: 3, anchor: 5, blocker: 7 },
  ]
  const pattern = sample(patterns)
  const optionTiles = [
    makeTile(pattern.best, focusSuit),
    makeTile(pattern.alt, focusSuit),
    makeTile(pattern.tail, focusSuit),
  ]

  if (!consumeTiles(counts, [...core, ...optionTiles])) {
    return null
  }

  const blockerTile = makeTile(pattern.blocker, focusSuit)
  const requiredRiver = [
    makeTile(pattern.anchor, focusSuit),
    ...Array(difficulty >= 4 ? 4 : 3).fill(blockerTile),
  ]
  const riverLength = difficulty >= 4 ? randomInt(12, 18) : randomInt(10, 15)
  const filler = buildRiverFiller(counts, [...core, ...optionTiles], requiredRiver, riverLength - requiredRiver.length, core.at(-1) ?? 'E')
  if (!filler) return null
  const river = shuffle([...requiredRiver, ...filler])

  if (!consumeTiles(counts, river)) {
    return null
  }

  const dora = chooseDora(counts, [...core, ...optionTiles])
  if (!consumeTile(counts, dora)) {
    return null
  }

  return {
    category: 'mixed' as const,
    intendedBest: makeTile(pattern.best, focusSuit),
    hand: sortTiles([...core, ...optionTiles]),
    river,
    dora,
  }
}

function buildScenario(difficulty: number, category: DefenseCategory): ScenarioBuild | null {
  const counts = createCounts()
  const focusSuit = sample(SUITS)

  switch (category) {
    case 'genbutsu':
      return buildGenbutsuScenario(difficulty, focusSuit, counts)
    case 'suji':
      return buildSujiScenario(focusSuit, counts)
    case 'kabe':
      return buildKabeScenario(focusSuit, counts)
    case 'one_chance':
      return buildOneChanceScenario(focusSuit, counts)
    case 'mixed':
      return buildMixedScenario(difficulty, focusSuit, counts)
    default:
      return null
  }
}

function isScenarioValid(
  difficulty: number,
  category: DefenseCategory,
  intendedBest: TileCode,
  options: EvaluatedOption[],
) {
  const [best, second] = options
  if (!best || !second) return false
  if (best.tile !== intendedBest) return false
  if (best.score <= second.score) return false

  const reasons = options.map((option) => option.reason)
  const hasDanger = options.some((option) => option.safety === 'dangerous' || option.safety === 'very_dangerous')

  switch (difficulty) {
    case 1:
      return best.reason === '現物' && hasDanger
    case 2:
      if (category === 'genbutsu') {
        return best.reason === '現物' && reasons.includes('筋') && hasDanger
      }
      return best.reason === '筋' && !reasons.includes('現物') && hasDanger
    case 3:
      if (category === 'kabe') {
        return best.reason.includes('壁') && !reasons.includes('現物') && hasDanger
      }
      if (category === 'one_chance') {
        return best.reason.includes('ONE CHANCE') && !reasons.includes('現物') && hasDanger
      }
      return (best.reason.includes('＋') || best.reason.includes('壁') || best.reason.includes('ONE CHANCE')) && hasDanger
    case 4:
      return best.reason.includes('＋') && options.some((option) => option.tile !== best.tile && option.safety === 'relatively_safe') && hasDanger
    default:
      return false
  }
}

function buildExplanation(problem: {
  safestDiscard: TileCode
  category: DefenseCategory
  options: EvaluatedOption[]
  river: TileCode[]
  dora: TileCode
}) {
  const [best, second] = problem.options
  const riverTiles = [...new Set(problem.river)].join('・')
  const categoryText: Record<DefenseCategory, string> = {
    genbutsu: '这是优先选择现物的基础题型。',
    suji: '没有现物，需要通过筋读来防守的题型。',
    kabe: '通过已见牌的枚数判断壁的题型。',
    one_chance: '利用ONE CHANCE来降低危险度的题型。',
    mixed: '综合比较筋、壁、ONE CHANCE的复合题型。',
  }

  return `${problem.safestDiscard} 是最安全的选择（${best.reason}）。${categoryText[problem.category]} 立直者的牌河中有 ${riverTiles}，次选 ${second.tile} 仅为 ${second.reason}。危险牌应优先避开无筋的中张牌。宝牌指示牌为 ${problem.dora}。`
}

function createProblem(difficulty: number, index: number, category: DefenseCategory): DefenseProblem {
  for (let attempt = 0; attempt < 600; attempt += 1) {
    const scenario = buildScenario(difficulty, category)
    if (!scenario) {
      continue
    }

    const evaluated = evaluateHand(scenario.hand, scenario.river, scenario.dora)
    if (!isScenarioValid(difficulty, category, scenario.intendedBest, evaluated)) {
      continue
    }

    const turn = scenario.river.length
    const riichiTurnIndex = randomInt(Math.min(4, turn - 2), Math.max(Math.min(4, turn - 2), turn - 2))
    return {
      id: `defense-L${difficulty}-${String(index).padStart(4, '0')}-${attempt}`,
      difficulty,
      turn,
      hand: scenario.hand,
      riichiRiver: scenario.river,
      riichiTurnIndex,
      dora: scenario.dora,
      safestDiscard: evaluated[0].tile,
      options: evaluated.map(({ tile, safety, reason }) => ({ tile, safety, reason })),
      explanation: buildExplanation({
        safestDiscard: evaluated[0].tile,
        category,
        options: evaluated,
        river: scenario.river,
        dora: scenario.dora,
      }),
      category,
    }
  }

  throw new Error(`Failed to generate a valid L${difficulty} ${category} problem after many attempts`)
}

function dedupeProblems(problems: DefenseProblem[]) {
  const seen = new Set<string>()
  return problems.filter((problem) => {
    const key = [
      problem.hand.join(','),
      problem.riichiRiver.join(','),
      problem.dora,
      problem.safestDiscard,
      problem.category,
    ].join('|')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function generateLevel(level: number) {
  const categories = shuffle(LEVEL_CATEGORIES[level])
  const problems: DefenseProblem[] = []
  let cursor = 1

  while (problems.length < LEVEL_COUNTS[level]) {
    const category = categories[problems.length % categories.length]
    problems.push(createProblem(level, cursor, category))
    cursor += 1
  }

  return dedupeProblems(problems)
}

function ensureLevelCount(level: number, problems: DefenseProblem[]) {
  const unique = [...problems]
  let cursor = problems.length + 1
  const target = LEVEL_COUNTS[level]

  while (unique.length < target) {
    const category = sample(LEVEL_CATEGORIES[level])
    const next = createProblem(level, cursor, category)
    const key = [next.hand.join(','), next.riichiRiver.join(','), next.dora, next.safestDiscard, next.category].join('|')
    const currentKeys = new Set(unique.map((problem) => [problem.hand.join(','), problem.riichiRiver.join(','), problem.dora, problem.safestDiscard, problem.category].join('|')))
    if (!currentKeys.has(key)) {
      unique.push(next)
    }
    cursor += 1
  }

  return unique.slice(0, target)
}

function writeIndex(outputDir: string, byLevel: Record<number, DefenseProblem[]>) {
  const indexPath = path.join(outputDir, 'index.json')
  let existing: Record<string, unknown> = {}

  if (existsSync(indexPath)) {
    existing = JSON.parse(readFileSync(indexPath, 'utf8')) as Record<string, unknown>
  }

  const defenseCategories = [...new Set(Object.values(byLevel).flat().map((problem) => problem.category))]
  const now = new Date().toISOString()
  const nextIndex = {
    ...existing,
    defenseLevels: Object.fromEntries(Object.entries(byLevel).map(([level, problems]) => [level, problems.length])),
    defenseCategories,
    defenseTotalProblems: Object.values(byLevel).reduce((sum, problems) => sum + problems.length, 0),
    defenseGeneratedAt: now,
    updatedAt: now,
  }

  writeFileSync(indexPath, `${JSON.stringify(nextIndex, null, 2)}\n`)
}

function main() {
  const startTime = Date.now()
  const rootDir = process.cwd()
  const outputDir = path.join(rootDir, 'public', 'data')
  mkdirSync(outputDir, { recursive: true })

  const byLevel = Object.fromEntries(
    Object.keys(LEVEL_COUNTS).map((levelKey) => {
      const level = Number(levelKey)
      const generated = generateLevel(level)
      const finalized = ensureLevelCount(level, generated)
      return [level, finalized]
    }),
  ) as Record<number, DefenseProblem[]>

  for (const [levelKey, problems] of Object.entries(byLevel)) {
    const filePath = path.join(outputDir, `defense-problems-L${levelKey}.json`)
    writeFileSync(filePath, `${JSON.stringify(problems, null, 2)}\n`)
    console.log(`Wrote ${path.relative(rootDir, filePath)} (${problems.length} problems)`)
  }

  writeIndex(outputDir, byLevel)

  const totalProblems = Object.values(byLevel).reduce((sum, problems) => sum + problems.length, 0)
  const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`Defense problem generation complete: ${totalProblems} problems in ${elapsedSeconds}s`)
}

main()

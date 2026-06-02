/**
 * Structured Mahjong Drill Problem Generator
 * 
 * Generates problems organized by knowledge points (知識点),
 * using hand templates that teach specific tile efficiency concepts.
 * Each template is varied across suits to produce many unique problems.
 */
import { TILES, TILE_INDEX, ALL_TILES, tilesToCounts } from './src/engine/tiles'
import { calculateShanten } from './src/engine/shanten'
import { calculateEfficiency } from './src/engine/efficiency'
import { analyzeHandStructure } from './src/engine/structure'
import { generateExplanation } from './src/engine/explanation'
import { calculateWaitQuality } from './src/engine/waitQuality'
import { writeFileSync, mkdirSync } from 'fs'

// ─── Types ───────────────────────────────────────────────────

interface ProblemRecord {
  id: string
  category: string      // knowledge point category
  categoryLabel: string // Chinese label
  difficulty: number
  hand: string[]
  bestDiscard: string
  options: {
    discard: string
    shanten: number
    ukeire: number
    quality: number
    isBest: boolean
    usefulTiles: { tile: string; count: number }[]
  }[]
  explanation: {
    handStructure: string
    bestReason: string
    commonMistake?: string
    concept?: string
  }
  tags: string[]
}

// ─── Suit Rotation ───────────────────────────────────────────
// Rotate a hand template across suits for variety

const SUIT_ROTATIONS: [string, string, string][] = [
  ['m', 'p', 's'],
  ['m', 's', 'p'],
  ['p', 'm', 's'],
  ['p', 's', 'm'],
  ['s', 'm', 'p'],
  ['s', 'p', 'm'],
]

function rotateSuit(tile: string, rotation: [string, string, string]): string {
  if (tile.endsWith('m')) return tile[0] + rotation[0]
  if (tile.endsWith('p')) return tile[0] + rotation[1]
  if (tile.endsWith('s')) return tile[0] + rotation[2]
  return tile // honors unchanged
}

function rotateHand(hand: string[], rotation: [string, string, string]): string[] {
  return hand.map(t => rotateSuit(t, rotation))
}

// ─── Rank Shift ──────────────────────────────────────────────
// Shift number tiles by offset within valid range

function shiftTile(tile: string, offset: number): string | null {
  if (/^[1-9][mps]$/.test(tile)) {
    const newRank = Number(tile[0]) + offset
    if (newRank >= 1 && newRank <= 9) return `${newRank}${tile[1]}`
    return null
  }
  return tile
}

function shiftHand(hand: string[], offset: number): string[] | null {
  const result: string[] = []
  for (const tile of hand) {
    const shifted = shiftTile(tile, offset)
    if (!shifted) return null
    result.push(shifted)
  }
  return result
}

// ─── Validation ──────────────────────────────────────────────

function isValidHand(hand: string[]): boolean {
  if (hand.length !== 14) return false
  const counts = new Map<string, number>()
  for (const t of hand) {
    const c = (counts.get(t) ?? 0) + 1
    if (c > 4) return false
    counts.set(t, c)
  }
  return true
}

// ─── Problem Builder ─────────────────────────────────────────

function buildProblem(
  id: string,
  hand: string[],
  category: string,
  categoryLabel: string,
  difficulty: number,
  extraTags: string[] = []
): ProblemRecord | null {
  if (!isValidHand(hand)) return null

  const efficiency = calculateEfficiency(hand)
  if (efficiency.length < 2) return null

  const best = efficiency[0]
  if (best.shantenAfter > 3) return null

  const waitQuality = calculateWaitQuality(hand)
  const qualityMap = new Map(waitQuality.map(w => [w.discard, w]))

  const ranked = efficiency.map(e => ({
    discard: e.discard,
    shanten: e.shantenAfter,
    ukeire: e.ukeire,
    quality: Math.round(qualityMap.get(e.discard)?.goodShapeRate ?? 0),
    usefulTiles: e.usefulTiles,
  })).sort((a, b) => a.shanten - b.shanten || b.ukeire - a.ukeire)

  const handCounts = tilesToCounts(hand)
  const options = ranked.slice(0, 6).map((r, i) => {
    const di = TILE_INDEX[r.discard]
    const afterCounts = [...handCounts]
    if (di != null) afterCounts[di] -= 1
    return {
      discard: r.discard,
      shanten: r.shanten,
      ukeire: r.ukeire,
      quality: r.quality,
      isBest: i === 0,
      usefulTiles: r.usefulTiles.map(tile => {
        const ti = TILE_INDEX[tile]
        return { tile, count: ti != null ? Math.max(4 - afterCounts[ti], 0) : 0 }
      }),
    }
  })

  const hand13 = [...hand]
  const removeIdx = hand13.indexOf(ranked[0].discard)
  if (removeIdx >= 0) hand13.splice(removeIdx, 1)
  const structure = analyzeHandStructure(hand13)

  const explanation = generateExplanation({
    bestDiscard: ranked[0].discard,
    options: ranked,
    structure,
    tags: extraTags,
  })

  return {
    id,
    category,
    categoryLabel,
    difficulty,
    hand,
    bestDiscard: ranked[0].discard,
    options,
    explanation,
    tags: [categoryLabel, ...extraTags],
  }
}

// ─── Knowledge Point Templates ───────────────────────────────
// Each template defines a hand pattern that teaches a specific concept.
// Templates are expanded via suit rotation and rank shifting.

interface Template {
  category: string
  categoryLabel: string
  difficulty: number
  // Hand in shorthand notation, will be parsed
  hands: string[][]   // raw tile arrays
  tags: string[]
}

// Helper to build tile arrays easily
function h(...tiles: string[]): string[] { return tiles }

const TEMPLATES: Template[] = [
  // ─── C1: 孤立牌取舍 (Isolated tile selection) ─────────────
  {
    category: 'isolated',
    categoryLabel: '孤立牌取舍',
    difficulty: 1,
    tags: ['基本牌理'],
    hands: [
      // 字牌 vs 19牌: cut honor over terminal
      h('2m','3m','4m','6m','7m','8m','2p','3p','4p','5s','6s','7s','1s','N'),
      h('1m','2m','3m','5m','6m','7m','3p','4p','5p','4s','5s','6s','9p','W'),
      h('2m','3m','4m','5p','6p','7p','7s','8s','9s','2s','3s','4s','1m','E'),
      // 19 vs 28: cut terminal over near-terminal
      h('1m','2m','3m','4p','5p','6p','6s','7s','8s','3m','4m','9s','1p','P'),
      h('3m','4m','5m','2p','3p','4p','7s','8s','9s','6m','7m','1s','9m','F'),
      // 28 vs 中张: cut 28 over middle tile
      h('2m','3m','4m','6p','7p','8p','4s','5s','6s','3s','4s','8m','2p','C'),
      h('1m','2m','3m','5p','6p','7p','3s','4s','5s','7m','8m','2s','8p','N'),
    ],
  },
  {
    category: 'isolated',
    categoryLabel: '孤立牌取舍',
    difficulty: 2,
    tags: ['受入比較'],
    hands: [
      // Multiple isolated tiles, need to compare connectivity
      h('2m','3m','4m','6m','7m','8m','3p','4p','5p','1s','5s','9s','E','S'),
      h('1m','2m','3m','5m','6m','7m','2p','3p','4p','1s','4s','8s','N','W'),
      h('3m','4m','5m','7p','8p','9p','2s','3s','4s','1m','6m','9s','P','F'),
      h('2m','3m','4m','4p','5p','6p','7s','8s','9s','1m','5m','1p','9p','C'),
    ],
  },

  // ─── C2: 搭子比較 (Taatsu comparison) ─────────────────────
  {
    category: 'taatsu',
    categoryLabel: '搭子比較',
    difficulty: 2,
    tags: ['搭子比較'],
    hands: [
      // 両面 vs 嵌張: keep ryanmen, cut kanchan component
      h('2m','3m','4m','5m','6m','3p','5p','6p','7p','4s','5s','6s','7s','8s'),
      h('1m','2m','3m','6m','7m','2p','3p','4p','5p','1s','3s','5s','6s','7s'),
      h('3m','4m','5m','6m','8m','2p','3p','4p','7p','8p','4s','5s','6s','7s'),
      // 嵌張 vs 辺張: keep kanchan over penchan
      h('1m','2m','5m','6m','7m','3p','4p','5p','8p','9p','2s','3s','4s','6s'),
      h('2m','3m','4m','8m','9m','1p','3p','5p','6p','7p','4s','5s','6s','7s'),
      h('1m','2m','4m','5m','6m','3p','4p','5p','7s','8s','9s','2s','3s','E'),
    ],
  },
  {
    category: 'taatsu',
    categoryLabel: '搭子比較',
    difficulty: 3,
    tags: ['搭子比較', '受入比較'],
    hands: [
      // Multiple taatsu, need to choose which to break
      h('1m','3m','4m','5m','7m','9m','2p','3p','4p','6p','8p','4s','5s','6s'),
      h('2m','4m','5m','6m','7m','9m','3p','4p','5p','1s','3s','6s','7s','8s'),
      h('1m','2m','3m','5m','7m','2p','4p','6p','7p','8p','3s','4s','5s','9s'),
    ],
  },

  // ─── C3: 複合搭子 (Complex taatsu) ────────────────────────
  {
    category: 'complex-taatsu',
    categoryLabel: '複合搭子',
    difficulty: 3,
    tags: ['複合搭子'],
    hands: [
      // Connected tiles forming multiple taatsu (e.g. 2345 = ryanmen+ryanmen)
      h('2m','3m','4m','5m','5p','6p','7p','8p','3s','4s','5s','6s','7s','N'),
      h('3m','4m','5m','6m','7m','2p','3p','4p','5p','4s','5s','6s','1s','E'),
      h('1m','2m','3m','4m','5m','6p','7p','8p','3s','4s','5s','6s','9m','W'),
      // Overlapping taatsu where one tile serves dual purpose
      h('2m','3m','4m','4m','5m','3p','4p','5p','7p','8p','2s','3s','4s','9s'),
      h('5m','6m','7m','7m','8m','1p','2p','3p','5p','6p','4s','5s','6s','N'),
    ],
  },

  // ─── C4: 雀頭候補 (Pair/head flexibility) ─────────────────
  {
    category: 'jantai',
    categoryLabel: '雀頭候補',
    difficulty: 2,
    tags: ['雀頭候補'],
    hands: [
      // Pair that doubles as taatsu material
      h('2m','3m','4m','5m','5m','6m','3p','4p','5p','7s','8s','9s','1s','E'),
      h('1m','2m','3m','4p','5p','6p','7p','7p','8p','3s','4s','5s','9s','N'),
      h('3m','4m','5m','6m','7m','8m','2p','2p','3p','4p','6s','7s','8s','W'),
      // Multiple pairs - choose which to keep as head
      h('2m','2m','3m','4m','5m','5p','5p','6p','7p','4s','5s','6s','7s','8s'),
      h('3m','3m','4m','5m','6m','7p','7p','8p','9p','2s','3s','4s','5s','N'),
    ],
  },

  // ─── C5: 七対子分岐 (Chiitoitsu branching) ────────────────
  {
    category: 'chiitoi',
    categoryLabel: '七対子分岐',
    difficulty: 3,
    tags: ['七対子分岐'],
    hands: [
      // Hand that can go either regular or chiitoitsu
      h('1m','1m','3m','3m','5p','5p','7p','7p','9s','9s','2s','2s','E','4m'),
      h('2m','2m','4m','4m','6p','6p','8p','8p','1s','1s','3s','3s','W','5m'),
      h('1m','1m','5m','5m','3p','3p','7p','7p','2s','2s','9s','9s','N','6m'),
    ],
  },

  // ─── C6: 受入 vs 好形 (Ukeire vs good shape) ──────────────
  {
    category: 'ukeire-vs-shape',
    categoryLabel: '受入vs好形',
    difficulty: 4,
    tags: ['好形判断', '受入比較'],
    hands: [
      // More ukeire with bad shape vs less ukeire with good shape
      h('2m','3m','4m','5m','6m','1p','3p','5p','6p','7p','4s','5s','6s','7s'),
      h('1m','2m','3m','4m','6m','7m','3p','4p','5p','8p','9p','5s','6s','7s'),
      h('3m','4m','5m','6m','7m','8m','2p','4p','5p','6p','1s','2s','8s','9s'),
      h('2m','3m','4m','7m','8m','9m','1p','2p','5p','7p','3s','4s','5s','6s'),
    ],
  },

  // ─── C7: 搭子過多 (Too many taatsu - width selection) ─────
  {
    category: 'excess-taatsu',
    categoryLabel: '搭子過多',
    difficulty: 3,
    tags: ['搭子過多'],
    hands: [
      // 5+ taatsu, need to drop the weakest
      h('1m','2m','4m','5m','7m','8m','2p','3p','5p','6p','3s','4s','7s','8s'),
      h('2m','3m','5m','6m','8m','9m','1p','2p','4p','5p','3s','4s','6s','7s'),
      h('1m','2m','3m','5m','6m','2p','3p','5p','6p','8p','9p','4s','5s','7s'),
      h('3m','4m','6m','7m','1p','2p','4p','5p','7p','8p','2s','3s','6s','7s'),
    ],
  },

  // ─── C8: 手役考慮 (Hand value consideration) ──────────────
  {
    category: 'yaku',
    categoryLabel: '打点考慮',
    difficulty: 4,
    tags: ['打点考慮'],
    hands: [
      // Tanyao potential: keep middle tiles
      h('2m','3m','4m','5m','6m','3p','4p','5p','6p','7p','2s','3s','4s','1m'),
      h('3m','4m','5m','6m','7m','2p','3p','4p','5p','6p','3s','4s','5s','9s'),
      // Pinfu potential: keep ryanmen
      h('2m','3m','4m','5m','6m','7m','3p','4p','6p','7p','5s','5s','8s','9s'),
      h('1m','2m','3m','4m','5m','5p','6p','7p','8p','3s','3s','4s','5s','E'),
      // Iipeiko potential
      h('1m','1m','2m','2m','3m','3m','5p','6p','7p','4s','5s','6s','7s','N'),
    ],
  },

  // ─── C9: 1向聴の基本 (Basic 1-shanten) ────────────────────
  {
    category: 'basic-1shanten',
    categoryLabel: '1向聴基本',
    difficulty: 1,
    tags: ['基本牌理'],
    hands: [
      // Simple 1-shanten with obvious best discard
      h('1m','2m','3m','4m','5m','6m','2p','3p','4p','5p','6s','7s','8s','N'),
      h('2m','3m','4m','5m','6m','7m','1p','2p','3p','7p','8p','5s','6s','E'),
      h('3m','4m','5m','6m','7m','8m','2p','3p','4p','6p','7p','3s','4s','W'),
      h('1m','2m','3m','5m','6m','7m','4p','5p','6p','7p','8p','4s','5s','P'),
      h('2m','3m','4m','6m','7m','8m','3p','4p','5p','6p','7p','6s','7s','F'),
      h('4m','5m','6m','7m','8m','9m','2p','3p','4p','5p','6p','2s','3s','C'),
    ],
  },

  // ─── C10: 受入枚数の精密計算 (Precise ukeire counting) ────
  {
    category: 'precise-ukeire',
    categoryLabel: '受入精密計算',
    difficulty: 2,
    tags: ['受入比較'],
    hands: [
      // Close ukeire options requiring careful counting
      h('2m','3m','4m','6m','7m','8m','2p','3p','5p','6p','4s','5s','6s','E'),
      h('1m','2m','3m','5m','6m','7m','3p','4p','6p','7p','5s','6s','7s','N'),
      h('3m','4m','5m','7m','8m','9m','2p','3p','4p','4p','5p','6s','7s','W'),
      h('2m','3m','4m','4m','5m','6m','5p','6p','7p','8p','3s','4s','5s','9s'),
      h('1m','2m','3m','3m','4m','5m','2p','3p','4p','6p','7p','5s','6s','7s'),
    ],
  },
]

// ─── Generation ──────────────────────────────────────────────

function generateFromTemplates(): ProblemRecord[] {
  const allProblems: ProblemRecord[] = []
  let idCounter = 0

  for (const template of TEMPLATES) {
    for (const baseHand of template.hands) {
      // Apply suit rotations
      for (const rotation of SUIT_ROTATIONS) {
        const rotated = rotateHand(baseHand, rotation)
        if (!isValidHand(rotated)) continue

        const id = `${template.category}-${String(++idCounter).padStart(4, '0')}`
        const problem = buildProblem(
          id, rotated,
          template.category, template.categoryLabel,
          template.difficulty, template.tags
        )
        if (problem) allProblems.push(problem)
      }

      // Apply rank shifts (-2, -1, +1, +2)
      for (const offset of [-2, -1, 1, 2]) {
        const shifted = shiftHand(baseHand, offset)
        if (!shifted || !isValidHand(shifted)) continue

        const id = `${template.category}-${String(++idCounter).padStart(4, '0')}`
        const problem = buildProblem(
          id, shifted,
          template.category, template.categoryLabel,
          template.difficulty, template.tags
        )
        if (problem) allProblems.push(problem)

        // Also rotate shifted hands
        for (const rotation of SUIT_ROTATIONS.slice(1, 4)) {
          const rotatedShifted = rotateHand(shifted, rotation)
          if (!isValidHand(rotatedShifted)) continue
          const id2 = `${template.category}-${String(++idCounter).padStart(4, '0')}`
          const problem2 = buildProblem(
            id2, rotatedShifted,
            template.category, template.categoryLabel,
            template.difficulty, template.tags
          )
          if (problem2) allProblems.push(problem2)
        }
      }
    }
  }

  return allProblems
}

// Also generate some random well-structured problems to fill gaps
function generateRandomProblems(count: number, existing: number): ProblemRecord[] {
  const results: ProblemRecord[] = []
  let attempts = 0

  function shuffle<T>(items: T[]): T[] {
    const result = [...items]
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
  }

  while (results.length < count && attempts < count * 30) {
    attempts++
    const hand = shuffle(ALL_TILES).slice(0, 14)
    if (!isValidHand(hand)) continue

    const efficiency = calculateEfficiency(hand)
    if (efficiency.length < 2) continue
    if (efficiency[0].shantenAfter > 2) continue

    const gap = efficiency[0].ukeire - efficiency[1].ukeire
    if (gap < 1) continue

    let difficulty: number
    let category: string
    let categoryLabel: string

    if (efficiency[0].shantenAfter === 2) {
      difficulty = 3
      category = 'random-2shanten'
      categoryLabel = '2向聴実践'
    } else if (gap > 8) {
      difficulty = 1
      category = 'random-easy'
      categoryLabel = '基本実践'
    } else if (gap >= 3) {
      difficulty = 2
      category = 'random-medium'
      categoryLabel = '受入実践'
    } else {
      difficulty = 3
      category = 'random-close'
      categoryLabel = '僅差判断'
    }

    const id = `random-${String(existing + results.length + 1).padStart(4, '0')}`
    const problem = buildProblem(id, hand, category, categoryLabel, difficulty, [])
    if (problem) results.push(problem)
  }

  return results
}

// ─── Main ────────────────────────────────────────────────────

console.log('=== Mahjong Drill Problem Generator ===')
console.log('')

console.log('Phase 1: Generating from knowledge-point templates...')
const startTime = Date.now()
const templateProblems = generateFromTemplates()
const templateTime = ((Date.now() - startTime) / 1000).toFixed(1)
console.log(`  → ${templateProblems.length} problems from templates (${templateTime}s)`)

// Count by category
const byCat = new Map<string, number>()
templateProblems.forEach(p => byCat.set(p.categoryLabel, (byCat.get(p.categoryLabel) ?? 0) + 1))
for (const [cat, count] of [...byCat.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${cat}: ${count}`)
}

// Fill up to a target with random problems
const randomTarget = Math.max(0, 3000 - templateProblems.length)
console.log('')
console.log(`Phase 2: Generating ${randomTarget} random practice problems...`)
const randomStart = Date.now()
const randomProblems = generateRandomProblems(randomTarget, templateProblems.length)
const randomTime = ((Date.now() - randomStart) / 1000).toFixed(1)
console.log(`  → ${randomProblems.length} random problems (${randomTime}s)`)

const allProblems = [...templateProblems, ...randomProblems]

// Deduplicate by hand (sorted tile string)
const seen = new Set<string>()
const unique = allProblems.filter(p => {
  const key = [...p.hand].sort().join(',')
  if (seen.has(key)) return false
  seen.add(key)
  return true
})

console.log('')
console.log(`Total: ${unique.length} unique problems (${allProblems.length - unique.length} duplicates removed)`)

// Group by difficulty
const byDiff: Record<number, ProblemRecord[]> = { 1: [], 2: [], 3: [], 4: [] }
unique.forEach(p => {
  if (byDiff[p.difficulty]) byDiff[p.difficulty].push(p)
})

console.log('')
console.log('By difficulty:')
for (const [level, probs] of Object.entries(byDiff)) {
  console.log(`  L${level}: ${probs.length}`)
}

// Write output
mkdirSync('public/data', { recursive: true })

for (const [level, probs] of Object.entries(byDiff)) {
  const path = `public/data/problems-L${level}.json`
  writeFileSync(path, JSON.stringify(probs))
  const sizeKB = (Buffer.byteLength(JSON.stringify(probs)) / 1024).toFixed(1)
  console.log(`  ${path}: ${probs.length} problems (${sizeKB} KB)`)
}

// Write index
const categories = [...new Set(unique.map(p => p.categoryLabel))]
const index = {
  levels: Object.fromEntries(Object.entries(byDiff).map(([l, p]) => [l, p.length])),
  categories,
  totalProblems: unique.length,
  generatedAt: new Date().toISOString(),
}
writeFileSync('public/data/index.json', JSON.stringify(index, null, 2))
console.log(`  public/data/index.json`)

const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
console.log('')
console.log(`Done in ${totalTime}s`)

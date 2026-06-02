import { TILE_INDEX, TILES, tilesToCounts } from './tiles'

export interface MentsuInfo {
  type: 'sequence' | 'triplet'
  tiles: string[]
  description: string
}

export interface TaatsuInfo {
  type: 'ryanmen' | 'kanchan' | 'penchan' | 'pair' | 'shanpon'
  tiles: string[]
  description: string
}

export interface JantaiInfo {
  tile: string
  tiles: string[]
  description: string
}

export interface HandStructure {
  mentsu: MentsuInfo[]
  taatsu: TaatsuInfo[]
  jantai: JantaiInfo | null
  isolated: string[]
  summary: string
}

function isHonor(index: number) {
  return index >= 27
}

function pushTriplets(counts: number[], mentsu: MentsuInfo[]) {
  counts.forEach((count, index) => {
    while (count >= 3) {
      counts[index] -= 3
      count -= 3
      mentsu.push({ type: 'triplet', tiles: [TILES[index], TILES[index], TILES[index]], description: `${TILES[index]}暗刻` })
    }
  })
}

function pushSequences(counts: number[], mentsu: MentsuInfo[]) {
  for (const suitStart of [0, 9, 18]) {
    for (let index = suitStart; index <= suitStart + 6; index += 1) {
      while (counts[index] > 0 && counts[index + 1] > 0 && counts[index + 2] > 0) {
        counts[index] -= 1
        counts[index + 1] -= 1
        counts[index + 2] -= 1
        mentsu.push({ type: 'sequence', tiles: [TILES[index], TILES[index + 1], TILES[index + 2]], description: `${TILES[index]}${TILES[index + 1]}${TILES[index + 2]}順子` })
      }
    }
  }
}

export function analyzeHandStructure(hand13: string[]): HandStructure {
  const counts = tilesToCounts(hand13)
  const working = [...counts]
  const mentsu: MentsuInfo[] = []
  const taatsu: TaatsuInfo[] = []

  pushTriplets(working, mentsu)
  pushSequences(working, mentsu)

  let jantai: JantaiInfo | null = null
  const pairIndex = working.findIndex((count) => count >= 2)
  if (pairIndex >= 0) {
    working[pairIndex] -= 2
    jantai = { tile: TILES[pairIndex], tiles: [TILES[pairIndex], TILES[pairIndex]], description: `${TILES[pairIndex]}${TILES[pairIndex]}雀頭` }
  }

  for (const suitStart of [0, 9, 18]) {
    for (let index = suitStart; index <= suitStart + 7; index += 1) {
      while (working[index] > 0 && working[index + 1] > 0) {
        working[index] -= 1
        working[index + 1] -= 1
        const edgeRank = index % 9
        const type: TaatsuInfo['type'] = edgeRank === 0 || edgeRank === 7 ? 'penchan' : 'ryanmen'
        const typeLabel = type === 'penchan' ? '辺張' : '両面'
        taatsu.push({ type, tiles: [TILES[index], TILES[index + 1]], description: `${TILES[index]}${TILES[index + 1]}${typeLabel}` })
      }
    }
  }

  for (const suitStart of [0, 9, 18]) {
    for (let index = suitStart; index <= suitStart + 6; index += 1) {
      while (working[index] > 0 && working[index + 2] > 0) {
        working[index] -= 1
        working[index + 2] -= 1
        taatsu.push({ type: 'kanchan', tiles: [TILES[index], TILES[index + 2]], description: `${TILES[index]}${TILES[index + 2]}嵌張(待ち${TILES[index + 1]})` })
      }
    }
  }

  working.forEach((count, index) => {
    while (count >= 2) {
      working[index] -= 2
      count -= 2
      taatsu.push({ type: 'pair', tiles: [TILES[index], TILES[index]], description: `${TILES[index]}対子` })
    }
  })

  const isolated = working.flatMap((count, index) => Array.from({ length: count }, () => TILES[index]))
  const taatsuLabels = taatsu.map((item) => `${item.tiles.join('')}${item.type === 'pair' ? '对子' : item.type}`)
  const isolatedText = isolated.length > 0 ? isolated.join('、') : '无明显孤张'
  const jantaiText = jantai ? `${jantai.tile}作雀头候选` : '雀头未固定'
  const honorCount = hand13.filter((tile) => TILE_INDEX[tile] != null && isHonor(TILE_INDEX[tile])).length
  const summary = `完成面子${mentsu.length}组，搭子${taatsu.length}组（${taatsuLabels.join('、') || '暂无'}），${jantaiText}，字牌${honorCount}枚，孤张为${isolatedText}。`

  return {
    mentsu,
    taatsu,
    jantai,
    isolated,
    summary,
  }
}

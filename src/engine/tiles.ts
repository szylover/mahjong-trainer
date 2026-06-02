export const TILES: string[] = [
  '1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m',
  '1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p',
  '1s', '2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s',
  'E', 'S', 'W', 'N', 'P', 'F', 'C',
]

export const TILE_INDEX: Record<string, number> = Object.fromEntries(
  TILES.map((tile, index) => [tile, index]),
) as Record<string, number>

export const ALL_TILES: string[] = TILES.flatMap((tile) => Array.from({ length: 4 }, () => tile))

export function tilesToCounts(tiles: string[]): number[] {
  const counts = Array.from({ length: TILES.length }, () => 0)

  for (const tile of tiles) {
    const index = TILE_INDEX[tile]
    if (index == null) {
      continue
    }
    counts[index] += 1
  }

  return counts
}

export function countsToTiles(counts: number[]): string[] {
  const tiles: string[] = []

  counts.forEach((count, index) => {
    for (let copy = 0; copy < count; copy += 1) {
      tiles.push(TILES[index])
    }
  })

  return tiles
}

export function parseHand(shorthand: string): string[] {
  const cleaned = shorthand.replace(/\s+/g, '')
  const tiles: string[] = []
  let digits = ''

  for (const char of cleaned) {
    if (/\d/.test(char)) {
      digits += char
      continue
    }

    if (char === 'm' || char === 'p' || char === 's') {
      for (const digit of digits) {
        tiles.push(`${digit}${char}`)
      }
      digits = ''
      continue
    }

    if (TILE_INDEX[char] != null) {
      digits = ''
      tiles.push(char)
    }
  }

  return tiles
}

function isTerminalOrHonor(index: number) {
  if (index >= 27) {
    return true
  }

  const rank = index % 9
  return rank === 0 || rank === 8
}

function calculateStandardShanten(baseCounts: number[]): number {
  const counts = [...baseCounts]
  let minShanten = 8

  function updateMinimum(mentsu: number, taatsu: number, pair: number) {
    const cappedTaatsu = Math.min(taatsu, 4 - mentsu)
    const candidate = 8 - mentsu * 2 - cappedTaatsu - pair
    if (candidate < minShanten) {
      minShanten = candidate
    }
  }

  function dfs(index: number, mentsu: number, taatsu: number, pair: number) {
    while (index < counts.length && counts[index] === 0) {
      index += 1
    }

    if (index >= counts.length) {
      updateMinimum(mentsu, taatsu, pair)
      return
    }

    updateMinimum(mentsu, taatsu, pair)

    if (counts[index] >= 3) {
      counts[index] -= 3
      dfs(index, mentsu + 1, taatsu, pair)
      counts[index] += 3
    }

    if (index < 27 && index % 9 <= 6 && counts[index + 1] > 0 && counts[index + 2] > 0) {
      counts[index] -= 1
      counts[index + 1] -= 1
      counts[index + 2] -= 1
      dfs(index, mentsu + 1, taatsu, pair)
      counts[index] += 1
      counts[index + 1] += 1
      counts[index + 2] += 1
    }

    if (counts[index] >= 2) {
      counts[index] -= 2
      if (pair === 0) {
        dfs(index, mentsu, taatsu, 1)
      }
      dfs(index, mentsu, taatsu + 1, pair)
      counts[index] += 2
    }

    if (index < 27 && index % 9 <= 7 && counts[index + 1] > 0) {
      counts[index] -= 1
      counts[index + 1] -= 1
      dfs(index, mentsu, taatsu + 1, pair)
      counts[index] += 1
      counts[index + 1] += 1
    }

    if (index < 27 && index % 9 <= 6 && counts[index + 2] > 0) {
      counts[index] -= 1
      counts[index + 2] -= 1
      dfs(index, mentsu, taatsu + 1, pair)
      counts[index] += 1
      counts[index + 2] += 1
    }

    counts[index] -= 1
    dfs(index, mentsu, taatsu, pair)
    counts[index] += 1
  }

  dfs(0, 0, 0, 0)
  return minShanten
}

function calculateChiitoitsuShanten(counts: number[]): number {
  let pairs = 0
  let unique = 0

  for (const count of counts) {
    if (count > 0) {
      unique += 1
    }
    if (count >= 2) {
      pairs += 1
    }
  }

  return 6 - pairs + Math.max(0, 7 - unique)
}

function calculateKokushiShanten(counts: number[]): number {
  let unique = 0
  let hasPair = 0

  counts.forEach((count, index) => {
    if (!isTerminalOrHonor(index) || count === 0) {
      return
    }

    unique += 1
    if (count >= 2) {
      hasPair = 1
    }
  })

  return 13 - unique - hasPair
}

export function calculateShanten(counts: number[]): number {
  return Math.min(
    calculateStandardShanten(counts),
    calculateChiitoitsuShanten(counts),
    calculateKokushiShanten(counts),
  )
}

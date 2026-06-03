import { useCallback, useEffect, useMemo, useState } from 'react'
import { evaluateDefense, generateDefenseDrill, recordStats } from '../api'
import MahjongTile from '../components/MahjongTile'
import TileHand from '../components/TileHand'
import { useTimer } from '../hooks/useTimer'
import { COUNT_OPTIONS, DIFFICULTY_OPTIONS } from '../types'
import type { DefenseEvaluationResponse, DefenseProblem } from '../types'

const SAFETY_LABELS: Record<string, { label: string; color: string }> = {
  safe: { label: '安全', color: '#22c55e' },
  relatively_safe: { label: '比较安全', color: '#86efac' },
  moderate: { label: '微妙', color: '#facc15' },
  dangerous: { label: '危险', color: '#f97316' },
  very_dangerous: { label: '非常危险', color: '#ef4444' },
}

const TILE_ORDER: Record<string, number> = {}
const suits = ['m', 'p', 's']
suits.forEach((suit, si) => {
  for (let n = 1; n <= 9; n++) {
    TILE_ORDER[`${n}${suit}`] = si * 10 + n
  }
})
const honors = ['E', 'S', 'W', 'N', 'P', 'F', 'C']
honors.forEach((h, i) => { TILE_ORDER[h] = 30 + i })

function sortHand(hand: string[]): string[] {
  return [...hand].sort((a, b) => (TILE_ORDER[a] ?? 99) - (TILE_ORDER[b] ?? 99))
}

export default function DefensePage() {
  const [difficulty, setDifficulty] = useState(1)
  const [count, setCount] = useState(10)
  const [problems, setProblems] = useState<DefenseProblem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [result, setResult] = useState<DefenseEvaluationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [evaluating, setEvaluating] = useState(false)
  const [sorted, setSorted] = useState(true)
  const { elapsedSeconds, start, stop, reset } = useTimer()

  const currentProblem = problems[currentIndex]

  const displayHand = useMemo(() => {
    if (!currentProblem) return []
    return sorted ? sortHand(currentProblem.hand) : currentProblem.hand
  }, [currentProblem, sorted])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    reset()

    generateDefenseDrill(difficulty, count)
      .then((result) => {
        if (cancelled) return
        setProblems(result)
        setCurrentIndex(0)
        setSelectedIndex(null)
        setResult(null)
        setLoading(false)
        start()
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : '加载题库失败')
        setLoading(false)
      })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty, count])

  const handleSelect = useCallback(
    async (index: number, tile: string) => {
      if (!currentProblem || result || evaluating) return

      setSelectedIndex(index)
      setEvaluating(true)
      const finalElapsed = stop()

      try {
        const evaluation = await evaluateDefense(currentProblem.hand, currentProblem.riichiRiver, tile)
        setResult(evaluation)
        void recordStats({
          mode: 'defense',
          difficulty,
          hand: currentProblem.hand,
          user_discard: tile,
          best_discard: currentProblem.safestDiscard,
          is_correct: evaluation.correct,
          time_ms: Math.round(finalElapsed),
          tags: [currentProblem.category],
        })
      } finally {
        setEvaluating(false)
      }
    },
    [currentProblem, difficulty, evaluating, result, stop],
  )

  const handleNext = useCallback(() => {
    if (currentIndex >= problems.length - 1) {
      setLoading(true)
      reset()
      generateDefenseDrill(difficulty, count)
        .then((result) => {
          setProblems(result)
          setCurrentIndex(0)
          setSelectedIndex(null)
          setResult(null)
          setLoading(false)
          start()
        })
        .catch(() => setLoading(false))
      return
    }

    setSelectedIndex(null)
    setResult(null)
    setCurrentIndex((v) => v + 1)
    start()
  }, [count, currentIndex, difficulty, problems.length, reset, start])

  return (
    <div className="page drill-page">
      <div className="drill-layout">
        <section className="panel-card drill-panel">
          <div className="drill-header">
            <div>
              <h1>防守训练</h1>
              <p>
                难度：L{difficulty} | 题 {Math.min(currentIndex + 1, Math.max(problems.length, 1))}/{Math.max(problems.length, count)}
              </p>
            </div>
            <div className="timer-pill">⏱️ {elapsedSeconds.toFixed(1)}s</div>
            <button
              type="button"
              className={`chip-button ${sorted ? 'is-active' : ''}`}
              onClick={() => setSorted((v) => !v)}
            >
              {sorted ? '🔤 已理牌' : '🔀 未理牌'}
            </button>
          </div>

          {loading || !currentProblem ? (
            <div className="loading-box">{error ? `❌ ${error}` : '正在加载题库...'}</div>
          ) : (
            <>
              {/* Riichi river */}
              <div className="defense-info">
                <div className="defense-river-header">
                  <span>🔴 对面立直 · 第{currentProblem.turn}巡 · 宝牌 </span>
                  <MahjongTile tile={currentProblem.dora} small disabled />
                </div>
                <div className="defense-river">
                  {currentProblem.riichiRiver.map((tile, i) => (
                    <div
                      key={`river-${i}`}
                      className={`river-tile ${i === currentProblem.riichiTurnIndex ? 'is-riichi' : ''}`}
                    >
                      <MahjongTile tile={tile} small disabled />
                    </div>
                  ))}
                </div>
              </div>

              {/* Player's hand */}
              <div className="hand-stage">
                <p className="stage-hint" style={{ marginTop: 0, marginBottom: 12 }}>
                  {evaluating ? '正在判定...' : '选择最安全的牌打出'}
                </p>
                <TileHand
                  tiles={displayHand}
                  selectedIndex={selectedIndex}
                  disabled={Boolean(result) || evaluating}
                  onSelect={handleSelect}
                />
              </div>
            </>
          )}

          <div className="drill-controls">
            <div className="control-group">
              <span className="control-label">难度选择：</span>
              <div className="chip-row">
                {DIFFICULTY_OPTIONS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={`chip-button ${difficulty === level ? 'is-active' : ''}`}
                    onClick={() => { setLoading(true); setDifficulty(level) }}
                  >
                    L{level}
                  </button>
                ))}
              </div>
            </div>
            <div className="control-group">
              <span className="control-label">题数：</span>
              <div className="chip-row">
                {COUNT_OPTIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`chip-button ${count === item ? 'is-active' : ''}`}
                    onClick={() => { setLoading(true); setCount(item) }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Analysis panel */}
        <section className={`analysis-panel ${result ? 'is-open' : ''}`}>
          {result && (
            <>
              <div className="analysis-header">
                <h2>{result.correct ? '✅ 正確！' : '❌ 不正確'}</h2>
                <p>
                  你的选择：{result.userTile}（{SAFETY_LABELS[result.userSafety]?.label ?? result.userSafety}）
                  | 最安全：{result.safestTile}
                </p>
              </div>

              <div className="analysis-section">
                <h3>🛡️ 安全度一览</h3>
                <div className="defense-options">
                  {result.options.map((opt) => (
                    <div
                      key={opt.tile}
                      className={`defense-option-row ${opt.tile === result.safestTile ? 'is-best' : ''} ${opt.tile === result.userTile ? 'is-user' : ''}`}
                    >
                      <MahjongTile tile={opt.tile} small disabled />
                      <span
                        className="safety-badge"
                        style={{ background: SAFETY_LABELS[opt.safety]?.color ?? '#666' }}
                      >
                        {SAFETY_LABELS[opt.safety]?.label ?? opt.safety}
                      </span>
                      <span className="safety-reason">{opt.reason}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="analysis-section explanation-grid">
                <div className="explanation-card">
                  <h3>📝 解説</h3>
                  <p>{result.explanation}</p>
                </div>
              </div>

              <div className="analysis-footer">
                <button type="button" className="primary-button" onClick={handleNext}>
                  {currentIndex >= problems.length - 1 ? '再来一组 →' : '下一题 →'}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

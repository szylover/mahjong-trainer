import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { evaluateDrill, generateDrill, recordStats } from '../api'
import AnalysisPanel from '../components/AnalysisPanel'
import TileHand from '../components/TileHand'
import { useTimer } from '../hooks/useTimer'
import { COUNT_OPTIONS, DIFFICULTY_OPTIONS, MODE_LABEL_MAP, MODE_OPTIONS, RECOMMENDED_MODE } from '../types'
import type { DrillEvaluationResponse, DrillProblem, ModeKey } from '../types'

function isModeKey(value: string | undefined): value is ModeKey {
  return MODE_OPTIONS.some((item) => item.key === value)
}

export default function DrillPage() {
  const { mode } = useParams()

  if (!isModeKey(mode)) {
    return <Navigate to={`/drill/${RECOMMENDED_MODE}`} replace />
  }

  return <DrillPageInner modeKey={mode} />
}

function DrillPageInner({ modeKey }: { modeKey: ModeKey }) {
  const [difficulty, setDifficulty] = useState(2)
  const [count, setCount] = useState(10)
  const [problems, setProblems] = useState<DrillProblem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [result, setResult] = useState<DrillEvaluationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [evaluating, setEvaluating] = useState(false)
  const { elapsedSeconds, start, stop, reset } = useTimer()

  const modeLabel = MODE_LABEL_MAP[modeKey]
  const currentProblem = problems[currentIndex]

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    reset()

    generateDrill({ mode: modeKey, difficulty, count })
      .then((response) => {
        if (cancelled) return
        setProblems(response.problems)
        setCurrentIndex(0)
        setSelectedIndex(null)
        setResult(null)
        setLoading(false)
        start()
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : '加载题库失败，请刷新页面')
        setLoading(false)
      })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, difficulty, modeKey])

  const handleSelect = useCallback(
    async (index: number, tile: string) => {
      if (!currentProblem || result || evaluating) {
        return
      }

      setSelectedIndex(index)
      setEvaluating(true)
      const finalElapsed = stop()

      try {
        const evaluation = await evaluateDrill({ hand: currentProblem.hand, discard: tile })
        setResult(evaluation)
        void recordStats({
          mode: modeKey,
          difficulty,
          hand: currentProblem.hand,
          user_discard: tile,
          best_discard: evaluation.analysis.bestDiscard,
          is_correct: evaluation.correct,
          time_ms: Math.round(finalElapsed),
          tags: currentProblem.tags,
        })
      } finally {
        setEvaluating(false)
      }
    },
    [currentProblem, difficulty, evaluating, modeKey, result, stop],
  )

  const handleNext = useCallback(() => {
    if (currentIndex >= problems.length - 1) {
      setLoading(true)
      reset()
      generateDrill({ mode: modeKey, difficulty, count })
        .then((response) => {
          setProblems(response.problems)
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
    setCurrentIndex((value) => value + 1)
    start()
  }, [count, currentIndex, difficulty, modeKey, problems.length, reset, start])

  const promptText = useMemo(() => currentProblem?.prompt ?? '点击要打出的牌', [currentProblem])

  return (
    <div className="page drill-page">
      <div className="drill-layout">
        <section className="panel-card drill-panel">
          <div className="drill-header">
            <div>
              <h1>{modeLabel}</h1>
              <p>
                模式：{modeLabel} | 难度：L{difficulty} | 题 {Math.min(currentIndex + 1, Math.max(problems.length, 1))}/{Math.max(problems.length, count)}
              </p>
            </div>
            <div className="timer-pill">⏱️ {elapsedSeconds.toFixed(1)}s</div>
          </div>

          <div className="hand-stage">
            {loading || !currentProblem ? (
              <div className="loading-box">{error ? `❌ ${error}` : '正在加载题库...'}</div>
            ) : (
              <>
                <TileHand
                  tiles={currentProblem.hand}
                  selectedIndex={selectedIndex}
                  disabled={Boolean(result) || evaluating}
                  onSelect={handleSelect}
                />
                <p className="stage-hint">{evaluating ? '正在分析答案...' : promptText}</p>
              </>
            )}
          </div>

          <div className="drill-controls">
            <div className="control-group">
              <span className="control-label">难度选择：</span>
              <div className="chip-row">
                {DIFFICULTY_OPTIONS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={`chip-button ${difficulty === level ? 'is-active' : ''}`}
                    onClick={() => {
                      setLoading(true)
                      setDifficulty(level)
                    }}
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
                    onClick={() => {
                      setLoading(true)
                      setCount(item)
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <AnalysisPanel open={Boolean(result)} result={result} onNext={handleNext} isLast={currentIndex >= problems.length - 1} />
      </div>
    </div>
  )
}

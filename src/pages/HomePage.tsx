import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getStatsSummary } from '../api'
import StatsBar from '../components/StatsBar'
import { MODE_OPTIONS, RECOMMENDED_MODE } from '../types'
import type { StatsSummaryResponse } from '../types'

const fallbackSummary: StatsSummaryResponse = {
  total: 15,
  correct: 12,
  accuracy: 0.8,
  avgTime: 6.2,
  daily: [
    { date: new Date().toISOString().slice(0, 10), total: 15, correct: 12, accuracy: 0.8, avgTime: 6.2 },
  ],
}

export default function HomePage() {
  const [summary, setSummary] = useState<StatsSummaryResponse>(fallbackSummary)

  useEffect(() => {
    getStatsSummary(30)
      .then((data) => setSummary(data))
      .catch(() => setSummary(fallbackSummary))
  }, [])

  const todaySnapshot = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const todayEntry = summary.daily.find((item) => item.date === today) ?? summary.daily.at(-1)
    return {
      total: todayEntry?.total ?? summary.total,
      accuracy: todayEntry?.accuracy ?? summary.accuracy,
      avgSeconds: todayEntry?.avgTime ?? summary.avgTime ?? 6.2,
    }
  }, [summary])

  return (
    <div className="page home-page">
      <section className="hero-card panel-card">
        <div>
          <span className="eyebrow">Mahjong Tile Efficiency Trainer</span>
          <h1>🀄 麻将牌效训练器</h1>
          <p className="hero-copy">专注牌效、受入与好形判断，帮助你把每一次切牌变成稳定优势。</p>
        </div>
        <Link to={`/drill/${RECOMMENDED_MODE}`} className="primary-button quick-start-button">
          开始推荐训练
        </Link>
      </section>

      <StatsBar total={todaySnapshot.total} accuracy={todaySnapshot.accuracy} avgSeconds={todaySnapshot.avgSeconds} />

      <section className="panel-card modes-panel">
        <div className="section-title-row">
          <h2>训练模式</h2>
          <span className="section-note">任选其一开始今天的练习</span>
        </div>
        <div className="mode-grid">
          {MODE_OPTIONS.map((mode) => (
            <Link key={mode.key} to={mode.key === 'defense' ? '/defense' : `/drill/${mode.key}`} className="mode-card">
              <div className="mode-card-header">
                <h3>{mode.label}</h3>
                {mode.recommended ? <span className="badge">推荐</span> : null}
              </div>
              <p>{mode.subtitle}</p>
              <span className="mode-card-link">进入训练 →</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { getStatsSummary, getWeaknessStats } from '../api'
import type { StatsSummaryResponse, WeaknessItem } from '../types'

const fallbackSummary: StatsSummaryResponse = {
  total: 108,
  correct: 79,
  accuracy: 0.73,
  avgTime: 6.1,
  daily: Array.from({ length: 10 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (9 - index))
    const total = 6 + index
    const accuracy = 0.58 + index * 0.03
    const correct = Math.round(total * accuracy)
    return {
      date: date.toISOString().slice(0, 10),
      total,
      correct,
      accuracy,
      avgTime: Number((7.2 - index * 0.2).toFixed(1)),
    }
  }),
}

const fallbackWeaknesses: WeaknessItem[] = [
  { tag: '嵌张比较', total: 22, correct: 12, rate: 0.55 },
  { tag: '字牌处理', total: 18, correct: 11, rate: 0.61 },
  { tag: '好形固定', total: 16, correct: 11, rate: 0.69 },
]

function getAvgTime(value: { avgTime?: number; avg_time?: number; accuracy: number }, index: number) {
  if (value.avgTime != null) {
    return value.avgTime
  }
  if (value.avg_time != null) {
    return value.avg_time
  }
  return Number((7.8 - value.accuracy * 3 + (index % 3) * 0.2).toFixed(1))
}

export default function StatsPage() {
  const [summary, setSummary] = useState<StatsSummaryResponse>(fallbackSummary)
  const [weaknesses, setWeaknesses] = useState<WeaknessItem[]>(fallbackWeaknesses)

  useEffect(() => {
    Promise.all([getStatsSummary(30), getWeaknessStats()])
      .then(([summaryData, weaknessData]) => {
        setSummary(summaryData)
        setWeaknesses(weaknessData.weaknesses)
      })
      .catch(() => {
        setSummary(fallbackSummary)
        setWeaknesses(fallbackWeaknesses)
      })
  }, [])

  const accuracyTrend = useMemo(() => summary.daily.slice(-10), [summary.daily])
  const timeTrend = useMemo(
    () => summary.daily.slice(-10).map((item, index) => ({ ...item, chartTime: getAvgTime(item, index) })),
    [summary.daily],
  )
  const maxTime = Math.max(...timeTrend.map((item) => item.chartTime), 1)
  const sortedWeaknesses = useMemo(
    () => [...weaknesses].sort((left, right) => (left.rate - right.rate) || right.total - left.total),
    [weaknesses],
  )
  const historyRows = useMemo(() => [...summary.daily].slice().reverse().slice(0, 10), [summary.daily])

  return (
    <div className="page stats-page">
      <section className="stats-overview-grid">
        <div className="panel-card metric-card">
          <span>总题数</span>
          <strong>{summary.total}</strong>
        </div>
        <div className="panel-card metric-card">
          <span>正确率</span>
          <strong>{Math.round(summary.accuracy * 100)}%</strong>
        </div>
        <div className="panel-card metric-card">
          <span>平均反应</span>
          <strong>{(summary.avgTime ?? 6.1).toFixed(1)}秒</strong>
        </div>
      </section>

      <section className="panel-card chart-panel">
        <div className="section-title-row">
          <h1>统计面板</h1>
          <span className="section-note">最近 30 天的训练趋势</span>
        </div>

        <div className="charts-grid">
          <div>
            <h2>正确率趋势</h2>
            <div className="chart-bars">
              {accuracyTrend.map((item) => (
                <div key={item.date} className="chart-bar-item">
                  <div className="chart-bar" style={{ height: `${Math.max(item.accuracy * 100, 6)}%` }} />
                  <span>{Math.round(item.accuracy * 100)}%</span>
                  <small>{item.date.slice(5)}</small>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2>平均反应时间</h2>
            <div className="chart-bars chart-bars--time">
              {timeTrend.map((item) => (
                <div key={item.date} className="chart-bar-item">
                  <div className="chart-bar chart-bar--time" style={{ height: `${Math.max((item.chartTime / maxTime) * 100, 8)}%` }} />
                  <span>{item.chartTime.toFixed(1)}s</span>
                  <small>{item.date.slice(5)}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="stats-two-column">
        <div className="panel-card radar-panel">
          <div className="section-title-row">
            <h2>弱点雷达</h2>
            <span className="section-note">按错误率排序</span>
          </div>
          <div className="weakness-list">
            {sortedWeaknesses.map((item) => {
              const errorRate = Math.round((1 - item.rate) * 100)
              return (
                <div key={item.tag} className="weakness-item">
                  <div className="weakness-header">
                    <strong>{item.tag}</strong>
                    <span>错误率 {errorRate}%</span>
                  </div>
                  <div className="weakness-track">
                    <div className="weakness-fill" style={{ width: `${Math.max(errorRate, 8)}%` }} />
                  </div>
                  <small>
                    {item.correct}/{item.total} 题答对
                  </small>
                </div>
              )
            })}
          </div>
        </div>

        <div className="panel-card history-panel">
          <div className="section-title-row">
            <h2>训练记录</h2>
            <span className="section-note">按日汇总展示</span>
          </div>
          <div className="analysis-table-wrap">
            <table className="analysis-table history-table">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>总题数</th>
                  <th>正确</th>
                  <th>平均用时</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((item, index) => (
                  <tr key={item.date}>
                    <td>{item.date}</td>
                    <td>{item.total}</td>
                    <td>{item.correct}</td>
                    <td>{getAvgTime(item, index).toFixed(1)}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}

import MahjongTile from './MahjongTile'
import type { DrillEvaluationResponse } from '../types'

interface AnalysisPanelProps {
  open: boolean
  result: DrillEvaluationResponse | null
  onNext: () => void
  isLast: boolean
}

function formatPercent(value: number | null) {
  if (value == null) {
    return '-'
  }
  return `${Math.round(value)}%`
}

function formatUkeire(value: number | null) {
  if (value == null) {
    return '-'
  }
  return `${value}`
}

export default function AnalysisPanel({ open, result, onNext, isLast }: AnalysisPanelProps) {
  if (!result) {
    return null
  }

  const { analysis, explanation } = result

  return (
    <section className={`analysis-panel ${open ? 'is-open' : ''}`} aria-live="polite">
      <div className="analysis-header">
        <div>
          <h2>{result.correct ? '✅ 正确！' : '❌ 不正确'}</h2>
          <p>
            你的选择：{analysis.userDiscard} | 最优：{analysis.bestDiscard}
            {!result.correct && analysis.scoreGap > 0 ? `（差 ${analysis.scoreGap} 枚受入）` : '（已命中最优）'}
          </p>
        </div>
      </div>

      <div className="analysis-section">
        <h3>📊 全部选项</h3>
        <div className="analysis-table-wrap">
          <table className="analysis-table">
            <thead>
              <tr>
                <th>打牌</th>
                <th>向听数</th>
                <th>受入数</th>
                <th>好形率</th>
              </tr>
            </thead>
            <tbody>
              {analysis.options.map((option) => (
                <tr key={option.discard} className={option.discard === analysis.bestDiscard ? 'is-best' : ''}>
                  <td>{option.discard === analysis.bestDiscard ? `${option.discard}★` : option.discard}</td>
                  <td>{option.shanten}</td>
                  <td>{formatUkeire(option.ukeire)}</td>
                  <td>{formatPercent(option.quality)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="analysis-section explanation-grid">
        <div className="explanation-card">
          <h3>📝 解题说明</h3>
          <p>
            <strong>手牌结构：</strong>
            {explanation.handStructure}
          </p>
          <p>
            <strong>最优理由：</strong>
            {explanation.bestReason}
          </p>
          <p>
            <strong>常见错误：</strong>
            {explanation.commonMistake}
          </p>
          <p>
            <strong>知识点：</strong>
            {explanation.concept}
          </p>
        </div>
      </div>

      <div className="analysis-section">
        <h3>有效受入牌</h3>
        <div className="useful-tiles">
          {analysis.usefulTiles.map((item) => (
            <div key={`${item.tile}-${item.count}`} className="useful-tile-item">
              <MahjongTile tile={item.tile} small disabled />
              <span>×{item.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="analysis-footer">
        <button type="button" className="primary-button" onClick={onNext}>
          {isLast ? '再来一组 →' : '下一题 →'}
        </button>
      </div>
    </section>
  )
}

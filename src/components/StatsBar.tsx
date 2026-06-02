interface StatsBarProps {
  total: number
  accuracy: number
  avgSeconds: number
}

export default function StatsBar({ total, accuracy, avgSeconds }: StatsBarProps) {
  return <div className="stats-bar">今日：{total}题 | 正确率{Math.round(accuracy * 100)}% | 平均{avgSeconds.toFixed(1)}秒</div>
}

import { Navigate, Route, Routes } from 'react-router-dom'
import NavBar from './components/NavBar'
import HomePage from './pages/HomePage'
import DrillPage from './pages/DrillPage'
import DefensePage from './pages/DefensePage'
import StatsPage from './pages/StatsPage'
import { RECOMMENDED_MODE } from './types'
import './App.css'

function SettingsPage() {
  return (
    <div className="page settings-page">
      <section className="panel-card settings-card">
        <h1>设置</h1>
        <p>这里预留给未来的偏好设定，例如题量默认值、计时提示音与牌背样式。</p>
        <p>当前版本可直接从首页或训练页开始使用。</p>
      </section>
    </div>
  )
}

export default function App() {
  return (
    <div className="app-shell">
      <NavBar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/drill/:mode" element={<DrillPage />} />
          <Route path="/defense" element={<DefensePage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to={`/drill/${RECOMMENDED_MODE}`} replace />} />
        </Routes>
      </main>
    </div>
  )
}

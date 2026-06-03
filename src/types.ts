export type TileCode = string

export type ModeKey = 'shanten' | 'ukeire' | 'shape' | 'sim' | 'speed' | 'defense'

export interface ModeOption {
  key: ModeKey
  label: string
  subtitle: string
  recommended?: boolean
}

export interface DiscardAnalysisOption {
  discard: TileCode
  shanten: number
  ukeire: number | null
  quality: number | null
  isBest?: boolean
}

export interface UsefulTile {
  tile: TileCode
  count: number
}

export interface ExplanationSections {
  handStructure: string
  bestReason: string
  commonMistake?: string
  concept?: string
}

export interface DrillProblem {
  id: string
  mode: ModeKey
  difficulty: number
  hand: TileCode[]
  tags: string[]
  prompt?: string
  bestDiscard?: TileCode
  analysisOptions?: DiscardAnalysisOption[]
  usefulTiles?: UsefulTile[]
  explanation?: ExplanationSections
}

export interface DrillGenerateRequest {
  mode: ModeKey
  difficulty: number
  count: number
}

export interface DrillGenerateResponse {
  problems: DrillProblem[]
}

export interface DrillEvaluateRequest {
  hand: TileCode[]
  discard: TileCode
}

export interface DrillEvaluationResponse {
  correct: boolean
  analysis: {
    bestDiscard: TileCode
    userDiscard: TileCode
    scoreGap: number
    options: DiscardAnalysisOption[]
    usefulTiles: UsefulTile[]
  }
  explanation: ExplanationSections
}

export interface DailyStat {
  date: string
  total: number
  correct: number
  accuracy: number
  avgTime?: number
  avg_time?: number
}

export interface StatsSummaryResponse {
  total: number
  correct: number
  accuracy: number
  avgTime?: number
  daily: DailyStat[]
}

export interface WeaknessItem {
  tag: string
  total: number
  correct: number
  rate: number
}

export interface WeaknessResponse {
  weaknesses: WeaknessItem[]
}

export interface DefenseProblem {
  id: string
  difficulty: number
  turn: number
  hand: TileCode[]
  riichiRiver: TileCode[]
  riichiTurnIndex: number
  dora: TileCode
  safestDiscard: TileCode
  options: DefenseOption[]
  explanation: string
  category: string
}

export interface DefenseOption {
  tile: TileCode
  safety: 'safe' | 'relatively_safe' | 'moderate' | 'dangerous' | 'very_dangerous'
  reason: string
}

export interface DefenseEvaluationResponse {
  correct: boolean
  safestTile: TileCode
  userTile: TileCode
  userSafety: string
  options: DefenseOption[]
  explanation: string
}

export interface RecordStatsRequest {
  mode: ModeKey
  difficulty: number
  hand: TileCode[]
  user_discard: TileCode
  best_discard: TileCode
  is_correct: boolean
  time_ms: number
  tags: string[]
}

export const MODE_OPTIONS: ModeOption[] = [
  { key: 'shanten', label: '向听速算', subtitle: '快速判断向听与改良路线' },
  { key: 'ukeire', label: '受入训练', subtitle: '比较打牌后的有效牌数量', recommended: true },
  { key: 'shape', label: '好形判断', subtitle: '兼顾受入与好形率的平衡' },
  { key: 'defense', label: '防守训练', subtitle: '立直后的安全牌判断（现物·筋·壁）' },
  { key: 'sim', label: '实战模拟', subtitle: '贴近实战的单巡选择题' },
  { key: 'speed', label: '限时挑战', subtitle: '在压力下稳定做出最优切牌' },
]

export const DIFFICULTY_OPTIONS = [1, 2, 3, 4] as const
export const COUNT_OPTIONS = [5, 10, 20] as const

export const MODE_LABEL_MAP: Record<ModeKey, string> = MODE_OPTIONS.reduce(
  (acc, item) => ({ ...acc, [item.key]: item.label }),
  {} as Record<ModeKey, string>,
)

export const RECOMMENDED_MODE = MODE_OPTIONS.find((item) => item.recommended)?.key ?? 'ukeire'

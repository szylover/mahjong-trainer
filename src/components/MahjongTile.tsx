import type { TileCode } from '../types'

interface TileProps {
  tile: TileCode
  onClick?: () => void
  selected?: boolean
  highlighted?: boolean
  small?: boolean
  disabled?: boolean
}

function getTileName(tile: TileCode) {
  const HONOR_LABELS: Record<string, string> = {
    E: '東', S: '南', W: '西', N: '北', P: '白', F: '發', C: '中',
  }
  const MAN_LABELS = ['一', '二', '三', '四', '五', '六', '七', '八', '九']
  if (/^[1-9]m$/.test(tile)) return `${MAN_LABELS[Number(tile[0]) - 1]}万`
  if (/^[1-9]p$/.test(tile)) return `${tile[0]}筒`
  if (/^[1-9]s$/.test(tile)) return `${tile[0]}索`
  return HONOR_LABELS[tile] ?? tile
}

export default function MahjongTile({
  tile,
  onClick,
  selected = false,
  highlighted = false,
  small = false,
  disabled = false,
}: TileProps) {
  return (
    <button
      type="button"
      className={[
        'mahjong-tile',
        small ? 'mahjong-tile--small' : '',
        selected ? 'is-selected' : '',
        highlighted ? 'is-highlighted' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      disabled={disabled}
      aria-label={`麻将牌 ${getTileName(tile)}`}
    >
      <img
        src={`/tiles/${tile}.svg`}
        alt={getTileName(tile)}
        draggable={false}
      />
    </button>
  )
}

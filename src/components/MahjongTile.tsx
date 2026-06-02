import type { TileCode } from '../types'

interface TileProps {
  tile: TileCode
  onClick?: () => void
  selected?: boolean
  highlighted?: boolean
  small?: boolean
  disabled?: boolean
}

const MAN_LABELS = ['一', '二', '三', '四', '五', '六', '七', '八', '九']
const HONOR_LABELS: Record<string, string> = {
  E: '東',
  S: '南',
  W: '西',
  N: '北',
  P: '白',
  F: '發',
  C: '中',
}

const PIN_LAYOUTS: Record<number, Array<[number, number]>> = {
  1: [[20, 28]],
  2: [[20, 18], [20, 38]],
  3: [[20, 14], [20, 28], [20, 42]],
  4: [[13, 18], [27, 18], [13, 38], [27, 38]],
  5: [[13, 18], [27, 18], [20, 28], [13, 38], [27, 38]],
  6: [[13, 14], [27, 14], [13, 28], [27, 28], [13, 42], [27, 42]],
  7: [[13, 12], [27, 12], [20, 21], [13, 30], [27, 30], [13, 44], [27, 44]],
  8: [[13, 12], [27, 12], [13, 23], [27, 23], [13, 34], [27, 34], [13, 45], [27, 45]],
  9: [[13, 12], [20, 12], [27, 12], [13, 28], [20, 28], [27, 28], [13, 44], [20, 44], [27, 44]],
}

function getSuit(tile: TileCode) {
  if (/^[1-9][mps]$/.test(tile)) {
    return tile[1]
  }
  return 'honor'
}

function getTileName(tile: TileCode) {
  if (/^[1-9]m$/.test(tile)) {
    return `${MAN_LABELS[Number(tile[0]) - 1]}万`
  }
  if (/^[1-9]p$/.test(tile)) {
    return `${tile[0]}筒`
  }
  if (/^[1-9]s$/.test(tile)) {
    return `${tile[0]}索`
  }
  return HONOR_LABELS[tile] ?? tile
}

function renderGlyph(tile: TileCode) {
  if (/^[1-9]m$/.test(tile)) {
    const number = Number(tile[0])
    return (
      <>
        <text x="20" y="27" textAnchor="middle" className="tile-glyph tile-glyph--man">
          {MAN_LABELS[number - 1]}
        </text>
        <text x="20" y="44" textAnchor="middle" className="tile-glyph tile-glyph--man tile-glyph--sub">
          万
        </text>
      </>
    )
  }

  if (/^[1-9]s$/.test(tile)) {
    return (
      <>
        <text x="20" y="29" textAnchor="middle" className="tile-glyph tile-glyph--sou">
          {tile[0]}
        </text>
        <text x="20" y="45" textAnchor="middle" className="tile-glyph tile-glyph--sou tile-glyph--sub">
          索
        </text>
      </>
    )
  }

  if (/^[1-9]p$/.test(tile)) {
    const number = Number(tile[0])
    return (
      <>
        <text x="20" y="11" textAnchor="middle" className="tile-corner-label">
          {tile[0]}
        </text>
        {PIN_LAYOUTS[number].map(([cx, cy], index) => (
          <g key={`${tile}-${index}`}>
            <circle cx={cx} cy={cy} r="5.4" className="tile-pin-dot" />
            <circle cx={cx} cy={cy} r="2.1" className="tile-pin-dot-core" />
          </g>
        ))}
      </>
    )
  }

  return (
    <text x="20" y="33" textAnchor="middle" className="tile-glyph tile-glyph--honor">
      {HONOR_LABELS[tile] ?? tile}
    </text>
  )
}

export default function MahjongTile({
  tile,
  onClick,
  selected = false,
  highlighted = false,
  small = false,
  disabled = false,
}: TileProps) {
  const suit = getSuit(tile)

  return (
    <button
      type="button"
      className={[
        'mahjong-tile',
        `mahjong-tile--${suit}`,
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
      <svg viewBox="0 0 40 56" width={small ? 28 : 40} height={small ? 40 : 56} role="img" aria-hidden="true">
        <rect x="2" y="2" width="36" height="52" rx="6" className="tile-shadow" />
        <rect x="3" y="2" width="34" height="50" rx="5" className="tile-face" />
        {renderGlyph(tile)}
      </svg>
    </button>
  )
}

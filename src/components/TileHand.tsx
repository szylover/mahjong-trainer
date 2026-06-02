import MahjongTile from './MahjongTile'
import type { TileCode } from '../types'

interface TileHandProps {
  tiles: TileCode[]
  selectedIndex?: number | null
  disabled?: boolean
  onSelect: (index: number, tile: TileCode) => void
}

export default function TileHand({ tiles, selectedIndex, disabled = false, onSelect }: TileHandProps) {
  return (
    <div className="tile-hand" role="group" aria-label="当前手牌">
      {tiles.map((tile, index) => (
        <MahjongTile
          key={`${tile}-${index}`}
          tile={tile}
          selected={selectedIndex === index}
          disabled={disabled}
          onClick={() => onSelect(index, tile)}
        />
      ))}
    </div>
  )
}

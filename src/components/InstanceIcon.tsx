import { useState, type CSSProperties } from 'react'

// Minecraft block textures bundled in assets/blocks. Each block is drawn as an isometric cube (top / left / right faces).
const files = import.meta.glob('../assets/blocks/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const tex = (name: string) => files[`../assets/blocks/${name}.png`] ?? ''

export const BLOCK_FACES: Record<string, { top: string; left: string; right: string }> = {
  crafting_table: { top: 'crafting_table_top', left: 'crafting_table_side', right: 'crafting_table_front' },
  furnace: { top: 'furnace_top', left: 'furnace_side', right: 'furnace_front' },
  tnt: { top: 'tnt_top', left: 'tnt_side', right: 'tnt_side' },
  bookshelf: { top: 'oak_planks', left: 'bookshelf', right: 'bookshelf' },
  oak_log: { top: 'oak_log_top', left: 'oak_log', right: 'oak_log' },
  diamond_ore: { top: 'diamond_ore', left: 'diamond_ore', right: 'diamond_ore' },
  cobblestone: { top: 'cobblestone', left: 'cobblestone', right: 'cobblestone' },
  bricks: { top: 'bricks', left: 'bricks', right: 'bricks' },
  gold_block: { top: 'gold_block', left: 'gold_block', right: 'gold_block' },
  glowstone: { top: 'glowstone', left: 'glowstone', right: 'glowstone' },
  obsidian: { top: 'obsidian', left: 'obsidian', right: 'obsidian' },
  netherrack: { top: 'netherrack', left: 'netherrack', right: 'netherrack' }
}
export const BLOCK_ICONS = Object.keys(BLOCK_FACES).map((b) => `block:${b}`)
export const DEFAULT_ICON = 'block:crafting_table'
export const blockLabel = (icon: string) => icon.replace('block:', '').replace(/_/g, ' ')

/** Renders an instance icon: a Minecraft block (`block:<id>`), an image URL (modpack logo) or, for old instances, plain text/emoji. */
export default function InstanceIcon({ icon, size = 28, className = '' }: { icon?: string; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false)
  const value = broken ? DEFAULT_ICON : icon || DEFAULT_ICON
  if (value.startsWith('picker:')) {
    const id = value.slice(7)
    const files = import.meta.glob('../assets/instance-icons/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
    const src = files[`../assets/instance-icons/${id}.png`]
    return src ? <img className={`instance-icon-img ${className}`} src={src} width={size} height={size} alt="" draggable={false}/> : <span className={`instance-icon-text ${className}`}>?</span>
  }
  if (/^(https?:|data:)/.test(value)) return <img className={`instance-icon-img ${className}`} src={value} width={size} height={size} alt="" loading="lazy" draggable={false} onError={() => setBroken(true)} />
  const faces = value.startsWith('block:') ? BLOCK_FACES[value.slice(6)] : undefined
  if (value.startsWith('block:') && !faces) return <InstanceIcon icon={DEFAULT_ICON} size={size} className={className} />
  if (!faces) return <span className={`instance-icon-text ${className}`} style={{ fontSize: size * .8 }}>{value}</span>
  return <span className={`block-icon ${className}`} style={{ '--s': `${size}px` } as CSSProperties} aria-hidden>
    <span className="block-cube">
      <i className="face face-top" style={{ backgroundImage: `url(${tex(faces.top)})` }} />
      <i className="face face-left" style={{ backgroundImage: `url(${tex(faces.left)})` }} />
      <i className="face face-right" style={{ backgroundImage: `url(${tex(faces.right)})` }} />
    </span>
  </span>
}

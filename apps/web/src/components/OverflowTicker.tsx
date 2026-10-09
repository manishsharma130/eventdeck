import { useEffect, useRef, useState, type ReactNode } from 'react'

type OverflowTickerProps = { children: ReactNode; active?: boolean; className?: string; title?: string }

const PIXELS_PER_SECOND = 14

export function OverflowTicker({ children, active, className = '', title }: OverflowTickerProps) {
  const viewportRef = useRef<HTMLSpanElement>(null)
  const [hovered, setHovered] = useState(false)
  const running = active ?? hovered

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    viewport.scrollLeft = 0
    if (!running || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const overflow = viewport.scrollWidth - viewport.clientWidth
    if (overflow <= 1) return

    let frame = 0
    let previous = performance.now()
    let position = 0
    let direction = 1
    const move = (now: number) => {
      const elapsed = Math.min(now - previous, 100)
      previous = now
      position += direction * PIXELS_PER_SECOND * elapsed / 1000
      if (position >= overflow) { position = overflow; direction = -1 }
      else if (position <= 0) { position = 0; direction = 1 }
      viewport.scrollLeft = position
      frame = window.requestAnimationFrame(move)
    }
    frame = window.requestAnimationFrame(move)
    return () => { window.cancelAnimationFrame(frame); viewport.scrollLeft = 0 }
  }, [running, children])

  return <span ref={viewportRef} className={`overflow-ticker ${className}`} title={title} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setHovered(true)} onBlur={() => setHovered(false)}><span>{children}</span></span>
}

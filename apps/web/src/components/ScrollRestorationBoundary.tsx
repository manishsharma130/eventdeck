import { useEffect, useLayoutEffect, useRef, type PropsWithChildren } from 'react'
import type { TabId } from './ui'

type ScrollPosition = { top: number; left: number }

// Kept outside React state so scrolling never causes a component render.
const positions = new Map<TabId, Map<string, ScrollPosition>>()
const transientClasses = new Set(['active', 'selected', 'dragging', 'details-open', 'details-closed'])

function elementKey(element: HTMLElement, boundary: HTMLElement): string {
  const parts: string[] = []
  let current: HTMLElement | null = element
  while (current && current !== boundary) {
    const classes = [...current.classList].filter((name) => !transientClasses.has(name)).sort().join('.')
    const siblings = current.parentElement ? [...current.parentElement.children].filter((item) => item.tagName === current?.tagName) : []
    parts.push(`${current.tagName.toLowerCase()}${classes ? `.${classes}` : ''}:${siblings.indexOf(current)}`)
    current = current.parentElement
  }
  return parts.reverse().join('>')
}

function restorePositions(boundary: HTMLElement, saved: Map<string, ScrollPosition>): void {
  for (const element of boundary.querySelectorAll<HTMLElement>('*')) {
    const position = saved.get(elementKey(element, boundary))
    if (!position) continue
    if (element.scrollTop !== position.top) element.scrollTop = position.top
    if (element.scrollLeft !== position.left) element.scrollLeft = position.left
  }
}

/** Preserves all descendant scroll containers while routed tabs remain unmounted. */
export function ScrollRestorationBoundary({ tab, children }: PropsWithChildren<{ tab: TabId }>) {
  const boundaryRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const boundary = boundaryRef.current
    if (!boundary) return
    const onScroll = (event: Event) => {
      if (!(event.target instanceof HTMLElement) || !boundary.contains(event.target)) return
      const tabPositions = positions.get(tab) ?? new Map<string, ScrollPosition>()
      tabPositions.set(elementKey(event.target, boundary), { top: event.target.scrollTop, left: event.target.scrollLeft })
      positions.set(tab, tabPositions)
    }
    boundary.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => boundary.removeEventListener('scroll', onScroll, true)
  }, [tab])

  useLayoutEffect(() => {
    const boundary = boundaryRef.current
    const saved = positions.get(tab)
    if (!boundary || !saved?.size) return
    let frame = 0
    const restore = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => restorePositions(boundary, saved))
    }
    restore()
    const observer = new MutationObserver(restore)
    observer.observe(boundary, { childList: true, subtree: true })
    const timeout = window.setTimeout(() => observer.disconnect(), 3000)
    return () => { cancelAnimationFrame(frame); window.clearTimeout(timeout); observer.disconnect() }
  }, [tab])

  return <div className="route-scroll-boundary" ref={boundaryRef}>{children}</div>
}

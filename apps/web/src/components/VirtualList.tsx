import { useRef, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

export function VirtualList<T>({ items, estimateSize, getKey, renderItem, className = '', overscan = 6 }: {
  items: T[]
  estimateSize: number
  getKey: (item: T, index: number) => string
  renderItem: (item: T, index: number) => ReactNode
  className?: string
  overscan?: number
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    getItemKey: (index) => getKey(items[index], index),
    overscan,
  })
  return <div className={`virtual-list ${className}`} ref={scrollRef}>
    <div className="virtual-list-inner" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((virtualRow) => <div
        className="virtual-list-item"
        data-index={virtualRow.index}
        key={virtualRow.key}
        ref={virtualizer.measureElement}
        style={{ transform: `translateY(${virtualRow.start}px)` }}
      >{renderItem(items[virtualRow.index], virtualRow.index)}</div>)}
    </div>
  </div>
}

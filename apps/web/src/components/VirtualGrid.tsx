import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

export function VirtualGrid<T>({ items, minColumnWidth, estimateRowSize, gap = 18, getKey, renderItem, className = '' }: {
  items: T[]
  minColumnWidth: number
  estimateRowSize: number
  gap?: number
  getKey: (item: T) => string
  renderItem: (item: T) => ReactNode
  className?: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState(1)
  useLayoutEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const update = () => setColumns(Math.max(1, Math.floor((element.clientWidth + gap) / (minColumnWidth + gap))))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [gap, minColumnWidth])
  const rowCount = Math.ceil(items.length / columns)
  const virtualizer = useVirtualizer({ count: rowCount, getScrollElement: () => scrollRef.current, estimateSize: () => estimateRowSize, overscan: 3 })
  return <div className={`virtual-grid ${className}`} ref={scrollRef}>
    <div className="virtual-list-inner" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((row) => {
        const rowItems = items.slice(row.index * columns, (row.index + 1) * columns)
        return <div className="virtual-grid-row" data-index={row.index} key={row.key} ref={virtualizer.measureElement} style={{ gap, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, transform: `translateY(${row.start}px)` }}>
          {rowItems.map((item) => <div key={getKey(item)}>{renderItem(item)}</div>)}
        </div>
      })}
    </div>
  </div>
}

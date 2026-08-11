import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/**
 * 浮在缸前面的那种毛玻璃面板。鱼缸尺寸和鱼市都是它。
 *
 * 没有用 shadcn 的 Card：Card 是铺在页面里的一块底，自带 py-6、gap-6 和一套
 * Header/Content 结构，而这里要的是压在 3D 画面上的一小片玻璃——内边距只有它的
 * 一半，也不需要那套分区。真用 Card 就得把它的内距、间距、底色、描边逐条盖掉，
 * 剩下的还是这几个类，只是多绕了一圈。
 */
export function Panel({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={cn(
        'rounded-xl border border-glass/24 bg-surface/72 px-4 py-3.5 backdrop-blur-md max-[720px]:rounded-none max-[720px]:border-0 max-[720px]:bg-transparent max-[720px]:px-1 max-[720px]:backdrop-blur-none',
        className,
      )}
      {...props}
    />
  )
}

/** 面板顶上那行小字，全大写、字距拉开。 */
export function PanelHeading({ className, ...props }: ComponentProps<'h2'>) {
  return (
    <h2
      className={cn(
        'text-[0.7rem] font-bold tracking-[0.16em] text-lagoon uppercase',
        className,
      )}
      {...props}
    />
  )
}

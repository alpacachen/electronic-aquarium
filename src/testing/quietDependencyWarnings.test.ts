import { afterEach, describe, expect, it, vi } from 'vitest'
import { Clock, getConsoleFunction, setConsoleFunction, warn } from 'three'
import { quietDependencyWarnings } from './quietDependencyWarnings'

describe('安静掉依赖自己的过时警告', () => {
  afterEach(() => {
    setConsoleFunction(null as unknown as Parameters<typeof setConsoleFunction>[0])
    vi.restoreAllMocks()
  })

  it('不再打印 fiber 建 Clock 时那条我们改不动的警告', () => {
    // Given 一个会记下所有 Three.js 警告的日志
    const logged = vi.spyOn(console, 'warn').mockImplementation(() => {})
    quietDependencyWarnings()

    // When 依赖像 fiber 那样建一个 Clock
    new Clock()

    // Then 日志里没有那条警告
    expect(logged).not.toHaveBeenCalled()
  })

  it('别的警告照旧送到日志里', () => {
    // Given 同一个装好过滤的日志
    const logged = vi.spyOn(console, 'warn').mockImplementation(() => {})
    quietDependencyWarnings()

    // When Three.js 报一件我们能动手改的事
    warn('Aquarium: 这条得让人看见。')

    // Then 它原样出现在日志里
    expect(logged).toHaveBeenCalledWith('THREE.Aquarium: 这条得让人看见。')
  })

  it('装两次也不会把先前的处理器丢掉', () => {
    // Given 已经有人接过了 Three.js 的日志
    const earlier = vi.fn()
    setConsoleFunction(earlier)

    // When 过滤器装了两次
    quietDependencyWarnings()
    quietDependencyWarnings()
    warn('Aquarium: 这条得让人看见。')

    // Then 先前那个处理器仍然收到这条警告，且只收到一次
    expect(earlier).toHaveBeenCalledTimes(1)
    expect(earlier).toHaveBeenCalledWith('warn', 'THREE.Aquarium: 这条得让人看见。')
    expect(getConsoleFunction()).not.toBe(earlier)
  })
})

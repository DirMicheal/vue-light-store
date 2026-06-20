import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ObservableStore } from '@/observable'
import type { Getters } from '@/types'

interface TestState {
  count: number
  name: string
}

interface TestGetters extends Getters<TestState> {
  doubleCount: (state: TestState) => number
}

interface TestActions {
  increment: () => void
}

const testState: TestState = { count: 0, name: 'test' }

describe('ObservableStore', () => {
  let observable: ObservableStore<TestState, TestGetters, TestActions>

  beforeEach(() => {
    observable = new ObservableStore<TestState, TestGetters, TestActions>('test')
  })

  describe('subscribe', () => {
    it('should add subscriber and return unsubscribe function', () => {
      const callback = vi.fn()
      const unsubscribe = observable.subscribe(callback)

      expect(typeof unsubscribe).toBe('function')
      expect(observable.subscriberCount()).toBe(1)
    })

    it('should notify subscribers when mutation occurs', () => {
      const callback = vi.fn()
      observable.subscribe(callback)

      observable.notifyMutation({
        type: 'patch',
        value: { count: 1 }
      }, testState)

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback.mock.calls[0][0]).toMatchObject({
        type: 'patch',
        storeName: 'test',
        value: { count: 1 }
      })
    })

    it('should support once option', () => {
      const callback = vi.fn()
      observable.subscribe(callback, { once: true })

      observable.notifyMutation({ type: 'patch', value: {} }, testState)
      observable.notifyMutation({ type: 'patch', value: {} }, testState)

      expect(callback).toHaveBeenCalledTimes(1)
      expect(observable.subscriberCount()).toBe(0)
    })

    it('should unsubscribe correctly', () => {
      const callback = vi.fn()
      const unsubscribe = observable.subscribe(callback)

      unsubscribe()

      observable.notifyMutation({ type: 'patch', value: {} }, testState)
      expect(callback).not.toHaveBeenCalled()
      expect(observable.subscriberCount()).toBe(0)
    })

    it('should handle subscriber errors gracefully', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const badCallback = vi.fn(() => {
        throw new Error('Subscriber error')
      })
      const goodCallback = vi.fn()

      observable.subscribe(badCallback)
      observable.subscribe(goodCallback)

      observable.notifyMutation({ type: 'patch', value: {} }, testState)

      expect(goodCallback).toHaveBeenCalled()
      expect(consoleError).toHaveBeenCalled()

      consoleError.mockRestore()
    })

    it('should not notify after dispose', () => {
      const callback = vi.fn()
      observable.subscribe(callback)
      observable.dispose()

      observable.notifyMutation({ type: 'patch', value: {} }, testState)
      expect(callback).not.toHaveBeenCalled()
    })

    it('should return noop unsubscribe when disposed', () => {
      observable.dispose()
      const unsubscribe = observable.subscribe(vi.fn())
      expect(typeof unsubscribe).toBe('function')
      expect(observable.subscriberCount()).toBe(0)
    })
  })

  describe('onAction', () => {
    it('should add action subscriber and return unsubscribe function', () => {
      const callback = vi.fn()
      const unsubscribe = observable.onAction(callback)

      expect(typeof unsubscribe).toBe('function')
      expect(observable.actionSubscriberCount()).toBe(1)
    })

    it('should notify action subscribers when action occurs', () => {
      const callback = vi.fn()
      observable.onAction(callback)

      observable.notifyAction({
        name: 'increment',
        args: [1, 2]
      })

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback.mock.calls[0][0]).toMatchObject({
        name: 'increment',
        storeName: 'test',
        args: [1, 2]
      })
    })

    it('should support once option for action subscribers', () => {
      const callback = vi.fn()
      observable.onAction(callback, { once: true })

      observable.notifyAction({ name: 'increment', args: [] })
      observable.notifyAction({ name: 'increment', args: [] })

      expect(callback).toHaveBeenCalledTimes(1)
      expect(observable.actionSubscriberCount()).toBe(0)
    })

    it('should call after callback and record result', () => {
      const afterCallback = vi.fn()
      const callback = vi.fn((info) => {
        info.after(afterCallback)
      })

      observable.onAction(callback)
      const { resolve } = observable.notifyAction({ name: 'increment', args: [] })
      resolve('result')

      expect(afterCallback).toHaveBeenCalledWith('result')
      const debugInfo = observable.getDebugInfo({ count: 0, name: 'test' }, {})
      expect(debugInfo.actionHistory[0].result).toBe('result')
    })

    it('should call onError callback and record error', () => {
      const testError = new Error('Test error')
      const errorCallback = vi.fn()
      const callback = vi.fn((info) => {
        info.onError(errorCallback)
      })

      observable.onAction(callback)
      const { reject } = observable.notifyAction({ name: 'increment', args: [] })
      reject(testError)

      expect(errorCallback).toHaveBeenCalledWith(testError)
      const debugInfo = observable.getDebugInfo({ count: 0, name: 'test' }, {})
      expect(debugInfo.actionHistory[0].error).toBe(testError)
    })

    it('should handle errors in after callback gracefully', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const callback = vi.fn((info) => {
        info.after(() => {
          throw new Error('After callback error')
        })
      })

      observable.onAction(callback)
      const { resolve } = observable.notifyAction({ name: 'increment', args: [] })
      resolve('result')

      expect(consoleError).toHaveBeenCalled()
      consoleError.mockRestore()
    })

    it('should handle errors in onError callback gracefully', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const testError = new Error('Original error')
      const callback = vi.fn((info) => {
        info.onError(() => {
          throw new Error('OnError callback error')
        })
      })

      observable.onAction(callback)
      const { reject } = observable.notifyAction({ name: 'increment', args: [] })
      reject(testError)

      expect(consoleError).toHaveBeenCalled()
      consoleError.mockRestore()
    })

    it('should handle action subscriber errors gracefully', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const badCallback = vi.fn(() => {
        throw new Error('Action subscriber error')
      })
      const goodCallback = vi.fn()

      observable.onAction(badCallback)
      observable.onAction(goodCallback)

      observable.notifyAction({ name: 'increment', args: [] })

      expect(goodCallback).toHaveBeenCalled()
      expect(consoleError).toHaveBeenCalled()

      consoleError.mockRestore()
    })

    it('should not notify actions after dispose', () => {
      const callback = vi.fn()
      observable.onAction(callback)
      observable.dispose()

      observable.notifyAction({ name: 'increment', args: [] })
      expect(callback).not.toHaveBeenCalled()
    })

    it('should return noop unsubscribe when disposed', () => {
      observable.dispose()
      const unsubscribe = observable.onAction(vi.fn())
      expect(typeof unsubscribe).toBe('function')
      expect(observable.actionSubscriberCount()).toBe(0)
    })
  })

  describe('history tracking', () => {
    it('should track mutation history', () => {
      for (let i = 0; i < 5; i++) {
        observable.notifyMutation({
          type: 'patch',
          value: { count: i }
        }, testState)
      }

      const debugInfo = observable.getDebugInfo({ count: 4, name: 'test' }, {})
      expect(debugInfo.mutationHistory).toHaveLength(5)
      expect(debugInfo.mutationHistory[0].value).toEqual({ count: 0 })
      expect(debugInfo.mutationHistory[4].value).toEqual({ count: 4 })
    })

    it('should limit history size to 100 entries', () => {
      for (let i = 0; i < 150; i++) {
        observable.notifyMutation({
          type: 'patch',
          value: { count: i }
        }, testState)
        observable.notifyAction({
          name: 'increment',
          args: [i]
        })
      }

      const debugInfo = observable.getDebugInfo({ count: 149, name: 'test' }, {})
      expect(debugInfo.mutationHistory).toHaveLength(100)
      expect(debugInfo.actionHistory).toHaveLength(100)
    })

    it('should clear history when clearHistory is called', () => {
      observable.notifyMutation({ type: 'patch', value: {} }, testState)
      observable.notifyAction({ name: 'increment', args: [] })

      observable.clearHistory()

      const debugInfo = observable.getDebugInfo({ count: 0, name: 'test' }, {})
      expect(debugInfo.mutationHistory).toHaveLength(0)
      expect(debugInfo.actionHistory).toHaveLength(0)
    })
  })

  describe('getDebugInfo', () => {
    it('should return complete debug information', () => {
      const callback = vi.fn()
      observable.subscribe(callback)
      observable.onAction(callback)
      observable.notifyMutation({ type: 'patch', value: { count: 5 } }, testState)
      observable.notifyAction({ name: 'increment', args: [1] })

      const state: TestState = { count: 5, name: 'test' }
      const getters = { doubleCount: 10 }

      const debugInfo = observable.getDebugInfo(state, getters)

      expect(debugInfo.name).toBe('test')
      expect(debugInfo.state).toEqual(state)
      expect(debugInfo.getters).toEqual(getters)
      expect(debugInfo.mutationHistory).toHaveLength(1)
      expect(debugInfo.actionHistory).toHaveLength(1)
      expect(debugInfo.subscriberCount).toBe(1)
      expect(debugInfo.actionSubscriberCount).toBe(1)
      expect(debugInfo.isDisposed).toBe(false)
    })

    it('should return deep clone of state and getters', () => {
      const state: TestState = { count: 5, name: 'test' }
      const getters = { doubleCount: 10 }

      const debugInfo = observable.getDebugInfo(state, getters)

      state.count = 100
      expect(debugInfo.state.count).toBe(5)
    })
  })

  describe('dispose', () => {
    it('should mark as disposed and clear all subscribers', () => {
      observable.subscribe(vi.fn())
      observable.onAction(vi.fn())
      observable.notifyMutation({ type: 'patch', value: {} }, testState)

      observable.dispose()

      expect(observable.isDisposed()).toBe(true)
      expect(observable.subscriberCount()).toBe(0)
      expect(observable.actionSubscriberCount()).toBe(0)

      const debugInfo = observable.getDebugInfo({ count: 0, name: 'test' }, {})
      expect(debugInfo.mutationHistory).toHaveLength(0)
      expect(debugInfo.actionHistory).toHaveLength(0)
    })

    it('should be idempotent', () => {
      observable.dispose()
      expect(() => observable.dispose()).not.toThrow()
      expect(observable.isDisposed()).toBe(true)
    })
  })

  describe('public methods', () => {
    it('should expose correct initial state via getters', () => {
      expect(observable.isDisposed()).toBe(false)
      expect(observable.subscriberCount()).toBe(0)
      expect(observable.actionSubscriberCount()).toBe(0)
    })

    it('should update counts after subscribing', () => {
      observable.subscribe(vi.fn())
      observable.subscribe(vi.fn())
      observable.onAction(vi.fn())

      expect(observable.isDisposed()).toBe(false)
      expect(observable.subscriberCount()).toBe(2)
      expect(observable.actionSubscriberCount()).toBe(1)
    })
  })

  describe('timestamps', () => {
    it('should include timestamps in mutations', () => {
      const before = Date.now()
      observable.notifyMutation({ type: 'patch', value: {} }, testState)
      const after = Date.now()

      const debugInfo = observable.getDebugInfo({ count: 0, name: 'test' }, {})
      const timestamp = debugInfo.mutationHistory[0].timestamp

      expect(timestamp).toBeGreaterThanOrEqual(before)
      expect(timestamp).toBeLessThanOrEqual(after)
    })

    it('should include timestamps in actions', () => {
      const before = Date.now()
      observable.notifyAction({ name: 'test', args: [] })
      const after = Date.now()

      const debugInfo = observable.getDebugInfo({ count: 0, name: 'test' }, {})
      const timestamp = debugInfo.actionHistory[0].timestamp

      expect(timestamp).toBeGreaterThanOrEqual(before)
      expect(timestamp).toBeLessThanOrEqual(after)
    })
  })
})

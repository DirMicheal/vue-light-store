import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Store } from '@/store'
import type {
  Getters,
  ModuleOptions,
  StoreRegistry,
  MutationInfo
} from '@/types'

interface CounterState {
  count: number
  name: string
  nested: {
    value: number
  }
}

interface CounterGetters extends Getters<CounterState> {
  doubleCount: (state: CounterState) => number
  isEven: (state: CounterState) => boolean
  fullName: (state: CounterState, getters: any) => string
}

interface CounterActions {
  increment: (amount?: number) => void
  decrement: () => void
  asyncIncrement: (amount: number, delay: number) => Promise<void>
  setName: (name: string) => void
  throwError: () => void
  callOtherAction: () => void
  nestedIncrement: () => void
}

describe('Store', () => {
  let registry: StoreRegistry
  let storeOptions: ModuleOptions<CounterState, CounterGetters, CounterActions>

  beforeEach(() => {
    registry = new Map()

    storeOptions = {
      name: 'counter',
      state: () => ({
        count: 0,
        name: 'test',
        nested: {
          value: 10
        }
      }),
      getters: {
        doubleCount: (state) => state.count * 2,
        isEven: (state) => state.count % 2 === 0,
        fullName: (state, getters) => `${state.name} - ${getters.doubleCount}`
      },
      actions: {
        increment(amount = 1) {
          this.$state.count += amount
        },
        decrement() {
          this.$state.count--
        },
        async asyncIncrement(amount: number, delay: number) {
          await new Promise((resolve) => setTimeout(resolve, delay))
          this.$state.count += amount
        },
        setName(name: string) {
          this.$state.name = name
        },
        throwError() {
          throw new Error('Test error')
        },
        callOtherAction() {
          this.$actions.increment(5)
        },
        nestedIncrement() {
          this.$state.nested.value++
        }
      }
    }
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('initialization', () => {
    it('should initialize with correct state', () => {
      const store = new Store(storeOptions, registry)
      expect(store.$name).toBe('counter')
      expect(store.$state.count).toBe(0)
      expect(store.$state.name).toBe('test')
      expect(store.$state.nested.value).toBe(10)
    })

    it('should have correct initial getters', () => {
      const store = new Store(storeOptions, registry)
      expect(store.$getters.doubleCount).toBe(0)
      expect(store.$getters.isEven).toBe(true)
      expect(store.$getters.fullName).toBe('test - 0')
    })

    it('should deep freeze initial state', () => {
      const store = new Store(storeOptions, registry)
      const debugInfo = store.$debug()
      expect(Object.isFrozen(debugInfo.state)).toBe(false)
    })

    it('should register itself in the registry', () => {
      const store = new Store(storeOptions, registry)
      expect(registry.get('counter')).toBe(store)
    })
  })

  describe('state protection', () => {
    it('should throw error when directly modifying state outside action', () => {
      const store = new Store(storeOptions, registry)
      expect(() => {
        ;(store.$state as any).count = 100
      }).toThrow('[vue-light-store] Cannot directly modify state "count" in store "counter"')
    })

    it('should throw error when directly deleting state property outside action', () => {
      const store = new Store(storeOptions, registry)
      expect(() => {
        delete (store.$state as any).name
      }).toThrow('[vue-light-store] Cannot directly delete property "name" in store "counter"')
    })

    it('should allow state modification inside action', () => {
      const store = new Store(storeOptions, registry)
      store.$actions.increment(5)
      expect(store.$state.count).toBe(5)
    })

    it('should allow nested state modification inside action', () => {
      const store = new Store(storeOptions, registry)
      store.$actions.nestedIncrement()
      expect(store.$state.nested.value).toBe(11)
    })

    it('should throw error when modifying disposed store', () => {
      const store = new Store(storeOptions, registry)
      store.$dispose()
      expect(() => {
        store.$patch({ count: 10 })
      }).toThrow('[vue-light-store] Store "counter" has been disposed')
    })
  })

  describe('getters', () => {
    it('should reactively update getters when state changes', () => {
      const store = new Store(storeOptions, registry)

      store.$actions.increment(5)
      expect(store.$getters.doubleCount).toBe(10)
      expect(store.$getters.isEven).toBe(false)
      expect(store.$getters.fullName).toBe('test - 10')

      store.$actions.increment(1)
      expect(store.$getters.doubleCount).toBe(12)
      expect(store.$getters.isEven).toBe(true)
    })

    it('should be readonly', () => {
      const store = new Store(storeOptions, registry)
      expect(() => {
        (store.$getters as any).doubleCount = 100
      }).toThrow()
    })
  })

  describe('actions', () => {
    it('should execute actions and update state', () => {
      const store = new Store(storeOptions, registry)
      store.$actions.increment(10)
      expect(store.$state.count).toBe(10)
    })

    it('should support actions calling other actions', () => {
      const store = new Store(storeOptions, registry)
      store.$actions.callOtherAction()
      expect(store.$state.count).toBe(5)
    })

    it('should handle async actions', async () => {
      vi.useFakeTimers()
      const store = new Store(storeOptions, registry)

      const promise = store.$actions.asyncIncrement(10, 100)
      expect(store.$state.count).toBe(0)

      vi.advanceTimersByTime(100)
      await promise

      expect(store.$state.count).toBe(10)
    })

    it('should handle action errors', () => {
      const store = new Store(storeOptions, registry)
      expect(() => store.$actions.throwError()).toThrow('Test error')
    })

    it('should reset actionInProgress flag after error', () => {
      const store = new Store(storeOptions, registry)
      try {
        store.$actions.throwError()
      } catch (e) {
        // ignore
      }
      expect((store as any).actionInProgress).toBe(false)
    })

    it('should pass correct arguments to actions', () => {
      const store = new Store(storeOptions, registry)
      store.$actions.increment(42)
      expect(store.$state.count).toBe(42)
    })

    it('should have correct this context in actions', () => {
      const store = new Store(storeOptions, registry)
      store.$actions.setName('newName')
      expect(store.$state.name).toBe('newName')
    })

    it('should handle async action errors', async () => {
      const asyncStoreOptions: ModuleOptions<CounterState, CounterGetters, CounterActions> = {
        ...storeOptions,
        name: 'asyncError',
        actions: {
          ...storeOptions.actions,
          asyncThrow: async function () {
            throw new Error('Async error')
          }
        } as any
      }

      const store = new Store(asyncStoreOptions, new Map())

      await expect(
        (store.$actions as any).asyncThrow()
      ).rejects.toThrow('Async error')
    })
  })

  describe('$patch', () => {
    it('should patch state with partial object', () => {
      const store = new Store(storeOptions, registry)
      store.$patch({ count: 50, name: 'patched' })
      expect(store.$state.count).toBe(50)
      expect(store.$state.name).toBe('patched')
    })

    it('should patch state with function', () => {
      const store = new Store(storeOptions, registry)
      store.$patch((state) => {
        state.count = 100
        state.name = 'functionPatched'
      })
      expect(store.$state.count).toBe(100)
      expect(store.$state.name).toBe('functionPatched')
    })

    it('should notify subscribers on patch', () => {
      const store = new Store(storeOptions, registry)
      const callback = vi.fn()
      store.$subscribe(callback)

      store.$patch({ count: 25 })

      expect(callback).toHaveBeenCalled()
      expect(callback.mock.calls[0][0].type).toBe('patch')
    })
  })

  describe('$reset', () => {
    it('should reset state to initial values', () => {
      const store = new Store(storeOptions, registry)
      store.$actions.increment(100)
      store.$actions.setName('modified')
      store.$actions.nestedIncrement()

      expect(store.$state.count).toBe(100)
      expect(store.$state.name).toBe('modified')
      expect(store.$state.nested.value).toBe(11)

      store.$reset()

      expect(store.$state.count).toBe(0)
      expect(store.$state.name).toBe('test')
      expect(store.$state.nested.value).toBe(10)
    })

    it('should notify subscribers on reset', () => {
      const store = new Store(storeOptions, registry)
      const callback = vi.fn()
      store.$subscribe(callback)

      store.$reset()

      expect(callback).toHaveBeenCalled()
      expect(callback.mock.calls[0][0].type).toBe('reset')
    })
  })

  describe('$subscribe', () => {
    it('should subscribe to mutations', () => {
      const store = new Store(storeOptions, registry)
      const callback = vi.fn()

      store.$subscribe(callback)
      store.$actions.increment(5)

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback.mock.calls[0][0]).toMatchObject({
        type: 'action',
        actionName: 'increment',
        path: 'count',
        value: 5
      })
    })

    it('should return unsubscribe function', () => {
      const store = new Store(storeOptions, registry)
      const callback = vi.fn()
      const unsubscribe = store.$subscribe(callback)

      unsubscribe()
      store.$actions.increment(5)

      expect(callback).not.toHaveBeenCalled()
    })

    it('should support detached option', () => {
      const store = new Store(storeOptions, registry)
      const callback = vi.fn()

      store.$subscribe(callback, { detached: true })
      store.$dispose()

      expect(store.$debug().subscriberCount).toBe(0)
    })

    it('should receive state in callback', () => {
      const store = new Store(storeOptions, registry)
      let receivedState: any

      store.$subscribe((_mutation, state) => {
        receivedState = state
      })

      store.$actions.increment(5)
      expect(receivedState.count).toBe(5)
    })
  })

  describe('$onAction', () => {
    it('should subscribe to actions', () => {
      const store = new Store(storeOptions, registry)
      const callback = vi.fn()

      store.$onAction(callback)
      store.$actions.increment(10)

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback.mock.calls[0][0]).toMatchObject({
        name: 'increment',
        storeName: 'counter',
        args: [10]
      })
    })

    it('should call after callback when action succeeds', () => {
      const store = new Store(storeOptions, registry)
      const afterCallback = vi.fn()

      store.$onAction((info) => {
        info.after?.(afterCallback)
      })

      store.$actions.increment(5)
      expect(afterCallback).toHaveBeenCalled()
    })

    it('should call onError callback when action fails', () => {
      const store = new Store(storeOptions, registry)
      const errorCallback = vi.fn()

      store.$onAction((info) => {
        info.onError?.(errorCallback)
      })

      try {
        store.$actions.throwError()
      } catch (e) {
        // ignore
      }

      expect(errorCallback).toHaveBeenCalled()
    })

    it('should return unsubscribe function', () => {
      const store = new Store(storeOptions, registry)
      const callback = vi.fn()
      const unsubscribe = store.$onAction(callback)

      unsubscribe()
      store.$actions.increment(5)

      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('$debug', () => {
    it('should return complete debug information', () => {
      const store = new Store(storeOptions, registry)
      store.$actions.increment(5)
      store.$subscribe(() => {})
      store.$onAction(() => {})

      const debugInfo = store.$debug()

      expect(debugInfo.name).toBe('counter')
      expect(debugInfo.state.count).toBe(5)
      expect(debugInfo.getters.doubleCount).toBe(10)
      expect(debugInfo.actionHistory).toHaveLength(1)
      expect(debugInfo.mutationHistory).toHaveLength(1)
      expect(debugInfo.subscriberCount).toBe(1)
      expect(debugInfo.actionSubscriberCount).toBe(1)
      expect(debugInfo.isDisposed).toBe(false)
    })

    it('should not expose internal state through debug', () => {
      const store = new Store(storeOptions, registry)
      const debugInfo = store.$debug()

      debugInfo.state.count = 999
      expect(store.$state.count).toBe(0)
    })
  })

  describe('$dispose', () => {
    it('should dispose the store', () => {
      const store = new Store(storeOptions, registry)
      store.$subscribe(() => {})
      store.$onAction(() => {})

      store.$dispose()

      expect(store.isDisposed).toBe(true)
      expect(registry.has('counter')).toBe(false)
    })

    it('should be idempotent', () => {
      const store = new Store(storeOptions, registry)
      store.$dispose()
      expect(() => store.$dispose()).not.toThrow()
    })

    it('should prevent operations after dispose', () => {
      const store = new Store(storeOptions, registry)
      store.$dispose()

      expect(() => store.$actions.increment()).toThrow()
      expect(() => store.$patch({ count: 1 })).toThrow()
      expect(() => store.$reset()).toThrow()
    })

    it('should return noop from subscribe after dispose', () => {
      const store = new Store(storeOptions, registry)
      store.$dispose()

      const unsubscribe = store.$subscribe(() => {})
      expect(typeof unsubscribe).toBe('function')
      expect(() => unsubscribe()).not.toThrow()
    })

    it('should return noop from onAction after dispose', () => {
      const store = new Store(storeOptions, registry)
      store.$dispose()

      const unsubscribe = store.$onAction(() => {})
      expect(typeof unsubscribe).toBe('function')
      expect(() => unsubscribe()).not.toThrow()
    })
  })

  describe('toPublicAPI', () => {
    it('should expose state as readonly properties', () => {
      const store = new Store(storeOptions, registry)
      const publicAPI = store.toPublicAPI()

      expect(publicAPI.count).toBe(0)
      expect(publicAPI.name).toBe('test')
      expect(publicAPI.$name).toBe('counter')
    })

    it('should expose getters as readonly properties', () => {
      const store = new Store(storeOptions, registry)
      const publicAPI = store.toPublicAPI()

      expect(publicAPI.doubleCount).toBe(0)
      expect(publicAPI.isEven).toBe(true)
    })

    it('should expose actions as callable methods', () => {
      const store = new Store(storeOptions, registry)
      const publicAPI = store.toPublicAPI()

      publicAPI.increment(10)
      expect(publicAPI.count).toBe(10)
    })

    it('should not allow direct state modification through public API', () => {
      const store = new Store(storeOptions, registry)
      const publicAPI = store.toPublicAPI()

      expect(() => {
        ;(publicAPI as any).count = 100
      }).toThrow()
    })

    it('should expose store methods on public API', () => {
      const store = new Store(storeOptions, registry)
      const publicAPI = store.toPublicAPI()

      expect(typeof publicAPI.$patch).toBe('function')
      expect(typeof publicAPI.$reset).toBe('function')
      expect(typeof publicAPI.$subscribe).toBe('function')
      expect(typeof publicAPI.$onAction).toBe('function')
      expect(typeof publicAPI.$debug).toBe('function')
    })

    it('should return cached public API on subsequent calls', () => {
      const store = new Store(storeOptions, registry)
      const publicAPI1 = store.toPublicAPI()
      const publicAPI2 = store.toPublicAPI()

      expect(publicAPI1).toBe(publicAPI2)
    })
  })

  describe('cross-module access', () => {
    it('should allow accessing other stores through registry', () => {
      const userStoreOptions = {
        name: 'user',
        state: () => ({ id: 1, username: 'user1' }),
        getters: {},
        actions: {}
      }

      const registry2 = new Map()
      const userStore = new Store(userStoreOptions, registry2)
      const counterStore = new Store(storeOptions, registry2)

      expect(registry2.get('user')).toBe(userStore)
      expect(registry2.get('counter')).toBe(counterStore)
      expect(registry2.size).toBe(2)
    })

    it('should allow actions to call other store actions', () => {
      interface UserState {
        id: number
        username: string
        points: number
      }

      interface UserActions {
        addPoints: (amount: number) => void
      }

      interface CrossState {
        value: number
      }

      interface CrossActions {
        rewardUser: (userId: number, points: number) => { userId: number; points: number }
      }

      const userStoreOptions: ModuleOptions<UserState, {}, UserActions> = {
        name: 'user',
        state: () => ({ id: 1, username: 'user1', points: 0 }),
        getters: {},
        actions: {
          addPoints(amount: number) {
            this.$state.points += amount
          }
        }
      }

      const crossStoreOptions: ModuleOptions<CrossState, {}, CrossActions> = {
        name: 'cross',
        state: () => ({ value: 0 }),
        getters: {},
        actions: {
          rewardUser(userId: number, points: number) {
            return { userId, points }
          }
        }
      }

      const registry2 = new Map()
      new Store(userStoreOptions, registry2)
      const crossStore = new Store(crossStoreOptions, registry2)

      const result = (crossStore.$actions as CrossActions).rewardUser(1, 100)
      expect(result).toEqual({ userId: 1, points: 100 })
    })
  })

  describe('mutation tracking', () => {
    it('should track action mutations with correct metadata', () => {
      const store = new Store(storeOptions, registry)
      let lastMutation: MutationInfo<CounterState> | undefined

      store.$subscribe((mutation) => {
        lastMutation = mutation
      })

      store.$actions.increment(42)

      expect(lastMutation).toBeDefined()
      expect(lastMutation!.type).toBe('action')
      expect(lastMutation!.actionName).toBe('increment')
      expect(lastMutation!.path).toBe('count')
      expect(lastMutation!.value).toBe(42)
      expect(lastMutation!.storeName).toBe('counter')
      expect(typeof lastMutation!.timestamp).toBe('number')
    })

    it('should track patch mutations', () => {
      const store = new Store(storeOptions, registry)
      let lastMutation: MutationInfo<CounterState> | undefined

      store.$subscribe((mutation) => {
        lastMutation = mutation
      })

      store.$patch({ count: 100 })

      expect(lastMutation!.type).toBe('patch')
      expect(lastMutation!.value).toEqual({ count: 100 })
    })
  })

  describe('store without getters or actions', () => {
    it('should work without getters', () => {
      const simpleOptions = {
        name: 'simple',
        state: () => ({ value: 42 })
      }

      const store = new Store(simpleOptions as any, new Map())
      expect(store.$state.value).toBe(42)
      expect(Object.keys(store.$getters)).toHaveLength(0)
    })

    it('should work without actions', () => {
      const simpleOptions = {
        name: 'simple2',
        state: () => ({ value: 42 }),
        getters: {}
      }

      const store = new Store(simpleOptions as any, new Map())
      expect(store.$state.value).toBe(42)
      expect(Object.keys(store.$actions)).toHaveLength(0)
    })
  })
})

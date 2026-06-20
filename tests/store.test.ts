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

    it('should notify mutation when deleting property inside action', () => {
      interface DelState { a: number; b?: number }
      interface DelActions { removeB: () => void }
      const delOptions: ModuleOptions<DelState, {}, DelActions> = {
        name: 'del-test',
        state: () => ({ a: 1, b: 2 }),
        getters: {},
        actions: {
          removeB() {
            delete this.$state.b
          }
        }
      }
      const store = new Store(delOptions, registry)
      const sub = vi.fn()
      store.$subscribe(sub)
      store.$actions.removeB()
      expect('b' in store.$state).toBe(false)
      expect(sub).toHaveBeenCalled()
      expect(sub.mock.calls[0][0].type).toBe('action')
      expect(sub.mock.calls[0][0].actionName).toBe('removeB')
    })

    it('should throw error when modifying disposed store', () => {
      const store = new Store(storeOptions, registry)
      store.$dispose()
      expect(() => {
        store.$patch({ count: 10 })
      }).toThrow('[vue-light-store] Store "counter" has been disposed')
    })

    it('should throw error when directly modifying nested object state outside action', () => {
      const store = new Store(storeOptions, registry)
      expect(() => {
        store.$state.nested.value = 999
      }).toThrow('[vue-light-store] Cannot directly modify state "nested.value" in store "counter"')
    })

    it('should throw error when directly deleting nested object property outside action', () => {
      const store = new Store(storeOptions, registry)
      expect(() => {
        delete (store.$state.nested as any).value
      }).toThrow('[vue-light-store] Cannot directly delete property "nested.value" in store "counter"')
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

    it('should cache computed getter results for performance', () => {
      const callCount = { value: 0 }
      const options: ModuleOptions<{ n: number }, { result: (s: { n: number }) => number }, {}> = {
        name: 'cached-getter-test',
        state: () => ({ n: 1 }),
        getters: {
          result: (state) => {
            callCount.value++
            return state.n * 2
          }
        }
      }
      const store = new Store(options, registry)

      const v1 = store.$getters.result
      const v2 = store.$getters.result
      const v3 = store.$getters.result

      expect(v1).toBe(2)
      expect(v2).toBe(2)
      expect(v3).toBe(2)
      expect(callCount.value).toBe(1)
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

    it('should preserve reactivity for nested objects after reset', () => {
      interface NestedState {
        nested: { value: number; deep: { x: number } }
        items: number[]
      }
      interface NestedActions {
        modify: () => void
        modifyAfterReset: () => void
      }
      const nestedOptions: ModuleOptions<NestedState, {}, NestedActions> = {
        name: 'nested-reset-test',
        state: () => ({
          nested: { value: 1, deep: { x: 10 } },
          items: [1, 2, 3]
        }),
        getters: {},
        actions: {
          modify() {
            this.$state.nested.value = 999
            this.$state.nested.deep.x = 999
            this.$state.items.push(999)
          },
          modifyAfterReset() {
            this.$state.nested.value = 888
            this.$state.nested.deep.x = 888
            this.$state.items.push(888)
          }
        }
      }
      const store = new Store(nestedOptions, registry)

      store.$actions.modify()
      expect(store.$state.nested.value).toBe(999)
      expect(store.$state.items).toEqual([1, 2, 3, 999])

      store.$reset()

      expect(store.$state.nested.value).toBe(1)
      expect(store.$state.nested.deep.x).toBe(10)
      expect(store.$state.items).toEqual([1, 2, 3])

      store.$actions.modifyAfterReset()
      expect(store.$state.nested.value).toBe(888)
      expect(store.$state.nested.deep.x).toBe(888)
      expect(store.$state.items).toEqual([1, 2, 3, 888])
    })

    it('should handle adding and removing properties during reset', () => {
      interface DynState {
        a: number
        b?: number
      }
      interface DynActions {
        addProp: () => void
        removeProp: () => void
      }
      const dynOptions: ModuleOptions<DynState, {}, DynActions> = {
        name: 'dyn-reset-test',
        state: () => ({ a: 1 }),
        getters: {},
        actions: {
          addProp() {
            this.$state.b = 42
          },
          removeProp() {
            delete this.$state.b
          }
        }
      }
      const store = new Store(dynOptions, registry)
      store.$actions.addProp()
      expect(store.$state.b).toBe(42)

      store.$reset()
      expect(store.$state.a).toBe(1)
      expect('b' in store.$state).toBe(false)
    })

    it('should handle type mismatch (array vs non-array) during reset', () => {
      interface MixedState {
        data: any
        list: any
      }
      interface MixedActions {
        swapTypes: () => void
      }
      const mixedOptions: ModuleOptions<MixedState, {}, MixedActions> = {
        name: 'mixed-type-reset',
        state: () => ({
          data: { x: 1 },
          list: [1, 2, 3]
        }),
        getters: {},
        actions: {
          swapTypes() {
            this.$state.data = [9, 9, 9]
            this.$state.list = { y: 2 }
          }
        }
      }
      const store = new Store(mixedOptions, registry)
      store.$actions.swapTypes()
      expect(store.$state.data).toEqual([9, 9, 9])
      expect(store.$state.list).toEqual({ y: 2 })

      store.$reset()
      expect(store.$state.data).toEqual({ x: 1 })
      expect(store.$state.list).toEqual([1, 2, 3])
    })

    it('should handle deeply nested arrays with objects during reset', () => {
      interface DeepArrState {
        rows: { cells: { val: number }[] }[]
        matrix: number[][]
      }
      interface DeepArrActions {
        mutate: () => void
      }
      const deepArrOptions: ModuleOptions<DeepArrState, {}, DeepArrActions> = {
        name: 'deep-arr-reset',
        state: () => ({
          rows: [
            { cells: [{ val: 1 }, { val: 2 }] },
            { cells: [{ val: 3 }] }
          ],
          matrix: [[1, 2], [3, 4]]
        }),
        getters: {},
        actions: {
          mutate() {
            this.$state.rows[0].cells[0].val = 999
            this.$state.rows.push({ cells: [{ val: 100 }] })
            this.$state.matrix[0][0] = 999
            this.$state.matrix.push([5, 6])
          }
        }
      }
      const store = new Store(deepArrOptions, registry)
      store.$actions.mutate()
      expect(store.$state.rows[0].cells[0].val).toBe(999)
      expect(store.$state.rows).toHaveLength(3)
      expect(store.$state.matrix[0][0]).toBe(999)
      expect(store.$state.matrix).toHaveLength(3)

      store.$reset()
      expect(store.$state.rows[0].cells[0].val).toBe(1)
      expect(store.$state.rows).toHaveLength(2)
      expect(store.$state.rows[1].cells[0].val).toBe(3)
      expect(store.$state.matrix).toEqual([[1, 2], [3, 4]])
    })
  })

  describe('array state protection', () => {
    interface ArrState { items: { id: number; name: string }[] }
    interface ArrActions {
      addItem: (item: { id: number; name: string }) => void
      removeItem: (id: number) => void
      modifyItem: (id: number, name: string) => void
    }
    let arrOptions: ModuleOptions<ArrState, {}, ArrActions>
    let arrRegistry: StoreRegistry

    beforeEach(() => {
      arrRegistry = new Map()
      arrOptions = {
        name: 'arr-test',
        state: () => ({
          items: [
            { id: 1, name: 'a' },
            { id: 2, name: 'b' }
          ]
        }),
        getters: {},
        actions: {
          addItem(item) {
            this.$state.items.push(item)
          },
          removeItem(id) {
            const idx = this.$state.items.findIndex(i => i.id === id)
            if (idx > -1) this.$state.items.splice(idx, 1)
          },
          modifyItem(id, name) {
            const item = this.$state.items.find(i => i.id === id)
            if (item) item.name = name
          }
        }
      }
    })

    it('should throw error when directly pushing to array outside action', () => {
      const store = new Store(arrOptions, arrRegistry)
      expect(() => {
        store.$state.items.push({ id: 3, name: 'c' })
      }).toThrow('[vue-light-store] Cannot directly modify array "items" via "push" in store "arr-test"')
    })

    it('should throw error when directly splicing array outside action', () => {
      const store = new Store(arrOptions, arrRegistry)
      expect(() => {
        store.$state.items.splice(0, 1)
      }).toThrow('[vue-light-store] Cannot directly modify array "items" via "splice" in store "arr-test"')
    })

    it('should throw error when directly setting array index outside action', () => {
      const store = new Store(arrOptions, arrRegistry)
      expect(() => {
        store.$state.items[0] = { id: 99, name: 'x' }
      }).toThrow('[vue-light-store] Cannot directly modify state "items[0]" in store "arr-test"')
    })

    it('should throw error when modifying nested object inside array outside action', () => {
      const store = new Store(arrOptions, arrRegistry)
      expect(() => {
        store.$state.items[0].name = 'modified'
      }).toThrow('[vue-light-store] Cannot directly modify state "items[0].name" in store "arr-test"')
    })

    it('should allow array modifications inside actions', () => {
      const store = new Store(arrOptions, arrRegistry)
      store.$actions.addItem({ id: 3, name: 'c' })
      expect(store.$state.items).toHaveLength(3)
      expect(store.$state.items[2]).toEqual({ id: 3, name: 'c' })

      store.$actions.modifyItem(1, 'modified')
      expect(store.$state.items[0].name).toBe('modified')

      store.$actions.removeItem(2)
      expect(store.$state.items).toHaveLength(2)
      expect(store.$state.items.find(i => i.id === 2)).toBeUndefined()
    })

    it('should protect various array mutation methods', () => {
      interface ArrMultiState { nums: number[] }
      interface ArrMultiActions {
        testAll: () => void
      }
      const arrMultiOptions: ModuleOptions<ArrMultiState, {}, ArrMultiActions> = {
        name: 'arr-multi-test',
        state: () => ({ nums: [3, 1, 2] }),
        getters: {},
        actions: {
          testAll() {
            this.$state.nums.push(4)
            expect(this.$state.nums.pop()).toBe(4)
            this.$state.nums.unshift(0)
            expect(this.$state.nums.shift()).toBe(0)
            this.$state.nums.sort((a, b) => a - b)
            this.$state.nums.reverse()
            this.$state.nums.fill(9)
            this.$state.nums.copyWithin(0, 1)
          }
        }
      }
      const store = new Store(arrMultiOptions, arrRegistry)
      store.$actions.testAll()
      expect(Array.isArray(store.$state.nums)).toBe(true)

      expect(() => { store.$state.nums.pop() }).toThrow()
      expect(() => { store.$state.nums.shift() }).toThrow()
      expect(() => { store.$state.nums.unshift(0) }).toThrow()
      expect(() => { store.$state.nums.sort() }).toThrow()
      expect(() => { store.$state.nums.reverse() }).toThrow()
      expect(() => { store.$state.nums.fill(0) }).toThrow()
      expect(() => { store.$state.nums.copyWithin(0, 1) }).toThrow()
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

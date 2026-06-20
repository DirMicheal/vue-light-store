import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  defineStore,
  getStore,
  hasStore,
  listStores,
  debugStores,
  disposeAllStores,
  createGlobalStore
} from '@/globalStore'
import type { Getters, PublicStore } from '@/types'

interface UserState {
  id: number
  username: string
  email: string
}

interface UserGetters extends Getters<UserState> {
  displayName: (state: UserState) => string
}

interface UserActions {
  setEmail: (email: string) => void
  setUsername: (username: string) => void
}

interface CartState {
  items: Array<{ id: number; name: string; price: number }>
  total: number
}

interface CartGetters extends Getters<CartState> {
  itemCount: (state: CartState) => number
  hasItems: (state: CartState) => boolean
}

interface CartActions {
  addItem: (item: { id: number; name: string; price: number }) => void
  removeItem: (id: number) => void
  clearCart: () => void
  checkout: () => Promise<{ success: boolean; userId: number }>
}

describe('globalStore', () => {
  beforeEach(() => {
    disposeAllStores()
  })

  afterEach(() => {
    disposeAllStores()
  })

  describe('defineStore', () => {
    it('should define a store and return a use function', () => {
      const useUserStore = defineStore<UserState, UserGetters, UserActions>({
        name: 'user',
        state: () => ({
          id: 1,
          username: 'testuser',
          email: 'test@example.com'
        }),
        getters: {
          displayName: (state) => `${state.username} (${state.id})`
        },
        actions: {
          setEmail(email: string) {
            this.$state.email = email
          },
          setUsername(username: string) {
            this.$state.username = username
          }
        }
      })

      expect(typeof useUserStore).toBe('function')
      expect(hasStore('user')).toBe(true)
    })

    it('should throw error when registering duplicate store name', () => {
      defineStore({
        name: 'duplicate',
        state: () => ({ value: 1 })
      })

      expect(() => {
        defineStore({
          name: 'duplicate',
          state: () => ({ value: 2 })
        })
      }).toThrow('[vue-light-store] Store "duplicate" is already registered')
    })

    it('should create singleton store instance on first use', () => {
      const useCounter = defineStore({
        name: 'counter',
        state: () => ({ count: 0 }),
        actions: {
          increment() {
            this.$state.count++
          }
        }
      })

      const store1 = useCounter()
      const store2 = useCounter()

      expect(store1).toBe(store2)
      store1.increment()
      expect(store2.count).toBe(1)
    })

    it('should recreate store if disposed', () => {
      const useCounter = defineStore({
        name: 'counter2',
        state: () => ({ count: 0 }),
        actions: {
          increment() {
            this.$state.count++
          }
        }
      })

      const store1 = useCounter()
      store1.increment()
      expect(store1.count).toBe(1)

      disposeAllStores()

      const store2 = useCounter()
      expect(store2.count).toBe(0)
      expect(store1).not.toBe(store2)
    })
  })

  describe('getStore', () => {
    it('should get store by name', () => {
      defineStore({
        name: 'testGet',
        state: () => ({ value: 42 })
      })

      const store = getStore<PublicStore<{ value: number }, {}, {}>>('testGet')
      expect(store).toBeDefined()
      expect(store!.value).toBe(42)
      expect(store!.$name).toBe('testGet')
    })

    it('should return undefined for non-existent store', () => {
      const store = getStore('nonExistent')
      expect(store).toBeUndefined()
    })
  })

  describe('hasStore', () => {
    it('should return true for registered store', () => {
      defineStore({
        name: 'testHas',
        state: () => ({})
      })

      expect(hasStore('testHas')).toBe(true)
    })

    it('should return false for unregistered store', () => {
      expect(hasStore('unregistered')).toBe(false)
    })
  })

  describe('listStores', () => {
    it('should list all registered store names', () => {
      defineStore({ name: 'store1', state: () => ({}) })
      defineStore({ name: 'store2', state: () => ({}) })
      defineStore({ name: 'store3', state: () => ({}) })

      const stores = listStores()
      expect(stores).toHaveLength(3)
      expect(stores).toContain('store1')
      expect(stores).toContain('store2')
      expect(stores).toContain('store3')
    })

    it('should return empty array when no stores registered', () => {
      expect(listStores()).toEqual([])
    })
  })

  describe('debugStores', () => {
    it('should return global debug information', () => {
      const useUser = defineStore<UserState, UserGetters, UserActions>({
        name: 'debugUser',
        state: () => ({
          id: 1,
          username: 'debuguser',
          email: 'debug@test.com'
        }),
        getters: {
          displayName: (state) => state.username
        },
        actions: {
          setEmail(email) {
            this.$state.email = email
          },
          setUsername(username) {
            this.$state.username = username
          }
        }
      })

      const useCart = defineStore<CartState, CartGetters, CartActions>({
        name: 'debugCart',
        state: () => ({
          items: [],
          total: 0
        }),
        getters: {
          itemCount: (state) => state.items.length,
          hasItems: (state) => state.items.length > 0
        },
        actions: {
          addItem(item) {
            this.$state.items.push(item)
            this.$state.total += item.price
          },
          removeItem(id) {
            const index = this.$state.items.findIndex((i) => i.id === id)
            if (index > -1) {
              this.$state.total -= this.$state.items[index].price
              this.$state.items.splice(index, 1)
            }
          },
          clearCart() {
            this.$state.items = []
            this.$state.total = 0
          },
          async checkout() {
            return { success: true, userId: 1 }
          }
        }
      })

      const userStore = useUser()
      const cartStore = useCart()

      userStore.setEmail('new@test.com')
      cartStore.addItem({ id: 1, name: 'Test', price: 100 })

      userStore.$subscribe(() => {})
      cartStore.$onAction(() => {})

      const debugInfo = debugStores()

      expect(debugInfo.totalStores).toBe(2)
      expect(debugInfo.totalSubscribers).toBe(1)
      expect(debugInfo.totalActionSubscribers).toBe(1)
      expect(debugInfo.stores['debugUser']).toBeDefined()
      expect(debugInfo.stores['debugCart']).toBeDefined()
      expect(debugInfo.stores['debugUser'].state.email).toBe('new@test.com')
      expect(debugInfo.stores['debugCart'].state.total).toBe(100)
    })

    it('should return empty debug info when no stores', () => {
      const debugInfo = debugStores()
      expect(debugInfo.totalStores).toBe(0)
      expect(debugInfo.totalSubscribers).toBe(0)
      expect(debugInfo.totalActionSubscribers).toBe(0)
      expect(debugInfo.stores).toEqual({})
    })
  })

  describe('disposeAllStores', () => {
    it('should dispose all stores', () => {
      const useStore1 = defineStore({ name: 'dispose1', state: () => ({ v: 1 }) })
      const useStore2 = defineStore({ name: 'dispose2', state: () => ({ v: 2 }) })

      const store1 = useStore1()
      const store2 = useStore2()

      disposeAllStores()

      expect(store1.$debug().isDisposed).toBe(true)
      expect(store2.$debug().isDisposed).toBe(true)
      expect(listStores()).toEqual([])
    })

    it('should be safe to call when no stores exist', () => {
      expect(() => disposeAllStores()).not.toThrow()
    })
  })

  describe('cross-module calls', () => {
    it('should allow one store to access another store', () => {
      const useUserStore = defineStore<UserState, UserGetters, UserActions>({
        name: 'crossUser',
        state: () => ({
          id: 123,
          username: 'crossuser',
          email: 'cross@test.com'
        }),
        getters: {
          displayName: (state) => state.username
        },
        actions: {
          setEmail(email) {
            this.$state.email = email
          },
          setUsername(username) {
            this.$state.username = username
          }
        }
      })

      const useCartStore = defineStore<CartState, CartGetters, CartActions>({
        name: 'crossCart',
        state: () => ({
          items: [],
          total: 0
        }),
        getters: {
          itemCount: (state) => state.items.length,
          hasItems: (state) => state.items.length > 0
        },
        actions: {
          addItem(item) {
            this.$state.items.push(item)
            this.$state.total += item.price
          },
          removeItem(id) {
            const index = this.$state.items.findIndex((i) => i.id === id)
            if (index > -1) {
              this.$state.total -= this.$state.items[index].price
              this.$state.items.splice(index, 1)
            }
          },
          clearCart() {
            this.$state.items = []
            this.$state.total = 0
          },
          async checkout() {
            const userStore = getStore<PublicStore<UserState, UserGetters, UserActions>>('crossUser')
            return {
              success: true,
              userId: userStore!.id
            }
          }
        }
      })

      const userStore = useUserStore()
      const cartStore = useCartStore()

      cartStore.addItem({ id: 1, name: 'Product', price: 99.99 })

      return cartStore.checkout().then((result) => {
        expect(result.success).toBe(true)
        expect(result.userId).toBe(123)
        expect(userStore.id).toBe(123)
      })
    })

    it('should allow actions to call other store actions', () => {
      const useAuthStore = defineStore({
        name: 'auth',
        state: () => ({
          userId: null as number | null,
          isLoggedIn: false
        }),
        actions: {
          login(userId: number) {
            this.$state.userId = userId
            this.$state.isLoggedIn = true
          },
          logout() {
            this.$state.userId = null
            this.$state.isLoggedIn = false
          }
        }
      })

      const useLoggerStore = defineStore({
        name: 'logger',
        state: () => ({
          logs: [] as Array<{ type: string; message: string; timestamp: number }>
        }),
        actions: {
          log(type: string, message: string) {
            this.$state.logs.push({
              type,
              message,
              timestamp: Date.now()
            })
          }
        }
      })

      const useOrderStore = defineStore({
        name: 'orders',
        state: () => ({
          orders: [] as Array<{ id: number; status: string }>
        }),
        actions: {
          createOrder() {
            const authStore = getStore<
              PublicStore<
                { userId: number | null; isLoggedIn: boolean },
                {},
                { login: (id: number) => void; logout: () => void }
              >
            >('auth')

            const loggerStore = getStore<
              PublicStore<
                { logs: any[] },
                {},
                { log: (type: string, message: string) => void }
              >
            >('logger')

            if (!authStore?.isLoggedIn) {
              loggerStore!.log('error', 'Cannot create order: user not logged in')
              throw new Error('User not logged in')
            }

            const orderId = Date.now()
            this.$state.orders.push({ id: orderId, status: 'created' })
            loggerStore!.log('info', `Order ${orderId} created by user ${authStore.userId}`)

            return orderId
          }
        }
      })

      const authStore = useAuthStore()
      const loggerStore = useLoggerStore()
      const orderStore = useOrderStore()

      expect(() => orderStore.createOrder()).toThrow('User not logged in')
      expect(loggerStore.logs).toHaveLength(1)
      expect(loggerStore.logs[0].type).toBe('error')

      authStore.login(42)

      const orderId = orderStore.createOrder()
      expect(typeof orderId).toBe('number')
      expect(orderStore.orders).toHaveLength(1)
      expect(loggerStore.logs).toHaveLength(2)
      expect(loggerStore.logs[1].type).toBe('info')
      expect(loggerStore.logs[1].message).toContain('42')
    })
  })

  describe('createGlobalStore', () => {
    it('should create isolated global store instance', () => {
      const globalStore1 = createGlobalStore()
      const globalStore2 = createGlobalStore()

      const useStore1 = globalStore1.register({
        name: 'isolated',
        state: () => ({ value: 1 })
      })

      expect(globalStore2.has('isolated')).toBe(false)
      expect(globalStore1.has('isolated')).toBe(true)

      const store1 = useStore1()
      expect(store1.$name).toBe('isolated')
    })

    it('should have independent state between instances', () => {
      const globalStore1 = createGlobalStore()
      const globalStore2 = createGlobalStore()

      const useStore1 = globalStore1.register({
        name: 'counter',
        state: () => ({ count: 0 }),
        actions: {
          increment() {
            this.$state.count++
          }
        }
      })

      const useStore2 = globalStore2.register({
        name: 'counter',
        state: () => ({ count: 100 }),
        actions: {
          increment() {
            this.$state.count++
          }
        }
      })

      const store1 = useStore1()
      const store2 = useStore2()

      store1.increment()
      store1.increment()

      store2.increment()

      expect(store1.count).toBe(2)
      expect(store2.count).toBe(101)
    })

    it('should dispose stores in specific instance only', () => {
      const globalStore1 = createGlobalStore()
      const globalStore2 = createGlobalStore()

      const useStore1 = globalStore1.register({
        name: 'test',
        state: () => ({ v: 1 })
      })

      const useStore2 = globalStore2.register({
        name: 'test',
        state: () => ({ v: 2 })
      })

      const store1 = useStore1()
      const store2 = useStore2()

      globalStore1.dispose()

      expect(store1.$debug().isDisposed).toBe(true)
      expect(store2.$debug().isDisposed).toBe(false)
    })
  })

  describe('TypeScript type inference', () => {
    it('should infer correct types for state', () => {
      const useTypedStore = defineStore({
        name: 'typed',
        state: () => ({
          count: 0,
          name: 'test',
          active: true,
          items: [1, 2, 3]
        }),
        getters: {
          doubled: (state) => state.count * 2,
          nameLength: (state) => state.name.length,
          firstItem: (state) => state.items[0]
        },
        actions: {
          setCount(n: number) {
            this.$state.count = n
          },
          addItem(n: number) {
            this.$state.items.push(n)
          }
        }
      })

      const store = useTypedStore()

      expect(store.count).toBe(0)
      expect(store.name).toBe('test')
      expect(store.active).toBe(true)
      expect(store.doubled).toBe(0)
      expect(store.nameLength).toBe(4)
      expect(store.firstItem).toBe(1)

      store.setCount(42)
      expect(store.count).toBe(42)
      expect(store.doubled).toBe(84)
    })
  })

  describe('protection across modules', () => {
    it('should prevent one module from directly modifying another module state', () => {
      defineStore({
        name: 'protectedA',
        state: () => ({ value: 0 }),
        actions: {
          setValue(v: number) {
            this.$state.value = v
          }
        }
      })

      const useStoreB = defineStore({
        name: 'protectedB',
        state: () => ({ otherValue: 0 }),
        actions: {
          tryToModifyA() {
            const storeA = getStore<any>('protectedA')
            expect(() => {
              storeA!.value = 100
            }).toThrow()
          },
          properlyModifyA() {
            const storeA = getStore<any>('protectedA')
            storeA!.setValue(100)
            return storeA!.value
          }
        }
      })

      const storeB = useStoreB()
      storeB.tryToModifyA()

      const result = storeB.properlyModifyA()
      expect(result).toBe(100)
    })
  })
})

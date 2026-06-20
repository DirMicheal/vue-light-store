import type {
  State,
  Getters,
  ModuleOptions,
  PublicStore,
  StoreRegistry,
  GlobalStore,
  GlobalDebugInfo,
  UseStore,
  AnyRecordActions
} from './types'
import { Store } from './store'

class GlobalStoreImpl implements GlobalStore {
  private registry: StoreRegistry = new Map()
  private storeFactories: Map<string, () => PublicStore<any, any, any>> = new Map()
  private publicAPICache: Map<string, PublicStore<any, any, any>> = new Map()

  register<
    S extends State,
    G extends Getters<S>,
    A extends AnyRecordActions
  >(options: ModuleOptions<S, G, A>): UseStore<S, G, A> {
    if (this.storeFactories.has(options.name)) {
      throw new Error(`[vue-light-store] Store "${options.name}" is already registered`)
    }

    const useStore = () => {
      let store = this.registry.get(options.name) as Store<S, G, A> | undefined

      if (!store || store.isDisposed) {
        store = new Store<S, G, A>(options, this.registry)
        this.registry.set(options.name, store)
        this.publicAPICache.set(options.name, store.toPublicAPI())
      }

      return this.publicAPICache.get(options.name) as PublicStore<S, G, A>
    }

    this.storeFactories.set(options.name, useStore)

    return useStore
  }

  get<T extends PublicStore<any, any, any>>(name: string): T | undefined {
    const factory = this.storeFactories.get(name)
    if (factory) {
      return factory() as T
    }
    return undefined
  }

  has(name: string): boolean {
    return this.storeFactories.has(name)
  }

  list(): string[] {
    return Array.from(this.storeFactories.keys())
  }

  $debug(): GlobalDebugInfo {
    const stores: GlobalDebugInfo['stores'] = {}
    let totalSubscribers = 0
    let totalActionSubscribers = 0

    this.registry.forEach((store, name) => {
      const debugInfo = store.$debug()
      stores[name] = debugInfo
      totalSubscribers += debugInfo.subscriberCount
      totalActionSubscribers += debugInfo.actionSubscriberCount
    })

    return {
      stores,
      totalStores: this.registry.size,
      totalSubscribers,
      totalActionSubscribers
    }
  }

  dispose(): void {
    this.registry.forEach((store) => {
      store.$dispose()
    })
    this.registry.clear()
    this.storeFactories.clear()
    this.publicAPICache.clear()
  }
}

const globalStore = new GlobalStoreImpl()

export function createGlobalStore(): GlobalStore {
  return new GlobalStoreImpl()
}

export function defineStore<
  S extends State,
  G extends Getters<S>,
  A extends AnyRecordActions
>(options: ModuleOptions<S, G, A>): UseStore<S, G, A> {
  return globalStore.register(options)
}

export function getStore<T extends PublicStore<any, any, any>>(name: string): T | undefined {
  return globalStore.get<T>(name)
}

export function hasStore(name: string): boolean {
  return globalStore.has(name)
}

export function listStores(): string[] {
  return globalStore.list()
}

export function debugStores(): GlobalDebugInfo {
  return globalStore.$debug()
}

export function disposeAllStores(): void {
  globalStore.dispose()
}

export default globalStore

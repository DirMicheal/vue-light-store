import { reactive, computed, type ComputedRef } from 'vue'
import type {
  State,
  Getters,
  ActionContext,
  ModuleOptions,
  ComputedGetters,
  StoreInstance,
  PublicStore,
  MutationInfo,
  StoreRegistry,
  AnyAction
} from './types'
import { ObservableStore } from './observable'

export class Store<
  S extends State,
  G extends Getters<S>,
  A extends object
> implements StoreInstance<S, G, A>
{
  readonly $name: string
  readonly $state: S
  readonly $getters: Readonly<ComputedGetters<G>>
  readonly $actions: Readonly<A>

  private _state: S
  private _initialState: S
  private _getters: G
  private _computedGettersCache: Map<keyof G, ComputedRef<any>> = new Map()
  private _actions: A
  private _observable: ObservableStore<S, G, A>
  private _registry: StoreRegistry
  private _actionInProgress = false
  private _currentActionName: string | null = null
  private _disposed = false
  private _stopWatchers: Array<() => void> = []

  private _publicAPI: PublicStore<S, G, A> | null = null

  private _rawState: S
  private _proxyCache: WeakMap<object, any> = new WeakMap()

  constructor(
    options: ModuleOptions<S, G, A>,
    registry: StoreRegistry
  ) {
    this.$name = options.name
    this._registry = registry
    this._observable = new ObservableStore<S, G, A>(options.name)

    this._initialState = this._structuredClone(options.state())
    this._rawState = reactive(options.state()) as S
    this._state = this._setupStateProtection(this._rawState)
    this.$state = this._state

    this._getters = (options.getters ?? {}) as G
    this.$getters = this._createComputedGetters() as Readonly<ComputedGetters<G>>

    this._actions = (options.actions ?? {}) as A
    this.$actions = this._createBoundActions() as Readonly<A>

    this._registry.set(this.$name, this)
  }

  private _structuredClone<T>(obj: T): T {
    if (typeof structuredClone === 'function') {
      return structuredClone(obj)
    }
    return JSON.parse(JSON.stringify(obj))
  }

  private _createComputedGetters(): ComputedGetters<G> {
    const computedGetters = {} as ComputedGetters<G>
    const getterKeys = Object.keys(this._getters) as Array<keyof G>

    getterKeys.forEach((key) => {
      const getterFn = this._getters[key]
      const computedRef = computed(() => getterFn(this._state, this.$getters))
      this._computedGettersCache.set(key, computedRef)
      Object.defineProperty(computedGetters, key, {
        get: () => computedRef.value,
        enumerable: true,
        configurable: false
      })
    })

    return computedGetters
  }

  private _createBoundActions(): A {
    const boundActions = {} as A
    const actionKeys = Object.keys(this._actions) as Array<keyof A>

    actionKeys.forEach((key) => {
      boundActions[key] = ((...args: any[]) => {
        return this._executeAction(key as string, args)
      }) as A[keyof A]
    })

    return boundActions
  }

  private _executeAction(actionName: string, args: any[]): any {
    if (this._disposed) {
      throw new Error(`[vue-light-store] Store "${this.$name}" has been disposed`)
    }

    const { resolve, reject } = this._observable.notifyAction({
      name: actionName,
      args
    })

    this._actionInProgress = true
    this._currentActionName = actionName

    try {
      const result = (this._actions[actionName as keyof A] as AnyAction).apply(
        this._createActionContext(),
        args
      )

      if (result instanceof Promise) {
        return result
          .then((resolvedResult) => {
            resolve(resolvedResult)
            this._actionInProgress = false
            this._currentActionName = null
            return resolvedResult
          })
          .catch((error) => {
            reject(error)
            this._actionInProgress = false
            this._currentActionName = null
            throw error
          })
      }

      resolve(result)
      this._actionInProgress = false
      this._currentActionName = null
      return result
    } catch (error) {
      reject(error as Error)
      this._actionInProgress = false
      this._currentActionName = null
      throw error
    }
  }

  private _createActionContext(): ActionContext<S, G, A> {
    return {
      $name: this.$name,
      $state: this._state,
      $getters: this.$getters,
      $actions: this.$actions,
      $patch: this.$patch.bind(this),
      $reset: this.$reset.bind(this),
      $subscribe: this.$subscribe.bind(this),
      $onAction: this.$onAction.bind(this),
      $debug: this.$debug.bind(this)
    }
  }

  private _setupStateProtection<T extends object>(target: T, parentPath: string = ''): T {
    const self = this

    if (self._proxyCache.has(target)) {
      return self._proxyCache.get(target)
    }

    const handler: ProxyHandler<T> = {
      get(target: T, prop: string | symbol) {
        const value = Reflect.get(target, prop)
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const currentPath = parentPath ? `${parentPath}.${String(prop)}` : String(prop)
          return self._setupStateProtection(value as object, currentPath)
        }
        if (Array.isArray(value)) {
          const currentPath = parentPath ? `${parentPath}.${String(prop)}` : String(prop)
          return self._setupArrayProtection(value, currentPath)
        }
        return value
      },
      set(target: T, prop: string | symbol, value: any) {
        if (self._disposed) {
          throw new Error(`[vue-light-store] Store "${self.$name}" has been disposed`)
        }

        if (!self._actionInProgress) {
          const fullPath = parentPath ? `${parentPath}.${String(prop)}` : String(prop)
          throw new Error(
            `[vue-light-store] Cannot directly modify state "${fullPath}" in store "${self.$name}". ` +
            `Use $patch or define an action instead.`
          )
        }

        const result = Reflect.set(target, prop, value)

        if (self._currentActionName && !['$patch', '$reset'].includes(self._currentActionName)) {
          const fullPath = parentPath ? `${parentPath}.${String(prop)}` : String(prop)
          self._observable.notifyMutation({
            type: 'action',
            actionName: self._currentActionName,
            path: fullPath,
            value
          }, self._state)
        }

        return result
      },
      deleteProperty(target: T, prop: string | symbol) {
        if (self._disposed) {
          throw new Error(`[vue-light-store] Store "${self.$name}" has been disposed`)
        }

        if (!self._actionInProgress) {
          const fullPath = parentPath ? `${parentPath}.${String(prop)}` : String(prop)
          throw new Error(
            `[vue-light-store] Cannot directly delete property "${fullPath}" in store "${self.$name}". ` +
            `Use $patch or define an action instead.`
          )
        }

        const result = Reflect.deleteProperty(target, prop)

        if (self._currentActionName && !['$patch', '$reset'].includes(self._currentActionName)) {
          const fullPath = parentPath ? `${parentPath}.${String(prop)}` : String(prop)
          self._observable.notifyMutation({
            type: 'action',
            actionName: self._currentActionName,
            path: fullPath
          }, self._state)
        }

        return result
      }
    }

    const proxy = new Proxy(target, handler)
    self._proxyCache.set(target, proxy)
    return proxy
  }

  private _setupArrayProtection<T extends any[]>(target: T, parentPath: string): T {
    const self = this

    if (self._proxyCache.has(target)) {
      return self._proxyCache.get(target)
    }

    const mutationMethods = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin']

    const handler: ProxyHandler<T> = {
      get(target: T, prop: string | symbol) {
        if (mutationMethods.includes(String(prop))) {
          return (...args: any[]) => {
            if (self._disposed) {
              throw new Error(`[vue-light-store] Store "${self.$name}" has been disposed`)
            }
            if (!self._actionInProgress) {
              throw new Error(
                `[vue-light-store] Cannot directly modify array "${parentPath}" via "${String(prop)}" in store "${self.$name}". ` +
                `Use $patch or define an action instead.`
              )
            }
            const result = (target as any)[String(prop)](...args)

            if (self._currentActionName && !['$patch', '$reset'].includes(self._currentActionName)) {
              self._observable.notifyMutation({
                type: 'action',
                actionName: self._currentActionName,
                path: parentPath,
                args
              }, self._state)
            }

            return result
          }
        }

        const value = Reflect.get(target, prop)
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const fullPath = `${parentPath}[${String(prop)}]`
          return self._setupStateProtection(value as object, fullPath)
        }
        if (Array.isArray(value)) {
          const fullPath = `${parentPath}[${String(prop)}]`
          return self._setupArrayProtection(value, fullPath)
        }
        return value
      },
      set(target: T, prop: string | symbol, value: any) {
        if (self._disposed) {
          throw new Error(`[vue-light-store] Store "${self.$name}" has been disposed`)
        }

        if (!self._actionInProgress) {
          const fullPath = `${parentPath}[${String(prop)}]`
          throw new Error(
            `[vue-light-store] Cannot directly modify state "${fullPath}" in store "${self.$name}". ` +
            `Use $patch or define an action instead.`
          )
        }

        const result = Reflect.set(target, prop, value)

        if (self._currentActionName && !['$patch', '$reset'].includes(self._currentActionName)) {
          const fullPath = `${parentPath}[${String(prop)}]`
          self._observable.notifyMutation({
            type: 'action',
            actionName: self._currentActionName,
            path: fullPath,
            value
          }, self._state)
        }

        return result
      },
      deleteProperty(target: T, prop: string | symbol) {
        if (self._disposed) {
          throw new Error(`[vue-light-store] Store "${self.$name}" has been disposed`)
        }

        if (!self._actionInProgress) {
          const fullPath = `${parentPath}[${String(prop)}]`
          throw new Error(
            `[vue-light-store] Cannot directly delete property "${fullPath}" in store "${self.$name}". ` +
            `Use $patch or define an action instead.`
          )
        }

        const result = Reflect.deleteProperty(target, prop)

        if (self._currentActionName && !['$patch', '$reset'].includes(self._currentActionName)) {
          const fullPath = `${parentPath}[${String(prop)}]`
          self._observable.notifyMutation({
            type: 'action',
            actionName: self._currentActionName,
            path: fullPath
          }, self._state)
        }

        return result
      }
    }

    const proxy = new Proxy(target, handler)
    self._proxyCache.set(target, proxy)
    return proxy
  }

  $patch(partial: Partial<S> | ((state: S) => void)): void {
    if (this._disposed) {
      throw new Error(`[vue-light-store] Store "${this.$name}" has been disposed`)
    }

    this._actionInProgress = true
    this._currentActionName = '$patch'

    try {
      if (typeof partial === 'function') {
        partial(this._state)
      } else {
        Object.assign(this._state, partial)
      }

      this._observable.notifyMutation({
        type: 'patch',
        value: partial
      }, this._state)
    } finally {
      this._actionInProgress = false
      this._currentActionName = null
    }
  }

  $reset(): void {
    if (this._disposed) {
      throw new Error(`[vue-light-store] Store "${this.$name}" has been disposed`)
    }

    this._actionInProgress = true
    this._currentActionName = '$reset'

    try {
      this._proxyCache = new WeakMap()
      const freshState = this._structuredClone(this._initialState)
      this._deepAssign(this._rawState, freshState)

      this._observable.notifyMutation({
        type: 'reset'
      }, this._state)
    } finally {
      this._actionInProgress = false
      this._currentActionName = null
    }
  }

  private _deepAssign(target: any, source: any): void {
    if (Array.isArray(source)) {
      target.length = 0
      source.forEach((item, index) => {
        if (item && typeof item === 'object') {
          if (Array.isArray(item)) {
            if (!Array.isArray(target[index])) {
              target[index] = []
            }
            this._deepAssign(target[index], item)
          } else {
            if (!target[index] || typeof target[index] !== 'object' || Array.isArray(target[index])) {
              target[index] = {}
            }
            this._deepAssign(target[index], item)
          }
        } else {
          target[index] = item
        }
      })
    } else {
      const targetKeys = Object.keys(target)
      const sourceKeys = Object.keys(source)

      targetKeys.forEach((key) => {
        if (!(key in source)) {
          delete target[key]
        }
      })

      sourceKeys.forEach((key) => {
        const sourceVal = source[key]
        const targetVal = target[key]

        if (sourceVal && typeof sourceVal === 'object') {
          if (Array.isArray(sourceVal)) {
            if (!Array.isArray(targetVal)) {
              target[key] = []
            }
            this._deepAssign(target[key], sourceVal)
          } else {
            if (!targetVal || typeof targetVal !== 'object' || Array.isArray(targetVal)) {
              target[key] = {}
            }
            this._deepAssign(target[key], sourceVal)
          }
        } else {
          target[key] = sourceVal
        }
      })
    }
  }

  $subscribe(
    callback: (mutation: MutationInfo<S>, state: S) => void,
    options?: { detached?: boolean; once?: boolean }
  ): () => void {
    if (this._disposed) {
      return () => {}
    }

    const wrappedCallback = (mutation: MutationInfo<S>) => {
      callback(mutation, this._state)
    }

    const unsubscribe = this._observable.subscribe(wrappedCallback, options)

    if (!options?.detached) {
      this._stopWatchers.push(unsubscribe)
    }

    return unsubscribe
  }

  $onAction(
    callback: Parameters<StoreInstance<S, G, A>['$onAction']>[0],
    options?: { detached?: boolean; once?: boolean }
  ): () => void {
    if (this._disposed) {
      return () => {}
    }

    const unsubscribe = this._observable.onAction(callback, options)

    if (!options?.detached) {
      this._stopWatchers.push(unsubscribe)
    }

    return unsubscribe
  }

  $debug(): ReturnType<StoreInstance<S, G, A>['$debug']> {
    return this._observable.getDebugInfo(this._state, this.$getters)
  }

  $dispose(): void {
    if (this._disposed) return

    this._disposed = true
    this._stopWatchers.forEach((stop) => stop())
    this._stopWatchers = []
    this._observable.dispose()
    this._registry.delete(this.$name)
  }

  toPublicAPI(): PublicStore<S, G, A> {
    if (this._publicAPI) {
      return this._publicAPI
    }

    const publicAPI = {} as PublicStore<S, G, A>

    Object.defineProperty(publicAPI, '$name', {
      value: this.$name,
      writable: false,
      enumerable: true
    })

    Object.keys(this._rawState).forEach((key) => {
      Object.defineProperty(publicAPI, key, {
        get: () => this._state[key as keyof S],
        enumerable: true,
        configurable: false
      })
    })

    Object.keys(this.$getters).forEach((key) => {
      Object.defineProperty(publicAPI, key, {
        get: () => this.$getters[key as keyof ComputedGetters<G>],
        enumerable: true,
        configurable: false
      })
    })

    Object.keys(this.$actions).forEach((key) => {
      Object.defineProperty(publicAPI, key, {
        value: this.$actions[key as keyof A],
        writable: false,
        enumerable: true,
        configurable: false
      })
    })

    publicAPI.$patch = this.$patch.bind(this)
    publicAPI.$reset = this.$reset.bind(this)
    publicAPI.$subscribe = this.$subscribe.bind(this)
    publicAPI.$onAction = this.$onAction.bind(this)
    publicAPI.$debug = this.$debug.bind(this)

    this._publicAPI = publicAPI
    return publicAPI
  }

  get isDisposed(): boolean {
    return this._disposed
  }

  get actionInProgress(): boolean {
    return this._actionInProgress
  }
}

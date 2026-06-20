import { reactive, computed } from 'vue'
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
  AnyRecordActions,
  AnyAction,
  AnyActions
} from './types'
import { ObservableStore } from './observable'

export class Store<
  S extends State,
  G extends Getters<S>,
  A extends AnyRecordActions
> implements StoreInstance<S, G, A>
{
  readonly $name: string
  readonly $state: S
  readonly $getters: Readonly<ComputedGetters<G>>
  readonly $actions: Readonly<A>

  private _state: S
  private _initialState: S
  private _getters: G
  private _actions: A
  private _observable: ObservableStore<S, G, A>
  private _registry: StoreRegistry
  private _actionInProgress = false
  private _currentActionName: string | null = null
  private _disposed = false
  private _stopWatchers: Array<() => void> = []

  private _publicAPI: PublicStore<S, G, A> | null = null

  private _rawState: S

  constructor(
    options: ModuleOptions<S, G, A>,
    registry: StoreRegistry
  ) {
    this.$name = options.name
    this._registry = registry
    this._observable = new ObservableStore<S, G, A>(options.name)

    this._initialState = this._deepFreezeClone(options.state())
    this._rawState = reactive(options.state()) as S
    this._state = this._setupStateProtection(this._rawState)
    this.$state = this._state

    this._getters = (options.getters ?? {}) as G
    this.$getters = this._createComputedGetters() as Readonly<ComputedGetters<G>>

    this._actions = (options.actions ?? {}) as A
    this.$actions = this._createBoundActions() as Readonly<A>

    this._registry.set(this.$name, this)
  }

  private _deepFreezeClone<T>(obj: T): T {
    const clone = JSON.parse(JSON.stringify(obj))
    return this._deepFreeze(clone)
  }

  private _deepFreeze<T>(obj: T): T {
    if (obj && typeof obj === 'object') {
      Object.freeze(obj)
      Object.values(obj).forEach((value) => this._deepFreeze(value))
    }
    return obj
  }

  private _createComputedGetters(): ComputedGetters<G> {
    const computedGetters = {} as ComputedGetters<G>
    const getterKeys = Object.keys(this._getters) as Array<keyof G>

    getterKeys.forEach((key) => {
      const getterFn = this._getters[key]
      Object.defineProperty(computedGetters, key, {
        get: () => {
          const c = computed(() => getterFn(this._state, this.$getters))
          return c.value
        },
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

  private _createActionContext(): ActionContext<S, G> {
    return {
      $name: this.$name,
      $state: this._state,
      $getters: this.$getters,
      $actions: this.$actions as unknown as Readonly<AnyActions>,
      $patch: this.$patch.bind(this),
      $reset: this.$reset.bind(this),
      $subscribe: this.$subscribe.bind(this),
      $onAction: this.$onAction.bind(this),
      $debug: this.$debug.bind(this)
    }
  }

  private _setupStateProtection(target: S): S {
    const self = this

    const handler: ProxyHandler<S> = {
      get(target: S, prop: string | symbol) {
        return Reflect.get(target, prop)
      },
      set(target: S, prop: string | symbol, value: any) {
        if (self._disposed) {
          throw new Error(`[vue-light-store] Store "${self.$name}" has been disposed`)
        }

        if (!self._actionInProgress) {
          throw new Error(
            `[vue-light-store] Cannot directly modify state "${String(prop)}" in store "${self.$name}". ` +
            `Use $patch or define an action instead.`
          )
        }

        const result = Reflect.set(target, prop, value)

        if (self._currentActionName && !['$patch', '$reset'].includes(self._currentActionName)) {
          self._observable.notifyMutation({
            type: 'action',
            actionName: self._currentActionName,
            path: String(prop),
            value
          }, self._state)
        }

        return result
      },
      deleteProperty(target: S, prop: string | symbol) {
        if (self._disposed) {
          throw new Error(`[vue-light-store] Store "${self.$name}" has been disposed`)
        }

        if (!self._actionInProgress) {
          throw new Error(
            `[vue-light-store] Cannot directly delete property "${String(prop)}" in store "${self.$name}". ` +
            `Use $patch or define an action instead.`
          )
        }

        const result = Reflect.deleteProperty(target, prop)

        if (self._currentActionName && !['$patch', '$reset'].includes(self._currentActionName)) {
          self._observable.notifyMutation({
            type: 'action',
            actionName: self._currentActionName,
            path: String(prop)
          }, self._state)
        }

        return result
      }
    }

    return new Proxy(target, handler)
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
      const newState = JSON.parse(JSON.stringify(this._initialState))
      Object.keys(this._state).forEach((key) => {
        delete this._state[key as keyof S]
      })
      Object.assign(this._state, newState)

      this._observable.notifyMutation({
        type: 'reset'
      }, this._state)
    } finally {
      this._actionInProgress = false
      this._currentActionName = null
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

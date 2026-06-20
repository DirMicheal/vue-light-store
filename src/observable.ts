import type {
  State,
  Getters,
  ActionStartInfo,
  MutationInfo,
  ActionInfo,
  SubscriptionCallback,
  ActionCallback,
  SubscribeOptions,
  StoreDebugInfo
} from './types'

interface Listener<T> {
  callback: T
  once: boolean
  detached: boolean
}

export class ObservableStore<
  S extends State,
  G extends Getters<S>,
  A extends object
> {
  private subscribers: Set<Listener<SubscriptionCallback<S>>> = new Set()
  private actionSubscribers: Set<Listener<ActionCallback>> = new Set()
  private mutationHistory: MutationInfo<S>[] = []
  private actionHistory: StoreDebugInfo<S, G, A>['actionHistory'] = []
  private maxHistorySize = 100
  private _isDisposed = false

  constructor(private storeName: string) {}

  notifyMutation(
    mutation: Omit<MutationInfo<S>, 'storeName' | 'timestamp'>,
    state: S
  ): void {
    if (this._isDisposed) return

    const fullMutation: MutationInfo<S> = {
      ...mutation,
      storeName: this.storeName,
      timestamp: Date.now()
    }

    this.mutationHistory.push(fullMutation)
    if (this.mutationHistory.length > this.maxHistorySize) {
      this.mutationHistory.shift()
    }

    for (const listener of this.subscribers) {
      try {
        listener.callback(fullMutation, state)
        if (listener.once) {
          this.subscribers.delete(listener)
        }
      } catch (e) {
        console.error(`[vue-light-store] Subscriber error in ${this.storeName}:`, e)
      }
    }
  }

  notifyAction(action: ActionStartInfo): {
    actionInfo: ActionInfo
    resolve: (result: any) => void
    reject: (error: Error) => void
  } {
    if (this._isDisposed) {
      return {
        actionInfo: {
          ...action,
          storeName: this.storeName,
          after: () => {},
          onError: () => {}
        },
        resolve: () => {},
        reject: () => {}
      }
    }

    const afterCallbacks: Array<(result: any) => void> = []
    const errorCallbacks: Array<(error: Error) => void> = []

    const fullAction: ActionInfo = {
      ...action,
      storeName: this.storeName,
      after: (callback: (result: any) => void) => {
        afterCallbacks.push(callback)
      },
      onError: (callback: (error: Error) => void) => {
        errorCallbacks.push(callback)
      }
    }

    const historyEntry: StoreDebugInfo<S, G, A>['actionHistory'][number] = {
      name: action.name,
      args: [...action.args],
      timestamp: Date.now()
    }

    this.actionHistory.push(historyEntry)
    if (this.actionHistory.length > this.maxHistorySize) {
      this.actionHistory.shift()
    }

    for (const listener of this.actionSubscribers) {
      try {
        listener.callback(fullAction)

        if (listener.once) {
          this.actionSubscribers.delete(listener)
        }
      } catch (e) {
        console.error(`[vue-light-store] Action subscriber error in ${this.storeName}:`, e)
      }
    }

    const resolve = (result: any) => {
      historyEntry.result = result
      for (const callback of afterCallbacks) {
        try {
          callback(result)
        } catch (e) {
          console.error(`[vue-light-store] Action after callback error in ${this.storeName}:`, e)
        }
      }
    }

    const reject = (error: Error) => {
      historyEntry.error = error
      for (const callback of errorCallbacks) {
        try {
          callback(error)
        } catch (e) {
          console.error(`[vue-light-store] Action error callback error in ${this.storeName}:`, e)
        }
      }
    }

    return { actionInfo: fullAction, resolve, reject }
  }

  subscribe(
    callback: SubscriptionCallback<S>,
    options: SubscribeOptions = {}
  ): () => void {
    if (this._isDisposed) {
      return () => {}
    }

    const listener: Listener<SubscriptionCallback<S>> = {
      callback,
      once: options.once ?? false,
      detached: options.detached ?? false
    }

    this.subscribers.add(listener)

    return () => {
      this.subscribers.delete(listener)
    }
  }

  onAction(
    callback: ActionCallback,
    options: SubscribeOptions = {}
  ): () => void {
    if (this._isDisposed) {
      return () => {}
    }

    const listener: Listener<ActionCallback> = {
      callback,
      once: options.once ?? false,
      detached: options.detached ?? false
    }

    this.actionSubscribers.add(listener)

    return () => {
      this.actionSubscribers.delete(listener)
    }
  }

  getDebugInfo(
    state: S,
    getters: any
  ): StoreDebugInfo<S, G, A> {
    return {
      name: this.storeName,
      state: JSON.parse(JSON.stringify(state)),
      getters: JSON.parse(JSON.stringify(getters)),
      actionHistory: [...this.actionHistory],
      mutationHistory: [...this.mutationHistory],
      subscriberCount: this.subscribers.size,
      actionSubscriberCount: this.actionSubscribers.size,
      isDisposed: this._isDisposed
    }
  }

  clearHistory(): void {
    this.mutationHistory = []
    this.actionHistory = []
  }

  dispose(): void {
    this._isDisposed = true
    this.subscribers.clear()
    this.actionSubscribers.clear()
    this.clearHistory()
  }

  isDisposed(): boolean {
    return this._isDisposed
  }

  subscriberCount(): number {
    return this.subscribers.size
  }

  actionSubscriberCount(): number {
    return this.actionSubscribers.size
  }
}

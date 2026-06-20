var f = Object.defineProperty;
var _ = (a, t, e) => t in a ? f(a, t, { enumerable: !0, configurable: !0, writable: !0, value: e }) : a[t] = e;
var i = (a, t, e) => _(a, typeof t != "symbol" ? t + "" : t, e);
import { reactive as g, computed as m } from "vue";
class $ {
  constructor(t) {
    i(this, "subscribers", /* @__PURE__ */ new Set());
    i(this, "actionSubscribers", /* @__PURE__ */ new Set());
    i(this, "mutationHistory", []);
    i(this, "actionHistory", []);
    i(this, "maxHistorySize", 100);
    i(this, "_isDisposed", !1);
    this.storeName = t;
  }
  notifyMutation(t, e) {
    if (this._isDisposed) return;
    const s = {
      ...t,
      storeName: this.storeName,
      timestamp: Date.now()
    };
    this.mutationHistory.push(s), this.mutationHistory.length > this.maxHistorySize && this.mutationHistory.shift(), this.subscribers.forEach((n) => {
      try {
        n.callback(s, e), n.once && this.subscribers.delete(n);
      } catch (r) {
        console.error(`[vue-light-store] Subscriber error in ${this.storeName}:`, r);
      }
    });
  }
  notifyAction(t) {
    if (this._isDisposed)
      return {
        actionInfo: {
          ...t,
          storeName: this.storeName,
          after: () => {
          },
          onError: () => {
          }
        },
        resolve: () => {
        },
        reject: () => {
        }
      };
    const e = [], s = [], n = {
      ...t,
      storeName: this.storeName,
      after: (c) => {
        e.push(c);
      },
      onError: (c) => {
        s.push(c);
      }
    }, r = {
      name: t.name,
      args: [...t.args],
      timestamp: Date.now()
    };
    return this.actionHistory.push(r), this.actionHistory.length > this.maxHistorySize && this.actionHistory.shift(), this.actionSubscribers.forEach((c) => {
      try {
        c.callback(n), c.once && this.actionSubscribers.delete(c);
      } catch (u) {
        console.error(`[vue-light-store] Action subscriber error in ${this.storeName}:`, u);
      }
    }), { actionInfo: n, resolve: (c) => {
      r.result = c, e.forEach((u) => {
        try {
          u(c);
        } catch (l) {
          console.error(`[vue-light-store] Action after callback error in ${this.storeName}:`, l);
        }
      });
    }, reject: (c) => {
      r.error = c, s.forEach((u) => {
        try {
          u(c);
        } catch (l) {
          console.error(`[vue-light-store] Action error callback error in ${this.storeName}:`, l);
        }
      });
    } };
  }
  subscribe(t, e = {}) {
    if (this._isDisposed)
      return () => {
      };
    const s = {
      callback: t,
      once: e.once ?? !1,
      detached: e.detached ?? !1
    };
    return this.subscribers.add(s), () => {
      this.subscribers.delete(s);
    };
  }
  onAction(t, e = {}) {
    if (this._isDisposed)
      return () => {
      };
    const s = {
      callback: t,
      once: e.once ?? !1,
      detached: e.detached ?? !1
    };
    return this.actionSubscribers.add(s), () => {
      this.actionSubscribers.delete(s);
    };
  }
  getDebugInfo(t, e) {
    return {
      name: this.storeName,
      state: JSON.parse(JSON.stringify(t)),
      getters: JSON.parse(JSON.stringify(e)),
      actionHistory: [...this.actionHistory],
      mutationHistory: [...this.mutationHistory],
      subscriberCount: this.subscribers.size,
      actionSubscriberCount: this.actionSubscribers.size,
      isDisposed: this._isDisposed
    };
  }
  clearHistory() {
    this.mutationHistory = [], this.actionHistory = [];
  }
  dispose() {
    this._isDisposed = !0, this.subscribers.clear(), this.actionSubscribers.clear(), this.clearHistory();
  }
  get isDisposed() {
    return this._isDisposed;
  }
  get subscriberCount() {
    return this.subscribers.size;
  }
  get actionSubscriberCount() {
    return this.actionSubscribers.size;
  }
}
class y {
  constructor(t, e) {
    i(this, "$name");
    i(this, "$state");
    i(this, "$getters");
    i(this, "$actions");
    i(this, "_state");
    i(this, "_initialState");
    i(this, "_getters");
    i(this, "_actions");
    i(this, "_observable");
    i(this, "_registry");
    i(this, "_actionInProgress", !1);
    i(this, "_currentActionName", null);
    i(this, "_disposed", !1);
    i(this, "_stopWatchers", []);
    i(this, "_publicAPI", null);
    i(this, "_rawState");
    this.$name = t.name, this._registry = e, this._observable = new $(t.name), this._initialState = this._deepFreezeClone(t.state()), this._rawState = g(t.state()), this._state = this._setupStateProtection(this._rawState), this.$state = this._state, this._getters = t.getters ?? {}, this.$getters = this._createComputedGetters(), this._actions = t.actions ?? {}, this.$actions = this._createBoundActions(), this._registry.set(this.$name, this);
  }
  _deepFreezeClone(t) {
    const e = JSON.parse(JSON.stringify(t));
    return this._deepFreeze(e);
  }
  _deepFreeze(t) {
    return t && typeof t == "object" && (Object.freeze(t), Object.values(t).forEach((e) => this._deepFreeze(e))), t;
  }
  _createComputedGetters() {
    const t = {};
    return Object.keys(this._getters).forEach((s) => {
      const n = this._getters[s];
      Object.defineProperty(t, s, {
        get: () => m(() => n(this._state, this.$getters)).value,
        enumerable: !0,
        configurable: !1
      });
    }), t;
  }
  _createBoundActions() {
    const t = {};
    return Object.keys(this._actions).forEach((s) => {
      t[s] = (...n) => this._executeAction(s, n);
    }), t;
  }
  _executeAction(t, e) {
    if (this._disposed)
      throw new Error(`[vue-light-store] Store "${this.$name}" has been disposed`);
    const { resolve: s, reject: n } = this._observable.notifyAction({
      name: t,
      args: e
    });
    this._actionInProgress = !0, this._currentActionName = t;
    try {
      const r = this._actions[t].apply(
        this._createActionContext(),
        e
      );
      return r instanceof Promise ? r.then((o) => (s(o), this._actionInProgress = !1, this._currentActionName = null, o)).catch((o) => {
        throw n(o), this._actionInProgress = !1, this._currentActionName = null, o;
      }) : (s(r), this._actionInProgress = !1, this._currentActionName = null, r);
    } catch (r) {
      throw n(r), this._actionInProgress = !1, this._currentActionName = null, r;
    }
  }
  _createActionContext() {
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
    };
  }
  _setupStateProtection(t) {
    const e = this, s = {
      get(n, r) {
        return Reflect.get(n, r);
      },
      set(n, r, o) {
        if (e._disposed)
          throw new Error(`[vue-light-store] Store "${e.$name}" has been disposed`);
        if (!e._actionInProgress)
          throw new Error(
            `[vue-light-store] Cannot directly modify state "${String(r)}" in store "${e.$name}". Use $patch or define an action instead.`
          );
        const b = Reflect.set(n, r, o);
        return e._currentActionName && !["$patch", "$reset"].includes(e._currentActionName) && e._observable.notifyMutation({
          type: "action",
          actionName: e._currentActionName,
          path: String(r),
          value: o
        }, e._state), b;
      },
      deleteProperty(n, r) {
        if (e._disposed)
          throw new Error(`[vue-light-store] Store "${e.$name}" has been disposed`);
        if (!e._actionInProgress)
          throw new Error(
            `[vue-light-store] Cannot directly delete property "${String(r)}" in store "${e.$name}". Use $patch or define an action instead.`
          );
        const o = Reflect.deleteProperty(n, r);
        return e._currentActionName && !["$patch", "$reset"].includes(e._currentActionName) && e._observable.notifyMutation({
          type: "action",
          actionName: e._currentActionName,
          path: String(r)
        }, e._state), o;
      }
    };
    return new Proxy(t, s);
  }
  $patch(t) {
    if (this._disposed)
      throw new Error(`[vue-light-store] Store "${this.$name}" has been disposed`);
    this._actionInProgress = !0, this._currentActionName = "$patch";
    try {
      typeof t == "function" ? t(this._state) : Object.assign(this._state, t), this._observable.notifyMutation({
        type: "patch",
        value: t
      }, this._state);
    } finally {
      this._actionInProgress = !1, this._currentActionName = null;
    }
  }
  $reset() {
    if (this._disposed)
      throw new Error(`[vue-light-store] Store "${this.$name}" has been disposed`);
    this._actionInProgress = !0, this._currentActionName = "$reset";
    try {
      const t = JSON.parse(JSON.stringify(this._initialState));
      Object.keys(this._state).forEach((e) => {
        delete this._state[e];
      }), Object.assign(this._state, t), this._observable.notifyMutation({
        type: "reset"
      }, this._state);
    } finally {
      this._actionInProgress = !1, this._currentActionName = null;
    }
  }
  $subscribe(t, e) {
    if (this._disposed)
      return () => {
      };
    const s = (r) => {
      t(r, this._state);
    }, n = this._observable.subscribe(s, e);
    return e != null && e.detached || this._stopWatchers.push(n), n;
  }
  $onAction(t, e) {
    if (this._disposed)
      return () => {
      };
    const s = this._observable.onAction(t, e);
    return e != null && e.detached || this._stopWatchers.push(s), s;
  }
  $debug() {
    return this._observable.getDebugInfo(this._state, this.$getters);
  }
  $dispose() {
    this._disposed || (this._disposed = !0, this._stopWatchers.forEach((t) => t()), this._stopWatchers = [], this._observable.dispose(), this._registry.delete(this.$name));
  }
  toPublicAPI() {
    if (this._publicAPI)
      return this._publicAPI;
    const t = {};
    return Object.defineProperty(t, "$name", {
      value: this.$name,
      writable: !1,
      enumerable: !0
    }), Object.keys(this._rawState).forEach((e) => {
      Object.defineProperty(t, e, {
        get: () => this._state[e],
        enumerable: !0,
        configurable: !1
      });
    }), Object.keys(this.$getters).forEach((e) => {
      Object.defineProperty(t, e, {
        get: () => this.$getters[e],
        enumerable: !0,
        configurable: !1
      });
    }), Object.keys(this.$actions).forEach((e) => {
      Object.defineProperty(t, e, {
        value: this.$actions[e],
        writable: !1,
        enumerable: !0,
        configurable: !1
      });
    }), t.$patch = this.$patch.bind(this), t.$reset = this.$reset.bind(this), t.$subscribe = this.$subscribe.bind(this), t.$onAction = this.$onAction.bind(this), t.$debug = this.$debug.bind(this), this._publicAPI = t, t;
  }
  get isDisposed() {
    return this._disposed;
  }
  get actionInProgress() {
    return this._actionInProgress;
  }
}
class d {
  constructor() {
    i(this, "registry", /* @__PURE__ */ new Map());
    i(this, "storeFactories", /* @__PURE__ */ new Map());
    i(this, "publicAPICache", /* @__PURE__ */ new Map());
  }
  register(t) {
    if (this.storeFactories.has(t.name))
      throw new Error(`[vue-light-store] Store "${t.name}" is already registered`);
    const e = () => {
      let s = this.registry.get(t.name);
      return (!s || s.isDisposed) && (s = new y(t, this.registry), this.registry.set(t.name, s), this.publicAPICache.set(t.name, s.toPublicAPI())), this.publicAPICache.get(t.name);
    };
    return this.storeFactories.set(t.name, e), e;
  }
  get(t) {
    const e = this.storeFactories.get(t);
    if (e)
      return e();
  }
  has(t) {
    return this.storeFactories.has(t);
  }
  list() {
    return Array.from(this.storeFactories.keys());
  }
  $debug() {
    const t = {};
    let e = 0, s = 0;
    return this.registry.forEach((n, r) => {
      const o = n.$debug();
      t[r] = o, e += o.subscriberCount, s += o.actionSubscriberCount;
    }), {
      stores: t,
      totalStores: this.registry.size,
      totalSubscribers: e,
      totalActionSubscribers: s
    };
  }
  dispose() {
    this.registry.forEach((t) => {
      t.$dispose();
    }), this.registry.clear(), this.storeFactories.clear(), this.publicAPICache.clear();
  }
}
const h = new d();
function A() {
  return new d();
}
function w(a) {
  return h.register(a);
}
function P(a) {
  return h.get(a);
}
function N(a) {
  return h.has(a);
}
function v() {
  return h.list();
}
function I() {
  return h.$debug();
}
function E() {
  h.dispose();
}
export {
  $ as ObservableStore,
  y as Store,
  A as createGlobalStore,
  I as debugStores,
  w as defineStore,
  E as disposeAllStores,
  P as getStore,
  N as hasStore,
  v as listStores
};

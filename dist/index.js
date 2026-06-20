var _ = Object.defineProperty;
var y = (l, t, s) => t in l ? _(l, t, { enumerable: !0, configurable: !0, writable: !0, value: s }) : l[t] = s;
var a = (l, t, s) => y(l, typeof t != "symbol" ? t + "" : t, s);
import { reactive as $, computed as g } from "vue";
class m {
  constructor(t) {
    a(this, "subscribers", /* @__PURE__ */ new Set());
    a(this, "actionSubscribers", /* @__PURE__ */ new Set());
    a(this, "mutationHistory", []);
    a(this, "actionHistory", []);
    a(this, "maxHistorySize", 100);
    a(this, "_isDisposed", !1);
    this.storeName = t;
  }
  notifyMutation(t, s) {
    if (this._isDisposed) return;
    const e = {
      ...t,
      storeName: this.storeName,
      timestamp: Date.now()
    };
    this.mutationHistory.push(e), this.mutationHistory.length > this.maxHistorySize && this.mutationHistory.shift();
    for (const n of this.subscribers)
      try {
        n.callback(e, s), n.once && this.subscribers.delete(n);
      } catch (i) {
        console.error(`[vue-light-store] Subscriber error in ${this.storeName}:`, i);
      }
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
    const s = [], e = [], n = {
      ...t,
      storeName: this.storeName,
      after: (r) => {
        s.push(r);
      },
      onError: (r) => {
        e.push(r);
      }
    }, i = {
      name: t.name,
      args: [...t.args],
      timestamp: Date.now()
    };
    this.actionHistory.push(i), this.actionHistory.length > this.maxHistorySize && this.actionHistory.shift();
    for (const r of this.actionSubscribers)
      try {
        r.callback(n), r.once && this.actionSubscribers.delete(r);
      } catch (c) {
        console.error(`[vue-light-store] Action subscriber error in ${this.storeName}:`, c);
      }
    return { actionInfo: n, resolve: (r) => {
      i.result = r;
      for (const c of s)
        try {
          c(r);
        } catch (u) {
          console.error(`[vue-light-store] Action after callback error in ${this.storeName}:`, u);
        }
    }, reject: (r) => {
      i.error = r;
      for (const c of e)
        try {
          c(r);
        } catch (u) {
          console.error(`[vue-light-store] Action error callback error in ${this.storeName}:`, u);
        }
    } };
  }
  subscribe(t, s = {}) {
    if (this._isDisposed)
      return () => {
      };
    const e = {
      callback: t,
      once: s.once ?? !1,
      detached: s.detached ?? !1
    };
    return this.subscribers.add(e), () => {
      this.subscribers.delete(e);
    };
  }
  onAction(t, s = {}) {
    if (this._isDisposed)
      return () => {
      };
    const e = {
      callback: t,
      once: s.once ?? !1,
      detached: s.detached ?? !1
    };
    return this.actionSubscribers.add(e), () => {
      this.actionSubscribers.delete(e);
    };
  }
  getDebugInfo(t, s) {
    return {
      name: this.storeName,
      state: JSON.parse(JSON.stringify(t)),
      getters: JSON.parse(JSON.stringify(s)),
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
  isDisposed() {
    return this._isDisposed;
  }
  subscriberCount() {
    return this.subscribers.size;
  }
  actionSubscriberCount() {
    return this.actionSubscribers.size;
  }
}
class A {
  constructor(t, s) {
    a(this, "$name");
    a(this, "$state");
    a(this, "$getters");
    a(this, "$actions");
    a(this, "_state");
    a(this, "_initialState");
    a(this, "_getters");
    a(this, "_computedGettersCache", /* @__PURE__ */ new Map());
    a(this, "_actions");
    a(this, "_observable");
    a(this, "_registry");
    a(this, "_actionInProgress", !1);
    a(this, "_currentActionName", null);
    a(this, "_disposed", !1);
    a(this, "_stopWatchers", []);
    a(this, "_publicAPI", null);
    a(this, "_rawState");
    a(this, "_proxyCache", /* @__PURE__ */ new WeakMap());
    this.$name = t.name, this._registry = s, this._observable = new m(t.name), this._initialState = this._structuredClone(t.state()), this._rawState = $(t.state()), this._state = this._setupStateProtection(this._rawState), this.$state = this._state, this._getters = t.getters ?? {}, this.$getters = this._createComputedGetters(), this._actions = t.actions ?? {}, this.$actions = this._createBoundActions(), this._registry.set(this.$name, this);
  }
  _structuredClone(t) {
    return typeof structuredClone == "function" ? structuredClone(t) : JSON.parse(JSON.stringify(t));
  }
  _createComputedGetters() {
    const t = {};
    return Object.keys(this._getters).forEach((e) => {
      const n = this._getters[e], i = g(() => n(this._state, this.$getters));
      this._computedGettersCache.set(e, i), Object.defineProperty(t, e, {
        get: () => i.value,
        enumerable: !0,
        configurable: !1
      });
    }), t;
  }
  _createBoundActions() {
    const t = {};
    return Object.keys(this._actions).forEach((e) => {
      t[e] = (...n) => this._executeAction(e, n);
    }), t;
  }
  _executeAction(t, s) {
    if (this._disposed)
      throw new Error(`[vue-light-store] Store "${this.$name}" has been disposed`);
    const { resolve: e, reject: n } = this._observable.notifyAction({
      name: t,
      args: s
    });
    this._actionInProgress = !0, this._currentActionName = t;
    try {
      const i = this._actions[t].apply(
        this._createActionContext(),
        s
      );
      return i instanceof Promise ? i.then((h) => (e(h), this._actionInProgress = !1, this._currentActionName = null, h)).catch((h) => {
        throw n(h), this._actionInProgress = !1, this._currentActionName = null, h;
      }) : (e(i), this._actionInProgress = !1, this._currentActionName = null, i);
    } catch (i) {
      throw n(i), this._actionInProgress = !1, this._currentActionName = null, i;
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
  _setupStateProtection(t, s = "") {
    const e = this;
    if (e._proxyCache.has(t))
      return e._proxyCache.get(t);
    const n = {
      get(h, o) {
        const r = Reflect.get(h, o);
        if (r && typeof r == "object" && !Array.isArray(r)) {
          const c = s ? `${s}.${String(o)}` : String(o);
          return e._setupStateProtection(r, c);
        }
        if (Array.isArray(r)) {
          const c = s ? `${s}.${String(o)}` : String(o);
          return e._setupArrayProtection(r, c);
        }
        return r;
      },
      set(h, o, r) {
        if (e._disposed)
          throw new Error(`[vue-light-store] Store "${e.$name}" has been disposed`);
        if (!e._actionInProgress) {
          const u = s ? `${s}.${String(o)}` : String(o);
          throw new Error(
            `[vue-light-store] Cannot directly modify state "${u}" in store "${e.$name}". Use $patch or define an action instead.`
          );
        }
        const c = Reflect.set(h, o, r);
        if (e._currentActionName && !["$patch", "$reset"].includes(e._currentActionName)) {
          const u = s ? `${s}.${String(o)}` : String(o);
          e._observable.notifyMutation({
            type: "action",
            actionName: e._currentActionName,
            path: u,
            value: r
          }, e._state);
        }
        return c;
      },
      deleteProperty(h, o) {
        if (e._disposed)
          throw new Error(`[vue-light-store] Store "${e.$name}" has been disposed`);
        if (!e._actionInProgress) {
          const c = s ? `${s}.${String(o)}` : String(o);
          throw new Error(
            `[vue-light-store] Cannot directly delete property "${c}" in store "${e.$name}". Use $patch or define an action instead.`
          );
        }
        const r = Reflect.deleteProperty(h, o);
        if (e._currentActionName && !["$patch", "$reset"].includes(e._currentActionName)) {
          const c = s ? `${s}.${String(o)}` : String(o);
          e._observable.notifyMutation({
            type: "action",
            actionName: e._currentActionName,
            path: c
          }, e._state);
        }
        return r;
      }
    }, i = new Proxy(t, n);
    return e._proxyCache.set(t, i), i;
  }
  _setupArrayProtection(t, s) {
    const e = this;
    if (e._proxyCache.has(t))
      return e._proxyCache.get(t);
    const n = ["push", "pop", "shift", "unshift", "splice", "sort", "reverse", "fill", "copyWithin"], i = {
      get(o, r) {
        if (n.includes(String(r)))
          return (...u) => {
            if (e._disposed)
              throw new Error(`[vue-light-store] Store "${e.$name}" has been disposed`);
            if (!e._actionInProgress)
              throw new Error(
                `[vue-light-store] Cannot directly modify array "${s}" via "${String(r)}" in store "${e.$name}". Use $patch or define an action instead.`
              );
            const f = o[String(r)](...u);
            return e._currentActionName && !["$patch", "$reset"].includes(e._currentActionName) && e._observable.notifyMutation({
              type: "action",
              actionName: e._currentActionName,
              path: s,
              args: u
            }, e._state), f;
          };
        const c = Reflect.get(o, r);
        if (c && typeof c == "object" && !Array.isArray(c)) {
          const u = `${s}[${String(r)}]`;
          return e._setupStateProtection(c, u);
        }
        if (Array.isArray(c)) {
          const u = `${s}[${String(r)}]`;
          return e._setupArrayProtection(c, u);
        }
        return c;
      },
      set(o, r, c) {
        if (e._disposed)
          throw new Error(`[vue-light-store] Store "${e.$name}" has been disposed`);
        if (!e._actionInProgress) {
          const f = `${s}[${String(r)}]`;
          throw new Error(
            `[vue-light-store] Cannot directly modify state "${f}" in store "${e.$name}". Use $patch or define an action instead.`
          );
        }
        const u = Reflect.set(o, r, c);
        if (e._currentActionName && !["$patch", "$reset"].includes(e._currentActionName)) {
          const f = `${s}[${String(r)}]`;
          e._observable.notifyMutation({
            type: "action",
            actionName: e._currentActionName,
            path: f,
            value: c
          }, e._state);
        }
        return u;
      },
      deleteProperty(o, r) {
        if (e._disposed)
          throw new Error(`[vue-light-store] Store "${e.$name}" has been disposed`);
        if (!e._actionInProgress) {
          const u = `${s}[${String(r)}]`;
          throw new Error(
            `[vue-light-store] Cannot directly delete property "${u}" in store "${e.$name}". Use $patch or define an action instead.`
          );
        }
        const c = Reflect.deleteProperty(o, r);
        if (e._currentActionName && !["$patch", "$reset"].includes(e._currentActionName)) {
          const u = `${s}[${String(r)}]`;
          e._observable.notifyMutation({
            type: "action",
            actionName: e._currentActionName,
            path: u
          }, e._state);
        }
        return c;
      }
    }, h = new Proxy(t, i);
    return e._proxyCache.set(t, h), h;
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
      this._proxyCache = /* @__PURE__ */ new WeakMap();
      const t = this._structuredClone(this._initialState);
      this._deepAssign(this._rawState, t), this._observable.notifyMutation({
        type: "reset"
      }, this._state);
    } finally {
      this._actionInProgress = !1, this._currentActionName = null;
    }
  }
  _deepAssign(t, s) {
    if (Array.isArray(s))
      t.length = 0, s.forEach((e, n) => {
        e && typeof e == "object" ? Array.isArray(e) ? (Array.isArray(t[n]) || (t[n] = []), this._deepAssign(t[n], e)) : ((!t[n] || typeof t[n] != "object" || Array.isArray(t[n])) && (t[n] = {}), this._deepAssign(t[n], e)) : t[n] = e;
      });
    else {
      const e = Object.keys(t), n = Object.keys(s);
      e.forEach((i) => {
        i in s || delete t[i];
      }), n.forEach((i) => {
        const h = s[i], o = t[i];
        h && typeof h == "object" ? Array.isArray(h) ? (Array.isArray(o) || (t[i] = []), this._deepAssign(t[i], h)) : ((!o || typeof o != "object" || Array.isArray(o)) && (t[i] = {}), this._deepAssign(t[i], h)) : t[i] = h;
      });
    }
  }
  $subscribe(t, s) {
    if (this._disposed)
      return () => {
      };
    const e = (i) => {
      t(i, this._state);
    }, n = this._observable.subscribe(e, s);
    return s != null && s.detached || this._stopWatchers.push(n), n;
  }
  $onAction(t, s) {
    if (this._disposed)
      return () => {
      };
    const e = this._observable.onAction(t, s);
    return s != null && s.detached || this._stopWatchers.push(e), e;
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
    }), Object.keys(this._rawState).forEach((s) => {
      Object.defineProperty(t, s, {
        get: () => this._state[s],
        enumerable: !0,
        configurable: !1
      });
    }), Object.keys(this.$getters).forEach((s) => {
      Object.defineProperty(t, s, {
        get: () => this.$getters[s],
        enumerable: !0,
        configurable: !1
      });
    }), Object.keys(this.$actions).forEach((s) => {
      Object.defineProperty(t, s, {
        value: this.$actions[s],
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
    a(this, "registry", /* @__PURE__ */ new Map());
    a(this, "storeFactories", /* @__PURE__ */ new Map());
    a(this, "publicAPICache", /* @__PURE__ */ new Map());
  }
  register(t) {
    if (this.storeFactories.has(t.name))
      throw new Error(`[vue-light-store] Store "${t.name}" is already registered`);
    const s = () => {
      let e = this.registry.get(t.name);
      return (!e || e.isDisposed) && (e = new A(t, this.registry), this.registry.set(t.name, e), this.publicAPICache.set(t.name, e.toPublicAPI())), this.publicAPICache.get(t.name);
    };
    return this.storeFactories.set(t.name, s), s;
  }
  get(t) {
    const s = this.storeFactories.get(t);
    if (s)
      return s();
  }
  has(t) {
    return this.storeFactories.has(t);
  }
  list() {
    return Array.from(this.storeFactories.keys());
  }
  $debug() {
    const t = {};
    let s = 0, e = 0;
    return this.registry.forEach((n, i) => {
      const h = n.$debug();
      t[i] = h, s += h.subscriberCount, e += h.actionSubscriberCount;
    }), {
      stores: t,
      totalStores: this.registry.size,
      totalSubscribers: s,
      totalActionSubscribers: e
    };
  }
  dispose() {
    this.registry.forEach((t) => {
      t.$dispose();
    }), this.registry.clear(), this.storeFactories.clear(), this.publicAPICache.clear();
  }
}
const b = new d();
function w() {
  return new d();
}
function N(l) {
  return b.register(l);
}
function v(l) {
  return b.get(l);
}
function P(l) {
  return b.has(l);
}
function C() {
  return b.list();
}
function I() {
  return b.$debug();
}
function E() {
  b.dispose();
}
export {
  m as ObservableStore,
  A as Store,
  w as createGlobalStore,
  I as debugStores,
  N as defineStore,
  E as disposeAllStores,
  v as getStore,
  P as hasStore,
  C as listStores
};

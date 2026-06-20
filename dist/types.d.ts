export type State = Record<string | symbol, any>;
export type Getter<S extends State, G extends Getters<S>> = (state: S, getters: G) => any;
export type Getters<S extends State> = Record<string, Getter<S, any>>;
export type AnyAction = (...args: any[]) => any;
export type AnyActions = Record<string, AnyAction>;
export type ValidateActions<T> = {
    [K in keyof T]: T[K] extends AnyAction ? T[K] : never;
};
export type AllActions<T> = T extends ValidateActions<T> ? true : false;
export interface ActionContext<S extends State, G extends Getters<S>, A = AnyActions> {
    readonly $name: string;
    $state: S;
    readonly $getters: Readonly<ComputedGetters<G>>;
    readonly $actions: Readonly<A>;
    $patch(partial: Partial<S> | ((state: S) => void)): void;
    $reset(): void;
    $subscribe(callback: SubscriptionCallback<S>, options?: SubscribeOptions): () => void;
    $onAction(callback: ActionCallback, options?: SubscribeOptions): () => void;
    $debug(): StoreDebugInfo<S, G, any>;
}
export type Action<S extends State, G extends Getters<S>, A = AnyActions> = (this: ActionContext<S, G, A>, ...args: any[]) => any;
export type Actions<S extends State, G extends Getters<S>, A = AnyActions> = Record<string, Action<S, G, A>>;
export type AnyRecordActions = Record<string, AnyAction>;
export type OmitThisParameter<T> = T extends (this: any, ...args: infer A) => infer R ? (...args: A) => R : T;
export interface ModuleOptions<S extends State, G extends Getters<S>, A extends object> {
    name: string;
    state: () => S;
    getters?: G;
    actions?: A & ThisType<ActionContext<S, G, A>> & ValidateActions<A>;
}
export type ComputedGetters<G extends Getters<any>> = {
    [K in keyof G]: ReturnType<G[K]>;
};
export interface StoreInstance<S extends State, G extends Getters<S>, A extends object> {
    readonly $name: string;
    readonly $state: S;
    readonly $getters: Readonly<ComputedGetters<G>>;
    readonly $actions: Readonly<A>;
    $patch(partial: Partial<S> | ((state: S) => void)): void;
    $reset(): void;
    $subscribe(callback: SubscriptionCallback<S>, options?: SubscribeOptions): () => void;
    $onAction(callback: ActionCallback, options?: SubscribeOptions): () => void;
    $debug(): StoreDebugInfo<S, G, A>;
    $dispose(): void;
}
export type PublicStore<S extends State, G extends Getters<S>, A extends object> = {
    readonly [K in keyof S]: S[K];
} & {
    readonly [K in keyof ComputedGetters<G>]: ComputedGetters<G>[K];
} & {
    [K in keyof A]: OmitThisParameter<A[K]>;
} & {
    readonly $name: string;
    $patch(partial: Partial<S> | ((state: S) => void)): void;
    $reset(): void;
    $subscribe(callback: SubscriptionCallback<S>, options?: SubscribeOptions): () => void;
    $onAction(callback: ActionCallback, options?: SubscribeOptions): () => void;
    $debug(): StoreDebugInfo<S, G, A>;
};
export interface SubscriptionCallback<S extends State> {
    (mutation: MutationInfo<S>, state: S): void;
}
export interface MutationInfo<_S extends State> {
    type: 'patch' | 'action' | 'reset' | 'direct';
    storeName: string;
    path?: string | undefined;
    value?: any | undefined;
    args?: any[] | undefined;
    actionName?: string | undefined;
    timestamp: number;
}
export interface ActionCallback {
    (info: ActionInfo): void;
}
export interface ActionStartInfo {
    name: string;
    args: any[];
}
export interface ActionInfo {
    name: string;
    storeName: string;
    args: any[];
    after: (callback: (result: any) => void) => void;
    onError: (callback: (error: Error) => void) => void;
}
export interface SubscribeOptions {
    detached?: boolean;
    once?: boolean;
}
export interface StoreDebugInfo<S extends State, G extends Getters<S>, _A extends object> {
    name: string;
    state: S;
    getters: ComputedGetters<G>;
    actionHistory: Array<{
        name: string;
        args: any[];
        timestamp: number;
        result?: any;
        error?: Error;
    }>;
    mutationHistory: MutationInfo<S>[];
    subscriberCount: number;
    actionSubscriberCount: number;
    isDisposed: boolean;
}
export type StoreRegistry = Map<string, StoreInstance<any, any, any>>;
export interface GlobalStore {
    register<S extends State, G extends Getters<S>, A extends object>(options: ModuleOptions<S, G, A>): () => PublicStore<S, G, A>;
    get<T extends PublicStore<any, any, any>>(name: string): T | undefined;
    has(name: string): boolean;
    list(): string[];
    $debug(): GlobalDebugInfo;
    dispose(): void;
}
export interface GlobalDebugInfo {
    stores: Record<string, StoreDebugInfo<any, any, any>>;
    totalStores: number;
    totalSubscribers: number;
    totalActionSubscribers: number;
}
export type UseStore<S extends State, G extends Getters<S>, A extends object> = () => PublicStore<S, G, A>;

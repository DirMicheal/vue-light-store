import type { State, Getters, ModuleOptions, ComputedGetters, StoreInstance, PublicStore, MutationInfo, StoreRegistry, AnyRecordActions } from './types';
export declare class Store<S extends State, G extends Getters<S>, A extends AnyRecordActions> implements StoreInstance<S, G, A> {
    readonly $name: string;
    readonly $state: S;
    readonly $getters: Readonly<ComputedGetters<G>>;
    readonly $actions: Readonly<A>;
    private _state;
    private _initialState;
    private _getters;
    private _actions;
    private _observable;
    private _registry;
    private _actionInProgress;
    private _currentActionName;
    private _disposed;
    private _stopWatchers;
    private _publicAPI;
    private _rawState;
    constructor(options: ModuleOptions<S, G, A>, registry: StoreRegistry);
    private _deepFreezeClone;
    private _deepFreeze;
    private _createComputedGetters;
    private _createBoundActions;
    private _executeAction;
    private _createActionContext;
    private _setupStateProtection;
    $patch(partial: Partial<S> | ((state: S) => void)): void;
    $reset(): void;
    $subscribe(callback: (mutation: MutationInfo<S>, state: S) => void, options?: {
        detached?: boolean;
        once?: boolean;
    }): () => void;
    $onAction(callback: Parameters<StoreInstance<S, G, A>['$onAction']>[0], options?: {
        detached?: boolean;
        once?: boolean;
    }): () => void;
    $debug(): ReturnType<StoreInstance<S, G, A>['$debug']>;
    $dispose(): void;
    toPublicAPI(): PublicStore<S, G, A>;
    get isDisposed(): boolean;
    get actionInProgress(): boolean;
}

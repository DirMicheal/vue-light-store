import type { State, Getters, ActionStartInfo, MutationInfo, ActionInfo, SubscriptionCallback, ActionCallback, SubscribeOptions, StoreDebugInfo, AnyRecordActions } from './types';
export declare class ObservableStore<S extends State, G extends Getters<S>, A extends AnyRecordActions> {
    private storeName;
    private subscribers;
    private actionSubscribers;
    private mutationHistory;
    private actionHistory;
    private maxHistorySize;
    private _isDisposed;
    constructor(storeName: string);
    notifyMutation(mutation: Omit<MutationInfo<S>, 'storeName' | 'timestamp'>, state: S): void;
    notifyAction(action: ActionStartInfo): {
        actionInfo: ActionInfo;
        resolve: (result: any) => void;
        reject: (error: Error) => void;
    };
    subscribe(callback: SubscriptionCallback<S>, options?: SubscribeOptions): () => void;
    onAction(callback: ActionCallback, options?: SubscribeOptions): () => void;
    getDebugInfo(state: S, getters: any): StoreDebugInfo<S, G, A>;
    clearHistory(): void;
    dispose(): void;
    get isDisposed(): boolean;
    get subscriberCount(): number;
    get actionSubscriberCount(): number;
}

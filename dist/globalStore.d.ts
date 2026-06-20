import type { State, Getters, ModuleOptions, PublicStore, GlobalStore, GlobalDebugInfo, UseStore, AnyRecordActions } from './types';
declare class GlobalStoreImpl implements GlobalStore {
    private registry;
    private storeFactories;
    private publicAPICache;
    register<S extends State, G extends Getters<S>, A extends AnyRecordActions>(options: ModuleOptions<S, G, A>): UseStore<S, G, A>;
    get<T extends PublicStore<any, any, any>>(name: string): T | undefined;
    has(name: string): boolean;
    list(): string[];
    $debug(): GlobalDebugInfo;
    dispose(): void;
}
declare const globalStore: GlobalStoreImpl;
export declare function createGlobalStore(): GlobalStore;
export declare function defineStore<S extends State, G extends Getters<S>, A extends AnyRecordActions>(options: ModuleOptions<S, G, A>): UseStore<S, G, A>;
export declare function getStore<T extends PublicStore<any, any, any>>(name: string): T | undefined;
export declare function hasStore(name: string): boolean;
export declare function listStores(): string[];
export declare function debugStores(): GlobalDebugInfo;
export declare function disposeAllStores(): void;
export default globalStore;

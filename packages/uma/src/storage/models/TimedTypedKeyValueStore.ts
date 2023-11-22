import { TimedKeyValueStore } from './TimedKeyValueStore';
import { TypedKeyValueStore } from './TypedKeyValueStore';

/**
 * Combines the methods of the TypedKeyValueStore and TimedKeyValueStore
 */
export type TimedTypedKeyValueStore<M> = TypedKeyValueStore<M> & TimedKeyValueStore<keyof M, M[keyof M]>;

import { KeyValueStore } from './KeyValueStore';

/**
 * Data structure that links a value to a timestamp
 */
export interface TimedValue<V> {
  value: V;
  timestamp: number;
}

export interface TimedKeyValueStore<K, V> extends KeyValueStore<K, V> {

  /**
   * Returns the timestamp at which a given key was latest updated.
   *
   * @param key - Key to check.
   *
   * @returns the timestamp if the key was set, otherwise undefined.
   */
  latestUpdate: (key: K) => Promise<number | undefined>;

  /**
   * Checks whether a value has had an update since the given timestamp.
   *
   * @param key - Key to check.
   * @param time - Time to compare to.
   *
   * @returns A boolean indicating if there was an update, or undefined if the key wasn't set
   */
  hasUpdate: (key: K, time: number) => Promise<boolean | undefined>;

}

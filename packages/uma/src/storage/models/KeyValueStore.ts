/**
 * A simple storage solution that can be used for internal values that need to be stored.
 * In general storages taking objects as keys are expected to work with different instances
 * of an object with the same values. Exceptions to this expectation should be clearly documented.
 */
export interface KeyValueStore<K, V> {

  /**
   * Returns the value stored for the given identifier.
   * `undefined` if no value is stored.
   *
   * @param key - Identifier to get the value for.
   *
   * @returns the value identified by the given key
   */
  get: (key: K) => Promise<V | undefined>;

  /**
   * Checks if there is a value stored for the given key.
   *
   * @param key - Identifier to check.
   *
   * @returns whether the key is in the store
   */
  has: (key: K) => Promise<boolean>;

  /**
   * Sets the value for the given key.
   *
   * @param key - Key to set/update.
   * @param value - Value to store.
   *
   * @returns The storage.
   */
  set: (key: K, value: V) => Promise<this>;

  /**
   * Deletes the value stored for the given key.
   *
   * @param key - Key to delete.
   *
   * @returns If there was a value to delete.
   */
  delete: (key: K) => Promise<boolean>;

  /**
   * An iterable of entries in the storage.
   *
   * @returns the asynchronous iterator
   */
  entries: () => AsyncIterableIterator<[K, V]>;

}

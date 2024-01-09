import clone from 'clone';
import { TimedValue } from './models/TimedKeyValueStore';
import { TimedTypedKeyValueStore } from './models/TimedTypedKeyValueStore';

/**
 * A {@link KeyValueStore} which uses a JavaScript Map for internal storage.
 *
 * @inheritdoc
 */
export class MemoryStore<M> implements TimedTypedKeyValueStore<M> {

  private readonly data: Map<keyof M, TimedValue<M[keyof M]>>;

  /**
   *
   * @param initialData data to initialize the memorystore with @range {json}
   */
  constructor(initialData?: [keyof M, M[keyof M]][]) {

    this.data = new Map(initialData?.map(([ key, value ]) => [ key, { value: clone(value), timestamp: Date.now() } ]));

  }

  get<T extends keyof M>(key: T): Promise<M[T] | undefined> {

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return Promise.resolve(this.data.has(key) ? clone(this.data.get(key)?.value as M[T]) : undefined);

  }

  has<T extends keyof M>(key: T): Promise<boolean> {

    return Promise.resolve(this.data.has(key));

  }

  set<T extends keyof M>(key: T, value: M[T]): Promise<this> {

    this.data.set(key, { value: clone(value), timestamp: Date.now() });

    return Promise.resolve(this);

  }

  delete<T extends keyof M>(key: T): Promise<boolean> {

    return Promise.resolve(this.data.delete(key));

  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async* entries(): AsyncIterableIterator<[keyof M, M[keyof M]]> {

    for (const [ key, value ] of this.data.entries()) {

      yield [ key, clone(value.value) ];

    }

  }

  latestUpdate<T extends keyof M>(key: T): Promise<number | undefined> {

    return Promise.resolve(this.data.get(key)?.timestamp);

  }

  hasUpdate <T extends keyof M>(key: T, time: number): Promise<boolean | undefined> {

    const timedValue = this.data.get(key);

    return Promise.resolve(timedValue ? timedValue.timestamp > time : undefined);

  }

}

import clone from 'clone';
import { KeyValueStore } from './models/KeyValueStore';
import { TypedKeyValueStore } from './models/TypedKeyValueStore';

/**
 * A {@link KeyValueStore} which uses a JavaScript Map for internal storage.
 *
 * @inheritdoc
 */
export class MemoryStore<M> implements TypedKeyValueStore<M> {

  private readonly data: Map<keyof M, M[keyof M]>;

  /**
   *
   * @param initialData data to initialize the memorystore with @range {json}
   */
  constructor(initialData?: [keyof M, M[keyof M]][]) {

    this.data = new Map(initialData?.map(([ key, value ]) => [ key, clone(value) ]));

  }

  public async get<T extends keyof M>(key: T): Promise<M[T] | undefined> {
    return this.data.has(key) ? clone(this.data.get(key) as M[T]) : undefined;
  }

  public async has<T extends keyof M>(key: T): Promise<boolean> {
    return Promise.resolve(this.data.has(key));
  }

  public async set<T extends keyof M>(key: T, value: M[T]): Promise<this> {
    this.data.set(key, clone(value));
    return Promise.resolve(this);
  }

  public async delete<T extends keyof M>(key: T): Promise<boolean> {
    return Promise.resolve(this.data.delete(key));
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async* entries(): AsyncIterableIterator<[keyof M, M[keyof M]]> {
    for (const [ key, value ] of this.data.entries()) {
      yield [ key, clone(value) ];
    }
  }
}

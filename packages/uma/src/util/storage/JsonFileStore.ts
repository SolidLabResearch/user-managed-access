/* eslint-disable no-param-reassign */
import { promises as fsPromises } from 'fs';
import { dirname, isAbsolute, join } from 'path';
import clone from 'clone';
import { TypedKeyValueStore } from './models/TypedKeyValueStore';

/**
 * Uses a JSON file to store key/value pairs.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class JsonFileStore<M extends Record<string, any>> implements TypedKeyValueStore<M> {

  private path: string;

  constructor(path: string) {

    this.path = isAbsolute(path) ? path : join(process.cwd(), path);

  }

  async get<T extends keyof M>(key: T): Promise<M[T] | undefined> {

    const json = await this.getJson();

    return Promise.resolve(json[key]);

  }

  async has<T extends keyof M>(key: T): Promise<boolean> {

    const json = await this.getJson();

    return typeof json[key] !== 'undefined';

  }

  async set<T extends keyof M>(key: T, value: M[T]): Promise<this> {

    return this.updateJson((json: M): this => {

      json[key] = value;

      return this;

    })();

  }

  async delete<T extends keyof M>(key: T): Promise<boolean> {

    return this.updateJson((json: M): boolean => {

      if (typeof json[key] !== 'undefined') {

        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete, no-param-reassign
        delete json[key];

        return true;

      }

      return false;

    })();

  }

  async* entries(): AsyncIterableIterator<[keyof M, M[keyof M]]> {

    const json = await this.getJson();

    for (const [ key, value ] of Object.entries(json)) {

      yield [ key, clone(value) ];

    }

  }

  /**
   * Updates the data in the JSON file.
   *
   * @param updateFn - A function that updates the JSON object.
   *
   * @returns The return value of `updateFn`.
   */
  private updateJson<T>(updateFn: (json: M) => T): () => Promise<T> {

    return async () => {

      const json = await this.getJson();
      const result = updateFn(json);
      // eslint-disable-next-line no-null/no-null
      const updatedText = JSON.stringify(json, null, 2);
      await fsPromises.mkdir(dirname(this.path), { recursive: true });
      await fsPromises.writeFile(this.path, updatedText, 'utf8');

      return result;

    };

  }

  /**
   * Reads and parses the data from the JSON file (without locking).
   */
  private async getJson(): Promise<M> {

    try {

      const text = await fsPromises.readFile(this.path, 'utf8');

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return JSON.parse(text) as M;

      // eslint-disable-next-line padded-blocks
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/dot-notation, @typescript-eslint/no-unsafe-member-access
      if (error && error['syscall'] && error['code'] && error['code'] === 'ENOENT') { return {} as M; }

      throw error;

    }

  }

}

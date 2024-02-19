/* 
 * Copied from https://github.com/woutermont/reType
 *
 * MIT License
 * 
 * Copyright (c) 2023 Wouter Termont
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * 
 */

export type Literal = null | undefined | symbol | boolean | number | bigint | string ;

export type Assertion<T> = (value: unknown) => asserts value is T;

export type ReType = Literal | Assertion<unknown> | { [_: PropertyKey]: ReType };

type _Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

type _Required<R extends { [_: PropertyKey]: ReType }> = {
  [K in keyof R as undefined extends Type<R[K]> ? never : K]: Type<R[K]>
};

type _Optional<R extends { [_: PropertyKey]: ReType }> = {
  [K in keyof R as undefined extends Type<R[K]> ? K : never]?: Type<R[K]>
};

type _Type<R extends ReType> = 
  R extends { [_: PropertyKey]: ReType } ? _Required<R> & _Optional<R> :
  R extends Assertion<infer T> ? T : 
  R;
  
export type Type<R extends ReType> = _Expand<_Type<R>>;

function isIn<T extends object>(key: PropertyKey, object: T): key is keyof T {
  return key in object;
}

export function reType<R extends ReType>(value: unknown, assertion: R): asserts value is Type<R> {
  switch (typeof assertion) {
    case 'function': return assertion(value); 
    case 'object': if (assertion !== null) {
      if (typeof value !== 'object' || value === null) throw new Error('value is not an object');
      
      const assertionKeys: (string | symbol)[] = [] as const;
      assertionKeys.push(...Object.getOwnPropertyNames(assertion));
      assertionKeys.push(...Object.getOwnPropertySymbols(assertion));
      assertionKeys.forEach(key => reType(isIn(key, value) ? value[key] : undefined, assertion[key]));

      break; 
    }
    default: if (value !== assertion) throw new Error(`value is not equal to ${String(assertion)}`);
  }
}

export function isType<R extends ReType>(value: unknown, assertion: R): value is Type<R> {
  if (typeof assertion === 'function') {
    try {
      (assertion as (_: unknown) => void)(value)
      return true;
    } catch {
      return false;
    }
  }
  return value === assertion;
}

export const any: Assertion<any> = () => {};
export const unknown: Assertion<unknown> = () => {};
export const never: Assertion<never> = () => { throw new Error() };

const primitive = (name: string) => (value: unknown) => { 
  if (typeof value !== name) throw new Error(`value is not a ${name}`);
};

export const symbol: Assertion<symbol> = primitive('symbol');
export const boolean: Assertion<boolean> = primitive('boolean');
export const number: Assertion<number> = primitive('number');
export const bigint: Assertion<bigint> = primitive('bigint');
export const string: Assertion<string> = primitive('string');

export const instance = <P extends any> (prototype: P): Assertion<P> => {
  return (value: unknown): asserts value is P => {
    if (value instanceof (prototype as any)) return;
    throw new Error(`value is not an instance of ${prototype}`);
  };
};

export const array = <E extends ReType> (element: E): Assertion<Type<E>[]> => {
  return (value: unknown): asserts value is Type<E>[] => {
    if (!Array.isArray(value)) throw new Error('value is not an array');
    value.forEach((e: unknown) => reType(e, element));
  };
};

export const empty: Assertion<[]> = (value: unknown): asserts value is [] => {
  if (Array.isArray(value) && value.length === 0) return;
  throw new Error('value is not the empty array');
};

type Tuple<Ts extends ReType[], Acc extends unknown[] = []> = 
  Ts extends [infer F extends ReType, ...infer R extends ReType[]] ? Tuple<R, [...Acc, Type<F>]> : Acc;

type Intersection<Ts extends ReType[], Acc extends unknown = unknown> = 
  Ts extends [infer F extends ReType, ...infer R extends ReType[]] ? Intersection<R, Acc & Type<F>> : Acc;

type Union<Ts extends ReType[], Acc extends unknown = never> = 
  Ts extends [infer F extends ReType, ...infer R extends ReType[]] ? Union<R, Acc | Type<F>> : Acc;

export const tuple = <Ts extends ReType[]> (...types: Ts): Assertion<Tuple<Ts>> => {
  return (value: unknown): asserts value is Tuple<Ts> => {
    if (!Array.isArray(value)) throw new Error('value is not a tuple');
    if (value.length !== types.length) throw new Error('value has wrong length');
    value.forEach((e: unknown, i: number) => reType(e, types[i]));
  }
};

export const intersection = <Ts extends ReType[]> (...types: Ts): Assertion<Intersection<Ts>> => {
  return (value: unknown): asserts value is Intersection<Ts> => {
    types.forEach(t => reType(value, t));
  }
};

export const union = <Ts extends ReType[]> (...types: Ts): Assertion<Union<Ts>> => {
  return (value: unknown): asserts value is Union<Ts> => {
    for (const t of types) try {
      reType(value, t);
      return;
    } catch {
      continue;
    }
    throw new Error('value is neither of the union types');
  }
};

export const optional = <T extends ReType> (pattern: T): Assertion<Union<[T, undefined]>> => {
  return union<[T, undefined]>(pattern, undefined);
}

export const record = <
  K extends Assertion<PropertyKey>,
  V extends ReType
> (k: K, v: V): Assertion<Record<Type<K>, V>> => {
  return (value: unknown): asserts value is Record<Type<K>, V> => {
    if (typeof value !== 'object' || value === null) throw new Error('value is not a record');
    
    const keys: (string | symbol)[] = [] as const;
    keys.push(...Object.getOwnPropertyNames(value));
    keys.push(...Object.getOwnPropertySymbols(value));
    keys.forEach(key => {
      reType(key, k);
      reType(isIn(key, value) ? value[key] : undefined, v);
    });
  }
}

export const dict = <T extends ReType> (records: T): Assertion<NodeJS.Dict<Type<T>>> => {
  return record(string, records);
}

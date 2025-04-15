import { parse, stringify } from 'node:querystring';

/**
 * Converts a x-www-form-urlencoded string to a JSON object.
 */
export function formToJson(form: string): unknown {
  return parse(form);
}

/**
 * Converts a JSON object to a x-www-form-urlencoded, if possible.
 */
export function jsonToForm(json: unknown): string {
  if (typeof json !== 'object' || json === null) {
    throw new Error('Can only convert JSON objects to urlencoded string.');
  }

  for (const val of Object.values(json)) {
    if (Array.isArray(val)) {
      if (!val.every(isPrimitive)) {
        throw new Error('Can only convert JSON objects with primitives or arrays of primitives to urlencoded string.');
      }
    } else if (!isPrimitive(val)) {
      throw new Error('Can only convert JSON objects with primitives or arrays of primitives to urlencoded string.');
    }
  }

  return stringify(json as Record<string, string | string[]>);
}

/**
 * Checks if the input is a string, number, or boolean.
 */
export function isPrimitive(val: unknown): val is string | number | boolean {
  return typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean';
}

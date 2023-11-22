/**
 * Is value a string
 * @param {any} value - value to be checked
 * @return {boolean} - true if value is a string
 */
export function isString(value: any): value is string {
  return typeof value === 'string' || value instanceof String;
}

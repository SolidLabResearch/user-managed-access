import {isString} from './StringGuard';

export type UrlString = string;

/**
 * Is this string a valid URL?
 *
 * @param {any} value - potential URL
 * @return {boolean} - true if is a string
 */
export function isUrlString(value: any): value is UrlString {
  return isString(value) && isValidHttpUrl(value);
}

/**
 * Checks whether a string value is an HTTP URL
 * @param {string} value
 * @return {boolean}
 */
function isValidHttpUrl(value: string ): boolean {
  let url;

  try {
    url = new URL(value);
  } catch (_) {
    return false;
  }

  return url.protocol === 'http:' || url.protocol === 'https:';
}

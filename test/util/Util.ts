import { KeyValueStorage } from '@solid/community-server';
import { UmaConfig } from '@solidlab/uma-css';
import { Mocked } from 'vitest';


/**
 * This is needed when you want to wait for all promises to resolve.
 * Also works when using vi.useFakeTimers().
 * For more details see the links below
 *  - https://github.com/facebook/jest/issues/2157
 *  - https://stackoverflow.com/questions/52177631/jest-timer-and-promise-dont-work-well-settimeout-and-async-function
 */
export async function flushPromises(): Promise<void> {
  return new Promise((await vi.importActual('timers')).setImmediate as any);
}

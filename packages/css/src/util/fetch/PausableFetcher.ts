import EventEmitter from 'events';
import { getLoggerFor } from 'global-logger-factory';
import type { Fetcher, FetchParams } from './Fetcher';
import type { StatusDependant } from './StatusDependant';

const PROCESS = Symbol();

/**
 * A {@link Fetcher} wrapper that is {@link StatusDependant},
 * enabling requests to be backlogged during inactive periods.
 */
export class PausableFetcher implements Fetcher, StatusDependant<boolean> {
  protected readonly logger = getLoggerFor(this);
  protected readonly backlog: EventEmitter[] = [];
  protected active = false;
  protected processing = false;

  constructor(
    protected readonly fetcher: Fetcher,
  ) {}

  async fetch(...args: FetchParams): Promise<Response> {
    const trigger = new EventEmitter();
    const result = new Promise<Response>(resolve => {
      trigger.on(PROCESS, () => {
        this.fetcher.fetch(...args).then(response => resolve(response))
      })
    });

    this.backlog.push(trigger);
    this.tryProcess();

    return result;
  }

  async changeStatus(active: boolean): Promise<void> {
    this.active = active;
    this.tryProcess();
  }

  private tryProcess(): void {
    if (this.active && !this.processing) this.process();
  }

  private process(): void {
    this.processing = true;

    while (this.backlog.length > 0) {
      if (!this.active) break;
      this.backlog.shift()?.emit(PROCESS);
    }

    this.processing = false;
  }
}

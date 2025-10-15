import { ServerConfigurator } from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';
import type { Server } from 'node:http';
import type { StatusDependant } from './StatusDependant';

/**
 * A {@link ServerConfigurator} that maps events of a {@link Server} so a status,
 * and sets this status on each of the configured {@link StatusDependant}.
 */
export class StatusDependantServerConfigurator<T> extends ServerConfigurator {
  protected readonly logger = getLoggerFor(this);

  public constructor(
    protected dependants: StatusDependant<T>[],
    protected readonly statusMap: Record<string, T>,
  ) { super() }

  public async handle(server: Server): Promise<void> {
    for (const event of Object.keys(this.statusMap)) {
      server.on(event, async () => {
        for (const dep of this.dependants) {
          dep.changeStatus(this.statusMap[event])
        }
      });
    }
  }
}

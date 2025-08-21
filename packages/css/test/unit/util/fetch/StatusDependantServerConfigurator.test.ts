import { EventEmitter } from 'events';
import { StatusDependant } from '../../../../src/util/fetch/StatusDependant';
import { StatusDependantServerConfigurator } from '../../../../src/util/fetch/StatusDependantServerConfigurator';

describe('StatusDependantServerConfigurator', (): void => {
  const statusMap = {
    on: true,
    off: false,
  };
  let dependants: StatusDependant<any>[];
  let configurator: StatusDependantServerConfigurator<any>;

  beforeEach(async(): Promise<void> => {
    dependants = [
      { changeStatus: vi.fn() },
      { changeStatus: vi.fn() }
    ];

    configurator = new StatusDependantServerConfigurator(dependants, statusMap);
  });

  it('calls the dependants with the correct status.', async(): Promise<void> => {
    const server = new EventEmitter();
    await expect(configurator.handle(server as any)).resolves.toBeUndefined();
    expect(dependants[0].changeStatus).toHaveBeenCalledTimes(0);
    expect(dependants[1].changeStatus).toHaveBeenCalledTimes(0);

    server.emit('on');
    expect(dependants[0].changeStatus).toHaveBeenCalledTimes(1);
    expect(dependants[1].changeStatus).toHaveBeenCalledTimes(1);
    expect(dependants[0].changeStatus).toHaveBeenLastCalledWith(true);
    expect(dependants[1].changeStatus).toHaveBeenLastCalledWith(true);

    server.emit('off');
    expect(dependants[0].changeStatus).toHaveBeenCalledTimes(2);
    expect(dependants[1].changeStatus).toHaveBeenCalledTimes(2);
    expect(dependants[0].changeStatus).toHaveBeenLastCalledWith(false);
    expect(dependants[1].changeStatus).toHaveBeenLastCalledWith(false);

    server.emit('other');
    expect(dependants[0].changeStatus).toHaveBeenCalledTimes(2);
    expect(dependants[1].changeStatus).toHaveBeenCalledTimes(2);
  });
});

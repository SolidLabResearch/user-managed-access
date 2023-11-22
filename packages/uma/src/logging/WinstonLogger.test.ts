import {Logger} from 'winston';
import {mock} from 'jest-mock-extended';
import {LoggerLevel} from './logger';
import {WinstonLogger} from './WinstonLogger';

let testLogger: Logger;

jest.mock('winston', () => ({
  createLogger: jest.fn().mockImplementation(() => {
    testLogger = mock<Logger>();

    return testLogger;
  }),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    printf: jest.fn(),
    colorize: jest.fn(),
  },
  transports: {
    File: jest.fn(),
    Stream: jest.fn(),
    Console: jest.fn(),
  },
}));

describe('WinstonLogger', () => {
  let logger: WinstonLogger;
  const spy = new Map();

  beforeEach(async () => {
    logger = new WinstonLogger('test-logger', 60, 30);
  });

  afterEach(() => {
    // clear spies
    jest.clearAllMocks();

    for (const value of Object.values(spy)) {
      value.mockReset();
    }
  });

  it('should be correctly instantiated', () => {
    expect(logger).toBeTruthy();
  });
  const testMessage = 'TestMessage';
  const data = {data: 'data'};

  it('Should call logger with printData', () => {
    logger.log(LoggerLevel.info, testMessage, data);
    expect(testLogger.log).toHaveBeenCalledTimes(1);

    expect(testLogger.log).toHaveBeenCalledWith({
      data,
      level: 'info',
      message: testMessage,
      printData: true,
      typeName: 'test-logger',
    });
  });

  it('Should call logger without printData', () => {
    logger.log(LoggerLevel.debug, testMessage, data);
    expect(testLogger.log).toHaveBeenCalledTimes(1);

    expect(testLogger.log).toHaveBeenCalledWith({
      data,
      level: 'debug',
      message: testMessage,
      printData: false,
      typeName: 'test-logger',
    });
  });

  it('Should not print data when printData is false', () => {
    expect(logger.formatLog({data,
      timestamp: '2022-04-18T08:40:43.595Z',
      level: 'debug',
      message: testMessage,
      printData: false,
      typeName: 'test-logger'})).toEqual('2022-04-18T08:40:43.595Z [test-logger] debug: TestMessage');
  });

  it('Should print data when printData is true', () => {
    expect(logger.formatLog({data,
      timestamp: '2022-04-18T08:40:43.595Z',
      level: 'debug',
      message: testMessage,
      printData: true,
      typeName: 'test-logger'})).toEqual('2022-04-18T08:40:43.595Z [test-logger] debug: '+
      'TestMessage\n{ data: \'data\' }');

    expect(logger.formatLog({undefined,
      timestamp: '2022-04-18T08:40:43.595Z',
      level: 'debug',
      message: testMessage,
      printData: true,
      typeName: 'test-logger'})).toEqual('2022-04-18T08:40:43.595Z [test-logger] debug: '+
        'TestMessage');
  });
});

/* eslint-disable require-jsdoc */
import {getLoggerFor} from './LoggerUtils';
import {WinstonLogger} from './WinstonLogger';

test('It should return a Winston logger for string loggable', () =>{
  const logger = getLoggerFor('example');
  expect(logger).toBeTruthy();
  expect(typeof logger).toEqual('object');
  expect(logger instanceof WinstonLogger).toBeTruthy();
});

class Example {
  constructor() {
  }
}

test('It should return a Winston logger for class loggable', () =>{
  const logger = getLoggerFor(new Example());
  expect(logger).toBeTruthy();
  expect(typeof logger).toEqual('object');
  expect(logger instanceof WinstonLogger).toBeTruthy();
});

import * as path from 'path';
import { ComponentsManager } from 'componentsjs';
import { NodeHttpServer } from './http/server/NodeHttpServer';
import { setLogger } from './logging/LoggerUtils';
import { WinstonLogger } from './logging/WinstonLogger';

const umaPort = 4000;
const protocol = 'http';
const host = 'localhost';

export const launch: () => Promise<void> = async () => {
  const variables: Record<string, any> = {};

  variables['urn:uma:variables:port'] = umaPort;
  variables['urn:uma:variables:host'] = host;
  variables['urn:uma:variables:protocol'] = protocol;
  variables['urn:uma:variables:baseUrl'] = `${protocol}://${host}:${umaPort}/uma`;

  variables['urn:uma:variables:mainModulePath'] = path.join(__dirname, '../');
  variables['urn:uma:variables:customConfigPath'] = path.join(__dirname, '../config/default.json');

  const mainModulePath = variables['urn:uma:variables:mainModulePath'];
  const configPath = variables['urn:uma:variables:customConfigPath'];

  setLogger(new WinstonLogger('test-logger', 60, 30));

  const manager = await ComponentsManager.build({
    mainModulePath,
    logLevel: 'silly',
    typeChecking: false,
  });

  await manager.configRegistry.register(configPath);

  const umaServer: NodeHttpServer = await manager.instantiate('urn:uma:default:NodeHttpServer',{variables});
  umaServer.start();

};

launch();

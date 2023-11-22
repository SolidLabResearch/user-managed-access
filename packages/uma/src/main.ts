import * as path from 'path';
import {ComponentsManager} from 'componentsjs';
import {NodeHttpServer} from './http/server/NodeHttpServer';
import {setLogger} from './logging/LoggerUtils';
import {WinstonLogger} from './logging/WinstonLogger';

const umaPort = 4000;
const protocol = 'http';
const host = 'localhost';
export const launch: () => Promise<void> =
async () => {
  const variables: Record<string, any> = {};

  variables['urn:authorization-service:variables:port'] = umaPort;
  variables['urn:authorization-service:variables:host'] = host;
  variables['urn:authorization-service:variables:protocol'] = protocol;
  variables['urn:authorization-service:variables:baseUrl'] = `${protocol}://${host}:${umaPort}/uma`;

  variables['urn:authorization-service:variables:mainModulePath'] = path.join(__dirname, '../');
  // will return all access modes always
  variables['urn:authorization-service:variables:customConfigPath'] = path.join(__dirname, '../config/debug.json');
  // follows Solid Application Interop spec
  // variables['urn:authorization-service:variables:customConfigPath'] = path.join(__dirname, '../config/default.json');

  const mainModulePath = variables['urn:authorization-service:variables:mainModulePath'];

  const configPath = variables['urn:authorization-service:variables:customConfigPath'];

  setLogger(new WinstonLogger('test-logger', 60, 30));
  const manager = await ComponentsManager.build({
    mainModulePath,
    logLevel: 'silly',
    typeChecking: false,
  });

  await manager.configRegistry.register(configPath);

  const umaServer: NodeHttpServer = await
  manager.instantiate('urn:authorization-service:default:NodeHttpServer',
      {variables});
  //   const aaServer: NodeHttpServer = await manager.instantiate('urn:authorization-agent:default:NodeHttpServer',
    //   {variables});
  umaServer.start();
//   aaServer.start();
};

launch();

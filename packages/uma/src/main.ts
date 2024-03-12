import * as fs from 'fs';
import * as path from 'path';
import { ComponentsManager } from 'componentsjs';
import { NodeHttpServer } from './util/http/server/NodeHttpServer';
import { setLogger } from './util/logging/LoggerUtils';
import { WinstonLogger } from './util/logging/WinstonLogger';
import { ResponseType } from './routes/Config';
import { ASYMMETRIC_CRYPTOGRAPHIC_ALGORITHM } 
  from '@solid/access-token-verifier/dist/constant/ASYMMETRIC_CRYPTOGRAPHIC_ALGORITHM';

const protocol = 'http';
const host = 'localhost';
const port = 4000;

const baseUrl = `${protocol}://${host}:${port}/uma`;
const rootDir = path.join(__dirname, '../');

export const launch: () => Promise<void> = async () => {

  const variables: Record<string, any> = {};

  variables['urn:uma:variables:port'] = port;
  variables['urn:uma:variables:host'] = host;
  variables['urn:uma:variables:protocol'] = protocol;
  variables['urn:uma:variables:baseUrl'] = baseUrl;
  
  variables['urn:uma:variables:policyDir'] = path.join(rootDir, './config/rules/policy');

  variables['urn:uma:variables:mainModulePath'] = rootDir;
  variables['urn:uma:variables:customConfigPath'] = path.join(rootDir, './config/default.json');

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

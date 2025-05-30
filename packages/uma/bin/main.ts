import * as path from 'path';
import { ComponentsManager } from 'componentsjs';
import { ServerInitializer, setGlobalLoggerFactory, WinstonLoggerFactory } from '@solid/community-server';

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
  variables['urn:uma:variables:rulesDir'] = path.join(rootDir, './config/rules/n3');

  variables['urn:uma:variables:mainModulePath'] = rootDir;
  variables['urn:uma:variables:customConfigPath'] = path.join(rootDir, './config/default.json');

  const mainModulePath = variables['urn:uma:variables:mainModulePath'];
  const configPath = variables['urn:uma:variables:customConfigPath'];

  setGlobalLoggerFactory(new WinstonLoggerFactory('info'));

  const manager = await ComponentsManager.build({
    mainModulePath,
    logLevel: 'silly',
    typeChecking: false,
  });

  await manager.configRegistry.register(configPath);

  const umaServer: ServerInitializer = await manager.instantiate('urn:uma:default:NodeHttpServer',{variables});
  await umaServer.handleSafe();

};

launch();

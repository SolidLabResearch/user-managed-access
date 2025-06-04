import * as path from 'path';
import { ComponentsManager } from 'componentsjs';
import { ServerInitializer, setGlobalLoggerFactory, WinstonLoggerFactory } from '@solid/community-server';

const protocol = 'http';
const host = 'localhost';
const port = 4000;

const baseUrl = `${protocol}://${host}:${port}/uma`;
const rootDir = path.join(__dirname, '../');

export const launch: () => Promise<void> = async () => {
  const variables: Record<string, unknown> = {};

  variables['urn:uma:variables:port'] = port;
  variables['urn:uma:variables:baseUrl'] = baseUrl;

  // variables['urn:uma:variables:policyDir'] = path.join(rootDir, './config/rules/policy');
  variables['urn:uma:variables:eyePath'] = 'eye';

  const configPath = path.join(rootDir, './config/demo.json');

  setGlobalLoggerFactory(new WinstonLoggerFactory('info'));

  const manager = await ComponentsManager.build({
    mainModulePath: rootDir,
    logLevel: 'silly',
    typeChecking: false,
  });

  await manager.configRegistry.register(configPath);

  const umaServer: ServerInitializer = await manager.instantiate('urn:uma:default:NodeHttpServer',{variables});
  await umaServer.handleSafe();
};

launch();

const path = require('path');
const { ComponentsManager } = require('componentsjs');
const { setGlobalLoggerFactory, WinstonLoggerFactory } = require('global-logger-factory');

const protocol = 'http';
const host = 'localhost';
const port = 4000;

const baseUrl = `${protocol}://${host}:${port}/uma`;
const rootDir = path.join(__dirname, '../');

const launch = async () => {
  const variables = {};

  variables['urn:uma:variables:port'] = port;
  variables['urn:uma:variables:baseUrl'] = baseUrl;

  // variables['urn:uma:variables:policyDir'] = path.join(rootDir, './config/rules/policy');
  variables['urn:uma:variables:policyContainer'] = 'http://localhost:3000/settings/policies/';
  variables['urn:uma:variables:eyePath'] = 'eye';
  variables['urn:uma:variables:backupFilePath'] = '';

  const configPath = path.join(rootDir, './config/demo.json');

  setGlobalLoggerFactory(new WinstonLoggerFactory('info'));

  const manager = await ComponentsManager.build({
    mainModulePath: rootDir,
    logLevel: 'silly',
    typeChecking: false,
  });

  await manager.configRegistry.register(configPath);

  const umaServer = await manager.instantiate('urn:uma:default:App',{variables});
  await umaServer.start();
};

launch();

const path = require('path');
const { ComponentsManager } = require('componentsjs');
const { setGlobalLoggerFactory, WinstonLoggerFactory } = require('@solid/community-server');

const port = process.env.UMA_DEMO_PORT ?? 4000;
const policiesUrl = process.env.UMA_DEMO_POLICIES ?? 'http://localhost:3000/settings/policies/';

const baseUrl = process.env.UMA_DEMO_BASE ?? `http://localhost:${port}/uma`;
const rootDir = path.join(__dirname, '../');

const launch = async () => {
  const variables = {};

  variables['urn:uma:variables:port'] = port;
  variables['urn:uma:variables:baseUrl'] = baseUrl;

  // variables['urn:uma:variables:policyDir'] = path.join(rootDir, './config/rules/policy');
  variables['urn:uma:variables:policyContainer'] = policiesUrl;
  variables['urn:uma:variables:eyePath'] = 'eye';

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

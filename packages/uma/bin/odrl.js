const path = require('path');
const { ComponentsManager } = require('componentsjs');
const { setGlobalLoggerFactory, WinstonLoggerFactory } = require('@solid/community-server');

const protocol = 'http';
const host = 'localhost';
const port = 4000;

const baseUrl = `${protocol}://${host}:${port}/uma`;
const rootDir = path.join(__dirname, '../');

const launch = async () => {
    const variables = {};

    variables['urn:uma:variables:port'] = port;
    variables['urn:uma:variables:baseUrl'] = baseUrl;

    variables['urn:uma:variables:policyBaseIRI'] = 'http://localhost:3000/';
    variables['urn:uma:variables:policyDir'] = path.join(rootDir, './config/rules/odrl');
    variables['urn:uma:variables:eyePath'] = 'eye';

    const configPath = path.join(rootDir, './config/odrl.json');

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

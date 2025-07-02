import { App, setGlobalLoggerFactory, WinstonLoggerFactory } from '@solid/community-server';
import * as path from 'path';
import { ComponentsManager } from 'componentsjs';

const protocol = 'http';
const host = 'localhost';
const port = 4000;

const baseUrl = `${protocol}://${host}:${port}/uma`;
const rootDir = path.join(__dirname, '../');

export const launch: () => Promise<void> = async () => {
    const variables: Record<string, any> = {};

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

    const umaServer: App = await manager.instantiate('urn:uma:default:App',{variables});
    await umaServer.start();
};

launch();

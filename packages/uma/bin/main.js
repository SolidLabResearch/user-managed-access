const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { ComponentsManager } = require('componentsjs');
const { setGlobalLoggerFactory, WinstonLoggerFactory } = require('global-logger-factory');

const argv = yargs(hideBin(process.argv))
  .option('port', {
    alias: 'p',
    type: 'number',
    description: 'Port number for the UMA server',
    default: 4000
  })
  .option('baseUrl', {
    alias: 'b',
    type: 'string',
    description: 'Base URL for the UMA server',
  })
  .option('loggingLevel', {
    alias: 'l',
    type: 'string',
    description: 'Log level for the UMA server',
    default: 'info'
  })
  .help()
  .alias('help', 'h')
  .argv;

const port = argv.port;
const baseUrl = argv.baseUrl || `http://localhost:${port}/uma`;
const rootDir = path.join(__dirname, '../');

const launch = async () => {
  const variables = {};

  variables['urn:uma:variables:port'] = port;
  variables['urn:uma:variables:baseUrl'] = baseUrl;

  variables['urn:uma:variables:policyBaseIRI'] = 'http://localhost:3000/';
  variables['urn:uma:variables:policyDir'] = path.join(rootDir, './config/rules/policy');
  variables['urn:uma:variables:eyePath'] = 'eye';
  variables['urn:uma:variables:backupFilePath'] = 'backup.ttl';

  const configPath = path.join(rootDir, './config/default.json');

  setGlobalLoggerFactory(new WinstonLoggerFactory(argv.logLevel || 'info'));

  const manager = await ComponentsManager.build({
    mainModulePath: rootDir,
    logLevel: argv.logLevel || 'silly',
    typeChecking: false,
  });

  await manager.configRegistry.register(configPath);

  const umaServer = await manager.instantiate('urn:uma:default:App',{variables});
  await umaServer.start();
};

launch();

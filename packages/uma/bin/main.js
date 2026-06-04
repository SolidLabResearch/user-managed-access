const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { ComponentsManager } = require('componentsjs');
const { setGlobalLoggerFactory, WinstonLoggerFactory } = require('global-logger-factory');

const rootDir = path.join(__dirname, '../');

const argv = yargs(hideBin(process.argv))
  .option('config', {
    alias: 'c',
    type: 'string',
    array: true,
    description: 'Components.js configuration file path(s)',
    default: [path.join(rootDir, './config/default.json')]
  })
  .option('port', {
    alias: 'p',
    type: 'number',
    description: 'Port number for the UMA server',
    default: 4000
  })
  .option('baseUrl', {
    alias: 'b',
    type: 'string',
    description: 'Base URL for the UMA server. Defaults to http://localhost:$PORT/uma',
  })
  .option('loggingLevel', {
    alias: 'l',
    type: 'string',
    description: 'Log level for the UMA server',
    default: 'info'
  })
  .option('backupFilePath', {
    alias: 'f',
    type: 'string',
    description: 'Backup file path for the UMA server',
    default: ''
  })
  .help()
  .alias('help', 'h')
  .argv;

const launch = async () => {
  const variables = {};

  variables['urn:uma:variables:port'] = argv.port;
  variables['urn:uma:variables:baseUrl'] = argv.baseUrl ?? `http://localhost:${argv.port}/uma`;
  variables['urn:uma:variables:backupFilePath'] = argv.backupFilePath;
  // Debug edge case for demo config
  variables['urn:uma:variables:policyContainer'] = 'http://localhost:3000/settings/policies/';

  setGlobalLoggerFactory(new WinstonLoggerFactory(argv.loggingLevel));

  const manager = await ComponentsManager.build({
    mainModulePath: rootDir,
    logLevel: argv.loggingLevel,
    typeChecking: false,
  });

  for (const configPath of argv.config) {
    await manager.configRegistry.register(configPath);
  }

  const umaServer = await manager.instantiate('urn:uma:default:App',{variables});
  await umaServer.start();
};

launch();

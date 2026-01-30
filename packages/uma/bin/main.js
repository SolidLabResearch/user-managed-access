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
    default: `http://localhost:${argv.port}/uma`
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

const rootDir = path.join(__dirname, '../');

const launch = async () => {
  const variables = {};

  variables['urn:uma:variables:port'] = argv.port;
  variables['urn:uma:variables:baseUrl'] = argv.baseUrl;
  variables['urn:uma:variables:eyePath'] = 'eye';
  variables['urn:uma:variables:backupFilePath'] = argv.backupFilePath;

  const configPath = path.join(rootDir, './config/default.json');

  setGlobalLoggerFactory(new WinstonLoggerFactory(argv.loggingLevel));

  const manager = await ComponentsManager.build({
    mainModulePath: rootDir,
    logLevel: argv.loggingLevel,
    typeChecking: false,
  });

  await manager.configRegistry.register(configPath);

  const umaServer = await manager.instantiate('urn:uma:default:App',{variables});
  await umaServer.start();
};

launch();

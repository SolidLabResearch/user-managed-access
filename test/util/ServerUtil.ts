import { App } from '@solid/community-server';
import { ComponentsManager, IModuleState } from 'componentsjs';
import * as path from 'node:path';


const portNames = [
  'AccessRequests',
  'Aggregation',
  'AggregationSource',
  'Base',
  'Demo',
  'ODRL',
  'OIDC',
  'Policies',
] as const;

export function getPorts(name: typeof portNames[number]): [ number, number ] {
  const idx = portNames.indexOf(name);
  // Just in case something doesn't listen to the typings
  if (idx < 0) {
    throw new Error(`Unknown port name ${name}`);
  }
  // 6000 is a bad port, causing node v18+ to block fetch requests targeting such a URL
  // https://fetch.spec.whatwg.org/#port-blocking
  return [ 6000 + idx + 1, 6100 + idx + 1 ];
}

let cachedModuleState: IModuleState;
/**
 * Returns a component instantiated from a Components.js configuration.
 */
export async function instantiateFromConfig(
  componentUrl: string,
  configPaths: string | string[],
  variables?: Record<string, unknown>,
): Promise<App> {
  // Initialize the Components.js loader
  const mainModulePath = path.join(__dirname, '../../');
  const manager = await ComponentsManager.build<App>({
    mainModulePath,
    logLevel: 'error',
    moduleState: cachedModuleState,
    typeChecking: false,
  });
  cachedModuleState = manager.moduleState;

  if (!Array.isArray(configPaths)) {
    configPaths = [ configPaths ];
  }

  // Instantiate the component from the config(s)
  for (const configPath of configPaths) {
    await manager.configRegistry.register(configPath);
  }
  return manager.instantiate(componentUrl, { variables });
}

export function getDefaultCssVariables(port: number, baseUrl?: string): Record<string, any> {
  return {
    'urn:solid-server:default:variable:baseUrl': baseUrl ?? `http://localhost:${port}/`,
    'urn:solid-server:default:variable:port': port,
    'urn:solid-server:default:variable:socket': null,
    'urn:solid-server:default:variable:loggingLevel': 'off',
    'urn:solid-server:default:variable:showStackTrace': true,
    'urn:solid-server:default:variable:seedConfig': null,
    'urn:solid-server:default:variable:workers': 1,
    'urn:solid-server:default:variable:confirmMigration': false,
  };
}

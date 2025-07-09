import { ComponentsManager, IModuleState } from 'componentsjs';
import * as path from 'node:path';

let cachedModuleState: IModuleState;

/**
 * Returns a component instantiated from a Components.js configuration.
 */
export async function instantiateFromConfig(
  componentUrl: string,
  configPaths: string | string[],
  variables?: Record<string, unknown>,
): Promise<unknown> {
  // Initialize the Components.js loader
  const mainModulePath = path.join(__dirname, '../../');
  const manager = await ComponentsManager.build({
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

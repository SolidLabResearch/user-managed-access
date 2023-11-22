
export interface Permission {
    resource_id: string;
    resource_scopes: string[];
}

/**
 *
 * @param {unknown} permissions
 * @return {void}
 */
export function assertPermissions(permissions: unknown): asserts permissions is Permission[] {
  if (!Array.isArray(permissions)) throw new Error('Permissions is not an array.');
  for (const permission of permissions) {
    const {resource_id: resource, resource_scopes: scopes} = permission;

    if (typeof resource !== 'string') {
      throw new Error('Permissions must contain a "resource_id" string.');
    }

    if (!scopes || !Array.isArray(scopes)) {
      throw new Error('Permissions must contain a "resource_scopes" array.');
    }

    for (const scope of scopes) {
      if (typeof scope !== 'string') {
        throw new Error('Permission scopes must be strings.');
      }
    }

    // TODO: check if scopes are applicable to resource
  }
}

import { AccessMap, AuxiliaryStrategy, ModesExtractor, Operation } from '@solid/community-server';

/**
 * When targeting an auxiliary resource,
 * this class will set the subject resource as the target instead.
 *
 * Below is some context on why this class is needed, compared to how permissions are done in the CSS.
 * There are 2 major components for permissions: a `ModesExtractor`,
 * which determines which permissions are needed to perform a certain operation on a resource,
 * and a `PermissionReader`, which determines which permissions are allowed (based on credentials) on that resource.
 * The `Authorizer` then checks if these match.
 * The Solid protocol defines that if you have access to a resource, you have access to its auxiliary resources.
 * The default CSS implementation handles this by extracting modes with the auxiliary resource as target,
 * and having a permission reader that is smart enough
 * to know it has to check the subject resource for the actual permissions.
 *
 * The above cannot work with the UMA setup, or at least not with how the other related components are implemented.
 * With UMA, the Resource Server extracts the modes, and then sends the result to the Authorization Server.
 * In the case of auxiliary resources, this means it sends the identifier of the auxiliary resource.
 * The Authorization server does not know that the permissions of the subject resource should be used,
 * so this would require having policies for auxiliary resources as well,
 * which is not ideal.
 * In case you do want to have separate policies for those, this class should be removed from the configuration.
 */
export class AuxiliaryModesExtractor extends ModesExtractor {
  public constructor(
    protected readonly source: ModesExtractor,
    protected readonly auxiliaryStrategy: AuxiliaryStrategy,
  ) {
    super();
  }

  public async canHandle(input: Operation): Promise<void> {
    return this.source.canHandle(input);
  }

  public async handle(input: Operation): Promise<AccessMap> {
    const result = await this.source.handle(input);
    const keys = [ ...result.distinctKeys() ];
    for (const key of keys) {
      if (this.auxiliaryStrategy.isAuxiliaryIdentifier(key) && !this.auxiliaryStrategy.usesOwnAuthorization(key)) {
        result.set(this.auxiliaryStrategy.getSubjectIdentifier(key), result.get(key)!);
        result.delete(key);
      }
    }
    return result;
  }
}

import { array, string, Type } from '../util/ReType';

export const DERIVATION_CREATION_SCOPE = 'urn:knows:uma:scopes:derivation-creation';
export const DERIVATION_MANAGEMENT_SCOPE = 'urn:knows:uma:scopes:derivation-management';
export const DERIVATION_ACCESS_CLAIM_TYPE = 'https://w3id.org/aggregator#derivation-access';
export const ACCESS_TOKEN_CLAIM_FORMAT = 'urn:ietf:params:oauth:token-type:access_token';

export const DerivedFrom = {
  issuer: string,
  derivation_resource_id: string,
};

export type DerivedFrom = Type<typeof DerivedFrom>;

export const DerivationRequiredClaim = {
  claim_type: string,
  claim_token_format: string,
  issuer: string,
  derivation_resource_id: string,
  resource_scopes: array(string),
};

export type DerivationRequiredClaim = Type<typeof DerivationRequiredClaim>;

export function derivationRequirementKey(requirement: DerivationRequiredClaim): string {
  return [
    requirement.claim_type,
    requirement.issuer,
    requirement.derivation_resource_id,
    ...requirement.resource_scopes,
  ].join('|');
}

export function hasScope(scope: string | undefined, expected: string): boolean {
  return typeof scope === 'string' && scope.split(/\s+/u).includes(expected);
}

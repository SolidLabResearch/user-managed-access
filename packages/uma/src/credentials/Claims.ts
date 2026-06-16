
export const WEBID = 'urn:solidlab:uma:claims:types:webid';
export const CLIENTID = 'urn:solidlab:uma:claims:types:clientid';
export const ORIGINAL = 'urn:solidlab:uma:claims:types:original';
export const PURPOSE = 'http://www.w3.org/ns/odrl/2/purpose';
export const LEGAL_BASIS = 'https://w3id.org/oac#LegalBasis';
export const ACCESS = 'urn:solidlab:uma:claims:types:access';

/**
 * Resolves a claim value by preferring an ORIGINAL claim-set entry when present.
 */
export function getOriginalClaimValue(claims: NodeJS.Dict<unknown>, claimType: string): unknown {
  const original = claims[ORIGINAL];
  if (typeof original === 'object' && original !== null) {
	const originalClaims = original as Record<string, unknown>;
	return originalClaims[claimType];
  }

  return claims[claimType];
}

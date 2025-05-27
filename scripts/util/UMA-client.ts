import { fetch } from 'cross-fetch'

/**
 * Decodes a JSON Web Token (JWT) by parsing its payload.
 *
 * @param {string} token - The JSON Web Token to be parsed.
 * @returns {Object} The decoded payload of the JWT as a JavaScript object.
 *
 */
export function parseJwt(token: string): Object {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
}

/**
 * Represents User-Managed Access (UMA) information, extracted from a RPT Request Response.
 *
 * @property {string} tokenEndpoint - The endpoint where the token can be requested.
 * @property {string} ticket - The ticket used for the UMA session.
 */
export type UMA_Session = {
    tokenEndpoint: string,
    ticket: string
}

/**
 * Parses the 'WWW-Authenticate' header from the given headers to extract UMA session details.
 *
 * @param {Headers} headers - The HTTP headers from which the 'WWW-Authenticate' header is to be extracted.
 * @returns {UMA_Session} The parsed UMA session details.
 * @throws Will throw an error if the 'WWW-Authenticate' header is not present.
 */
export function parseAuthenticateHeader(headers: Headers): UMA_Session {
    const wwwAuthenticateHeader = headers.get("WWW-Authenticate")
    if (!wwwAuthenticateHeader) throw Error("No WWW-Authenticate Header present");

    const { as_uri, ticket } = Object.fromEntries(wwwAuthenticateHeader.replace(/^UMA /, '').split(', ').map(
        param => param.split('=').map(s => s.replace(/"/g, ''))
    ));

    const tokenEndpoint = as_uri + "/token" // NOTE: should normally be retrieved from .well-known/uma2-configuration

    return {
        tokenEndpoint,
        ticket
    }
}

/**
 * Represents a claim with a token and its format.
 *
 * @property {string} token - The claim token.
 * @property {string} token_format - The format of the claim token.
 */
export type Claim = {
    token: string,
    token_format: string
}

/**
 * Authenticated fetcher following the User Managed Access 2.0 Grant for Oauth 2.0 Authorization flow
 * using one claim.
 * (https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-grant-2.0.html)
 */
export class UserManagedAccessFetcher {
    private readonly claim: Claim;
    private readonly grant_type= 'urn:ietf:params:oauth:grant-type:uma-ticket';
    public constructor(claim: Claim) {
        this.claim = claim;
    }

    public async fetch(url: string, init: RequestInit = {}): Promise<Response> {
        // https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-grant-2.0.html#rfc.section.3.1
        // 3.1 Client Requests Resource Without Providing an Access Token
        const noTokenResponse = await fetch(url, init);
        if (noTokenResponse.status > 199 && noTokenResponse.status < 300) {
            console.log('No Authorization token was required.')
            return noTokenResponse;
        }
        // https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-grant-2.0.html#rfc.section.3.2
        // 3.2 Resource Server Responds to Client's Tokenless Access Attempt

        const { tokenEndpoint, ticket } = parseAuthenticateHeader(noTokenResponse.headers)

        const content = {
            grant_type: this.grant_type,
            ticket,
            claim_token: encodeURIComponent(this.claim.token),
            claim_token_format: this.claim.token_format,
        }

        // https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-grant-2.0.html#rfc.section.3.3.1
        // 3.3.1 Client Request to Authorization Server for RPT
        const asRequestResponse = await fetch(tokenEndpoint, {
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify(content),
        });

        if (asRequestResponse.status !== 200) {
            // https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-grant-2.0.html#rfc.section.3.3.6
            // 3.3.6 Authorization Server Response to Client on Authorization  Failure
            // TODO: log properly
            return asRequestResponse
            throw Error("Authorization token not granted" + await asRequestResponse.text());
        }

        // https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-grant-2.0.html#rfc.section.3.3.5
        // 3.3.5 Authorization Server Response to Client on Authorization Success
        const asResponse = await asRequestResponse.json();

        // RPT added to header
        const headers = new Headers(init.headers);
        headers.set('Authorization', `${asResponse.token_type} ${asResponse.access_token}`);

        // https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-grant-2.0.html#rfc.section.3.4
        // 3.4 Client Requests Resource and Provides an RPT
        // https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-grant-2.0.html#rfc.section.3.3.5
        // 3.5 Resource Server Responds to Client's RPT-Accompanied Resource Request
        return fetch(url, { ...init, headers });

    }
}

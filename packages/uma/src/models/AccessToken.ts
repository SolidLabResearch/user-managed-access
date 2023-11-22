import { Permission } from './Permission';

/**
 * A UmaAccessToken is a type of RPT that is supported by the UmaGrantProcessor.
 */
export interface Authorization {
    permissions: Permission[],
}

/**
 * The Principal object serializes the authorization
 * request made by the client to the UMA AS.
 */
export interface Principal {
    /**
     * The WebID of the RP
     */
    webId: string,
    /**
     * The ClientID of the Application used by the RP
     */
    clientId?: string,
}

export type AccessToken = Principal & Authorization;

// copied from UMA Laurens
export interface ResourceIdentifier {
    /**
     * Resource IRI
     */
    iri: string;
}

export enum AccessMode {
    read = "http://www.w3.org/ns/auth/acl#Read",
    append = "http://www.w3.org/ns/auth/acl#Append",
    write = "http://www.w3.org/ns/auth/acl#Write",
    create = "http://www.w3.org/ns/auth/acl#Create",
    delete = "http://www.w3.org/ns/auth/acl#Delete"
}

export interface Ticket {
    sub: ResourceIdentifier;
    owner: string;
    requested: Set<AccessMode>;
}

/**
 * The Principal object serializes the authorization
 * request made by the client to the UMA AS.
 */
export interface Principal {
    /**
     * The WebID of the RP
     */
    webId: string;
    /**
     * The ClientID of the Application used by the RP
     */
    clientId?: string;
}
// end copy laurens
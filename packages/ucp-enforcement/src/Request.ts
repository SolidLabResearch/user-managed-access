import { Store, DataFactory } from "n3";
const { quad, namedNode } = DataFactory

/**
 * 
 * @property {string} subject - The identifier of the entity that wants to execute an action on a resource (e.g. a {@link https://solid.github.io/webid-profile/ WebID})
 * @property {string} action - The type of action(s) that the entity wants to perform on the resource (e.g. a CRUD action)
 * @property {string} resource - The resource identifier that is governed by a usage control policy 
 * @property {string} context - Extra information supplied (can be the purpose of use, extra claims, ...) | Note: currently not implemented yet
 * @property {string} owner - The owner/providerof the resource (e.g. a {@link https://solid.github.io/webid-profile/ WebID})
 */
export interface UconRequest {
    subject: string;
    action: string[];
    resource: string;
    context?: string;
    owner?: string
}
/**
 * Creates an N3 Store based on the context of an UMA Access Request.
 * Currently, the access request also contain ACL access modes.
 * @param context
 */

export function createContext(request: UconRequest): Store {
    const contextStore = new Store();
    const { owner, subject: requestingParty, action: requestedAccessModes, resource } = request;
    const contextIRI = 'http://example.org/context';
    contextStore.addQuads([
        quad(namedNode(contextIRI), namedNode('http://example.org/resourceOwner'), namedNode(owner!)), // will probably fail if owner is not passed
        quad(namedNode(contextIRI), namedNode('http://example.org/requestingParty'), namedNode(requestingParty)),
        quad(namedNode(contextIRI), namedNode('http://example.org/target'), namedNode(resource))
    ]);

    for (const accessMode of requestedAccessModes) {
        contextStore.addQuad(namedNode(contextIRI), namedNode('http://example.org/requestPermission'), namedNode(accessMode));
    }
    return contextStore;
}

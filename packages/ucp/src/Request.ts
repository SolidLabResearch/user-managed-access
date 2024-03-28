import { Store, DataFactory } from "n3";
const { quad, namedNode, literal } = DataFactory

/**
 * 
 * @property subject - The identifier of the entity that wants to execute an action on a resource (e.g. a {@link https://solid.github.io/webid-profile/ WebID})
 * @property action - The type of action(s) that the entity wants to perform on the resource (e.g. a CRUD action)
 * @property resource - The resource identifier that is governed by a usage control policy 
 * @property claims - Extra information supplied (can be the purpose of use, extra claims, ...)
 * @property owner - The owner/providerof the resource (e.g. a {@link https://solid.github.io/webid-profile/ WebID})
 */
export interface UconRequest {
    subject: string;
    action: string[];
    resource: string;
    owner?: string;
    claims?: NodeJS.Dict<unknown>;
}

/**
 * Creates an N3 Store based on the context of an UMA Access Request.
 * Currently, the access request also contain ACL access modes.
 * @param context
 */
export function createContext(request: UconRequest): Store {
    const contextStore = new Store();
    const { owner, subject: requestingParty, action: requestedAccessModes, resource, claims } = request;
    const contextIRI = 'http://example.org/context';
    contextStore.addQuads([
        quad(namedNode(contextIRI), namedNode('http://example.org/requestingParty'), namedNode(requestingParty)),
        quad(namedNode(contextIRI), namedNode('http://example.org/target'), namedNode(resource))
    ]);
    if (owner) contextStore.addQuads([
        quad(namedNode(contextIRI), namedNode('http://example.org/resourceOwner'), namedNode(owner)),
    ]);

    for (const accessMode of requestedAccessModes) {
        contextStore.addQuad(namedNode(contextIRI), namedNode('http://example.org/requestPermission'), namedNode(accessMode));
    }

    for (const [claim, value] of Object.entries(claims ?? {})) {
        if (typeof value !== 'string') {
            console.log(`[Request.createContext]: Skipping claim ${claim} because only string values are supported.`);
            continue; // TODO: support full RDF
        }

        let object;
        try { object = namedNode(value) } catch { object = literal(value) }
        contextStore.addQuad(namedNode(contextIRI), namedNode(claim), object);
    }

    return contextStore;
}

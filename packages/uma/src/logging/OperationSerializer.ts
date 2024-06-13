import { RDF } from "@solid/community-server";
import { DataFactory as df, Triple } from "n3";

const policyType = 'http://example.org/ns/policies/Policy'

export function serializePolicyInstantiation() : Triple[] {
    let id = df.namedNode('urn:example:policy:uuid:0221319319231831')

    let triples = [
        df.triple(id, df.namedNode(RDF.type), df.namedNode(policyType))
    ]

    return triples
}


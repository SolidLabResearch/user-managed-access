import { Store, Triple, DataFactory, Quad_Graph, Quad } from 'n3'


class OperationLogger {

    store: Store = new Store();

    /**
     * Store all triples in the store in a newly created graph term, and return the graph term
     * @param {Triple} triples array of triples
     * @returns {Quad_Graph} name of the graph in which the triples are stored
     */
    addLogEntry(triples: Triple[], graphName?: string): Quad_Graph {
        let graphTerm: Quad_Graph = graphName 
            ? DataFactory.namedNode(graphName)
            : DataFactory.blankNode()
         
        this.store.addQuads(
            triples.map(triple => DataFactory.quad(triple.subject, triple.predicate, triple.object, graphTerm))
        )
        
        return graphTerm
    }

    getLogEntries(graphName: Quad_Graph | string | null) {
        return this.store.getQuads(null, null, null, graphName)
    }

    getLogEntriesByType(type: string) {
        let quads = this.store.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', type, null)
        let graph_terms = [...new Map(quads.map(item => [item.value, item])).values()];

        let logEntries: Quad[] = []
        for (let term of graph_terms) {
            logEntries = logEntries.concat(this.store.getQuads(null, null, null, term))
        }

        return logEntries
    }


}

const logger = new OperationLogger();

export function getOperationLogger() {
    return logger;
} 
import type { Quad, Quad_Subject } from '@rdfjs/types';
import { AsyncHandler } from 'asynchronous-handlers';
import { ConflictResolver } from 'policy-conflict-resolver';

export interface ConflictResolutionStrategyInput {
    /**
     * The Evaluation Request to which an ODRL Evaluation has occurred.
     */
    request: {
        identifier: Quad_Subject;
        request: Quad[];
    }
    /**
     * A set of ODRL policies reports serialized as a list of quads
     */
    policies: Quad[];
    /**
     * A set of policy compliance reports serialized as a list of quads
     */
    reports: Quad[];
}

/**
 * The strategy employed for ODRL Evaluations.
 *
 * This is necessary to deal with multiple rule reports that might conflict with each other.
 * It also contains the logic to encode the strategy what happens when there is no information to be gained from the compliance report.
 * I.e. what access control decision is employed when no active Permission Rule Reports are present.
 */
export abstract class Strategy extends AsyncHandler<ConflictResolutionStrategyInput, boolean> {
    protected resolver: ConflictResolver;

    constructor(conflictResolver: ConflictResolver) {
        super();
        this.resolver = conflictResolver;
    }
}

import { Store } from 'n3';
import { parseComplianceReport, RDF, REPORT, serializeComplianceReport } from 'odrl-evaluator';
import { ActiveConflictResolver, ConflictResolverInput, DenyConflictResolver, FORCE } from 'policy-conflict-resolver';
import { ConflictResolutionStrategyInput, Strategy } from './Strategy';

/**
 * A strategy for ODRL evaluations that combines two strategies:
 * - default deny: If there is no active permission, the action is not allowed -> There must be at least one permission.
 * - prohibition over permissions: The action is allowed if there is no prohibition and at least one permission.
 *
 * The stronger of the two is that there must be at least one permission and no prohibitions for that given request.
 *
 * It works for one request at a time to determine whether the action is allowed on the resource or not.
 */
export class PrioritizeProhibitionStrategy extends Strategy {
    public constructor() {
        super(new ActiveConflictResolver(new DenyConflictResolver()));
    }

    async handle(input: ConflictResolutionStrategyInput): Promise<boolean> {
        const reportStore = new Store(input.reports)
        const policyReportNodes = reportStore.getSubjects(RDF.type, REPORT.PolicyReport, null);
        const conflictResolverInput: ConflictResolverInput = { reports: [] }

        for (const policyReportNode of policyReportNodes) {
            const parsedReport = parseComplianceReport(policyReportNode, reportStore);

            if (parsedReport.request.value !== input.request.identifier.value) {
                // Ignore this compliance report as it pertains to another request
                continue;
            }
            // NOTE: on rule level of the compliance, this does not get checked.
            // In theory it is possible to have a compliance report that has a different requested rule than to the top level.
            // In practice, that should not happen.

            conflictResolverInput.reports.push(
                {
                    report: serializeComplianceReport(parsedReport),
                    policy: input.policies
                })

        }
        const result = await this.resolver.handleSafe(conflictResolverInput);
        const resultStore = new Store(result.report);
        const status = resultStore.getObjects(result.identifier, FORCE.conclusion, null);
        if (status.length < 1) {
            return false;
        }

        return status[0].value === FORCE.Allow;
    }
}

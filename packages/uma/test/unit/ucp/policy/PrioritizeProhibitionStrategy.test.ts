import {
    PolicyReport,
    RuleReportType,
    PremiseReportType,
    SatisfactionState,
    ActivationState,
    AttemptState,
    serializeComplianceReport,
    ODRL
} from "odrl-evaluator"
import { DataFactory } from 'n3';
import type { Quad, Quad_Subject } from '@rdfjs/types'
import { PrioritizeProhibitionStrategy } from '../../../../src/ucp/policy/PrioritizeProhibitionStrategy'

const { namedNode, literal, quad } = DataFactory;

describe("PrioritizeProhibitionStrategy", (): void => {
    let complianceReport: PolicyReport;
    let strategy: PrioritizeProhibitionStrategy;
    let request: { identifier: Quad_Subject, request: Quad[] };
    beforeEach(async (): Promise<void> => {
        let requestIdentifier = "urn:uuid:evaluation-request-1";
        const requestRule = "urn:uuid:requested-rule-xyz"
        request = {
            identifier: namedNode(requestIdentifier),
            request: [
                quad(namedNode(requestIdentifier), ODRL.terms.permission, namedNode(requestRule))
            ]
        }
        complianceReport = {
            id: namedNode("urn:uuid:policy-report-1"),
            created: literal("2024-02-12T11:20:10.999Z", "http://www.w3.org/2001/XMLSchema#dateTime"),
            request: namedNode(requestIdentifier),
            policy: namedNode("urn:uuid:policy-123"),
            ruleReport: [
                {
                    id: namedNode("urn:uuid:rule-report-1"),
                    type: RuleReportType.PermissionReport,
                    activationState: ActivationState.Active,
                    attemptState: AttemptState.Attempted,
                    performanceState: undefined,
                    deonticState: undefined,
                    rule: namedNode("urn:uuid:rule-abc"),
                    requestedRule: namedNode(requestRule),
                    premiseReport: [
                        {
                            id: namedNode("urn:uuid:premise-1"),
                            type: PremiseReportType.TargetReport,
                            premiseReport: [],
                            satisfactionState: SatisfactionState.Satisfied
                        },
                        {
                            id: namedNode("urn:uuid:premise-2"),
                            type: PremiseReportType.PartyReport,
                            premiseReport: [],
                            satisfactionState: SatisfactionState.Satisfied
                        },
                        {
                            id: namedNode("urn:uuid:premise-3"),
                            type: PremiseReportType.ActionReport,
                            premiseReport: [],
                            satisfactionState: SatisfactionState.Satisfied
                        }
                    ],
                    conditionReport: []
                }
            ]
        }
        strategy = new PrioritizeProhibitionStrategy();
    });

    it('returns true when there are only active rule reports.', async (): Promise<void> => {
        const result = await strategy.handle({
            request: request,
            reports: serializeComplianceReport(complianceReport),
            policies: []
        });
        expect(result).toBe(true)
    });

    it('returns false when there no active permission rule reports.', async (): Promise<void> => {
        complianceReport.ruleReport[0].activationState = ActivationState.Inactive
        const result = await strategy.handle({
            request: request,
            reports: serializeComplianceReport(complianceReport),
            policies: []
        });
        expect(result).toBe(false)
    });

    it('returns false when there is an active prohibition rule report.', async (): Promise<void> => {
        complianceReport.ruleReport[0].type = RuleReportType.ProhibitionReport;
        const result = await strategy.handle({
            request: request,
            reports: serializeComplianceReport(complianceReport),
            policies: []
        });
        expect(result).toBe(false)
    });

    it('returns false when there is an active prohibition and active permission rule report in different compliance reports.', async (): Promise<void> => {
        let prohibitionComplianceReport: PolicyReport = {
            id: namedNode("urn:uuid:policy-report-2"),
            created: literal("2024-02-12T11:20:10.999Z", "http://www.w3.org/2001/XMLSchema#dateTime"),
            request: complianceReport.request,
            policy: namedNode("urn:uuid:policy-124"),
            ruleReport: [
                {
                    id: namedNode("urn:uuid:rule-report-2"),
                    type: RuleReportType.ProhibitionReport,
                    activationState: ActivationState.Active,
                    attemptState: AttemptState.Attempted,
                    performanceState: undefined,
                    deonticState: undefined,
                    rule: namedNode("urn:uuid:rule-abc"),
                    requestedRule: complianceReport.ruleReport[0].requestedRule,
                    premiseReport: [
                    ],
                    conditionReport: []
                }
            ]
        }
        const result = await strategy.handle({
            request: request,
            reports: [...serializeComplianceReport(complianceReport), ...serializeComplianceReport(prohibitionComplianceReport)],
            policies: []
        });
        expect(result).toBe(false)
    });

    it('returns false when there is an active prohibition and active permission rule report in the same compliance report.', async (): Promise<void> => {
        complianceReport.ruleReport.push(
            {
                    id: namedNode("urn:uuid:rule-report-2"),
                    type: RuleReportType.ProhibitionReport,
                    activationState: ActivationState.Active,
                    attemptState: AttemptState.Attempted,
                    performanceState: undefined,
                    deonticState: undefined,
                    rule: namedNode("urn:uuid:rule-abc"),
                    requestedRule: complianceReport.ruleReport[0].requestedRule,
                    premiseReport: [
                    ],
                    conditionReport: []
                }
        )
        const result = await strategy.handle({
            request: request,
            reports: serializeComplianceReport(complianceReport),
            policies: []
        });
        expect(result).toBe(false)
    });


    it('returns false when there are no active permission rule reports for the given request.', async (): Promise<void> => {
        request.identifier = namedNode("random-request");
        const result = await strategy.handle({
            request: request,
            reports: serializeComplianceReport(complianceReport),
            policies: []
        });
        expect(result).toBe(false)
    })
})

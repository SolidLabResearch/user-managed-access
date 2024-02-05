import { Store } from "n3";
import { IPolicyType, PolicyPlugin } from "../PolicyExecutor";
import { accesModesAllowed } from "../util/constants";
import { Conclusion } from "../Explanation";

export const ucpLogPluginIdentifier = 'http://example.org/dataUsageLog'

export class UCPLogPlugin extends PolicyPlugin {
    public async execute(mainStore: Store, policyStore: Store, policy: IPolicyType): Promise<Conclusion> {
        // TODO: think about no permission (explicit)

        return {
            ruleIRI: policy.args['http://example.org/UCrule'][0].value,
            interpretationIRI: policy.args['http://example.org/N3Identifier'][0].value,
            grants: policy.args[accesModesAllowed].map(term => term.value),
            timestamp: new Date(policy.args['http://purl.org/dc/terms/issued'][0].value),
        }
    }
}    

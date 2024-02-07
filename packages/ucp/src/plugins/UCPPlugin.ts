import { Store } from "n3";
import { IPolicyType, PolicyPlugin } from "../PolicyExecutor";
import { ACCESS_MODES_ALLOWED } from "../util/Constants";

export const ucpPluginIdentifier = 'http://example.org/dataUsage'

export class UcpPlugin extends PolicyPlugin {
    public async execute(mainStore: Store, policyStore: Store, policy: IPolicyType): Promise<string[]> {
        // TODO: think about no permission (explicit)

        return policy.args[ACCESS_MODES_ALLOWED].map(term => term.value);
    }
}    

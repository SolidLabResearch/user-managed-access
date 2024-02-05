import { Store } from "n3";
import { IPolicyType, PolicyPlugin } from "../PolicyExecutor";
import { accesModesAllowed } from "../util/constants";

export const ucpPluginIdentifier = 'http://example.org/dataUsage'

export class UcpPlugin extends PolicyPlugin {
    public async execute(mainStore: Store, policyStore: Store, policy: IPolicyType): Promise<string[]> {
        // TODO: think about no permission (explicit)

        return policy.args[accesModesAllowed].map(term => term.value);
    }
}    

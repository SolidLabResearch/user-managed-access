import { PolicyExecutor, UcpPatternEnforcement, UcpPlugin, MemoryUCRulesStorage, turtleStringToStore } from "@solidlab/ucp";
import { EyeJsReasoner } from "koreografeye";

async function main() {
    // load plugin(s)
    const plugins = { "http://example.org/dataUsage": new UcpPlugin() }
    // Initialise koreografeye policy executor
    const policyExecutor = new PolicyExecutor(plugins)
    // Initialise Usage Control Rule Storage
    const uconRulesStorage = new MemoryUCRulesStorage();
    // load N3 Rules
    const response = await fetch('https://raw.githubusercontent.com/woutslabbinck/ucp-enforcement/main/rules/data-crud-rules.n3'); // loading from the github repo
    const n3Rules: string[] = [await response.text()]
    // instantiate the enforcer using the policy executor,
    const ucpEvaluator = new UcpPatternEnforcement(uconRulesStorage, n3Rules, new EyeJsReasoner([
            "--quiet",
            "--nope",
            "--pass"]), policyExecutor)
    
    // calculate grants based on a request
    const noAccessModes = await ucpEvaluator.calculateAccessModes({
    subject: "https://pod.rubendedecker.be/profile/card#me",
    action: ["http://www.w3.org/ns/auth/acl#Read"],
    resource: "urn:wout:age",
    owner: "https://pod.woutslabbinck.com/profile/card#me"
    });
    console.log(noAccessModes);
    
    // add Usage Control Rule to Usage Control Rule Storage
    const ucr = `@prefix odrl: <http://www.w3.org/ns/odrl/2/> .
@prefix : <http://example.org/usageControlRule> .

:permission
  a odrl:Permission ;
  odrl:action odrl:read ;
  odrl:target <urn:wout:age> ;
  odrl:assignee <https://pod.rubendedecker.be/profile/card#me> ;
  odrl:assigner <https://pod.woutslabbinck.com/profile/card#me> .
    `
    const policyStore = await turtleStringToStore(ucr);
    await uconRulesStorage.addRule(policyStore);

    // calculate grants based on a request
    const accessModes = await ucpEvaluator.calculateAccessModes({
    subject: "https://pod.rubendedecker.be/profile/card#me",
    action: ["http://www.w3.org/ns/auth/acl#Read"],
    resource: "urn:wout:age",
    owner: "https://pod.woutslabbinck.com/profile/card#me"
    });
    console.log(accessModes);
}
main()
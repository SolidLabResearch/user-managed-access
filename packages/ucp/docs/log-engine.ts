import { PolicyExecutor, UcpPatternEnforcement, UCPLogPlugin, MemoryUCRulesStorage, explanationToRdf, serializeFullExplanation, turtleStringToStore } from "@solidlab/ucp";
import { EyeJsReasoner } from "koreografeye";

async function main() {
    // load plugin(s)
    const plugins = { "http://example.org/dataUsageLog": new UCPLogPlugin() }
    // instantiate koreografeye policy executor
    const policyExecutor = new PolicyExecutor(plugins)
    // ucon storage
    const uconRulesStorage = new MemoryUCRulesStorage()
    // load N3 Rules from a directory 
    const response = await fetch('https://raw.githubusercontent.com/woutslabbinck/ucp-enforcement/main/rules/log-usage-rule.n3'); // loading from the github repo
    const n3Rules: string[] = [await response.text()]
    // instantiate the enforcer using the policy executor,
    const ucpEvaluator = new UcpPatternEnforcement(uconRulesStorage, n3Rules, new EyeJsReasoner([
        "--quiet",
        "--nope",
        "--pass"]), policyExecutor)
    
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
    const explanation = await ucpEvaluator.calculateAndExplainAccessModes({
        subject: "https://pod.rubendedecker.be/profile/card#me",
        action: ["http://www.w3.org/ns/auth/acl#Read"],
        resource: "urn:wout:age",
        owner: "https://pod.woutslabbinck.com/profile/card#me"
    });
    console.log(explanation);

    // use of explanationToRdf
    const explanationStore = explanationToRdf(explanation);

    // use of serializeFullExplanation
    const uconRules = await uconRulesStorage.getStore();
    const serialized = serializeFullExplanation(explanation, uconRules, n3Rules.join('\n'));
    console.log(serialized);
}
main()
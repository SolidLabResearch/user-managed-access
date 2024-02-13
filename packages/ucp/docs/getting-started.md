This tutorial is about how to install and use the [@solidlab/ucp](https://github.com/SolidLabResearch/user-managed-access/tree/main/packages/ucp) library utilities.

## Installing

As of today (2 Februari 2024), this package is not on npm.
Which means installing via `npm install @solidlab/ucp` does **not** work yet.

However, it can still easily installed by adding `"@solidlab/ucp": "https://github.com/woutslabbinck/ucp-enforcement.git"` to your dependencies in package.json.

If no package.json is yet present, you can just create a `package.json` file, copy the contents below and execute `npm i`

```json
{
    "dependencies": {
        "ucp-enforcement": "https://github.com/woutslabbinck/ucp-enforcement.git",
    }
}
```

### Note for installing

Another options currently is to look at [GitPkg](https://gitpkg.now.sh/).

## Using the library

First, a brief reminder of what the goal is library.
What this library gives is a set of tools for creating **usage control decision** engines that are fully customizable.
A **usage control decision** engine evaluates an *action request* against a set of *Usage Control Policies* to get a conclusion of *access grants*.

### Example

As an example, imagine that Ruben wants to know Wout his age.
The age of Wout can be found in a *resource*, `urn:wout:age` (a unique identifier), and is safeguarded by Wout his *policy* that says Ruben has read access to the *resource*. 
Concretely, this policy could be modelled as a tuple (Requesting Party (RP), action, target resource, resource owner), which in this example would be (*urn:ruben*,*read access*, *urn:wout:age*,*urn:wout*).
The **usage control decision** engine, would then be able to interpret both the request and the policy to give as conclusion a grant: *read access*. 
This means Ruben is able to know Wout his age and we know that the access is allowed conforming to the policies of Wout thanks to the engine.

Note: that this example does not contain any usage control yet, but is rather access control.
When a policy has additional to the current tuple expression and enforcement for e.g. Ruben has to delete the data after 30 days and/or that he can only use it for the purpose of for example buying a gift for Wout his Birthday, then we are talking about Usage Control.
Though, you could see the current use case as preventive usage control without purposes.

### High level Architecture

There are two functions implemented to calculate the grants, both are part of the interface `UconEnforcementDecision`.

1. `calculateAccessModes`: Calculate the *access grants* based on the set of *Usage Control Policies* , the *request* and how to *interpret the policies* (the algorithm)
2. `calculateAndExplainAccessModes`: The same as `calculateAccessModes`, but also provides an **Explanation** of how the *access grants* are calculated.

Both functions have as input a `UconRequest`. This is an interface that formalizes the action request e.g. (RP, requested action, resource) (*urn:ruben*,*read access*, *urn:wout:age*).

As output, `calculateAccessModes` has a list of strings (`access grants`) and `calculateAndExplainAccessModes` has an `Explanation` (which will be elaborated later).

### The first usage control decision engine

The implementation of the `UconEnforcementDecision` interface that this library provides is `UcpPatternEnforcement`.

The first instantiation of this interface is what is referred here as the first **usage control decision** engine.
Before this instantiation is given, an explanation of how it works is given in [the following section](#usage-control-decision-engine).

#### Usage Control Decision engine

The (`UcpPatternEnforcement`) engine has three components and can be consulted with the methods described in [the high level architecture](#high-level-architecture).

The three components:

- A **[storage](https://github.com/SolidLabResearch/user-managed-access/tree/main/packages/ucp/src/plugins)** to the set of *Usage Control Policies*
- A **storage** to the set of [Notation3](https://w3c.github.io/N3/spec/) (N3) [interpretation rules](https://github.com/SolidLabResearch/user-managed-access/tree/main/packages/ucp/rules)
- A configured instance of **[Koreografeye](https://github.com/eyereasoner/Koreografeye)** consisting of:
  - An **N3 reasoner** ([eye-js](https://github.com/eyereasoner/eye-js))
  - A [Koreografeye policy/plugin executor](https://github.com/SolidLabResearch/user-managed-access/blob/main/packages/ucp/src/PolicyExecutor.ts) + [plugins](https://github.com/SolidLabResearch/user-managed-access/tree/main/packages/ucp/src/plugins)

When a method (e.g. `calculateAccessModes`) is then called with an `action request` the following steps are then executed:

1. The N3 Reasoner runs with as input:
   1. The set of *Usage Control Policies*
   2. The request (`UconRequest` serialized as RDF)
   3. The N3 *interpretation rules*
2. The conclusion from the Reasoner is then extracted by the Koreografeye policy/plugin executor (configured with plugins)
3. The result is then returned

This modular approach allows for fast prototyping of a formal Usage Control Policy language, which can then immediately be evaluated.

#### Instantiation

This first policy engine instantiation can perform an evaluation of policies modelled with [Open Digital Rights Language (ODRL)](https://www.w3.org/TR/odrl-model/).
More specifically, with a subset that only can interpret `odrl:Permission`s with as **action** `odrl:modify`, `odrl:read` and `odrl:use` (which means both modify and read) against action requests and where there are **no Constraints**.

To initialise `UcpPatternEnforcement` as this engine, the following code is required:

```ts
import { PolicyExecutor, UcpPatternEnforcement, UcpPlugin, MemoryUCRulesStorage } from "@solidlab/ucp";
import { EyeJsReasoner } from "koreografeye";

// load plugin
const plugins = { "http://example.org/dataUsage": new UcpPlugin() }
// instantiate koreografeye policy executor
const policyExecutor = new PolicyExecutor(plugins)
// ucon storage
const uconRulesStorage = new MemoryUCRulesStorage();
// load N3 Rules
const response = await fetch('https://raw.githubusercontent.com/woutslabbinck/ucp-enforcement/main/rules/data-crud-rules.n3'); // loading from the github repo
const n3Rules: string[] = [await response.text()]
// instantiate the enforcer using the policy executor,
const ucpEvaluator = new UcpPatternEnforcement(uconRulesStorage, n3Rules, new EyeJsReasoner([
        "--quiet",
        "--nope",
        "--pass"]), policyExecutor)
```

At this point, the engine is ready to be used. Which means that now you can use the `calculateAccessModes` function to request the **grants** for following *action request*: "Ruben wants to know the age of Wout".

```ts
const accessModes = await ucpEvaluator.calculateAccessModes({
    subject: "https://pod.rubendedecker.be/profile/card#me",
    action: ["http://www.w3.org/ns/auth/acl#Read"],
    resource: "urn:wout:age",
    owner: "https://pod.woutslabbinck.com/profile/card#me"
});
console.log(accessModes);
```

Unfortunately, this results into an empty list `[]`. Which means no **grants** are given and thus Ruben cannot know the age of Wout.

The reason for this is very simple, there is **no** *Usage Control Policy* in the storage.

This can however be resolved by simply adding such a policy to the **Usage Control Rule Storage**:

```ts
@prefix odrl: <http://www.w3.org/ns/odrl/2/> .
@prefix : <http://example.org/usageControlRule> .

:permission
  a odrl:Permission ;
  odrl:action odrl:read ;
  odrl:target <urn:wout:age> ;
  odrl:assignee <https://pod.rubendedecker.be/profile/card#me> ;
  odrl:assigner <https://pod.woutslabbinck.com/profile/card#me> .
```

To add this rule to the storage, the following code can be used:

```ts
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
```

From now on, when the access modes are calculated again, the following grants are received:

```sh
[ 'http://www.w3.org/ns/auth/acl#Read' ]
```

The full code sample for this example can be found in [appendix I](#appendix-I-Full-code-snippet)

### Temporal Policy engine

TODO:

### Engine with explanation

First an elaboration is given for what is meant by explanation.
Note: after implementation, similarities have been found with the idea of **ODRL Evaluator** from the [ODRL Formal Semantics Community Group](https://w3c.github.io/odrl/formal-semantics/).

#### Explanation

So what is the explanation exactly? It is an interface which contains four components:


An **Explanation** consists of four components:

- **decision**: This is the same as the grants (array of access modes) from `calculateAccessModes`. It is the **result** of the evaluation
- **request**: The input *action request* 
- **conclusions**: The conclusions of the reasoner. A conclusion itself consists of four parts: the **Rule Identifier**, the **Interpration N3 Rule Identifier**, the **grants** allowed (the actual conclusion) and the **timestamp** at which the conclusion was generated. A conclusion can be seen as the proof of following function: $interpretation(rule, context, timestamp) -> grants$
- **algorithm**: Which algorithm is used to interpret the set of conclusions
  - Note: only the **union** operator is currently implemented. That is: $\forall c \in C. grant \in c \Rightarrow grant \in D$ </br>
    For all conclusions in **Conclusions**, if a grant is in conclusion, then it is part of the list of grants in **Decision**.

Having the **Explanation** after an evaluation thus allows for logging with provenance/proof of why a certain action was granted at a certain time.

#### Instantiation

To have a **usage control decision** engine that can give **Explanations**, it needs to be instantiated correctly. This can be done with following code:

```ts
import { PolicyExecutor, UcpPatternEnforcement, UCPLogPlugin, MemoryUCRulesStorage } from "@solidlab/ucp";
import { EyeJsReasoner } from "koreografeye";

// load plugin
const plugins = { "http://example.org/dataUsageLog": new UCPLogPlugin() }
// instantiate koreografeye policy executor
const policyExecutor = new PolicyExecutor(plugins)
// ucon storage
const uconRulesStorage = new ContainerUCRulesStorage(uconRulesContainer)
// load N3 Rules from a directory 
const response = await fetch('https://raw.githubusercontent.com/woutslabbinck/ucp-enforcement/main/rules/log-usage-rule.n3'); // loading from the github repo
const n3Rules: string[] = [await response.text()]
// instantiate the enforcer using the policy executor,
const ucpPatternEnforcement = new UcpPatternEnforcement(uconRulesStorage, n3Rules, new EyeJsReasoner([
    "--quiet",
    "--nope",
    "--pass"]), policyExecutor)
```

Not that compared to the previous engines, a different **plugin** and a different **N3 interpretation rules** are used.
These allow for retrieving a proper explanation during the calculation of the requests.

Another difference is the fact that know the method `calculateAndExplainAccessModes` has to be used. 
Luckily, this still uses a `UconRequest` as input:

```ts
const explanation = await ucpEvaluator.calculateAndExplainAccessModes({
    subject: "https://pod.rubendedecker.be/profile/card#me",
    action: ["http://www.w3.org/ns/auth/acl#Read"],
    resource: "urn:wout:age",
    owner: "https://pod.woutslabbinck.com/profile/card#me"
});
console.log(explanation);
```

When a policy is added to the TODO: storage. This will print out a Javascript Object, which is not very nice.

Luckily, it is possible to have a nice RDF serialization as output:

```ts
import { explanationToRdf, serializeFullExplanation } from "@solidlab/ucp";

// use of explanationToRdf
const explanationStore = explanationToRdf(explanation);

// use of serializeFullExplanation
const uconRules = await uconRulesStorage.getStore();
const serialized: string = serializeFullExplanation(explanation, uconRules, n3Rules.join('\n'));
```

Or to be used as RDF in code with the N3 Store: 

```ts
// use of explanationToRdf
const explanationStore = explanationToRdf(explanation);
```


## appendix I: Full code snippet

```ts
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
```

## appendix III: Full code snippet Explanation
```ts
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

    // use of serializeFullExplanation
    const uconRules = await uconRulesStorage.getStore();
    const serialized = serializeFullExplanation(explanation, uconRules, n3Rules.join('\n'));
    console.log(serialized);
}
main()
```


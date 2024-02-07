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

## Using the library

### First policy engine

First, a brief reminder of what the goal is library.
The utilities facilitate the creation of a custom **usage control decision** engine.
The most important interface is `UconEnforcementDecision`. 
It has two functions:

- `calculateAccessModes`
- `calculateAndExplainAccessModes`

Both functions return a list of `grants`, which means the **access modes** that are granted after taking the *usage control request* (the input of the two functions) and the current *set of Usage Control Rules (UCRs)* and how they are *interpreted*.

The class `UcpPatternEnforcement` implements the aforementioned interface. It uses 4 components to realize the calculation:

1. a storage for UCRs
2. a set of [Notation3](https://w3c.github.io/N3/spec/) (N3) [interpretation rules](https://github.com/SolidLabResearch/user-managed-access/tree/main/packages/ucp/rules)
3. An N3 reasoner ([eye-js](https://github.com/eyereasoner/eye-js))
4. A [Koreografeye](https://github.com/eyereasoner/Koreografeye) policy/plugin executor (with its own plugins)

The following code initialises the `UcpPatternEnforcement` class:

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
const ucpDecide = new UcpPatternEnforcement(uconRulesStorage, n3Rules, new EyeJsReasoner([
        "--quiet",
        "--nope",
        "--pass"]), policyExecutor)

const accessModes = await ucpDecide.calculateAccessModes({
    subject: "https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me",
    action: ["http://www.w3.org/ns/auth/acl#Read"],
    resource: "http://localhost:3000/test.ttl",
    owner: "http://localhost:3000/alice/profile/card#me"
});
console.log(accessModes);
```

Note that an empty list is printed in the console. 
While the component is initialised correctly, no access is granted.
The reason for that is that currently the **UCR Storage** (`MemoryUCRulesStorage`) is still empty. As long as there are no rules that allow for an particular *action* (read access) for a given *subject* (the requesting party, the client) for a given *resource*, no grants will be given.

To solve that, an example is given of such a Usage Control Rule that the **engine** (`ucpDecide`) understands:

```turtle
@prefix odrl: <http://www.w3.org/ns/odrl/2/> .
@prefix : <http://example.org/usageControlRule> .
@prefix acl: <http://www.w3.org/ns/auth/acl#>.

:permission
  a odrl:Permission ;
  odrl:action odrl:use ;
  odrl:target <http://localhost:3000/test.ttl> ;
  odrl:assignee <https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me> ;
  odrl:assigner <http://localhost:3000/alice/profile/card#me> .
```

To add such a rule to the **UCR Storage**, it first has to be parsed/deserialized to an [N3 Store](https://github.com/rdfjs/N3.js).
Reason being, that the method `addRule`  for the storage (`MemoryUCRulesStorage` ) expects as input an object of the `Store` type.

Any kind of tool or method can be used to convert this `text/turtle` string to an N3 Store. However, in the `ucp-enforcement` library, the function `turtleStringToStore` does just that.

The following thus parses the **Usage Control Rule** and stores it to the **Usage Control Rule Storage**:

```ts
const ucr = `@prefix odrl: <http://www.w3.org/ns/odrl/2/> .
@prefix : <http://example.org/usageControlRule> .

:permission
  a odrl:Permission ;
  odrl:action odrl:use ;
  odrl:target <http://localhost:3000/test.ttl> ;
  odrl:assignee <https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me> ;
  odrl:assigner <http://localhost:3000/alice/profile/card#me> .
    `
const policyStore = await turtleStringToStore(ucr);
await uconRulesStorage.addRule(policyStore);
```

Running the calculation again, now that the rule is added to the storage, result in the allowed access grants!

The full code sample for this example can be found in [appendix I](#appendix-I:-Full-code-snippet)

### Temporal Policy engine

TODO:

### Engine with explanation

TODO:

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
    const ucpDecide = new UcpPatternEnforcement(uconRulesStorage, n3Rules, new EyeJsReasoner([
            "--quiet",
            "--nope",
            "--pass"]), policyExecutor)

    // add Usage Control Rule to Usage Control Rule Storage
    const ucr = `@prefix odrl: <http://www.w3.org/ns/odrl/2/> .
    @prefix : <http://example.org/usageControlRule> .

    :permission
      a odrl:Permission ;
      odrl:action odrl:use ;
      odrl:target <http://localhost:3000/test.ttl> ;
      odrl:assignee <https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me> ;
      odrl:assigner <http://localhost:3000/alice/profile/card#me> .
        `
    const policyStore = await turtleStringToStore(ucr);
    await uconRulesStorage.addRule(policyStore);

    // calculate grants based on a request
    const accessModes = await ucpDecide.calculateAccessModes({
        subject: "https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me",
        action: ["http://www.w3.org/ns/auth/acl#Read"],
        resource: "http://localhost:3000/test.ttl",
        owner: "http://localhost:3000/alice/profile/card#me"
    });
    console.log(accessModes);
}
main()
```


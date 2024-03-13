import { createContext, storeToString } from "@solidlab/ucp";
import { initEngine } from "./demoEngine";
import { demoPolicy } from "./policyCreation";

async function main(){
    const {css, ucpEngine, storage} = await initEngine();

    const target = "urn:wout:age"
    const requestingParty = "https://pod.rubendedecker.be/profile/card#me"

    const request = { 
        subject: requestingParty, 
        action: ["http://www.w3.org/ns/auth/acl#Read"], 
        resource: target, 
        owner: "https://pod.woutslabbinck.com/profile/card#me" 
    }
    const policy = demoPolicy(target, requestingParty)
    // start server
    await css.start();


    const noAccessModes = await ucpEngine.calculateAccessModes(request); 
    console.log("Access modes retrieved when no policy in storage", noAccessModes);

    // Add following Policy to storage:
    // Wout gives access to Ruben regarding Wout his age 
    // constraints: two weeks from now on + purpose= "age-verification"
    await storage.addRule(policy.representation)
    

    const accessModes = await ucpEngine.calculateAccessModes(request); 
    console.log("Access modes retrieved when policy in storage", accessModes);

    // debug logs
    // console.log(storeToString(createContext(request))); // Note: request -> which is also what is expected in the uma server at that stage
    // console.log(storeToString(policy.representation)); // Note: log ODRL rule
    console.log("Right now 'storage' is used to PUT the demo policy to 'http://localhost:3123/'. A normal HTTP request can also be used to do that.");
    
}

main()
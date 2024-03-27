import React, { useEffect, useState } from "react";
import { createPolicy, doPolicyFlowFromString, readPolicyDirectory } from "../util/PolicyManagement";
import PolicyModal from "./Modal";
import { SimplePolicy } from "../util/policyCreation";

export default function Home() { 

    const [policyList, setPolicyList] = useState([] as SimplePolicy[])

    useEffect(() => {
      async function getPolicies() {
        let policies = await readPolicyDirectory();
        setPolicyList(policies)
      }
      getPolicies()
    }, [])
    

    async function addPolicy(policyText: string) {
        console.log('Adding the following policy:')
        console.log(policyText)
        await doPolicyFlowFromString(policyText)
    }

    function renderPolicy(policy: SimplePolicy) {
        return (
            <div className="policyentry">
                <p>{policy.policyIRI}</p>
            </div>
        )
    }

    return (
        <div id="policypage">
            <div id="policymanagementcontainer" className="rowcontainer">
                <div id="PolicyListContainer" className="columncontainer">
                    <div id="policyList" >
                        {
                            policyList.map(renderPolicy)
                        }
                    </div>
                    <PolicyModal addPolicy={addPolicy}/>
                </div>
                <div id="PolicyDisplayScreen">
                    <textarea id="policyview" readOnly/>
                </div>
            </div>
        </div>
    )
}
import React, { useEffect, useState } from "react";
import { createPolicy, doPolicyFlowFromString, readPolicy, readPolicyDirectory } from "../util/PolicyManagement";
import PolicyModal from "./Modal";
import { SimplePolicy } from "../util/policyCreation";

export default function Home() { 

    const [policyList, setPolicyList] = useState<SimplePolicy[]>([])
    const [selectedPolicy, setSelectedPolicy] = useState<null|string>(null)

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
        const policyObject = await readPolicy(policyText)
        setPolicyList(policyList.concat(policyObject))
    }

    function renderPolicy(policy: SimplePolicy) {
        return (
            <div key={policy.policyLocation} className={`policyentry ${policy.policyIRI === selectedPolicy ? 'selectedentry' : ''}`} onClick={() => setSelectedPolicy(policy.policyIRI)}>
                <p>{policy.policyIRI}</p>
            </div>
        )
    }

    const selectedPolicyText = selectedPolicy 
        ? policyList.filter(p => p.policyIRI === selectedPolicy)[0]?.policyText || ''
        : ''

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
                    <textarea id="policyview" value={selectedPolicyText} readOnly/>
                </div>
            </div>
        </div>
    )
}

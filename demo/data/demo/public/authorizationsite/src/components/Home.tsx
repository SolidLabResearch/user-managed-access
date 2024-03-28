import React, { useEffect, useState } from "react";
import { createAndSubmitPolicy, doPolicyFlowFromString, readPolicy, readPolicyDirectory } from "../util/PolicyManagement";
import PolicyModal from "./Modal";
import PolicyFormModal from "./FormModal"
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

    async function addPolicyFromText(policyText: string) {
        console.log('Adding the following policy:')
        console.log(policyText)
        await doPolicyFlowFromString(policyText)
        const policyObject = await readPolicy(policyText)
        if(policyObject) setPolicyList(policyList.concat(policyObject))
    }

    async function addPolicyFromFormdata(formdata: any) {
        console.log('Adding the following policy:')
        console.log(formdata)
        const policyObject = await createAndSubmitPolicy(formdata)
        if(policyObject) setPolicyList(policyList.concat(policyObject))
    }

    function renderPolicy(policy: SimplePolicy) {
        return (
            <div key={policy.policyLocation} className={`policyentry ${policy.policyIRI === selectedPolicy ? 'selectedentry' : ''}`} onClick={() => setSelectedPolicy(policy.policyIRI)}>
                <p>id: {policy.policyIRI}</p>
                <p>{policy.description}</p>
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
                    <PolicyFormModal addPolicy={addPolicyFromFormdata}/>
                </div>
                <div id="PolicyDisplayScreen">
                    <textarea id="policyview" value={selectedPolicyText} readOnly/>
                </div>
            </div>
        </div>
    )
}

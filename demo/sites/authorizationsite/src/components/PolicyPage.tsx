import { useEffect, useState } from "react";
import { createAndSubmitPolicy, doPolicyFlowFromString, 
    readPolicy, readPolicyDirectory } from "../util/PolicyManagement";
import PolicyFormModal from "./FormModal"
import { SimplePolicy } from "../util/Types";
import { Session } from "@inrupt/solid-client-authn-browser";

export default function PolicyPage({
    session,
    selected
}: {
    session: Session,
    selected: string | undefined
}) { 

    const [policyList, setPolicyList] = useState<SimplePolicy[]>([])
    const [selectedPolicy, setSelectedPolicy] = useState<null|string>(selected || null)
    useEffect(() => {
      async function getPolicies() {
        let policies: SimplePolicy[] = []
        try {
            policies = await readPolicyDirectory();
        } catch (e) { console.warn(e) }
        
        setPolicyList(policies)
      }
      getPolicies()
    }, [])

    async function addPolicyFromFormdata(formdata: any) {    
        const policyObject = await createAndSubmitPolicy(formdata)
        if(policyObject) setPolicyList(policyList.concat(policyObject))       
    }

    function renderPolicy(policy: SimplePolicy) {
        return (
            <div key={policy.policyLocation} className={
                `policyentry ${policy.policyIRI === selectedPolicy ? 'selectedentry' : ''} \
${policy.isSystemPolicy === true ? 'system-policy' : ''}`
            } onClick={() => setSelectedPolicy(policy.policyIRI)}>
                <p>id: {policy.policyIRI}</p>
                <p>{policy.description}</p>
            </div>
        )
    }

    const selectedPolicyText = selectedPolicy 
        ? policyList.filter(p => p.policyIRI === selectedPolicy)[0]?.policyText || ''
        : ''
    console.log('SELECTED', selectedPolicy)

    return (
        <div id="policy-page" className="page-view">
            <div className="columncontainer flex-40">
                <div id="policyList" >
                    {
                        policyList.map(renderPolicy)
                    }
                </div>
                {/* <PolicyFormModal addPolicy={addPolicyFromFormdata}/> */}
            </div>
            <div id="PolicyDisplayScreen" className="flex-60">
                <textarea id="policyview" value={selectedPolicyText} readOnly/>
            </div>
        </div>
    )
}
import { useEffect, useState } from "react";
import { readInstantiationDirectory} from "../util/PolicyManagement";
import { InstantiatedPolicy } from "../util/Types";
import { Session } from "@inrupt/solid-client-authn-browser";

export default function InstantiationPage({
    session,
    navigate
}: {
    session: Session,
    navigate: Function
}) { 

    const [policyList, setPolicyList] = useState<InstantiatedPolicy[]>([])
    const [selectedPolicy, setSelectedPolicy] = useState<null|string>(null)

    useEffect(() => {
      async function getPolicies() {
        let policies: InstantiatedPolicy[] = []
        try {
            policies = await readInstantiationDirectory();
        } catch (e) { console.warn(e) }
        setPolicyList(policies)
      }
      getPolicies()
    }, [])

    const goto = (policyId: string) => {
        navigate(policyId.trim())
    }

    function renderPolicy(policy: InstantiatedPolicy) {
        return (
            <div key={policy.policyLocation} className={
                `policyentry ${policy.policyIRI === selectedPolicy ? 'selectedentry' : ''}`
            } onClick={() => setSelectedPolicy(policy.policyIRI)}>
                <p>id: {policy.policyIRI}</p>
                <p>{policy.description}</p>
                <button onClick={() => { 
                    if (policy["prov:wasDerivedFrom"]) goto(policy["prov:wasDerivedFrom"][0]); 
                }}>derived from policy</button>
            </div>
        )
    }

    const selectedPolicyText = selectedPolicy 
        ? policyList.filter(p => p.policyIRI === selectedPolicy)[0]?.policyText || ''
        : ''

    return (
        <div id="policy-page" className="page-view">
            <div className="columncontainer flex-40">
                <div id="policyList" >
                    {
                        policyList.map(renderPolicy)
                    }
                </div>
            </div>
            <div id="PolicyDisplayScreen" className="flex-60">
                <textarea id="policyview" value={selectedPolicyText} readOnly/>
            </div>
        </div>
    )
}
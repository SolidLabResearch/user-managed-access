import { useEffect, useState } from "react";
import { readCredentialsDirectory } from "../util/CredentialsManagement";
import { VerifiableCredential } from "../util/Types";
import { Session } from "@inrupt/solid-client-authn-browser";

export default function CredentialsPage({
    session
}: {
    session: Session
}) { 

    const [credentialsList, setCredentialsList] = useState<VerifiableCredential[]>([])
    const [selectedCredential, setSelectedCredential] = useState<null|VerifiableCredential>(null)

    useEffect(() => {
      async function getCredentials() {
        let credentials: VerifiableCredential[] = []
        try {
            credentials = await readCredentialsDirectory(session.fetch);
        } catch (_ignored) {}
        
        setCredentialsList(credentials)
      }
      getCredentials()
    }, [])

    // async function addPolicyFromText(policyText: string) {
    //     console.log('Adding the following policy:')
    //     console.log(policyText)
    //     await doPolicyFlowFromString(policyText)
    //     const policyObject = await readPolicy(policyText)
    //     if(policyObject) setPolicyList(policyList.concat(policyObject))
    // }

    function renderCredential(entity: VerifiableCredential) {
        return (
            <div key={entity.id} className={
                `policyentry ${entity.id === selectedCredential?.id ? 'selectedentry' : ''}`
            } onClick={() => setSelectedCredential(entity)}>
                <p>id: {entity.id}</p>
                <p>{entity.description}</p>
            </div>
        )
    }

    const selectedCredentialContents = selectedCredential 
        ? JSON.stringify(credentialsList.filter(c => c.id === selectedCredential.id)[0], null, 2) || ''
        : ''

    return (
        <div id="credentials-page" className="page-view">
            <div className="columncontainer flex-40">
                <div id="credentials-list" >
                    {
                        credentialsList.map(renderCredential)
                    }
                </div>
            </div>
            <div id="PolicyDisplayScreen" className="flex-60">
                <textarea id="policyview" value={selectedCredentialContents} readOnly/>
            </div>
        </div>
    )
}

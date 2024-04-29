/* eslint-disable max-len */
import React, { useEffect, useState } from "react";
import { StoreInfo } from "./Drawer";
import { Card, Grid, Typography } from "@mui/material";
import { AuditEntry } from "../util/Types";
import AuditEntryPage from "./AuditEntryPage";
import { verifyAuditCredentialSignature, verifyAuditTokenSignature, verifyCredentialAgeIsAdult,  } from "../util/verification";


export default function StorePage({ store }: { store: StoreInfo }) {

    const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
    const [selectedEntry, setSelectedEntry] = useState<AuditEntry | undefined>(undefined)

    useEffect(() => {
        async function fetchAuditEntries() {
            const res = await fetch(store.audit)
            const parsedEntries = await res.json() as any;
            return parsedEntries.map((e: any) => {
              e.timestamp = new Date(e.timestamp)
              return e
            })
        }
        fetchAuditEntries().then(entries => setAuditEntries(entries)) //todo: uncomment

    }, [])
    
    return(
        <div id="store-page">
            <h1><a href={store.site}>{store.name}</a></h1>
            <div className="flex-row">
                {/* Data Retrievals */}
                <Grid container className="grid-container">
                  <Grid item xs={4}>
                    <div id="retrievals-listing">
                      <Grid container>
                        {auditEntries.map(entry =>
                          selectedEntry === entry 
                          ? <AuditEntryDisplay key={entry.timestamp.toISOString()+entry.resourceId} entry={entry} selected={true} selectEntry={setSelectedEntry} />  
                          : <AuditEntryDisplay key={entry.timestamp.toISOString()+entry.resourceId} entry={entry} selected={false} selectEntry={setSelectedEntry} />  
                        )}
                      </Grid>
                    </div>
                  </Grid>
                  <Grid item xs={8} className="left-border">
                    {
                      selectedEntry
                      ? <AuditEntryPage entry={selectedEntry} />
                      : <div />
                    }
                  </Grid>
                  
                </Grid>
            </div>
        </div>
    )


}


function AuditEntryDisplay ({entry, selected, selectEntry}: 
  {entry: AuditEntry, selected: boolean, selectEntry: Function}) {

  const [tokenVerified, setTokenVerified] = useState<boolean|undefined>(undefined)
  const [vcVerified, setVCVerified] = useState<boolean|undefined>(undefined)
  const [ageVerified, setAgeVerified] = useState<boolean|undefined>(undefined)

  useEffect(() => {
    async function checkTokenSignature() {
      try {
        const verified = await verifyAuditTokenSignature(entry)
        if (verified) setTokenVerified(true);
        else setTokenVerified(false)
      } catch (e) { setTokenVerified(false) }
    }
    async function checkVCSignature() {
      try {
        const verified = await verifyAuditCredentialSignature(entry)
        if (verified) setVCVerified(true);
        else setVCVerified(false)
      } catch (e) { setVCVerified(false) }
    }
    async function checkAge() {
      try {
        const verified = await verifyCredentialAgeIsAdult(entry)
        if (verified) setAgeVerified(true);
        else setAgeVerified(false)
      } catch (e) { setAgeVerified(false) }
    }
    checkTokenSignature()  
    checkVCSignature()
    checkAge()
  }, [])

  function getVerificationStatus(parameter: boolean | undefined, line: string) {
    let color = 'black'
    let status = 'checking ...'

    if (parameter === false){
      color = 'red'
      status = 'FAILED'
    } else if (parameter === true) {
      color = 'green'
      status = 'VERIFIED'
    } 
    return (
      <Typography variant="subtitle2" style={{color: color}}>
        {line}{status}
      </Typography>
    )
  }

  return (
    <Card key={entry.token} className={`retrieval-resource-card ${
      // todo: better equals check?
      selected ? "selected" : "" 
    }`} onClick={() => { selectEntry(entry) }}>
      <Typography variant="h6">
        {entry.resourceId}
      </Typography>
      <Typography variant="subtitle1">
        {entry.timestamp.toISOString()}
      </Typography>
      {getVerificationStatus(tokenVerified, 'Contract signature: ')}
      {getVerificationStatus(vcVerified, 'Credential signature: ')}
      {getVerificationStatus(ageVerified, 'Age verification: ')}
    </Card>  
  )
}
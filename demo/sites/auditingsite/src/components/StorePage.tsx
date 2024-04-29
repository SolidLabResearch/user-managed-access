/* eslint-disable max-len */
import React, { useEffect, useState } from "react";
import { StoreInfo } from "./Drawer";
import { Card, Grid, Typography } from "@mui/material";
import { AuditEntry } from "../util/Types";
import AuditEntryPage from "./AuditEntryPage";


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
                          <Card key={entry.token} className={`retrieval-resource-card ${
                            // todo: better equals check?
                            selectedEntry === entry ? "selected" : "" 
                          }`} onClick={() => { setSelectedEntry(entry) }}>
                            <Typography variant="h6">
                              {entry.resourceId}
                            </Typography>
                            <Typography variant="subtitle1">
                              {entry.timestamp.toISOString()}
                            </Typography>
                          </Card>    
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
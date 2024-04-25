import express, { Request, Response, response } from 'express';
import { processAgeResult, retrieveData, terms, verifyVCsignature, verifyJwtToken } from './util'
import BackendStore, { Contract, Embedded } from './storage';
import cors from "cors"

const app = express()
const port = 5123
app.use(cors());
app.use(express.json())
app.use((req, res, next) => {
    const {method, url} = req
    console.log(`[store-backend] ${method}\t${url}`)
    next()
})

const storage = new BackendStore();

// Verification Interface

app.get('/verify', async (req: Request, res: Response) => {
    
    let { webid } = req.query
    const webId = webid as string;
    console.log(`[store-backend] processing verification request for ${webId}`)

    // todo: make this take the correct webid and make the age credential to be found from the WebID?

    const credentialURL = terms.views['age-credential'] // todo: fix this

    // 1 negotiate access to age credential
    const { data, token } = await retrieveData(credentialURL, webId);

    // 2 store signed token for ag
    let payload
    try {
        payload = await verifyJwtToken(token, webId);
    } catch (e) {
        const warning = 'Data unusable, as token could not be verified!'
        console.warn(warning)
        res.statusCode = 200;
        res.send({
            "verified": false, // todo: more info & credential verification result
            "message": `verification failed: ${warning}`
        })
    }
    
    // 3 Log token, contract (in token), webId (token verification check) and data as single unit
    const contract = payload.contract as Contract
    const embedded: Embedded = { 
        contract, 
        token, 
        webId, 
        data,
        resourceId: credentialURL,
        timestamp: new Date()
    }
    storage.storeEmbedded(embedded)

    // todo:: check purpose checking etc double check

    // 4 verify age credential signature
    // todo: signature verification currently done on VC service through API.
    // this should be moved to the backend itself in due time?
    let result = await verifyVCsignature('http://localhost:4444/verify', data)
    if (!result.validationResult.valid) {
        res.statusCode = 200;
        res.send({
            "verified": false, // todo: more info & credential verification result
            "message": "Age Credential data validation failed"
        })
    }
    if (!result.verificationResult.verified) {
        res.statusCode = 200;
        res.send({
            "verified": false, // todo: more info & credential verification result
            "message": "Age Credential signature verification failed"
        })
    }    

    // 5 check age
    const decision = await processAgeResult(data, webId)
    
    // 6 return decision
    if (decision) {
        res.statusCode = 200;
        res.send({
            "verified": true,
        })
    } else {
        res.statusCode = 200;
        res.send({
            "verified": false, // todo: more info & credential verification result
            "message": "verification failed"
        })
    }
})

app.get('/audit', (req: Request, res: Response) => {
    const result = storage.getLogs();
    res.status(200)
    res.send(result)
})

app.listen(port, () => {
  console.log(`[store-backend] Store backend listening on port ${port}`)
})

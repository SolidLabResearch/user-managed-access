import express, { Request, Response, response } from 'express';
import { processAgeResult, retrieveData, terms } from './util'
import BackendStore, { Contract, Retrieval } from './storage';

const app = express()
const port = 5123
app.use(express.json())

const storage = new BackendStore();



// Verification Interface

app.get('/verify', async (req: Request, res: Response) => {
    // const { webId } = req.body
    const webId = 'http://localhost:3000/ruben/profile/card#me'

    // todo: make this take the correct webid and make the age credential to be found from the WebID?

    const credentialURL = terms.views['age-credential'] // todo: fix this

    // 1 negotiate access to age credential
    const ageData = await retrieveData(credentialURL, webId);

    // 2 store signed token for age credential location

    // 3 verify age credential signature
    const decision = await processAgeResult(ageData, webId)
    
    // 4 return decision
    if (decision) {
        res.statusCode = 200;
        res.send({
            "verified": true,
        })
    } else {
        res.statusCode = 200;
        res.send({
            "verified": false, // todo: more info & credential verification result
        })
    }
})


// Logging interface

/**
 * POST body of type Contract
 */
app.post('/contract', (req: Request, res: Response) => {
    const contract = req.body as Contract
    storage.storeContract(contract)
    res.status(200);
    res.send({status: 'ok'})
})

/**
 * POST body of type Request
 */
app.post('/data', (req: Request, res: Response) => {
    const bodyJSON = req.body;
    const retrieval: Retrieval = {
        timestamp : new Date(),
        resourceId: bodyJSON.resourceId,
        data: bodyJSON.data
    }
    storage.storeRetrieval(retrieval)
    res.status(200);
    res.send({status: 'ok'})
})

app.get('/audit', (req: Request, res: Response) => {
    const result = storage.getLogs();
    res.status(200)
    res.send(result)
})




app.listen(port, () => {
  console.log(`[store-backend] Store backend listening on port ${port}`)
})




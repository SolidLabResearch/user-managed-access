import express, { Request, Response, response } from 'express';
import { performAgeVerification } from './util'
import BackendStore, { Contract, Retrieval } from './storage';
import { randomUUID } from 'crypto';
import { timeStamp } from 'console';

const app = express()
const port = 5123
app.use(express.json())

const storage = new BackendStore();



// Verification Interface

app.get('/verify', async (req: Request, res: Response) => {
    const { webId } = req.body

    try {
        let verified = await performAgeVerification(webId)
        if(verified) { 
            res.statusCode = 200;
            res.send({
                "verified": true,
            })
          
        } 
      } catch (e) {

        res.send({
            "verified": false,
            "error": e,
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
  console.log(`Example app listening on port ${port}`)
})




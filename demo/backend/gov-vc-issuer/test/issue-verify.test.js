import fs from 'fs'
import path from 'path'
import assert from "node:assert";
import * as mime from "mime-types";

let apiConfig = {
    origin: 'http://localhost',
    port:4444,
    baseUrl: undefined,
    routes: {}
}
apiConfig['baseUrl'] = `${apiConfig.origin}:${apiConfig.port}`
apiConfig.routes = Object.fromEntries(['setup','issue','verify']
    .map(r => [r, new URL(r, apiConfig.baseUrl).toString()]))

const dirResources = './test/resources'
const inputFiles = fs.readdirSync('./test/resources')
    .map(x => {
        const fpath = path.resolve(dirResources, x)
        const contentType = mime.lookup(fpath)
        return { fpath,  contentType }
    })

const podConfig = {
    "email": "government@belgium.be",
    "password": "abc123",
    "css": "http://localhost:8080/",
    "webId": "http://localhost:8080/gov-data-registry/profile/card#me"
}
async function main() {
    console.log('>>> SETUP')
    const setup = async () => {
        await fetch(apiConfig.routes.setup,{
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify(podConfig)
        })
    }
    await setup()
    for await (const f of inputFiles) {
        console.log(`Issue & Verify resource: ${f.fpath} (${f.contentType})`)
        console.log('>>> ISSUE')
        const response = await fetch(apiConfig.routes.issue, {
            method:'POST',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                ...podConfig,
                data: fs.readFileSync(f.fpath, {encoding:'utf-8'}),
                contentType: f.contentType
            })
        })
        if(!response.ok) {
            throw new Error(`Test failed for ${f.fpath}`)
        }
        const vc = await response.json()
        console.log(`VC\n${JSON.stringify(vc, null, 2)}`)

        // VERIFY
        console.log('>>> VERIFY')
        const verificationResultResponse = await fetch(apiConfig.routes.verify, {
            method:'POST',
            headers: { 'content-type': 'application/json'},
            body: JSON.stringify({verifiableCredential: vc})
        })
        const {verificationResult, validationResult} = await verificationResultResponse.json()
        assert(validationResult.valid)
        assert(verificationResult.verified)
        console.log(`${f.fpath} ✅`)
    }

}
main().then().catch(console.error);
export {};

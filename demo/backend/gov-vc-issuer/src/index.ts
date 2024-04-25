import express, {Express} from 'express';
import bodyParser from "body-parser";
import cors from 'cors'

// @ts-ignore
import {JsonLdDocumentLoader} from 'jsonld-document-loader';
import {CredentialSubject} from "@digitalcredentials/vc-data-model/dist/VerifiableCredential";
import {createDocumentLoader, getAuthenticatedFetch, parseToJsonLD} from './utils/index.js';
import {config} from './config.js'
import {
    createCredential,
    createKey,
    exportKeypair,
    preloadDocumentLoaderContexts,
    sign,
    verify
} from "./controller/index.js";

// WebID shenanigans
import rdfParser from 'rdf-parse'
import rdfSerializer from 'rdf-serialize'
import Streamify from 'streamify-string'
import streamToString from 'stream-to-string'

const serviceUrl = 'http://localhost:4444/'
const keyUrl = serviceUrl + 'key'
const webIdDocument = serviceUrl + 'id'
const webId = webIdDocument + '#me'
const pass = 'abc123'

const jdl = new JsonLdDocumentLoader();
preloadDocumentLoaderContexts(jdl)


const key = await createKey(webId, pass, keyUrl)

// Add key description to Solid WebID Profile Document
const publicKeyExport = await exportKeypair(key, {publicKey:true, includeContext:true})


const app: Express = express();
app.use(cors(config.cors))
app.use(bodyParser.json())
app.use((req, res, next) => {
    const {method, url} = req
    console.log(`[${config.name}] ${method}\t${url}`)
    next()
})

app.get('/id', async (req,res)=>{

    const ttlDocument = 
`@prefix foaf: <http://xmlns.com/foaf/0.1/>.
@prefix solid: <http://www.w3.org/ns/solid/terms#>.

<${webIdDocument}> a foaf:PersonalProfileDocument;
    foaf:maker <${webId}>;
    foaf:primaryTopic <${webId}>.
<${webId}> a foaf:Organization;
    <https://w3id.org/security#assertionMethod> <${keyUrl}>;
    <https://w3id.org/security#verificationMethod> <${keyUrl}>.`

  // respond with html page
  if (req.accepts('text/turtle')) {
    res.status(200)
    res.contentType('text/turtle')
    res.send(ttlDocument)
    return;
  }

  let outputContentType;

  // respond with json
  if (req.accepts('application/json')) {
    outputContentType = 'application/ld+json'
  } else if (req.accepts('text/html')) {
    outputContentType = 'application/ld+json'
  } else {
    if (req.accepted) outputContentType = req.accepted[0].value
    else if (req.headers['accept']) outputContentType = req.headers['accept']
    else outputContentType = 'text/turtle'
  }

  const textStream = Streamify(ttlDocument)

  // .default because of some typing errors 
  const quadStream = await (rdfParser as any).default.parse(textStream, { contentType: 'text/turtle' })
  const newTextStream = await (rdfSerializer as any).default
        .serialize(quadStream, { contentType: outputContentType });

  const resultingDocument = await streamToString(newTextStream)
  
  res.status(200)
  res.contentType(outputContentType)
  res.send(resultingDocument)
})

app.get('/key', async (req,res)=>{
    res.header('Content-Type', 'application/json')
    res.send(Buffer.from(JSON.stringify(publicKeyExport,null,2)))
})


app.get('/credential', async (req,res)=>{
    const { webid } = req.query;

    if (!webId) { 
        res.status(400)
        res.send('This request requires a webid parameter')
    }

    const credentialSubject = {
        "@id": webid,
        "http://www.w3.org/2006/vcard/ns#bday": {
            "@value": new Date('1995-04-09').toISOString(),
            "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
        }
    } as CredentialSubject

    const credential = createCredential(
        key,
        credentialSubject
    )

    console.log('credential', credential)

    const signedCredential = await sign({
        key,
        credential,
        documentLoader: createDocumentLoader(jdl)
    })

    console.log('signedCredential', signedCredential)

    res.setHeader('content-type', 'application/json')
    res.send(JSON.stringify(signedCredential))

})


app.post('/verify', async (req,res)=>{
    const verifiableCredential = req.body
    const documentLoader = createDocumentLoader(jdl)

    const {validationResult, verificationResult} =  await verify({
        credential: verifiableCredential,
        documentLoader
    })

    console.log(verificationResult)

    res.send({validationResult, verificationResult})
})

app.listen(config.port, () => {
    console.log(`⚡️[${config.name}]: Server is running at http://localhost:${config.port}`);
})

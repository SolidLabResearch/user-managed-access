
import sign from 'jwt-encode'
import { Parser, Store } from 'n3';

const parser = new Parser()

export const terms = {
    solid: {
        umaServer: 'http://www.w3.org/ns/solid/terms#umaServer',
        viewIndex: 'http://www.w3.org/ns/solid/terms#viewIndex',
        entry: 'http://www.w3.org/ns/solid/terms#entry',
        filter: 'http://www.w3.org/ns/solid/terms#filter',
        location: 'http://www.w3.org/ns/solid/terms#location',
    },
    filters: {
        bday: 'http://localhost:3000/catalog/public/filters/bday',
        age: 'http://localhost:3000/catalog/public/filters/age',
    },
    views: {
        bday: 'http://localhost:3000/ruben/private/derived/bday',
        age: 'http://localhost:3000/ruben/private/derived/age',
    },
    agents: {
        ruben: 'http://localhost:3000/ruben/profile/card#me',
        vendor: 'http://localhost:5123/id',
        present: 'http://localhost:3000/demo/public/bday-app',
    },
    scopes: {
        read: 'urn:example:css:modes:read',
    }
}

/* Helper functions */

export function log(msg: string, obj?: any) {
    console.log('');
    console.log(msg);
    if (obj) {
      console.log('\n');
      console.log(obj);
    }
  }
  
// creates the container if it does not exist yet (only when access is there)
export async function initContainer(container: string): Promise<void> {
    const res = await fetch(container)
    if (res.status === 404) {
        const res = await fetch(container, {
        method: 'PUT'
        })
        if (res.status !== 201) {
        log('Creating container at ' + container + ' not successful'); throw 0;
        }
    }
}


export async function fetchThroughUMA(documentURI: string, webId: string, fetch: Function): 
  Promise<{ data: string, token?: any }> {

    
    const umaServer = await getUmaServerForWebID(webId)
    if (!umaServer) throw new Error('Could not discover UMA service'); 
    const configUrl = new URL('.well-known/uma2-configuration', umaServer);
    const umaConfig: any = await (await fetch(configUrl)).json();
    const tokenEndpoint: any = umaConfig.token_endpoint;
  
    const accessRequest = {
      permissions: [{
        resource_id: documentURI,
        resource_scopes: [ terms.scopes.read ],
      }]
    };

    const data = {
        "http://www.w3.org/ns/odrl/2/purpose": "urn:solidlab:uma:claims:purpose:use",
        "urn:solidlab:uma:claims:types:webid": "http://localhost:3000/ruben/profile/card#me"
      }
      // todo: Have a store public key and use this to sign (though it's https is it really necessary?)
      const secret = ('store public key') // todo: this should be the public key
      
      const claim_token = sign(data, secret)
    
    log(JSON.stringify(accessRequest))
  
    let tokenEndpointResponse = await fetch(tokenEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...accessRequest,
          claim_token_format: 'urn:solidlab:uma:claims:formats:jwt',
          claim_token,
        })
    });
  
    if (tokenEndpointResponse.status === 403) { 
      try {
        const { ticket, required_claims }: any = await tokenEndpointResponse.json();
        if (!ticket || !required_claims) { // There is no negotiation 
          throw new Error('Resource does not exist or you have insufficient permissions to access the resource.') 
        }
  
        tokenEndpointResponse = await fetch(tokenEndpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...accessRequest,
            ticket,
            claim_token_format: 'urn:solidlab:uma:claims:formats:jwt',
            claim_token,
          })
        });
      } catch(e) {
        throw e
      } 
    }
  
    if (tokenEndpointResponse.status !== 200) { 
        log('Access request failed despite policy...'); 
        throw new Error("Access request failed despite policy..."); 
    }
      
    const tokenParams: any = await tokenEndpointResponse.json();
  
    // Retrieving document with access token
  
    const accessWithTokenResponse = await fetch(documentURI, {
      headers: { 'Authorization': `${tokenParams.token_type} ${tokenParams.access_token}` }
    });
  
    if (accessWithTokenResponse.status !== 200) { 
        log('Access with token failed...'); 
        throw new Error("Access with token failed..."); 
    }
  
    let result = await accessWithTokenResponse.text()
    
    return { data: result, token: tokenParams.access_token }
}


async function getUmaServerForWebID(webId: string) {
    let profileText;
    let webIdData: Store;
    try {
      profileText = await (await fetch(webId, {headers: { "accept": 'text-turtle'}})).text()
      webIdData = new Store(parser.parse(profileText));
    } catch (e: any) {
      log(e)
      throw new Error('Could not read WebID information')
    }
    return webIdData.getObjects(webId, terms.solid.umaServer, null)[0]?.value;
  }
  
  
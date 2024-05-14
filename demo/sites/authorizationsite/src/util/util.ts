

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
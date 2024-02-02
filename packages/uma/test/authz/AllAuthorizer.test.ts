import {AllAuthorizer} from './AllAuthorizer';
import {Authorizer} from '../models/Authorizer';

const WEBID = 'https://example.com/profile/alice#me';
const CLIENT = 'https://projectapp.com';
const RESOURCE = 'https://pods.example.com/test/123.ttl';

test('It should grant all modes in constructor', async () => {
  const authorizer: Authorizer = new AllAuthorizer();

  expect(await authorizer.authorize({
    webId: WEBID, 
    clientId: CLIENT
  }, [{
    resource_id: RESOURCE,
    resource_scopes: ['read']
  }])).toEqual(new Set(['read']));
});

test('It should grant all modes by default', async () => {
  const authorizer: Authorizer = new AllAuthorizer();

  expect(await authorizer.authorize({
    webId: WEBID, 
    clientId: CLIENT
  }, [{
    resource_id: RESOURCE,
    resource_scopes: ['read']
  }])).toEqual(
      new Set(['read', 'write', 'create', 'delete', 'append']));
});

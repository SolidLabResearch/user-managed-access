import { Type, array, optional as $, string, dict } from '../util/ReType';

export const ResourceDescription = {
  resource_scopes: array(string),
  resource_defaults: $(dict(array(string))),
  resource_relations: $(dict(array(string))),
  type: $(string),
  name: $(string),
  icon_uri: $(string),
  description: $(string),
};

export type ResourceDescription = Type<typeof ResourceDescription>;

const blaVal = { test: $(dict(array(string))) };
type Bla = Type<typeof blaVal>;
const bla: Bla = { test: { a: ['5']} };
console.log(bla);

const rd: ResourceDescription = {
  resource_scopes: [],
  resource_defaults: { a: ['5'] },
};
rd.resource_relations = { b: [ 'c' ] };
console.log(rd);

const description: ResourceDescription = {
  resource_scopes: [
    'urn:example:css:modes:read',
    'urn:example:css:modes:append',
    'urn:example:css:modes:create',
    'urn:example:css:modes:delete',
    'urn:example:css:modes:write',
  ],
};
description.resource_defaults = { 'http://www.w3.org/ns/ldp#contains': description.resource_scopes };

export const SETUP_POLICIES = (
    resourceParent: string,
    resourceURL: string,
    resourceOwner: string
) => `
@prefix ex: <http://example.org/> .
@prefix odrl: <http://www.w3.org/ns/odrl/2/> .

ex:setupPolicy1 a odrl:Agreement ;
                odrl:permission ex:setupPermission1 ;
                odrl:uid ex:setupPolicy1 .
ex:setupPermission1 a odrl:Permission ;
               odrl:action odrl:modify ;
               odrl:target <${resourceURL}> ;
               odrl:assignee <${resourceOwner}> ;
               odrl:assigner <${resourceOwner}> .

ex:setupPolicy1a a odrl:Agreement ;
                 odrl:permission ex:setupPermission1a ;
                 odrl:uid ex:setupPolicy1a .
ex:setupPermission1a a odrl:Permission ;
                odrl:action odrl:create ;
                odrl:target <${resourceURL}> ;
                odrl:assignee <${resourceOwner}> ;
                odrl:assigner <${resourceOwner}> .

ex:setupPolicy2 a odrl:Agreement ;
                odrl:permission ex:setupPermission2 ;
                odrl:uid ex:setupPolicy2 .
ex:setupPermission2 a odrl:Permission ;
               odrl:action odrl:modify ;
               odrl:target <${resourceParent}> ;
               odrl:assignee <${resourceOwner}> ;
               odrl:assigner <${resourceOwner}> .

ex:setupPolicy2a a odrl:Agreement ;
                 odrl:permission ex:setupPermission2a ;
                 odrl:uid ex:setupPolicy2a .
ex:setupPermission2a a odrl:Permission ;
                odrl:action odrl:create ;
                odrl:target <${resourceParent}> ;
                odrl:assignee <${resourceOwner}> ;
                odrl:assigner <${resourceOwner}> .

ex:setupPolicy3 a odrl:Agreement ;
                odrl:uid ex:setupPolicy3 ;
                odrl:permission ex:setupPermission3 .
ex:setupPermission3 a odrl:Permission ;
               odrl:action odrl:read ;
               odrl:target <${resourceURL}> ;
               odrl:assignee <${resourceOwner}> ;
               odrl:assigner <${resourceOwner}> .
`;

export const ACCESS_REQUEST = (resourceURL: string, requestingParty: string) => `
@prefix sotw: <https://w3id.org/force/sotw#> .
@prefix odrl: <http://www.w3.org/ns/odrl/2/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix ex: <http://example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

ex:request a sotw:EvaluationRequest ;
      dcterms:issued "${new Date().toISOString()}"^^xsd:datetime ;
      sotw:requestedTarget <${resourceURL}> ;
      sotw:requestedAction odrl:read ;
      sotw:requestingParty <${requestingParty}> ;
      ex:requestStatus ex:requested .
`;

export const accessRequestID = 'http://example.org/request';

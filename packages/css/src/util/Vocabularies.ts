import { createVocabulary } from '@solid/community-server';

export const DCTERMS = createVocabulary(
  'http://purl.org/dc/terms/',
  'issued'
);

export const DPV = createVocabulary(
  'https://w3id.org/dpv#',
  'hasData',
  'hasDataSubject',
);

export const ODRL = createVocabulary(
  'http://www.w3.org/ns/odrl/2/',
  'hasPolicy'
);

export const TE = createVocabulary(
  'https://w3id.org/trustenvelope#',
  'DataProvenance',
  'PolicyProvenance',
  'TrustEnvelope',
  'provenance',
  'recipient',
  'rightsHolder',
  'sender',
  'sign',
);

export const UMA = createVocabulary('http://www.w3.org/ns/solid/uma#',
    // 'userMode',
    // 'publicMode',
    // 'ticketNeeds',
    // 'ticketSubject',
    'as'
);

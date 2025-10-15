import { createVocabulary } from 'rdf-vocabulary';

export const MODES = createVocabulary(
  'urn:example:css:modes:',
  'append',
  'read',
  'create',
  'delete',
  'write',
);

export const UMA = createVocabulary('http://www.w3.org/ns/solid/uma#',
    // 'userMode',
    // 'publicMode',
    // 'ticketNeeds',
    // 'ticketSubject',
    'as'
);

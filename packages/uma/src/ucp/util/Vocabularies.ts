import { DC as DC_CSS } from '@solid/community-server';
import { createVocabulary, extendVocabulary } from 'rdf-vocabulary';

export const DC = extendVocabulary(DC_CSS,'creator');

export const ODRL = createVocabulary(
    'http://www.w3.org/ns/odrl/2/',
    'AssetCollection',
    'Agreement',
    'Offer',
    'Permission',
    'Prohibition',
    'Duty',
    'Request',
    'Constraint',
    'source',
    'partOf',
    'action',
    'target',
    'assignee',
    'assigner',
    'constraint',
    'operator',
    'permission',
    'prohibition',
    'duty',
    'dateTime',
    'purpose',
    'leftOperand',
    'rightOperand',
    'gt',
    'lt',
    'eq',
    'uid',
    'read',
);

export const ODRL_P = createVocabulary(
  'https://w3id.org/force/odrl3proposal#',
  'relation',
);

export const OWL = createVocabulary(
  'http://www.w3.org/2002/07/owl#',
  'inverseOf',
);

export const SOTW = createVocabulary(
  'https://w3id.org/force/sotw#',
  'EvaluationRequest',
  'accepted',
  'denied',
  'requested',
  'requestedAction',
  'requestedTarget',
  'requestingParty',
  'requestStatus',
);

export const UMA_SCOPES = createVocabulary(
  'urn:knows:uma:scopes:',
  'derivation-creation',
  'derivation-read',
);

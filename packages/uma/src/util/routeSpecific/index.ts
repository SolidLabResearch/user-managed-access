export * from './post';
export * from './delete';
export * from './get';
export * from './patch';

import { QueryEngine } from '@comunica/query-sparql';
export const queryEngine = new QueryEngine();

export * from './post-sanitization';
export * from './delete-sanitization';
export * from './get-sanitization';
export * from './patch-sanitization';

import { QueryEngine } from '@comunica/query-sparql';
export const queryEngine = new QueryEngine();

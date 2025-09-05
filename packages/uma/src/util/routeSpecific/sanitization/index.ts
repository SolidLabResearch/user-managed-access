export * from './postSanitization';
export * from './deleteSanitization';
export * from './getSanitization';
export * from './patchSanitization';

import { QueryEngine } from '@comunica/query-sparql';
export const queryEngine = new QueryEngine();

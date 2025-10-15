import { InternalServerError } from '@solid/community-server';
import { PERMISSIONS } from '@solidlab/policy-engine';
import { VocabularyValue } from 'rdf-vocabulary';
import { MODES } from '../util/Vocabularies';

const modeMap = {
  [PERMISSIONS.Append]: MODES.append,
  [PERMISSIONS.Create]: MODES.create,
  [PERMISSIONS.Delete]: MODES.delete,
  [PERMISSIONS.Modify]: MODES.write,
  [PERMISSIONS.Read]: MODES.read,
} as const;

// TODO: MODES are also needed in uma package though (OdrlAuthorizer and RequestProcessing)

const scopeMap = Object.fromEntries(Object.entries(modeMap)
  .map(([ mode, scope ]) => [ scope, mode ])
) as Record<VocabularyValue<typeof MODES>, VocabularyValue<typeof PERMISSIONS>>;

export function toUmaScope(mode: VocabularyValue<typeof PERMISSIONS>): VocabularyValue<typeof MODES> {
  if (!mode.startsWith(PERMISSIONS.namespace)) {
    throw new InternalServerError(`Trying to convert unknown permission: ${mode}`);
  }
  return modeMap[mode];
}

export function toCssMode(scope: VocabularyValue<typeof MODES>): VocabularyValue<typeof PERMISSIONS> {
  if (!scope.startsWith(MODES.namespace)) {
    throw new InternalServerError(`Trying to convert unknown scope: ${scope}`);
  }
  return scopeMap[scope];
}

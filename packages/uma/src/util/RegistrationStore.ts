import { KeyValueStorage } from '@solid/community-server';
import { ResourceDescription } from '../views/ResourceDescription';

export type Registration = {
  owner: string,
  description: ResourceDescription,
}

export type RegistrationStore = KeyValueStorage<string, Registration>;

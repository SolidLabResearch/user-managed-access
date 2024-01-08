import { AccessMap } from '@solid/community-server';
import { isString } from '../../util/StringGuard';
import fetch from 'cross-fetch';

/**
   * Fetches a permission ticket from the Permission Registration endpoint of the UMA Authorization Server.
   *
   * @param {AccessMap} permissions - the requested permissions
   * @param {string} endpoint - the authorization server permissions endpoint
   * @param {string} pat - the AS PAT 
   */
export async function fetchPermissionTicket(
  permissions: AccessMap, 
  endpoint: string, 
  pat: string
): Promise<string | undefined> {
  const body = [];

  for (const [ target, modes ] of permissions.entrySets()) {
    body.push({
      resource_id: target.path,
      resource_scopes: Array.from(modes)
    });
  }

  const request = {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${pat}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  };

  const response = await fetch(endpoint, request);

  if (response.status === 200) return undefined;

  if (response.status !== 201) {
    throw new Error(`Error while retrieving UMA Ticket: Received status ${response.status} from '${endpoint}'.`);
  }

  const json = await response.json();

  if (!json.ticket || !isString(json.ticket)) {
    throw new Error('Invalid response from UMA AS: missing or invalid \'ticket\'.');
  }

  return json.ticket;
}

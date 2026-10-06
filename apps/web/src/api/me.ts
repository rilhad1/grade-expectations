import {
  meResponseSchema,
  publicConfigSchema,
  type MeResponse,
  type PublicConfig,
} from '@ge/shared';

import { cachedFetch } from '../offline/cache';

export class UnauthenticatedError extends Error {
  constructor() {
    super('UNAUTHENTICATED');
  }
}

/** Профіль кешується в локальній базі: без інтернету застосунок запускається з останнім відомим. */
export const fetchMe = (): Promise<MeResponse> =>
  cachedFetch('me', async () => {
    const res = await fetch('/api/v1/me');
    if (res.status === 401) throw new UnauthenticatedError();
    if (!res.ok) throw new Error(`me: ${res.status}`);
    return meResponseSchema.parse(await res.json());
  });

export async function fetchPublicConfig(): Promise<PublicConfig> {
  const res = await fetch('/api/v1/public-config');
  if (!res.ok) throw new Error(`public-config: ${res.status}`);
  return publicConfigSchema.parse(await res.json());
}

import {
  meResponseSchema,
  publicConfigSchema,
  type MeResponse,
  type PublicConfig,
} from '@ge/shared';

export class UnauthenticatedError extends Error {
  constructor() {
    super('UNAUTHENTICATED');
  }
}

export async function fetchMe(): Promise<MeResponse> {
  const res = await fetch('/api/v1/me');
  if (res.status === 401) throw new UnauthenticatedError();
  if (!res.ok) throw new Error(`me: ${res.status}`);
  return meResponseSchema.parse(await res.json());
}

export async function fetchPublicConfig(): Promise<PublicConfig> {
  const res = await fetch('/api/v1/public-config');
  if (!res.ok) throw new Error(`public-config: ${res.status}`);
  return publicConfigSchema.parse(await res.json());
}

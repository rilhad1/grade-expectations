import { healthResponseSchema, type HealthResponse } from '@ge/shared';

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/api/v1/health');
  if (!res.ok) throw new Error(`health: ${res.status}`);
  return healthResponseSchema.parse(await res.json());
}

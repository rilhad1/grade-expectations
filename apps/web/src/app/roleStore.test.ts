import { beforeEach, describe, expect, it } from 'vitest';

import { resolveActiveRole, useRoleStore } from './roleStore';

describe('resolveActiveRole', () => {
  it('бере обрану роль, якщо вона доступна', () => {
    expect(resolveActiveRole(['TEACHER', 'MODERATOR'], 'MODERATOR')).toBe('MODERATOR');
  });
  it('якщо обраної ролі немає — перша доступна', () => {
    expect(resolveActiveRole(['TEACHER'], 'MODERATOR')).toBe('TEACHER');
    expect(resolveActiveRole(['TEACHER', 'MODERATOR'], null)).toBe('TEACHER');
  });
  it('без ролей — null', () => {
    expect(resolveActiveRole([], 'TEACHER')).toBeNull();
  });
});

describe('useRoleStore', () => {
  beforeEach(() => {
    useRoleStore.getState().reset();
  });
  it('запам’ятовує й скидає роль', () => {
    useRoleStore.getState().setPreferredRole('MODERATOR');
    expect(useRoleStore.getState().preferredRole).toBe('MODERATOR');
    useRoleStore.getState().reset();
    expect(useRoleStore.getState().preferredRole).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';

import { can, type Action, type Membership, type Resource } from './permissions.js';

const org = 'org1';
const teacher: Membership = { userId: 'u-teacher', organizationId: org, roles: ['TEACHER'] };
const moderator: Membership = { userId: 'u-mod', organizationId: org, roles: ['MODERATOR'] };
const both: Membership = { userId: 'u-both', organizationId: org, roles: ['TEACHER', 'MODERATOR'] };

const own = (m: Membership): Resource => ({ organizationId: org, teacherId: m.userId });
const foreign: Resource = { organizationId: org, teacherId: 'someone-else' };

const OWN_ACTIONS: Action[] = [
  'lesson:update',
  'attendance:write',
  'grade:write',
  'assessment:write',
  'attestation:write',
  'program:write',
  'gradingRules:write',
  'request:create',
];
const STRUCTURE_ACTIONS: Action[] = [
  'structure:write',
  'load:write',
  'schedule:write',
  'schedule:publish',
  'request:resolve',
];

describe('can: TEACHER', () => {
  it.each(OWN_ACTIONS)('%s: дозволено у своєму навантаженні', (action) => {
    expect(can(teacher, action, own(teacher))).toBe(true);
  });

  it.each(OWN_ACTIONS)('%s: заборонено у чужому навантаженні', (action) => {
    expect(can(teacher, action, foreign)).toBe(false);
  });

  it('змінити оцінку в чужому навантаженні заборонено', () => {
    expect(can(teacher, 'grade:write', foreign)).toBe(false);
  });

  it.each(STRUCTURE_ACTIONS)('%s: заборонено', (action) => {
    expect(can(teacher, action, own(teacher))).toBe(false);
  });

  it('читає довідники й навантаження, але розклад лише опублікований', () => {
    expect(can(teacher, 'directory:read', { organizationId: org })).toBe(true);
    expect(can(teacher, 'load:read', { organizationId: org })).toBe(true);
    expect(
      can(teacher, 'schedule:read', { organizationId: org, scheduleStatus: 'PUBLISHED' }),
    ).toBe(true);
    expect(can(teacher, 'schedule:read', { organizationId: org, scheduleStatus: 'DRAFT' })).toBe(
      false,
    );
    expect(can(teacher, 'schedule:read', { organizationId: org })).toBe(false);
  });

  it('журнал і атестації читає лише свої', () => {
    expect(can(teacher, 'gradebook:read', own(teacher))).toBe(true);
    expect(can(teacher, 'gradebook:read', foreign)).toBe(false);
    expect(can(teacher, 'attestation:read', foreign)).toBe(false);
  });
});

describe('can: MODERATOR', () => {
  it.each(STRUCTURE_ACTIONS)('%s: дозволено', (action) => {
    expect(can(moderator, action, { organizationId: org })).toBe(true);
  });

  it.each(['schedule:read', 'gradebook:read', 'attestation:read', 'directory:read'] as Action[])(
    '%s: читає все, зокрема чернетки',
    (action) => {
      expect(
        can(moderator, action, { organizationId: org, teacherId: 'x', scheduleStatus: 'DRAFT' }),
      ).toBe(true);
    },
  );

  it.each(['grade:write', 'attendance:write', 'attestation:write', 'lesson:update'] as Action[])(
    '%s: редагування чужих оцінок не дозволено (OQ-3)',
    (action) => {
      expect(can(moderator, action, foreign)).toBe(false);
    },
  );
});

describe('can: кілька ролей', () => {
  it('поєднує права: структура + власні пари', () => {
    expect(can(both, 'schedule:publish', { organizationId: org })).toBe(true);
    expect(can(both, 'grade:write', own(both))).toBe(true);
    expect(can(both, 'grade:write', foreign)).toBe(false);
  });
});

describe('can: ізоляція коледжів', () => {
  it('заборонено все для іншої організації', () => {
    const other: Resource = {
      organizationId: 'org2',
      teacherId: teacher.userId,
      scheduleStatus: 'PUBLISHED',
    };
    expect(can(teacher, 'grade:write', other)).toBe(false);
    expect(can(moderator, 'schedule:publish', other)).toBe(false);
    expect(can(teacher, 'schedule:read', other)).toBe(false);
  });

  it('користувач без ролей не має прав', () => {
    expect(
      can({ userId: 'u', organizationId: org, roles: [] }, 'directory:read', {
        organizationId: org,
      }),
    ).toBe(false);
  });
});

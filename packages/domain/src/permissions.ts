import type { Role } from '@ge/shared';

export type Action =
  // читання
  | 'schedule:read'
  | 'directory:read'
  | 'load:read'
  | 'gradebook:read'
  | 'attestation:read'
  // структура (деканат)
  | 'structure:write' // роки, семестри, групи, потоки, студенти, зарахування, дисципліни, аудиторії, дзвінки
  | 'load:write'
  | 'schedule:write'
  | 'schedule:publish'
  | 'request:resolve'
  // робота викладача над своїми навантаженнями
  | 'lesson:update'
  | 'attendance:write'
  | 'grade:write'
  | 'assessment:write'
  | 'attestation:write'
  | 'program:write'
  | 'gradingRules:write'
  | 'request:create';

export interface Membership {
  userId: string;
  organizationId: string;
  roles: readonly Role[];
}

export interface Resource {
  organizationId: string;
  /** Викладач навантаження/заняття, якого стосується дія. */
  teacherId?: string;
  /** Для schedule:read — статус версії розкладу. */
  scheduleStatus?: 'DRAFT' | 'PUBLISHED';
}

const MODERATOR_ACTIONS: ReadonlySet<Action> = new Set<Action>([
  'schedule:read',
  'directory:read',
  'load:read',
  'gradebook:read',
  'attestation:read',
  'structure:write',
  'load:write',
  'schedule:write',
  'schedule:publish',
  'request:resolve',
  // TODO(OQ-3): редагування оцінок і відвідуваності модератором заборонене, доки не вирішено
]);

const TEACHER_READ: ReadonlySet<Action> = new Set<Action>(['directory:read', 'load:read']);

/** Дії викладача лише над власними навантаженнями. */
const TEACHER_OWN: ReadonlySet<Action> = new Set<Action>([
  'gradebook:read',
  'attestation:read',
  'lesson:update',
  'attendance:write',
  'grade:write',
  'assessment:write',
  'attestation:write',
  'program:write',
  'gradingRules:write',
  'request:create',
]);

/** Єдине місце перевірки прав; клієнт лише ховає недоступні дії. */
export function can(membership: Membership, action: Action, resource: Resource): boolean {
  if (membership.organizationId !== resource.organizationId) return false;

  if (membership.roles.includes('MODERATOR') && MODERATOR_ACTIONS.has(action)) return true;

  if (membership.roles.includes('TEACHER')) {
    if (TEACHER_READ.has(action)) return true;
    if (action === 'schedule:read') return resource.scheduleStatus === 'PUBLISHED';
    if (TEACHER_OWN.has(action)) return resource.teacherId === membership.userId;
  }
  return false;
}

import type { Role } from '@ge/shared';

import { uk } from '../shared/i18n/uk';

export interface NavItem {
  to:
    | '/'
    | '/gradebook'
    | '/schedule'
    | '/my-disciplines'
    | '/attestations'
    | '/hours'
    | '/profile'
    | '/admin/schedule-builder'
    | '/admin/semesters'
    | '/admin/groups'
    | '/admin/loads'
    | '/admin/requests'
    | '/admin/directory'
    | '/admin/moderation';
  label: string;
  /** Показувати лічильник нових запитів. */
  badge?: 'requests';
}

const teacher: NavItem[] = [
  { to: '/', label: uk.nav.today },
  { to: '/schedule', label: uk.nav.schedule },
  { to: '/gradebook', label: uk.nav.gradebook },
  { to: '/my-disciplines', label: uk.nav.myDisciplines },
  { to: '/attestations', label: uk.nav.attestations },
  { to: '/hours', label: uk.nav.hours },
  { to: '/profile', label: uk.nav.profile },
];

const moderator: NavItem[] = [
  { to: '/', label: uk.nav.today },
  { to: '/schedule', label: uk.nav.schedule },
  { to: '/gradebook', label: uk.nav.gradebook },
  { to: '/my-disciplines', label: uk.nav.myDisciplines },
  { to: '/attestations', label: uk.nav.attestations },
  { to: '/hours', label: uk.nav.hours },
  { to: '/profile', label: uk.nav.profile },
  { to: '/admin/schedule-builder', label: uk.nav.scheduleBuilder },
  { to: '/admin/semesters', label: uk.nav.semesters },
  { to: '/admin/groups', label: uk.nav.groups },
  { to: '/admin/loads', label: uk.nav.loads },
  { to: '/admin/requests', label: uk.nav.requests, badge: 'requests' },
  { to: '/admin/directory', label: uk.nav.directory },
  { to: '/admin/moderation', label: uk.nav.moderation },
];

/** Навігація залежить від активної ролі (перемикач у меню користувача). */
export const navFor = (role: Role | null): NavItem[] =>
  role === 'MODERATOR' ? moderator : teacher;

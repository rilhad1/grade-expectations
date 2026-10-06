import type { Role } from '@ge/shared';
import type { SvgIconComponent } from '@mui/icons-material';
import CalendarTodayOutlined from '@mui/icons-material/CalendarTodayOutlined';
import CalendarViewWeekOutlined from '@mui/icons-material/CalendarViewWeekOutlined';
import DashboardCustomizeOutlined from '@mui/icons-material/DashboardCustomizeOutlined';
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined';
import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined';
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import LayersOutlined from '@mui/icons-material/LayersOutlined';
import LibraryBooksOutlined from '@mui/icons-material/LibraryBooksOutlined';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined';
import ShieldOutlined from '@mui/icons-material/ShieldOutlined';
import SwapHorizOutlined from '@mui/icons-material/SwapHorizOutlined';
import WorkOutlineOutlined from '@mui/icons-material/WorkOutlineOutlined';

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
  icon: SvgIconComponent;
  /** Розділ навігації: загальний чи «Деканат». */
  section: 'main' | 'dean';
  /** Показувати лічильник нових запитів. */
  badge?: 'requests';
}

const teacher: NavItem[] = [
  { to: '/', label: uk.nav.today, icon: CalendarTodayOutlined, section: 'main' },
  { to: '/schedule', label: uk.nav.schedule, icon: CalendarViewWeekOutlined, section: 'main' },
  { to: '/gradebook', label: uk.nav.gradebook, icon: MenuBookOutlined, section: 'main' },
  { to: '/attestations', label: uk.nav.attestations, icon: FactCheckOutlined, section: 'main' },
  { to: '/my-disciplines', label: uk.nav.myDisciplines, icon: LayersOutlined, section: 'main' },
  { to: '/hours', label: uk.nav.hours, icon: ScheduleOutlined, section: 'main' },
  { to: '/profile', label: uk.nav.profile, icon: FileDownloadOutlined, section: 'main' },
];

const dean: NavItem[] = [
  {
    to: '/admin/schedule-builder',
    label: uk.nav.scheduleBuilder,
    icon: DashboardCustomizeOutlined,
    section: 'dean',
  },
  { to: '/admin/semesters', label: uk.nav.semesters, icon: EventNoteOutlined, section: 'dean' },
  { to: '/admin/groups', label: uk.nav.groups, icon: GroupsOutlined, section: 'dean' },
  { to: '/admin/loads', label: uk.nav.loads, icon: WorkOutlineOutlined, section: 'dean' },
  { to: '/admin/directory', label: uk.nav.directory, icon: LibraryBooksOutlined, section: 'dean' },
  {
    to: '/admin/requests',
    label: uk.nav.requests,
    icon: SwapHorizOutlined,
    section: 'dean',
    badge: 'requests',
  },
  { to: '/admin/moderation', label: uk.nav.moderation, icon: ShieldOutlined, section: 'dean' },
];

/** Навігація залежить від активної ролі (перемикач у меню користувача). */
export const navFor = (role: Role | null): NavItem[] =>
  role === 'MODERATOR' ? [...teacher, ...dean] : teacher;

/** Розділи, що відкриваються нижньою панеллю на телефоні; решта — на сторінці «Ще». */
export const MOBILE_PRIMARY: readonly NavItem['to'][] = ['/', '/schedule', '/gradebook'];

import type {
  AttendanceStatus,
  ControlForm,
  GradeKind,
  IsoDate,
  LessonKind,
  LessonStatus,
  ParityAfterBreak,
  PeriodKind,
  SlotParity,
  WeekParity,
} from '@ge/shared';

export interface SemesterPeriodInput {
  kind: PeriodKind;
  startDate: IsoDate;
  endDate: IsoDate;
}

export interface SemesterInput {
  startDate: IsoDate;
  endDate: IsoDate;
  firstWeekParity: WeekParity;
  parityAfterBreak: ParityAfterBreak;
  periods: readonly SemesterPeriodInput[];
}

export interface ScheduleSlotInput {
  id: string;
  loadId: string;
  /** 1 = понеділок … 6 = субота */
  weekday: number;
  pairNumber: number;
  parity: SlotParity;
  roomId: string | null;
  validFrom: IsoDate;
  validTo: IsoDate | null;
}

export interface LoadInput {
  id: string;
  groupId: string;
  subgroupId: string | null;
  teacherId: string;
  kind: LessonKind;
  plannedHours: number;
  controlForm: ControlForm;
}

export interface ExistingLesson {
  id: string;
  loadId: string;
  slotId: string | null;
  date: IsoDate;
  pairNumber: number;
  status: LessonStatus;
  /** Є відмітки відвідуваності або оцінки. */
  hasMarks: boolean;
  /** Змінене вручну (дата, пара, аудиторія, статус). */
  manuallyEdited: boolean;
}

export interface GeneratedLesson {
  loadId: string;
  slotId: string;
  date: IsoDate;
  pairNumber: number;
  roomId: string | null;
  scheduleVersion: number;
}

export interface GradeInput {
  kind: GradeKind;
  value: number;
  date: IsoDate;
  /** Пропущена контрольна (значення ігнорується; див. rules.missedTest). */
  missed?: boolean;
}

export interface AttendanceInput {
  status: AttendanceStatus;
  date: IsoDate;
}

export interface DateRange {
  from: IsoDate;
  to: IsoDate;
}

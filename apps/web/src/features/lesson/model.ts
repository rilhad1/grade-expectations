import type {
  AttendanceStatus,
  GradeEntry,
  LessonDetailDto,
  LessonKind,
  RosterEntry,
} from '@ge/shared';

type Scale = LessonDetailDto['scale'];
type GradeKindValue = GradeEntry['kind'];

/** Тап по студенту: присутній ↔ «н»; інші стани (нп, з) повертаються в «присутній». */
export function toggleAbsent(current: AttendanceStatus): AttendanceStatus {
  return current === 'PRESENT' ? 'ABSENT' : 'PRESENT';
}

/** Значення, які пропонує клавіатура оцінок для шкали (100-бальна вводиться вручну). */
export function keypadValues(scale: Scale): number[] | null {
  if (scale === 'TWELVE') return Array.from({ length: 12 }, (_, i) => i + 1);
  if (scale === 'FIVE') return [1, 2, 3, 4, 5];
  return null;
}

export const scaleRange: Record<Scale, { min: number; max: number }> = {
  TWELVE: { min: 1, max: 12 },
  FIVE: { min: 1, max: 5 },
  HUNDRED: { min: 0, max: 100 },
  PASS_FAIL: { min: 0, max: 1 },
};

export const isValidGrade = (scale: Scale, value: number): boolean =>
  Number.isInteger(value) && value >= scaleRange[scale].min && value <= scaleRange[scale].max;

/** Тип оцінки за замовчуванням з виду заняття. */
export function defaultGradeKind(kind: LessonKind): GradeKindValue {
  if (kind === 'LAB') return 'LAB';
  if (kind === 'PRACTICE') return 'PRACTICE';
  if (kind === 'CONTROL') return 'TEST';
  return 'ORAL';
}

/** «Присутні 22 з 25»: усі, хто не «н» і не «нп» (запізнілий присутній). */
export function presentCount(roster: readonly RosterEntry[]): number {
  return roster.filter((r) => r.attendance === 'PRESENT' || r.attendance === 'LATE').length;
}

/** Оптимістична відмітка: оновлює локальну копію заняття до відповіді сервера. */
export function withAttendance(
  detail: LessonDetailDto,
  enrollmentId: string,
  status: AttendanceStatus,
): LessonDetailDto {
  return {
    ...detail,
    roster: detail.roster.map((r) =>
      r.enrollmentId === enrollmentId ? { ...r, attendance: status, marked: true } : r,
    ),
  };
}

export function withGrade(
  detail: LessonDetailDto,
  enrollmentId: string,
  grade: Pick<GradeEntry, 'id' | 'kind' | 'value' | 'comment'>,
): LessonDetailDto {
  return {
    ...detail,
    roster: detail.roster.map((r) => {
      if (r.enrollmentId !== enrollmentId) return r;
      const exists = r.grades.some((g) => g.id === grade.id);
      const next: GradeEntry = {
        ...grade,
        version: r.grades.find((g) => g.id === grade.id)?.version ?? 0,
      };
      return {
        ...r,
        grades: exists ? r.grades.map((g) => (g.id === grade.id ? next : g)) : [...r.grades, next],
      };
    }),
  };
}

export function withoutGrade(detail: LessonDetailDto, gradeId: string): LessonDetailDto {
  return {
    ...detail,
    roster: detail.roster.map((r) => ({ ...r, grades: r.grades.filter((g) => g.id !== gradeId) })),
  };
}

/** Скільки хвилин лишилось до кінця пари (null, якщо пара не сьогодні або вже закінчилась). */
export function minutesLeft(
  now: Date,
  today: string,
  lessonDate: string,
  endsAt: string | undefined,
): number | null {
  if (lessonDate !== today || endsAt === undefined) return null;
  const [h, m] = endsAt.split(':').map(Number) as [number, number];
  const kyiv = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Kyiv',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
  const [nh, nm] = kyiv.split(':').map(Number) as [number, number];
  const left = h * 60 + m - (nh * 60 + nm);
  return left > 0 ? left : null;
}

/** Підпис оцінки в чіпі: для «зараховано / не зараховано» — «зар.» / «не зар.». */
export function gradeLabel(scale: Scale, value: number): string {
  if (scale === 'PASS_FAIL') return value === 1 ? 'зар.' : 'не зар.';
  return String(value);
}

/** Колір комірки за оцінкою (шкала 12-бальна): 1–3 — червонуватий, 10–12 — зеленуватий. */
export function gradeTone(scale: Scale, value: number): 'low' | 'high' | 'none' {
  if (scale !== 'TWELVE') return 'none';
  if (value <= 3) return 'low';
  if (value >= 10) return 'high';
  return 'none';
}

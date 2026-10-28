import type { AttendanceStatus, GradebookCell, GradebookDto, GradeEntry } from '@ge/shared';

type Student = GradebookDto['students'][number];

const emptyCell = (): GradebookCell => ({ attendance: null, grades: [] });

function patchCell(
  dto: GradebookDto,
  enrollmentId: string,
  lessonId: string,
  patch: (cell: GradebookCell) => GradebookCell,
): GradebookDto {
  return {
    ...dto,
    students: dto.students.map((s: Student) =>
      s.enrollmentId === enrollmentId
        ? { ...s, cells: { ...s.cells, [lessonId]: patch(s.cells[lessonId] ?? emptyCell()) } }
        : s,
    ),
  };
}

export const setCellAttendance = (
  dto: GradebookDto,
  enrollmentId: string,
  lessonId: string,
  status: AttendanceStatus,
) => patchCell(dto, enrollmentId, lessonId, (c) => ({ ...c, attendance: status }));

/** Додає оцінку або оновлює наявну (за id), зберігаючи її версію. */
export const setCellGrade = (
  dto: GradebookDto,
  enrollmentId: string,
  lessonId: string,
  grade: Pick<GradeEntry, 'id' | 'kind' | 'value'>,
) =>
  patchCell(dto, enrollmentId, lessonId, (c) => {
    const current = c.grades.find((g) => g.id === grade.id);
    const next: GradeEntry = {
      ...grade,
      comment: current?.comment ?? null,
      version: current?.version ?? 0,
    };
    return {
      ...c,
      grades: current ? c.grades.map((g) => (g.id === grade.id ? next : g)) : [...c.grades, next],
    };
  });

export const removeCellGrade = (
  dto: GradebookDto,
  enrollmentId: string,
  lessonId: string,
  gradeId: string,
) =>
  patchCell(dto, enrollmentId, lessonId, (c) => ({
    ...c,
    grades: c.grades.filter((g) => g.id !== gradeId),
  }));

/** Ставить (value) або прибирає (null) оцінку студента в колонці оцінювання. */
export const setAssessmentCell = (
  dto: GradebookDto,
  enrollmentId: string,
  assessmentId: string,
  value: number | null,
): GradebookDto => ({
  ...dto,
  students: dto.students.map((s: Student) => {
    if (s.enrollmentId !== enrollmentId) return s;
    const rest = Object.fromEntries(
      Object.entries(s.assessmentGrades).filter(([id]) => id !== assessmentId),
    );
    const current = s.assessmentGrades[assessmentId];
    return {
      ...s,
      assessmentGrades:
        value === null
          ? rest
          : {
              ...rest,
              [assessmentId]: {
                id: current?.id ?? `tmp-${assessmentId}-${enrollmentId}`,
                value,
                comment: current?.comment ?? null,
                version: current?.version ?? 0,
              },
            },
    };
  }),
});

/** Текст клітинки: оцінки через кому і літера відмітки («10, 8 н»). */
export function cellText(
  cell: GradebookCell | undefined,
  short: Record<AttendanceStatus, string>,
): string {
  if (!cell) return '';
  const grades = cell.grades.map((g) => g.value).join(', ');
  const mark = cell.attendance && cell.attendance !== 'PRESENT' ? short[cell.attendance] : '';
  return [grades, mark].filter(Boolean).join(' ');
}

export type KeyAction =
  | { type: 'move'; dRow: number; dCol: number }
  | { type: 'digit'; buffer: string }
  | { type: 'attendance'; status: AttendanceStatus }
  | { type: 'delete' }
  | { type: 'open' }
  | null;

const ATTENDANCE_KEYS: Record<string, AttendanceStatus> = {
  н: 'ABSENT',
  n: 'ABSENT',
  п: 'EXCUSED',
  p: 'EXCUSED',
  з: 'LATE',
  z: 'LATE',
  ' ': 'PRESENT',
};

/** Клавіатура журналу як в Excel: стрілки, цифри, Enter, Delete; н / п / з — відмітки. */
export function interpretKey(key: string, buffer: string, shiftKey = false): KeyAction {
  switch (key) {
    case 'ArrowUp':
      return { type: 'move', dRow: -1, dCol: 0 };
    case 'ArrowDown':
      return { type: 'move', dRow: 1, dCol: 0 };
    case 'ArrowLeft':
      return { type: 'move', dRow: 0, dCol: -1 };
    case 'ArrowRight':
      return { type: 'move', dRow: 0, dCol: 1 };
    case 'Tab':
      return { type: 'move', dRow: 0, dCol: shiftKey ? -1 : 1 };
    case 'Enter':
      return { type: 'open' };
    case 'Delete':
    case 'Backspace':
      return { type: 'delete' };
  }
  if (/^\d$/.test(key)) return { type: 'digit', buffer: (buffer + key).slice(0, 3) };
  const status = ATTENDANCE_KEYS[key.toLowerCase()];
  return status ? { type: 'attendance', status } : null;
}

/** Чи може буфер цифр ще вирости (1 → 10, 11, 12), тож з коммітом варто зачекати. */
export function bufferIsFinal(buffer: string, max: number): boolean {
  const n = Number(buffer);
  return n * 10 > max || buffer.length >= String(max).length;
}

/** Нова позиція курсора в межах таблиці. */
export function moveSelection(
  pos: { row: number; col: number },
  action: { dRow: number; dCol: number },
  size: { rows: number; cols: number },
): { row: number; col: number } {
  const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), Math.max(max - 1, 0));
  return {
    row: clamp(pos.row + action.dRow, size.rows),
    col: clamp(pos.col + action.dCol, size.cols),
  };
}

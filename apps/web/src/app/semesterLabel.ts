import type { AcademicYearDto, SemesterFullDto } from '@ge/shared';

const ROMAN = { 1: 'I', 2: 'II' } as const;

/** «2026/2027 · I семестр» */
export function semesterLabel(
  semester: Pick<SemesterFullDto, 'number' | 'academicYearId'>,
  years: readonly AcademicYearDto[],
): string {
  const year = years.find((y) => y.id === semester.academicYearId)?.title ?? '';
  const roman =
    semester.number === 1 || semester.number === 2
      ? ROMAN[semester.number]
      : String(semester.number);
  return `${year} · ${roman} семестр`;
}

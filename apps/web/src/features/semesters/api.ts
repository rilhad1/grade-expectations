import {
  academicYearDtoSchema,
  cloneSemesterResultSchema,
  groupDtoSchema,
  promoteGroupsResultSchema,
  semesterDtoSchema,
  type CloneSemesterResult,
  type PromoteGroupsResult,
  type SemesterFullDto,
} from '@ge/shared';

import { patch, post } from '../../api/http';

import { suggestYearTitle, type SemesterFormValues } from './SemesterForm';

/** Створює (за потреби) рік і семестр-чернетку за значеннями форми. */
export async function createSemesterFromForm(v: SemesterFormValues): Promise<SemesterFullDto> {
  let academicYearId = v.yearId;
  if (v.yearId === 'new') {
    const year = await post(
      '/academic-years',
      {
        title: v.newYearTitle.trim() || suggestYearTitle(v.startDate),
        startDate: v.newYearStart,
        endDate: v.newYearEnd,
      },
      academicYearDtoSchema,
    );
    academicYearId = year.id;
  }
  return post(
    '/semesters',
    {
      academicYearId,
      number: v.number,
      startDate: v.startDate,
      endDate: v.endDate,
      firstWeekParity: v.firstWeekParity,
      parityAfterBreak: v.parityAfterBreak,
      periods: v.periods,
    },
    semesterDtoSchema,
  );
}

export const updateSemesterFromForm = (
  s: SemesterFullDto,
  v: SemesterFormValues,
): Promise<SemesterFullDto> =>
  patch(
    `/semesters/${s.id}`,
    {
      version: s.version,
      startDate: v.startDate,
      endDate: v.endDate,
      firstWeekParity: v.firstWeekParity,
      parityAfterBreak: v.parityAfterBreak,
      periods: v.periods,
    },
    semesterDtoSchema,
  );

export const activateSemester = (id: string) =>
  post(`/semesters/${id}/activate`, {}, semesterDtoSchema);
export const closeSemester = (id: string) => post(`/semesters/${id}/close`, {}, semesterDtoSchema);

export const promoteGroups = (
  toAcademicYearId: string,
  groupIds: string[],
): Promise<PromoteGroupsResult> =>
  post(
    '/groups/promote',
    { toAcademicYearId, groups: groupIds.map((groupId) => ({ groupId })) },
    promoteGroupsResultSchema,
  );

export const cloneSemester = (targetId: string, sourceId: string): Promise<CloneSemesterResult> =>
  post(`/semesters/${targetId}/clone-from/${sourceId}`, {}, cloneSemesterResultSchema);

export { groupDtoSchema };

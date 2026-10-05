import {
  cohortDtoSchema,
  enrollmentDtoSchema,
  groupDetailDtoSchema,
  groupDtoSchema,
  importStudentsResultSchema,
  studentDtoSchema,
  subgroupDtoSchema,
  type GroupDetailDto,
  type ImportStudentsResult,
} from '@ge/shared';

import { del, get, patch, post } from '../../api/http';

export const fetchGroup = (id: string): Promise<GroupDetailDto> =>
  get(`/groups/${id}`, groupDetailDtoSchema);

export const createCohort = (specialty: string, entryYear: number) =>
  post('/cohorts', { specialty, entryYear }, cohortDtoSchema);

export const createGroup = (body: {
  cohortId: string;
  academicYearId: string;
  name: string;
  course: number;
}) => post('/groups', body, groupDtoSchema);

export const deleteGroup = (id: string) => del(`/groups/${id}`);

export const createStudent = (body: {
  lastName: string;
  firstName: string;
  middleName: string | null;
  groupId: string;
  fromDate: string;
}) => post('/students', body, studentDtoSchema);

export const updateStudent = (
  id: string,
  version: number,
  body: { lastName: string; firstName: string; middleName: string | null },
) => patch(`/students/${id}`, { ...body, version }, studentDtoSchema);

export const updateEnrollmentStatus = (
  id: string,
  version: number,
  status: 'ACTIVE' | 'ACADEMIC_LEAVE' | 'EXPELLED' | 'TRANSFERRED',
) => patch(`/enrollments/${id}`, { status, version }, enrollmentDtoSchema);

export const importStudents = (body: {
  groupId: string;
  fromDate: string;
  text: string;
  dryRun: boolean;
}): Promise<ImportStudentsResult> => post('/students/import', body, importStudentsResultSchema);

export const createSubgroup = (groupId: string, name: string, enrollmentIds: string[]) =>
  post(`/groups/${groupId}/subgroups`, { name, enrollmentIds }, subgroupDtoSchema);

export const updateSubgroup = (
  id: string,
  version: number,
  body: { name?: string; enrollmentIds?: string[] },
) => patch(`/subgroups/${id}`, { ...body, version }, subgroupDtoSchema);

export const deleteSubgroup = (id: string) => del(`/subgroups/${id}`);

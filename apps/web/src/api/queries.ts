import {
  academicYearDtoSchema,
  bellDtoSchema,
  cohortDtoSchema,
  disciplineDtoSchema,
  groupDtoSchema,
  loadDtoSchema,
  roomDtoSchema,
  semesterDtoSchema,
  studentDtoSchema,
  userDtoSchema,
} from '@ge/shared';
import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';

import { get, getAll } from './http';

/** Ключі й запити, спільні для екранів деканату. */
export const q = {
  years: () =>
    queryOptions({
      queryKey: ['years'],
      queryFn: () => getAll('/academic-years', academicYearDtoSchema),
    }),
  semesters: () =>
    queryOptions({
      queryKey: ['semesters'],
      queryFn: () => get('/semesters', z.array(semesterDtoSchema)),
    }),
  disciplines: () =>
    queryOptions({
      queryKey: ['disciplines'],
      queryFn: () => getAll('/disciplines', disciplineDtoSchema),
    }),
  rooms: () =>
    queryOptions({ queryKey: ['rooms'], queryFn: () => getAll('/rooms', roomDtoSchema) }),
  bells: () =>
    queryOptions({ queryKey: ['bells'], queryFn: () => get('/bells', z.array(bellDtoSchema)) }),
  cohorts: () =>
    queryOptions({ queryKey: ['cohorts'], queryFn: () => getAll('/cohorts', cohortDtoSchema) }),
  groups: (academicYearId?: string) =>
    queryOptions({
      queryKey: ['groups', academicYearId ?? 'all'],
      queryFn: () => getAll('/groups', groupDtoSchema, { academicYearId }),
    }),
  students: (groupId?: string) =>
    queryOptions({
      queryKey: ['students', groupId ?? 'all'],
      queryFn: () => getAll('/students', studentDtoSchema, { groupId }),
    }),
  users: () =>
    queryOptions({ queryKey: ['users'], queryFn: () => getAll('/users', userDtoSchema) }),
  loads: (semesterId: string) =>
    queryOptions({
      queryKey: ['loads', semesterId],
      queryFn: () => getAll('/loads', loadDtoSchema, { semesterId }),
    }),
};

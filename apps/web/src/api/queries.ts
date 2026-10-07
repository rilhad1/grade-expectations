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

import { cachedFetch } from '../offline/cache';
import { compareGroups, compareText, sortByCourseDisciplineGroup } from '../shared/sort';

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
      queryFn: () => cachedFetch('semesters', () => get('/semesters', z.array(semesterDtoSchema))),
    }),
  disciplines: () =>
    queryOptions({
      queryKey: ['disciplines'],
      queryFn: async () =>
        (await getAll('/disciplines', disciplineDtoSchema)).sort((a, b) =>
          compareText(a.title, b.title),
        ),
    }),
  rooms: () =>
    queryOptions({ queryKey: ['rooms'], queryFn: () => getAll('/rooms', roomDtoSchema) }),
  bells: () =>
    queryOptions({
      queryKey: ['bells'],
      queryFn: () => cachedFetch('bells', () => get('/bells', z.array(bellDtoSchema))),
    }),
  cohorts: () =>
    queryOptions({ queryKey: ['cohorts'], queryFn: () => getAll('/cohorts', cohortDtoSchema) }),
  groups: (academicYearId?: string) =>
    queryOptions({
      queryKey: ['groups', academicYearId ?? 'all'],
      queryFn: async () =>
        (await getAll('/groups', groupDtoSchema, { academicYearId })).sort(compareGroups),
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
      // Скрізь однаковий порядок: курс → предмет → група
      queryFn: async () =>
        sortByCourseDisciplineGroup(
          await cachedFetch(`loads:${semesterId}`, () =>
            getAll('/loads', loadDtoSchema, { semesterId }),
          ),
        ),
    }),
};

import {
  bellDtoSchema,
  createUserResultSchema,
  disciplineDtoSchema,
  roomDtoSchema,
  userDtoSchema,
  type BellDto,
} from '@ge/shared';
import { z } from 'zod';

import { del, patch, post, put } from '../../api/http';

export const saveDiscipline = (
  existing: { id: string; version: number } | undefined,
  body: {
    title: string;
    shortTitle: string;
    code: string | null;
    color: string;
    defaultScale: 'TWELVE' | 'FIVE' | 'HUNDRED' | 'PASS_FAIL';
  },
) =>
  existing
    ? patch(
        `/disciplines/${existing.id}`,
        { ...body, version: existing.version },
        disciplineDtoSchema,
      )
    : post('/disciplines', body, disciplineDtoSchema);
export const deleteDiscipline = (id: string) => del(`/disciplines/${id}`);

export const saveRoom = (
  existing: { id: string; version: number } | undefined,
  body: { name: string; capacity: number | null; kind: string | null },
) =>
  existing
    ? patch(`/rooms/${existing.id}`, { ...body, version: existing.version }, roomDtoSchema)
    : post('/rooms', body, roomDtoSchema);
export const deleteRoom = (id: string) => del(`/rooms/${id}`);

export const saveBells = (bells: BellDto[]) => put('/bells', bells, z.array(bellDtoSchema));

export const createUser = (body: {
  email: string;
  fullName: string;
  roles: ('TEACHER' | 'MODERATOR')[];
}) => post('/users', body, createUserResultSchema);
export const updateUserRoles = (userId: string, roles: ('TEACHER' | 'MODERATOR')[]) =>
  put(`/users/${userId}/roles`, { roles }, userDtoSchema);

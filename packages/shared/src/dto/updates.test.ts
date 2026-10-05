import { describe, expect, it } from 'vitest';

import { updateAcademicYearSchema, updateSemesterSchema } from './academic.js';
import {
  updateCohortSchema,
  updateDisciplineSchema,
  updateEnrollmentSchema,
  updateGroupSchema,
  updateRoomSchema,
  updateStudentSchema,
  updateSubgroupSchema,
} from './directory.js';
import { updateLoadSchema } from './loads.js';
import { updateSlotSchema } from './schedules.js';

/**
 * Регресія: у Zod 4 `.partial()` не прибирає `.default()`, тому PATCH без поля
 * мовчки скидав би його до значення за замовчуванням. Схема оновлення, розібрана лише
 * з `version`, не має містити жодних інших ключів.
 */
describe('схеми оновлення не підставляють значень за замовчуванням', () => {
  const schemas = {
    academicYear: updateAcademicYearSchema,
    semester: updateSemesterSchema,
    discipline: updateDisciplineSchema,
    room: updateRoomSchema,
    cohort: updateCohortSchema,
    group: updateGroupSchema,
    subgroup: updateSubgroupSchema,
    student: updateStudentSchema,
    enrollment: updateEnrollmentSchema,
    load: updateLoadSchema,
    slot: updateSlotSchema,
  };

  it.each(Object.entries(schemas))('%s', (_name, schema) => {
    expect(schema.parse({ version: 3 })).toEqual({ version: 3 });
  });
});

import { Prisma, type PrismaClient } from '@prisma/client';

/** Моделі з прямим полем organizationId: для них ізоляція вшита в розширення. */
const TENANT_MODELS: ReadonlySet<string> = new Set(
  Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === 'organizationId'))
    // ChangeLog пишеться сервером і читається по id, фільтр додається явно в sync-модулі
    .map((m) => m.name),
);

const READ_WRITE_WHERE_OPS: ReadonlySet<string> = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
]);

type AnyArgs = Record<string, unknown>;

/**
 * Клієнт Prisma, прив'язаний до коледжу: до кожного запиту моделей із organizationId
 * примусово додається фільтр (значення від викликача перезаписується), а при створенні
 * організація проставляється автоматично.
 *
 * Дочірні моделі без organizationId (Semester, Lesson, Grade тощо) ізолюються через зв'язки
 * у repo-шарі. TODO(фаза 2, ADR-008): Postgres RLS як другий рубіж.
 */
export function forOrganization(prisma: PrismaClient, organizationId: string) {
  return prisma.$extends({
    name: 'tenant',
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) return query(args);
          const a = args as AnyArgs;

          if (READ_WRITE_WHERE_OPS.has(operation)) {
            a['where'] = { ...(a['where'] as object | undefined), organizationId };
          } else if (operation === 'create') {
            a['data'] = { ...(a['data'] as object), organizationId };
          } else if (operation === 'createMany' || operation === 'createManyAndReturn') {
            const data = a['data'] as object | object[];
            a['data'] = Array.isArray(data)
              ? (data as object[]).map((row): object => ({ ...row, organizationId }))
              : { ...data, organizationId };
          } else if (operation === 'upsert') {
            a['where'] = { ...(a['where'] as object), organizationId };
            a['create'] = { ...(a['create'] as object), organizationId };
          }
          return query(args);
        },
      },
    },
  });
}

export type TenantClient = ReturnType<typeof forOrganization>;

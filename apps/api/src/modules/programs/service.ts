import { uuidv7, type GradingRules, type LoadDto, type TopicPlanDto } from '@ge/shared';

import { conflict } from '../../errors.js';
import { isoOf } from '../../lib/db.js';
import type { AuthContext } from '../../plugins/session.js';
import { assertScaleUnlocked, findJournalLoad } from '../journal/gradebook.js';
import { getLoad } from '../loads/service.js';
import { assignTopicsForLoads } from '../schedules/service.js';

type Kind = 'LECTURE' | 'PRACTICE' | 'LAB' | 'SEMINAR' | 'CONTROL';

const latestProgram = (ctx: AuthContext, disciplineId: string, kind: Kind) =>
  ctx.db.disciplineProgram.findFirst({
    where: { disciplineId, deletedAt: null },
    orderBy: { edition: 'desc' },
    include: { topics: { where: { deletedAt: null, kind }, orderBy: { order: 'asc' } } },
  });

/** Тематичний план навантаження: теми останньої редакції програми дисципліни того ж виду занять. */
export async function getTopicPlan(ctx: AuthContext, loadId: string): Promise<TopicPlanDto> {
  const load = await findJournalLoad(ctx, loadId);
  const program = await latestProgram(ctx, load.disciplineId, load.kind);
  return {
    programId: program?.id ?? null,
    edition: program?.edition ?? null,
    loadKind: load.kind,
    topics: (program?.topics ?? []).map((t) => ({
      id: t.id,
      order: t.order,
      title: t.title,
      hours: t.hours,
      kind: t.kind,
    })),
  };
}

/**
 * Повна заміна тематичного плану (порядок = порядок у запиті): наявні теми оновлюються за id,
 * нові створюються, зайві м'яко видаляються. Після цього теми заново розкладаються по майбутніх заняттях.
 */
export async function replaceTopics(
  ctx: AuthContext,
  loadId: string,
  topics: readonly { id?: string | undefined; title: string; hours: number }[],
): Promise<TopicPlanDto> {
  const load = await findJournalLoad(ctx, loadId);
  let program = await latestProgram(ctx, load.disciplineId, load.kind);
  if (!program) {
    const created = await ctx.db.disciplineProgram.create({
      data: {
        id: uuidv7(),
        disciplineId: load.disciplineId,
        edition: isoOf(load.semester.startDate).slice(0, 4),
      },
    });
    program = { ...created, topics: [] };
  }
  const programId = program.id;
  const existing = new Map(program.topics.map((t) => [t.id, t]));
  const incomingIds = new Set(topics.flatMap((t) => (t.id ? [t.id] : [])));
  if (topics.some((t) => t.id !== undefined && !existing.has(t.id))) {
    throw conflict('TOPIC_NOT_FOUND', 'Тему не знайдено в цьому плані; оновіть сторінку');
  }

  await ctx.db.$transaction(async (tx) => {
    const gone = program.topics.filter((t) => !incomingIds.has(t.id)).map((t) => t.id);
    if (gone.length > 0) {
      await tx.programTopic.updateMany({
        where: { id: { in: gone } },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
    }
    for (const [index, topic] of topics.entries()) {
      const order = index + 1;
      const current = topic.id ? existing.get(topic.id) : undefined;
      if (current) {
        if (
          current.order !== order ||
          current.title !== topic.title ||
          current.hours !== topic.hours
        ) {
          await tx.programTopic.update({
            where: { id: current.id },
            data: { order, title: topic.title, hours: topic.hours, version: { increment: 1 } },
          });
        }
      } else {
        await tx.programTopic.create({
          data: {
            id: topic.id ?? uuidv7(),
            programId,
            order,
            title: topic.title,
            hours: topic.hours,
            kind: load.kind,
          },
        });
      }
    }
  });

  await assignTopicsForLoads(ctx, [loadId]);
  return getTopicPlan(ctx, loadId);
}

/** Правила оцінювання навантаження. Шкалу не можна змінити, коли оцінки вже виставлені. */
export async function updateGradingRules(
  ctx: AuthContext,
  loadId: string,
  rules: GradingRules,
): Promise<LoadDto> {
  const load = await findJournalLoad(ctx, loadId);
  await assertScaleUnlocked(ctx, load, rules.scale);
  await ctx.db.teachingLoad.update({
    where: { id: loadId },
    data: { gradingRules: rules, version: { increment: 1 } },
  });
  return getLoad(ctx, loadId);
}

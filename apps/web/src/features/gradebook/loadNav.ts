import type { LessonKind, LoadDto } from '@ge/shared';

/** Порядок видів: основним у зведеному журналі вважається практичне навантаження, а не лекція. */
const PRIMARY_ORDER: readonly LessonKind[] = ['PRACTICE', 'LAB', 'SEMINAR', 'CONTROL', 'LECTURE'];
/** Порядок видів у фільтрі й переліках: лекція, практична, лабораторна… */
export const KIND_ORDER: readonly LessonKind[] = [
  'LECTURE',
  'PRACTICE',
  'LAB',
  'SEMINAR',
  'CONTROL',
];

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'uk');
const primaryRank = (l: LoadDto) => PRIMARY_ORDER.indexOf(l.kind);

/** Основне навантаження журналу: його id стоїть в адресі сторінки. */
const primaryOf = (loads: readonly LoadDto[]): LoadDto | undefined =>
  [...loads].sort((a, b) => primaryRank(a) - primaryRank(b) || a.id.localeCompare(b.id))[0];

/** Ключ журналу: дисципліна + група + підгрупа (види занять — усередині одного журналу). */
const journalKey = (l: LoadDto) => `${l.discipline.id}|${l.group.id}|${l.subgroup?.id ?? ''}`;

export interface Journal {
  /** Основне навантаження (id для адреси журналу). */
  primaryId: string;
  discipline: LoadDto['discipline'];
  group: LoadDto['group'];
  subgroup: LoadDto['subgroup'];
  /** Види занять журналу в порядку «лекція → практична → …». */
  kinds: LessonKind[];
  held: number;
  planned: number;
}

/** Журнали викладача: по одному на дисципліну, групу й підгрупу, незалежно від видів занять. */
export function journalsOf(loads: readonly LoadDto[]): Journal[] {
  const groups = new Map<string, LoadDto[]>();
  for (const l of loads) groups.set(journalKey(l), [...(groups.get(journalKey(l)) ?? []), l]);
  return [...groups.values()]
    .flatMap((items) => {
      const primary = primaryOf(items);
      if (!primary) return [];
      return [
        {
          primaryId: primary.id,
          discipline: primary.discipline,
          group: primary.group,
          subgroup: primary.subgroup,
          kinds: KIND_ORDER.filter((k) => items.some((l) => l.kind === k)),
          held: items.reduce((sum, l) => sum + l.hours.held, 0),
          planned: items.reduce((sum, l) => sum + l.plannedHours, 0),
        },
      ];
    })
    .sort(
      (a, b) =>
        a.discipline.title.localeCompare(b.discipline.title, 'uk') ||
        a.group.name.localeCompare(b.group.name, 'uk') ||
        (a.subgroup?.name ?? '').localeCompare(b.subgroup?.name ?? '', 'uk'),
    );
}

export interface LoadNav {
  disciplines: { id: string; title: string; color: string }[];
  groups: { id: string; name: string }[];
  /** Підгрупи поточної дисципліни й групи (без підгрупи — «уся група»). */
  subgroups: { id: string | null; name: string | null }[];
  /** Журнал вибраної дисципліни: та сама група, інакше перша за назвою групи. */
  forDiscipline: (disciplineId: string) => string | null;
  /** Журнал вибраної групи тієї ж дисципліни. */
  forGroup: (groupId: string) => string | null;
  /** Журнал вибраної підгрупи (null — уся група) тієї ж дисципліни й групи. */
  forSubgroup: (subgroupId: string | null) => string | null;
}

/**
 * Навігація між журналами викладача: дисципліна → група → підгрупа.
 * Вид занять — не навігація, а фільтр усередині журналу; кожен вибір зводиться до основного навантаження.
 */
export function loadNav(loads: readonly LoadDto[], currentId: string): LoadNav | null {
  const current = loads.find((l) => l.id === currentId);
  if (!current) return null;
  const journals = journalsOf(loads);

  const disciplines = [...new Map(loads.map((l) => [l.discipline.id, l.discipline])).values()]
    .map((d) => ({ id: d.id, title: d.title, color: d.color }))
    .sort((a, b) => a.title.localeCompare(b.title, 'uk'));
  const sameDiscipline = journals.filter((j) => j.discipline.id === current.discipline.id);
  const groups = [...new Map(sameDiscipline.map((j) => [j.group.id, j.group])).values()].sort(
    byName,
  );
  const sameGroup = sameDiscipline.filter((j) => j.group.id === current.group.id);
  const subgroups = sameGroup.map((j) => ({
    id: j.subgroup?.id ?? null,
    name: j.subgroup?.name ?? null,
  }));
  const preferWhole = (items: Journal[]) => items.find((j) => j.subgroup === null) ?? items[0];

  return {
    disciplines,
    groups,
    subgroups,
    forDiscipline: (disciplineId) => {
      const sorted = journals
        .filter((j) => j.discipline.id === disciplineId)
        .sort((a, b) => byName(a.group, b.group));
      const own = sorted.filter((j) => j.group.id === current.group.id);
      const pool = own.length > 0 ? own : sorted.filter((j) => j.group.id === sorted[0]?.group.id);
      return preferWhole(pool)?.primaryId ?? null;
    },
    forGroup: (groupId) =>
      preferWhole(sameDiscipline.filter((j) => j.group.id === groupId))?.primaryId ?? null,
    forSubgroup: (subgroupId) =>
      sameGroup.find((j) => (j.subgroup?.id ?? null) === subgroupId)?.primaryId ?? null,
  };
}

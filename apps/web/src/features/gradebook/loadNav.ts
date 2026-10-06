import type { LessonKind, LoadDto } from '@ge/shared';

export interface LoadVariant {
  id: string;
  kind: LessonKind;
  subgroupName: string | null;
}

export interface LoadNav {
  disciplines: { id: string; title: string; color: string }[];
  groups: { id: string; name: string }[];
  /** Навантаження тієї ж дисципліни й групи (види занять, підгрупи). */
  variants: LoadVariant[];
  /** Навантаження для вибраної дисципліни: та сама група, інакше перша за назвою групи. */
  forDiscipline: (disciplineId: string) => string | null;
  /** Навантаження для вибраної групи тієї ж дисципліни: той самий вид, інакше перше. */
  forGroup: (groupId: string) => string | null;
}

/** Порядок видів у перемикачі: лекція, практична, лабораторна… */
const KIND_ORDER: readonly LessonKind[] = ['LECTURE', 'PRACTICE', 'LAB', 'SEMINAR', 'CONTROL'];

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'uk');

/**
 * Навігація між журналами викладача: дисципліна → група → вид заняття (підгрупа).
 * Журнал — на навантаження, тому кожен вибір зводиться до id навантаження.
 */
export function loadNav(loads: readonly LoadDto[], currentId: string): LoadNav | null {
  const current = loads.find((l) => l.id === currentId);
  if (!current) return null;

  const disciplines = [...new Map(loads.map((l) => [l.discipline.id, l.discipline])).values()]
    .map((d) => ({ id: d.id, title: d.title, color: d.color }))
    .sort((a, b) => a.title.localeCompare(b.title, 'uk'));
  const sameDiscipline = loads.filter((l) => l.discipline.id === current.discipline.id);
  const groups = [...new Map(sameDiscipline.map((l) => [l.group.id, l.group])).values()].sort(
    byName,
  );
  const variants = sameDiscipline
    .filter((l) => l.group.id === current.group.id)
    .sort(
      (a, b) =>
        KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
        (a.subgroup?.name ?? '').localeCompare(b.subgroup?.name ?? ''),
    )
    .map((l) => ({ id: l.id, kind: l.kind, subgroupName: l.subgroup?.name ?? null }));

  return {
    disciplines,
    groups,
    variants,
    forDiscipline: (disciplineId) => {
      const candidates = loads.filter((l) => l.discipline.id === disciplineId);
      return (
        candidates.find((l) => l.group.id === current.group.id && l.kind === current.kind)?.id ??
        candidates.find((l) => l.group.id === current.group.id)?.id ??
        [...candidates].sort((a, b) => byName(a.group, b.group))[0]?.id ??
        null
      );
    },
    forGroup: (groupId) => {
      const candidates = sameDiscipline.filter((l) => l.group.id === groupId);
      return (
        candidates.find((l) => l.kind === current.kind && l.subgroup?.id === current.subgroup?.id)
          ?.id ??
        candidates.find((l) => l.kind === current.kind)?.id ??
        candidates[0]?.id ??
        null
      );
    },
  };
}

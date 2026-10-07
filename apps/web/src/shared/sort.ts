import type { LessonKind } from '@ge/shared';

/** Українське порівняння: «ПДт-2» раніше за «ПДт-11», регістр і діакритика не важливі. */
const collator = new Intl.Collator('uk', { numeric: true, sensitivity: 'base' });
export const compareText = (a: string, b: string): number => collator.compare(a, b);

const KIND_RANK: Record<LessonKind, number> = {
  LECTURE: 0,
  PRACTICE: 1,
  LAB: 2,
  SEMINAR: 3,
  CONTROL: 4,
};

interface Sortable {
  discipline: { title: string };
  group: { name: string; course?: number };
  subgroup?: { name: string } | null;
  kind?: LessonKind;
}

/**
 * Порядок за замовчуванням для списків: курс → предмет → група (→ підгрупа → вид занять).
 * Без курсу (невідомий) — наприкінці.
 */
export function compareByCourseDisciplineGroup(a: Sortable, b: Sortable): number {
  return (
    (a.group.course ?? 99) - (b.group.course ?? 99) ||
    compareText(a.discipline.title, b.discipline.title) ||
    compareText(a.group.name, b.group.name) ||
    compareText(a.subgroup?.name ?? '', b.subgroup?.name ?? '') ||
    (a.kind === undefined || b.kind === undefined ? 0 : KIND_RANK[a.kind] - KIND_RANK[b.kind])
  );
}

export const sortByCourseDisciplineGroup = <T extends Sortable>(items: readonly T[]): T[] =>
  [...items].sort(compareByCourseDisciplineGroup);

/** Групи: за курсом, потім за назвою. */
export const compareGroups = (
  a: { name: string; course?: number },
  b: { name: string; course?: number },
): number => (a.course ?? 99) - (b.course ?? 99) || compareText(a.name, b.name);

/** Розбиває вже відсортований список на послідовні секції за курсом (для заголовків «N курс»). */
export function sectionsByCourse<T extends { group: { course?: number } }>(
  items: readonly T[],
): { course: number | undefined; items: T[] }[] {
  const sections: { course: number | undefined; items: T[] }[] = [];
  for (const item of items) {
    const last = sections[sections.length - 1];
    if (last && last.course === item.group.course) last.items.push(item);
    else sections.push({ course: item.group.course, items: [item] });
  }
  return sections;
}

/**
 * «КІт-31, КІт-32, КІт-33» → «КІт-31, 32, 33»: спільний префікс до дефіса не повторюється.
 * Назви без спільного префікса виводяться повністю.
 */
export function compressGroupNames(names: readonly string[]): string {
  const prefixes = names.map((n) => (n.includes('-') ? n.slice(0, n.indexOf('-') + 1) : null));
  const first = prefixes[0];
  const shared = first !== null && first !== undefined && prefixes.every((p) => p === first);
  if (!shared || names.length < 2) return names.join(', ');
  return [names[0], ...names.slice(1).map((n) => n.slice(first.length))].join(', ');
}

interface StreamLesson {
  streamId: string | null;
  date: string;
  pairNumber: number;
  group: { id: string; name: string };
}

/**
 * Одна пара потоку для кількох груп показується однією карткою: назви груп зливаються,
 * а лічильники відміток (`marked`, `total`) складаються. Перший урок потоку — представник.
 */
export function mergeStreamLessons<T extends StreamLesson>(
  lessons: readonly T[],
): (T & { streamLessonIds: string[] })[] {
  const out: (T & { streamLessonIds: string[]; names: string[] })[] = [];
  const byKey = new Map<string, (typeof out)[number]>();
  for (const lesson of lessons) {
    const id = (lesson as unknown as { id: string }).id;
    const key =
      lesson.streamId === null
        ? null
        : `${lesson.streamId}|${lesson.date}|${String(lesson.pairNumber)}`;
    const existing = key === null ? undefined : byKey.get(key);
    if (existing) {
      existing.streamLessonIds.push(id);
      existing.names.push(lesson.group.name);
      const sums = existing as unknown as { marked?: number; total?: number };
      const own = lesson as unknown as { marked?: number; total?: number };
      if (sums.marked !== undefined && own.marked !== undefined) sums.marked += own.marked;
      if (sums.total !== undefined && own.total !== undefined) sums.total += own.total;
      continue;
    }
    const entry = {
      ...lesson,
      streamLessonIds: [id],
      names: [lesson.group.name],
    };
    out.push(entry);
    if (key !== null) byKey.set(key, entry);
  }
  return out.map(({ names, ...rest }) => ({
    ...(rest as unknown as T & { streamLessonIds: string[] }),
    group: { ...rest.group, name: compressGroupNames(names.sort(compareNatural)) },
  }));
}

const collator = new Intl.Collator('uk', { numeric: true });
const compareNatural = (a: string, b: string) => collator.compare(a, b);

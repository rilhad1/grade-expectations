import type { LoadDto } from '@ge/shared';

export interface HoursRow {
  loadId: string;
  teacher: string;
  discipline: string;
  group: string;
  kind: LoadDto['kind'];
  planned: number;
  held: number;
  forecast: number;
  deficit: number;
  extraPairs: number;
}

/** Рядки звіту про вичитку: за викладачем, потім за дисципліною й групою. */
export function hoursRows(loads: readonly LoadDto[]): HoursRow[] {
  return loads
    .map((l) => ({
      loadId: l.id,
      teacher: l.teacher.fullName,
      discipline: l.discipline.shortTitle,
      group: l.subgroup ? `${l.group.name} (${l.subgroup.name})` : l.group.name,
      kind: l.kind,
      planned: l.hours.planned,
      held: l.hours.held,
      forecast: l.hours.forecast,
      deficit: l.hours.deficit,
      extraPairs: l.hours.extraPairsNeeded,
    }))
    .sort(
      (a, b) =>
        a.teacher.localeCompare(b.teacher, 'uk') ||
        a.discipline.localeCompare(b.discipline, 'uk') ||
        a.group.localeCompare(b.group, 'uk'),
    );
}

export function hoursTotals(rows: readonly HoursRow[]) {
  return rows.reduce(
    (sum, r) => ({
      planned: sum.planned + r.planned,
      held: sum.held + r.held,
      forecast: sum.forecast + r.forecast,
      deficit: sum.deficit + r.deficit,
      extraPairs: sum.extraPairs + r.extraPairs,
    }),
    { planned: 0, held: 0, forecast: 0, deficit: 0, extraPairs: 0 },
  );
}

const BOM = String.fromCharCode(0xfeff);

const cell = (value: string | number): string => {
  const text = String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** CSV для Excel: роздільник «;», BOM для коректного кодування кирилиці. */
export function hoursCsv(
  rows: readonly HoursRow[],
  headers: readonly string[],
  kindLabel: (kind: LoadDto['kind']) => string,
): string {
  const lines = [
    headers,
    ...rows.map((r) => [
      r.teacher,
      r.discipline,
      r.group,
      kindLabel(r.kind),
      r.planned,
      r.held,
      r.forecast,
      r.deficit,
      r.extraPairs,
    ]),
  ];
  return `${BOM}${lines.map((line) => line.map(cell).join(';')).join('\r\n')}\r\n`;
}

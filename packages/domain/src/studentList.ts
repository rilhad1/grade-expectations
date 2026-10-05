export interface ParsedStudent {
  /** Номер рядка у вхідному тексті (з 1). */
  line: number;
  lastName: string;
  firstName: string;
  middleName: string | null;
}

export interface StudentListError {
  line: number;
  text: string;
  code: 'NEED_LAST_AND_FIRST_NAME';
}

export interface ParsedStudentList {
  rows: ParsedStudent[];
  errors: StudentListError[];
}

/** «коваленко» → «Коваленко», «мак-дональд» → «Мак-Дональд»; апострофи зберігаються. */
export function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/(^|[-\s])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

const NUMBERING = /^\s*\d+\s*[.)]?\s+/;
const HEADER = /прізвище/i;

/**
 * Розбирає список студентів із вставленого тексту (з Excel/Word): по одному студенту в рядку.
 * Підтримує розділювачі табуляція, «;» і «,» («Прізвище;Ім'я;По батькові») та пробіли
 * («Коваленко Анна Петрівна»). Нумерація на початку рядка й рядок-заголовок ігноруються.
 */
export function parseStudentList(text: string): ParsedStudentList {
  const rows: ParsedStudent[] = [];
  const errors: StudentListError[] = [];

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1;
    const cleaned = raw.replace(NUMBERING, '').trim();
    if (cleaned === '' || (rows.length === 0 && errors.length === 0 && HEADER.test(cleaned)))
      return;

    const columns = /[\t;,]/.test(cleaned) ? cleaned.split(/[\t;,]/) : cleaned.split(/\s+/);
    const parts = columns.map((c) => c.trim()).filter((c) => c !== '');
    const [last, first, ...rest] = parts;
    if (last === undefined || first === undefined) {
      errors.push({ line, text: cleaned, code: 'NEED_LAST_AND_FIRST_NAME' });
      return;
    }
    rows.push({
      line,
      lastName: normalizeName(last),
      firstName: normalizeName(first),
      middleName: rest.length > 0 ? normalizeName(rest.join(' ')) : null,
    });
  });

  return { rows, errors };
}

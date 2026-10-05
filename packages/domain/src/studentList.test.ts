import { describe, expect, it } from 'vitest';

import { normalizeName, parseStudentList } from './studentList.js';

describe('normalizeName', () => {
  it('приводить регістр і обробляє дефіс', () => {
    expect(normalizeName('  коваленко ')).toBe('Коваленко');
    expect(normalizeName('МАК-ДОНАЛЬД')).toBe('Мак-Дональд');
    expect(normalizeName("п'ятниця")).toBe("П'ятниця");
  });
});

describe('parseStudentList', () => {
  it('розбирає ПІБ через пробіли', () => {
    const { rows, errors } = parseStudentList('Коваленко Анна Петрівна\nМельник Остап');
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { line: 1, lastName: 'Коваленко', firstName: 'Анна', middleName: 'Петрівна' },
      { line: 2, lastName: 'Мельник', firstName: 'Остап', middleName: null },
    ]);
  });

  it('підтримує табуляцію, крапку з комою і кому', () => {
    const { rows } = parseStudentList(
      'Ткачук\tІрина\tОлегівна\nБондар;Максим\nСавчук, Олена, Іванівна',
    );
    expect(rows.map((r) => [r.lastName, r.firstName, r.middleName])).toEqual([
      ['Ткачук', 'Ірина', 'Олегівна'],
      ['Бондар', 'Максим', null],
      ['Савчук', 'Олена', 'Іванівна'],
    ]);
  });

  it('ігнорує нумерацію, порожні рядки та рядок-заголовок', () => {
    const { rows, errors } = parseStudentList(
      'Прізвище;Ім’я;По батькові\n\n1. Коваленко Анна\n2) Мельник Остап\n3 Бондар Максим',
    );
    expect(errors).toEqual([]);
    expect(rows.map((r) => r.lastName)).toEqual(['Коваленко', 'Мельник', 'Бондар']);
    expect(rows.map((r) => r.line)).toEqual([3, 4, 5]);
  });

  it('нормалізує регістр', () => {
    expect(parseStudentList('КОВАЛЕНКО анна').rows[0]).toMatchObject({
      lastName: 'Коваленко',
      firstName: 'Анна',
    });
  });

  it('рядок з одним словом — помилка з номером рядка', () => {
    const { rows, errors } = parseStudentList('Коваленко Анна\nМельник\nБондар Максим');
    expect(rows).toHaveLength(2);
    expect(errors).toEqual([{ line: 2, text: 'Мельник', code: 'NEED_LAST_AND_FIRST_NAME' }]);
  });

  it('порожній текст і CRLF', () => {
    expect(parseStudentList('')).toEqual({ rows: [], errors: [] });
    expect(parseStudentList('Коваленко Анна\r\nМельник Остап\r\n').rows).toHaveLength(2);
  });

  it('заголовок розпізнається лише першим рядком', () => {
    const { rows, errors } = parseStudentList('Коваленко Анна\nПрізвище Ім’я');
    expect(rows).toHaveLength(2);
    expect(errors).toEqual([]);
  });

  it('перший рядок після рядка-помилки з заголовком не губиться', () => {
    const { errors } = parseStudentList('Мельник\nПрізвище Ім’я');
    expect(errors).toHaveLength(1);
  });
});

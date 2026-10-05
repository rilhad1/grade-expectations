export interface PromotedGroupName {
  name: string;
  course: number;
}

/**
 * Назва групи наступного курсу: «ПДт-11» → «ПДт-21» (перша цифра — курс, далі номер групи).
 * Повертає null, якщо назва не відповідає шаблону або курс уже останній (9).
 */
export function promoteGroupName(name: string): PromotedGroupName | null {
  const match = /^(.*?)(\d)(\d+)$/.exec(name.trim());
  if (!match) return null;
  const [, prefix = '', courseDigit = '', number = ''] = match;
  const course = Number(courseDigit) + 1;
  if (course > 9) return null;
  return { name: `${prefix}${course}${number}`, course };
}

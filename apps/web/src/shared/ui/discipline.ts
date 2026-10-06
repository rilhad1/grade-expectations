/**
 * Кольори картки дисципліни з її кольору-мітки: суцільний, світла заливка й межа.
 * Заливка й межа рахуються змішуванням із поверхнею, тому однаково працюють у світлій і темній темі
 * та для будь-якого кольору, збереженого в довіднику.
 */
export interface DisciplineTone {
  solid: string;
  tint: string;
  border: string;
}

export function disciplineTone(color: string): DisciplineTone {
  return {
    solid: color,
    tint: `color-mix(in srgb, ${color} 13%, var(--mui-palette-background-paper, #fff))`,
    border: `color-mix(in srgb, ${color} 26%, var(--mui-palette-background-paper, #fff))`,
  };
}

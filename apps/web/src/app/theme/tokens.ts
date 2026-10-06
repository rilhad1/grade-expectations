/**
 * Дизайн-токени Grade Expectations (джерело — design/tokens.json).
 * Значення з позначкою «виведено» відсутні в tokens.json і взяті з макетів або обчислені.
 */

export interface SchemeTokens {
  bg: string;
  surface: string;
  surface2: string;
  sunken: string;
  skeleton: string;
  line: string;
  line2: string;
  text: string;
  text2: string;
  text3: string;
  accent: string;
  accentHover: string;
  accentSoft: string;
  accentLine: string;
  onAccent: string;
  ok: string;
  okBg: string;
  warn: string;
  warnBg: string;
  warnDot: string;
  err: string;
  errFg: string;
  errBg: string;
  scrim: string;
  /** Статуси відвідуваності: фон і текст чипа, підсвітка рядка. */
  att: {
    present: { bg: string; fg: string };
    absent: { bg: string; fg: string; row: string };
    excused: { bg: string; fg: string; row: string };
    late: { bg: string; fg: string };
  };
  /** Бейдж ролі «Модератор» (викладач — на основі accentSoft/accent). */
  moderator: { bg: string; fg: string };
  /** Підсвітка клітинок оцінок. */
  grade: { low: string; high: string; naBg: string; naFg: string };
}

export const light: SchemeTokens = {
  bg: '#F7F5F0',
  surface: '#FFFFFF',
  surface2: '#FBFAF7',
  sunken: '#F1EEE7',
  skeleton: '#ECE8E0',
  line: '#E4E0D6',
  line2: '#D3CEC2',
  text: '#1F2328',
  text2: '#4E545B',
  text3: '#676C73',
  accent: '#1F3A5F',
  accentHover: '#162C49',
  accentSoft: '#E7EDF4',
  accentLine: '#B9C8DA',
  onAccent: '#FFFFFF',
  ok: '#2E6A3E',
  okBg: '#E5F1E8',
  warn: '#7A4A06',
  warnBg: '#FBF0DB',
  warnDot: '#B57A12',
  err: '#A3352B',
  errFg: '#8F2B22',
  errBg: '#FBE9E6',
  scrim: 'rgba(20,22,26,.42)',
  att: {
    present: { bg: '#F0EEE8', fg: '#4E545B' },
    absent: { bg: '#F7E4E1', fg: '#8F2B22', row: '#FDF6F4' },
    excused: { bg: '#F9ECD4', fg: '#7A4A06', row: '#FEF9F0' },
    late: { bg: '#E3EBF7', fg: '#1E4D8A' },
  },
  moderator: { bg: '#EFE7D6', fg: '#6B4E12' },
  grade: { low: '#FBECE9', high: '#E6F2E9', naBg: '#FBF0DB', naFg: '#7A4A06' },
};

export const dark: SchemeTokens = {
  bg: '#14171B',
  surface: '#1B1F25',
  surface2: '#20252B',
  sunken: '#262B32',
  skeleton: '#2A3038', // виведено
  line: '#2E343C',
  line2: '#3B424B',
  text: '#E9E7E2',
  text2: '#B6BBC2',
  text3: '#979DA5',
  accent: '#9DB8DA',
  accentHover: '#B3CBEE', // виведено
  accentSoft: '#22344A',
  accentLine: '#35506F', // виведено
  onAccent: '#0F1620',
  ok: '#8CCB9E',
  okBg: '#1E3526',
  warn: '#F2D29A',
  warnBg: '#3A2F17',
  warnDot: '#D9A84A', // виведено
  err: '#F08C80', // виведено
  errFg: '#F4BCB3',
  errBg: '#3A2421', // виведено
  scrim: 'rgba(0,0,0,.62)',
  att: {
    present: { bg: '#2A3038', fg: '#B6BBC2' }, // виведено
    absent: { bg: '#4A2420', fg: '#F4BCB3', row: '#231B1B' },
    excused: { bg: '#46351A', fg: '#F2D29A', row: '#221E16' },
    late: { bg: '#1F3350', fg: '#B3CBEE' },
  },
  moderator: { bg: '#3A3220', fg: '#E6D3A2' }, // виведено
  grade: { low: '#3A2421', high: '#1E3526', naBg: '#3A2F17', naFg: '#F2D29A' },
};

/** Приглушені кольори-мітки дисциплін (8 штук); у темі лишаються тими самими. */
export const disciplinePalette = [
  '#4C6A92',
  '#3D7A72',
  '#7A5C8C',
  '#94701F',
  '#A65E46',
  '#667536',
  '#9B5470',
  '#5D6B78',
] as const;

export const radius = { field: 6, button: 6, card: 10, sheet: 16, chip: 4 } as const;

export const size = {
  sidebar: 248,
  sidebarCollapsed: 72,
  topbar: 64,
  buttonDesktop: 36,
  buttonMobile: 48,
  touchMin: 48,
  bottomNav: 80,
  lessonRowMobile: 60,
  gradebookRow: 30,
  gradebookDateCol: 46,
} as const;

export const shadow = {
  menu: '0 8px 24px rgba(31,35,40,.10)',
  dialog: '0 20px 48px rgba(20,22,26,.28)',
  sheet: '0 -8px 24px rgba(0,0,0,.14)',
} as const;

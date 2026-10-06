import { createTheme, type Palette, type Theme } from '@mui/material/styles';

import { dark, light, radius, shadow, size, type SchemeTokens } from './tokens';

declare module '@mui/material/styles' {
  interface Palette {
    /** Токени продукту, яких немає в стандартній палітрі MUI. */
    ge: GeTokens;
  }
  interface PaletteOptions {
    ge?: GeTokens;
  }
}

type GeTokens = Pick<
  SchemeTokens,
  | 'surface2'
  | 'sunken'
  | 'skeleton'
  | 'line2'
  | 'text3'
  | 'accentSoft'
  | 'accentLine'
  | 'ok'
  | 'okBg'
  | 'warn'
  | 'warnBg'
  | 'warnDot'
  | 'err'
  | 'errFg'
  | 'errBg'
  | 'scrim'
  | 'att'
  | 'moderator'
  | 'grade'
>;

const ge = (t: SchemeTokens): GeTokens => ({
  surface2: t.surface2,
  sunken: t.sunken,
  skeleton: t.skeleton,
  line2: t.line2,
  text3: t.text3,
  accentSoft: t.accentSoft,
  accentLine: t.accentLine,
  ok: t.ok,
  okBg: t.okBg,
  warn: t.warn,
  warnBg: t.warnBg,
  warnDot: t.warnDot,
  err: t.err,
  errFg: t.errFg,
  errBg: t.errBg,
  scrim: t.scrim,
  att: t.att,
  moderator: t.moderator,
  grade: t.grade,
});

const scheme = (t: SchemeTokens) => ({
  palette: {
    primary: { main: t.accent, dark: t.accentHover, contrastText: t.onAccent },
    secondary: { main: t.text2 },
    background: { default: t.bg, paper: t.surface },
    text: { primary: t.text, secondary: t.text2, disabled: t.text3 },
    divider: t.line,
    success: { main: t.ok, light: t.okBg, contrastText: t.onAccent },
    warning: { main: t.warn, light: t.warnBg, contrastText: t.onAccent },
    error: { main: t.err, light: t.errBg, contrastText: t.onAccent },
    ge: ge(t),
  },
});

/** Палітра з урахуванням CSS-змінних (theme.vars) — для styleOverrides. */
const pal = (theme: Theme): Palette => (theme.vars ?? theme).palette as unknown as Palette;

const FONT = '"Golos Text", system-ui, -apple-system, "Segoe UI", sans-serif';

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'data-color-scheme' },
  defaultColorScheme: 'light',
  colorSchemes: { light: scheme(light), dark: scheme(dark) },
  breakpoints: { values: { xs: 0, sm: 600, md: 900, lg: 1280, xl: 1536 } },
  shape: { borderRadius: radius.field },
  typography: {
    fontFamily: FONT,
    htmlFontSize: 14,
    fontSize: 14,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 600,
    h4: { fontSize: 28, lineHeight: '36px', fontWeight: 600, letterSpacing: '-0.015em' },
    h5: { fontSize: 24, lineHeight: '32px', fontWeight: 600, letterSpacing: '-0.01em' },
    h6: { fontSize: 16, lineHeight: '24px', fontWeight: 600 },
    subtitle1: { fontSize: '1rem', lineHeight: 1.45, fontWeight: 600 },
    subtitle2: { fontSize: '0.9286rem', lineHeight: 1.4, fontWeight: 600 },
    body1: { fontSize: '1rem', lineHeight: 1.43 },
    body2: { fontSize: '0.9286rem', lineHeight: 1.4 },
    caption: { fontSize: '0.857rem', lineHeight: 1.33, fontWeight: 500 },
    button: { textTransform: 'none', fontWeight: 500, fontSize: '1rem' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: (theme) => ({
        html: { fontSize: 14, [theme.breakpoints.down('md')]: { fontSize: 16 } },
        body: {
          fontVariantNumeric: 'normal',
          WebkitFontSmoothing: 'antialiased',
          backgroundColor: pal(theme).background.default,
        },
        // Табличні цифри для оцінок, годин, дат і часу
        '.tnum': { fontVariantNumeric: 'tabular-nums' },
        '*:focus-visible': {
          outline: `2px solid ${pal(theme).primary.main}`,
          outlineOffset: 2,
        },
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0.01ms !important',
            scrollBehavior: 'auto !important',
          },
        },
      }),
    },
    MuiButtonBase: { defaultProps: { disableRipple: true } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: ({ theme }) => ({
          minHeight: size.buttonDesktop,
          borderRadius: radius.button,
          padding: '0 14px',
          fontWeight: 500,
          fontSize: '1rem',
          [theme.breakpoints.down('md')]: { minHeight: size.buttonMobile },
          '&.Mui-disabled': { opacity: 0.5 },
        }),
        sizeSmall: { minHeight: 28, padding: '0 10px', fontSize: '0.9286rem' },
        sizeLarge: { minHeight: size.buttonMobile, padding: '0 20px', fontSize: '1.0714rem' },
        outlined: ({ theme }) => ({
          borderColor: pal(theme).ge.line2,
          color: pal(theme).text.primary,
          backgroundColor: pal(theme).background.paper,
          '&:hover': { borderColor: pal(theme).ge.line2, backgroundColor: pal(theme).ge.sunken },
        }),
        containedPrimary: ({ theme }) => ({
          '&:hover': { backgroundColor: pal(theme).primary.dark },
        }),
        text: ({ theme }) => ({ color: pal(theme).primary.main }),
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: radius.button,
          [theme.breakpoints.down('md')]: { minWidth: 44, minHeight: 44 },
        }),
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: radius.field,
          backgroundColor: pal(theme).background.paper,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: pal(theme).ge.line2 },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: pal(theme).ge.line2 },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: pal(theme).primary.main,
            borderWidth: 1,
            boxShadow: `0 0 0 1px ${pal(theme).primary.main}`,
          },
          '&.Mui-error .MuiOutlinedInput-notchedOutline': {
            borderColor: pal(theme).ge.err,
            boxShadow: `0 0 0 1px ${pal(theme).ge.err}`,
          },
          '&.Mui-disabled': { backgroundColor: pal(theme).ge.sunken },
        }),
        input: { paddingTop: 8.5, paddingBottom: 8.5 },
        inputSizeSmall: { paddingTop: 6, paddingBottom: 6 },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { fontWeight: 500 } } },
    MuiFormHelperText: { styleOverrides: { root: { marginLeft: 0 } } },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' },
        sizeSmall: { height: 24, fontSize: '0.857rem' },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: 'none' },
        outlined: ({ theme }) => ({
          borderColor: pal(theme).divider,
          borderRadius: radius.card,
        }),
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: ({ theme }) => ({
          borderRadius: radius.card,
          boxShadow: shadow.dialog,
          border: `1px solid ${pal(theme).divider}`,
        }),
      },
    },
    MuiDialogTitle: {
      styleOverrides: { root: { fontSize: 20, lineHeight: '28px', fontWeight: 600 } },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: ({ theme }) => ({
          padding: '16px 24px',
          borderTop: `1px solid ${pal(theme).divider}`,
          gap: 8,
        }),
      },
    },
    MuiDrawer: { styleOverrides: { paper: { backgroundImage: 'none' } } },
    MuiMenu: {
      styleOverrides: {
        paper: ({ theme }) => ({
          borderRadius: radius.card,
          boxShadow: shadow.menu,
          border: `1px solid ${pal(theme).ge.line2}`,
        }),
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#1F2328',
          color: '#FFFFFF',
          fontSize: '0.857rem',
          fontWeight: 500,
          borderRadius: radius.field,
          padding: '6px 10px',
        },
        arrow: { color: '#1F2328' },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: ({ theme }) => ({ borderBottom: `1px solid ${pal(theme).ge.line2}` }),
        indicator: { height: 2 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: ({ theme }) => ({
          minHeight: 44,
          fontWeight: 500,
          color: pal(theme).text.secondary,
          '&.Mui-selected': { color: pal(theme).text.primary, fontWeight: 600 },
        }),
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: ({ theme }) => ({ borderBottomColor: pal(theme).divider }),
        head: ({ theme }) => ({
          backgroundColor: pal(theme).ge.surface2,
          color: pal(theme).ge.text3,
          fontSize: '0.857rem',
          fontWeight: 600,
          lineHeight: 1.33,
        }),
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: radius.field, alignItems: 'center' },
        standardSuccess: ({ theme }) => ({
          backgroundColor: pal(theme).ge.okBg,
          color: pal(theme).ge.ok,
        }),
        standardWarning: ({ theme }) => ({
          backgroundColor: pal(theme).ge.warnBg,
          color: pal(theme).ge.warn,
        }),
        standardError: ({ theme }) => ({
          backgroundColor: pal(theme).ge.errBg,
          color: pal(theme).ge.errFg,
        }),
        standardInfo: ({ theme }) => ({
          backgroundColor: pal(theme).ge.accentSoft,
          color: pal(theme).primary.main,
        }),
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: ({ theme }) => ({
          height: 6,
          borderRadius: 3,
          backgroundColor: pal(theme).ge.sunken,
        }),
        bar: { borderRadius: 3 },
      },
    },
    MuiSkeleton: {
      styleOverrides: {
        root: ({ theme }) => ({ backgroundColor: pal(theme).ge.skeleton }),
      },
    },
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: ({ theme }) => ({
          padding: 3,
          gap: 3,
          backgroundColor: pal(theme).ge.sunken,
          border: `1px solid ${pal(theme).ge.line2}`,
          borderRadius: 8,
        }),
        grouped: {
          border: 0,
          margin: 0,
          '&:not(:first-of-type), &:not(:last-of-type)': { borderRadius: radius.button },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          minHeight: 30,
          padding: '0 12px',
          borderRadius: radius.button,
          color: pal(theme).text.secondary,
          fontWeight: 500,
          '&.Mui-selected': {
            backgroundColor: pal(theme).background.paper,
            color: pal(theme).text.primary,
            fontWeight: 600,
            boxShadow: `0 0 0 1px ${pal(theme).ge.line2}`,
            '&:hover': { backgroundColor: pal(theme).background.paper },
          },
          [theme.breakpoints.down('md')]: { minHeight: 42 },
        }),
      },
    },
  },
});

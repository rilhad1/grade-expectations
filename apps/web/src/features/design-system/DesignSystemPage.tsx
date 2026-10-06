import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import type { ReactNode } from 'react';

import { ThemeModeSwitch } from '../../app/ThemeModeSwitch';
import { disciplinePalette } from '../../app/theme';
import { uk } from '../../shared/i18n/uk';
import {
  CardSkeleton,
  ControlFormBadge,
  EmptyState,
  GradeChip,
  LessonCard,
  ListSkeleton,
  PageHeader,
  ProgressBar,
  RoleBadge,
  StatCard,
  StatusChip,
  type LessonCardState,
  type LessonCardTag,
} from '../../shared/ui';

const t = uk.designSystem;

const SWATCHES: { name: string; color: string }[] = [
  { name: 'background.default', color: 'background.default' },
  { name: 'background.paper', color: 'background.paper' },
  { name: 'ge.surface2', color: 'ge.surface2' },
  { name: 'ge.sunken', color: 'ge.sunken' },
  { name: 'divider', color: 'divider' },
  { name: 'ge.line2', color: 'ge.line2' },
  { name: 'text.primary', color: 'text.primary' },
  { name: 'text.secondary', color: 'text.secondary' },
  { name: 'ge.text3', color: 'ge.text3' },
  { name: 'primary.main', color: 'primary.main' },
  { name: 'ge.accentSoft', color: 'ge.accentSoft' },
  { name: 'ge.okBg', color: 'ge.okBg' },
  { name: 'ge.warnBg', color: 'ge.warnBg' },
  { name: 'ge.errBg', color: 'ge.errBg' },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box
      component="section"
      aria-label={title}
      sx={{
        display: 'grid',
        gridTemplateColumns: { md: '220px 1fr' },
        gap: 4,
        py: 4,
        borderTop: 1,
        borderColor: 'divider',
      }}
    >
      <Typography variant="h6" component="h2">
        {title}
      </Typography>
      <Box>{children}</Box>
    </Box>
  );
}

const CARDS: { state: LessonCardState; tag?: LessonCardTag }[] = [
  { state: 'planned' },
  { state: 'current', tag: { label: t.cards.current, tone: 'ok' } },
  { state: 'held', tag: { label: t.cards.held, tone: 'ok' } },
  { state: 'cancelled', tag: { label: t.cards.cancelled, tone: 'err' } },
  { state: 'moved', tag: { label: t.cards.moved, tone: 'accent' } },
  { state: 'substituted', tag: { label: t.cards.substituted, tone: 'warn' } },
  { state: 'extra', tag: { label: t.cards.extra, tone: 'outline' } },
];

/** Внутрішня сторінка огляду дизайн-системи (лише dev-збірка). */
export function DesignSystemPage() {
  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 2, md: 4 }, py: 4 }}>
      <PageHeader title={t.title} subtitle={t.intro} actions={<ThemeModeSwitch />} />

      <Section title={t.colors}>
        <Stack direction="row" flexWrap="wrap" gap={2}>
          {SWATCHES.map((s) => (
            <Box key={s.name} sx={{ width: 132 }}>
              <Box
                sx={{
                  height: 56,
                  borderRadius: '6px',
                  bgcolor: s.color,
                  border: 1,
                  borderColor: 'divider',
                }}
              />
              <Typography variant="caption" className="tnum" color="text.secondary">
                {s.name}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Section>

      <Section title={t.attendance}>
        <Stack gap={2}>
          <Stack direction="row" gap={2} alignItems="center">
            <StatusChip status="PRESENT" present />
            <StatusChip status="ABSENT" />
            <StatusChip status="EXCUSED" />
            <StatusChip status="LATE" />
          </Stack>
          <Stack direction="row" gap={0.5} flexWrap="wrap">
            {Array.from({ length: 12 }, (_, i) => (
              <GradeChip key={i} value={i + 1} />
            ))}
          </Stack>
          <Stack direction="row" gap={2} alignItems="center">
            <GradeChip value={7} />
            <GradeChip value={4} state="pending" />
            <GradeChip value={11} state="error" />
            <GradeChip value={9} state="conflict" />
            <GradeChip value={10} state="editing" />
          </Stack>
        </Stack>
      </Section>

      <Section title={t.disciplines}>
        <Stack direction="row" gap={1.5} flexWrap="wrap">
          {disciplinePalette.map((c) => (
            <Box key={c} sx={{ width: 96, height: 56, borderRadius: '6px', bgcolor: c }} />
          ))}
        </Stack>
      </Section>

      <Section title={t.typography}>
        <Stack gap={1}>
          <Typography variant="h4">{t.title}</Typography>
          <Typography variant="h5">{t.title}</Typography>
          <Typography variant="h6">{t.title}</Typography>
          <Typography>{t.sample}</Typography>
          <Typography variant="body2">{t.sample}</Typography>
          <Typography variant="caption">{t.sample}</Typography>
          <Typography className="tnum" sx={{ fontSize: 20, fontWeight: 600 }}>
            08:30 · 10,5 · 2 140 · 48 з 72
          </Typography>
        </Stack>
      </Section>

      <Section title={t.controls}>
        <Stack gap={3}>
          <Stack direction="row" gap={1.5} flexWrap="wrap">
            <Button variant="contained">{t.primary}</Button>
            <Button variant="outlined">{t.secondary}</Button>
            <Button>{t.text}</Button>
            <Button variant="outlined" color="error">
              {t.danger}
            </Button>
            <Button variant="contained" disabled>
              {t.primary}
            </Button>
            <Button variant="contained" startIcon={<CalendarMonthIcon />}>
              {t.primary}
            </Button>
          </Stack>
          <Stack direction="row" gap={2} flexWrap="wrap" alignItems="flex-start">
            <TextField label={t.field} size="small" />
            <TextField
              label={t.field}
              size="small"
              defaultValue="13"
              error
              helperText={t.fieldError}
            />
            <TextField label={t.field} size="small" defaultValue={uk.theme.dark} disabled />
          </Stack>
        </Stack>
      </Section>

      <Section title={t.lessonCards}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 2,
          }}
        >
          {CARDS.map(({ state, tag }) => (
            <LessonCard
              key={state}
              color={disciplinePalette[state === 'moved' ? 1 : state === 'substituted' ? 3 : 0]}
              title={t.sample}
              kind="ПР"
              meta={['ПДт-12 · ауд. 214']}
              state={state}
              {...(tag && { tag })}
              minHeight={112}
            />
          ))}
        </Box>
      </Section>

      <Section title={t.badges}>
        <Stack direction="row" gap={2} alignItems="center" flexWrap="wrap">
          <RoleBadge role="TEACHER" />
          <RoleBadge role="MODERATOR" />
          <ControlFormBadge form="EXAM" />
          <ControlFormBadge form="CREDIT" />
        </Stack>
      </Section>

      <Section title={t.states}>
        <Stack gap={3}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 2 }}>
            <StatCard label={uk.hours.columns.planned} value={306} suffix="год" />
            <StatCard label={uk.hours.columns.held} value={186} suffix="год · 61%" />
            <StatCard label={uk.hours.columns.deficit} value="−4" tone="warn" />
          </Box>
          <ProgressBar value={0.64} label={t.loading} />
          <EmptyState
            icon={<CalendarMonthIcon />}
            title={t.emptyTitle}
            description={t.emptyText}
            action={<Button variant="outlined">{t.emptyAction}</Button>}
          />
          <CardSkeleton label={t.loading} />
          <ListSkeleton label={t.loading} />
        </Stack>
      </Section>
    </Box>
  );
}

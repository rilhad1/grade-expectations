import type { LessonItemDto, TodayDto } from '@ge/shared';
import CheckIcon from '@mui/icons-material/Check';
import {
  Alert,
  Box,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import { q } from '../../api/queries';
import { loadToday } from '../../offline/lessonSource';
import { formatWeekdayDate } from '../../shared/format';
import { uk } from '../../shared/i18n/uk';
import { DisciplineDot } from '../../shared/ui/DisciplineDot';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';
import { LinkButton, LinkListItem } from '../../shared/ui/links';

import { kyivMinutes, pairTime, pickCurrent } from './model';

const t = uk.today;

function LessonLine({
  lesson,
  bells,
}: {
  lesson: TodayDto['lessons'][number];
  bells: Parameters<typeof pairTime>[0];
}) {
  const held = lesson.status === 'HELD';
  return (
    <ListItem
      disablePadding
      secondaryAction={
        held ? (
          <Chip
            size="small"
            color="success"
            icon={<CheckIcon />}
            label={`${lesson.marked}/${lesson.total}`}
          />
        ) : undefined
      }
    >
      <LinkListItem to="/lessons/$lessonId" params={{ lessonId: lesson.id }} sx={{ minHeight: 56 }}>
        <ListItemText
          primary={
            <>
              <DisciplineDot color={lesson.discipline.color} />
              {lesson.discipline.shortTitle} · {lesson.group.name}
              {lesson.subgroup ? ` · ${lesson.subgroup.name}` : ''}
            </>
          }
          secondary={`${lesson.pairNumber} ${t.pair} · ${pairTime(bells, lesson.pairNumber)}${lesson.room ? ` · ${t.room} ${lesson.room.name}` : ''}`}
          slotProps={{ secondary: { sx: { fontVariantNumeric: 'tabular-nums' } } }}
        />
      </LinkListItem>
    </ListItem>
  );
}

function CurrentCard({
  lesson,
  state,
  progress,
  bells,
}: {
  lesson: LessonItemDto;
  state: 'ongoing' | 'next';
  progress: number;
  bells: Parameters<typeof pairTime>[0];
}) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2.5, mb: 2, borderColor: state === 'ongoing' ? 'primary.main' : 'divider' }}
    >
      <Chip
        size="small"
        color={state === 'ongoing' ? 'primary' : 'default'}
        label={state === 'ongoing' ? t.now : t.next}
        sx={{ mb: 1 }}
      />
      <Typography variant="h6" component="h2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {lesson.pairNumber} {t.pair} · {pairTime(bells, lesson.pairNumber)}
      </Typography>
      <Typography variant="h5" component="p" sx={{ my: 0.5 }}>
        <DisciplineDot color={lesson.discipline.color} size={12} />
        {lesson.discipline.title} · {lesson.group.name}
        {lesson.subgroup ? ` · ${lesson.subgroup.name}` : ''}
      </Typography>
      <Typography color="text.secondary">
        {lesson.room ? `${t.room} ${lesson.room.name} · ` : ''}
        {uk.lesson.topic}: {lesson.topic ?? uk.lesson.noTopic}
      </Typography>
      {state === 'ongoing' && (
        <LinearProgress
          variant="determinate"
          value={progress * 100}
          sx={{ my: 2, height: 6, borderRadius: 3 }}
          aria-label="Час пари"
        />
      )}
      <LinkButton
        to="/lessons/$lessonId"
        params={{ lessonId: lesson.id }}
        variant="contained"
        size="large"
        sx={{ mt: 2, minHeight: 52, minWidth: 220 }}
      >
        {t.start}
      </LinkButton>
    </Paper>
  );
}

export function TodayScreen({ fullName }: { fullName: string }) {
  const today = useQuery({ queryKey: ['today'], queryFn: loadToday, refetchInterval: 60_000 });
  const bells = useQuery(q.bells());
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date());
    }, 30_000);
    return () => {
      clearInterval(id);
    };
  }, []);

  const data = today.data;
  const bellList = bells.data ?? [];
  const current = data ? pickCurrent(data.lessons, bellList, kyivMinutes(now)) : null;
  const others = data?.lessons.filter((l) => l.id !== current?.lesson?.id) ?? [];

  return (
    <>
      <Typography variant="h5" component="h1" gutterBottom>
        {t.title}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {t.welcome}, {fullName}
        {data ? ` · ${formatWeekdayDate(data.date)}` : ''}
      </Typography>
      <ErrorAlert error={today.error} />
      {data && (
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} alignItems="flex-start">
          <Box sx={{ flexGrow: 1, minWidth: 0, width: '100%' }}>
            {data.lessons.length === 0 && <Alert severity="info">{t.noLessons}</Alert>}
            {current?.lesson && (current.state === 'ongoing' || current.state === 'next') && (
              <CurrentCard
                lesson={current.lesson}
                state={current.state}
                progress={current.progress}
                bells={bellList}
              />
            )}
            {others.length > 0 && (
              <Paper variant="outlined">
                <Typography variant="subtitle2" sx={{ px: 2, pt: 1.5 }}>
                  {t.others}
                </Typography>
                <List>
                  {others.map((l) => (
                    <LessonLine key={l.id} lesson={l} bells={bellList} />
                  ))}
                </List>
              </Paper>
            )}
          </Box>

          <Stack spacing={2} sx={{ width: { xs: '100%', lg: 360 }, flexShrink: 0 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" component="h2" gutterBottom>
                {t.events}
              </Typography>
              {data.attestations.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  {t.noEvents}
                </Typography>
              )}
              {data.attestations.map((a) => (
                <Typography key={`${a.kind}-${a.dateFrom}`} variant="body2" sx={{ mb: 0.5 }}>
                  {t.eventKinds[a.kind]} · {a.groups.join(', ')} —{' '}
                  <strong>{t.inDays(a.daysUntil)}</strong>
                </Typography>
              ))}
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" component="h2" gutterBottom>
                {t.risk}
              </Typography>
              {data.risk.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  {t.noRisk}
                </Typography>
              )}
              {data.risk.slice(0, 8).map((r) => (
                <Typography key={`${r.loadId}-${r.enrollmentId}`} variant="body2" sx={{ mb: 0.5 }}>
                  <Link to="/gradebook/$loadId" params={{ loadId: r.loadId }}>
                    {r.lastName} {r.firstName}
                  </Link>{' '}
                  · {r.group} · {r.discipline}{' '}
                  <Typography component="span" variant="caption" color="error">
                    ({r.reasons.map((x) => t.riskReasons[x]).join(', ')})
                  </Typography>
                </Typography>
              ))}
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" component="h2" gutterBottom>
                {t.hours}
              </Typography>
              {data.hours.map((h) => (
                <Box key={h.id} sx={{ mb: 1.5 }}>
                  <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    <DisciplineDot color={h.discipline.color} size={8} />
                    {h.discipline.shortTitle} · {h.group.name} · {uk.loads.kindsShort[h.kind]} —{' '}
                    {h.hours.held} {t.hoursOf} {h.plannedHours} {t.hoursUnit}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, (h.hours.held / h.plannedHours) * 100)}
                    color={h.hours.forecast < h.plannedHours ? 'warning' : 'primary'}
                    sx={{ height: 4, borderRadius: 2 }}
                  />
                </Box>
              ))}
            </Paper>
          </Stack>
        </Stack>
      )}
    </>
  );
}

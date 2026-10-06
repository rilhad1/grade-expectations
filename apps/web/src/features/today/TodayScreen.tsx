import type { LessonItemDto, TodayDto } from '@ge/shared';
import CalendarViewWeekOutlined from '@mui/icons-material/CalendarViewWeekOutlined';
import CheckIcon from '@mui/icons-material/Check';
import PlaceOutlined from '@mui/icons-material/PlaceOutlined';
import PlayArrow from '@mui/icons-material/PlayArrow';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { q } from '../../api/queries';
import { loadToday } from '../../offline/lessonSource';
import { formatWeekdayDate } from '../../shared/format';
import { uk } from '../../shared/i18n/uk';
import { DisciplineDot } from '../../shared/ui/DisciplineDot';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';
import { PageHeader } from '../../shared/ui/PageHeader';
import { ProgressBar } from '../../shared/ui/Stat';
import { LinkBase, LinkButton } from '../../shared/ui/links';

import { kyivMinutes, pairTime, pickCurrent } from './model';

const t = uk.today;

const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return h * 60 + m;
};

const Pill = ({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: 'accent' | 'ok' | 'sunken';
}) => (
  <Box
    component="span"
    className="tnum"
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 0.75,
      height: 22,
      px: 1,
      borderRadius: '11px',
      fontSize: 12,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      bgcolor: tone === 'accent' ? 'primary.main' : tone === 'ok' ? 'ge.okBg' : 'ge.sunken',
      color: tone === 'accent' ? 'primary.contrastText' : tone === 'ok' ? 'ge.ok' : 'text.primary',
    }}
  >
    {children}
  </Box>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Box
    component="section"
    aria-label={title}
    sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}
  >
    <Typography variant="h6" component="h2" sx={{ fontSize: { xs: 17, md: 16 } }}>
      {title}
    </Typography>
    {children}
  </Box>
);

function LessonRow({
  lesson,
  bells,
}: {
  lesson: TodayDto['lessons'][number];
  bells: Parameters<typeof pairTime>[0];
}) {
  const held = lesson.status === 'HELD';
  const off = lesson.status === 'CANCELLED' || lesson.status === 'MOVED';
  return (
    <LinkBase
      to="/lessons/$lessonId"
      params={{ lessonId: lesson.id }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        width: '100%',
        minHeight: 64,
        px: { xs: 2, md: 2.5 },
        py: 1.5,
        textAlign: 'left',
        borderBottom: 1,
        borderColor: 'divider',
        '&:last-of-type': { borderBottom: 0 },
        color: off ? 'ge.text3' : 'text.primary',
      }}
    >
      <Box
        className="tnum"
        sx={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 600,
          ...(held
            ? { bgcolor: 'ge.okBg', color: 'ge.ok' }
            : { border: '1px solid', borderColor: 'ge.line2', color: 'text.secondary' }),
        }}
      >
        {held ? <CheckIcon sx={{ fontSize: 16 }} /> : lesson.pairNumber}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontWeight: 500, textDecoration: off ? 'line-through' : 'none' }}>
          <DisciplineDot color={lesson.discipline.color} size={8} />
          {lesson.discipline.shortTitle} · {lesson.group.name}
          {lesson.subgroup ? ` · ${lesson.subgroup.name}` : ''}
        </Typography>
        <Typography className="tnum" variant="body2" color="text.secondary" noWrap>
          {lesson.pairNumber} {t.pair} · {pairTime(bells, lesson.pairNumber)}
          {lesson.room ? ` · ${t.room} ${lesson.room.name}` : ''}
        </Typography>
      </Box>
      {held ? (
        <Pill tone="sunken">{`${String(lesson.marked)}/${String(lesson.total)}`}</Pill>
      ) : off ? (
        <Typography variant="body2" color="text.secondary">
          {t.cancelled}
        </Typography>
      ) : null}
    </LinkBase>
  );
}

function CurrentCard({
  lesson,
  total,
  state,
  progress,
  bells,
  nowMin,
}: {
  lesson: LessonItemDto;
  total: number | null;
  state: 'ongoing' | 'next';
  progress: number;
  bells: Parameters<typeof pairTime>[0];
  nowMin: number;
}) {
  const bell = bells.find((b) => b.pairNumber === lesson.pairNumber);
  const start = bell ? toMin(bell.startsAt) : 0;
  const end = bell ? toMin(bell.endsAt) : 0;
  return (
    <Paper
      variant="outlined"
      component="section"
      aria-label={t.title}
      sx={{
        p: { xs: 2.25, md: 3 },
        display: 'flex',
        flexDirection: 'column',
        gap: 2.25,
        borderColor: state === 'ongoing' ? 'ge.accentLine' : 'divider',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Pill tone="accent">{`${String(lesson.pairNumber)} ${t.pair}`}</Pill>
        <Typography className="tnum" sx={{ fontWeight: 600 }}>
          {`${String(lesson.pairNumber)} ${t.pair} · ${pairTime(bells, lesson.pairNumber)}`}
        </Typography>
        <Pill tone="ok">{state === 'ongoing' ? t.now : t.next}</Pill>
        <Box sx={{ flex: 1 }} />
        <Typography variant="body2" color="ge.text3">
          {uk.loads.kinds[lesson.kind]}
        </Typography>
      </Box>

      <Box>
        <Typography
          variant="h4"
          component="p"
          sx={{
            display: 'flex',
            alignItems: 'center',
            fontSize: { xs: 24, md: 28 },
            lineHeight: 1.25,
          }}
        >
          <DisciplineDot color={lesson.discipline.color} size={12} gap={1.5} />
          {lesson.discipline.title}
        </Typography>
        <Typography
          color="text.secondary"
          sx={{ mt: 0.75, display: 'flex', gap: 2, flexWrap: 'wrap' }}
        >
          <Box component="b" sx={{ color: 'text.primary', fontWeight: 600 }}>
            {lesson.group.name}
            {lesson.subgroup ? ` · ${lesson.subgroup.name}` : ''}
          </Box>
          {total !== null && (
            <span>
              {t.wholeGroup} · {t.students(total)}
            </span>
          )}
          {lesson.room && (
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
              <PlaceOutlined sx={{ fontSize: 16 }} />
              {t.room} {lesson.room.name}
            </Box>
          )}
        </Typography>
      </Box>

      <Box
        sx={{
          px: 1.75,
          py: 1.25,
          bgcolor: 'ge.surface2',
          border: 1,
          borderColor: 'divider',
          borderRadius: '6px',
        }}
      >
        <Typography>
          {uk.lesson.topic}: {lesson.topic ?? uk.lesson.noTopic}
        </Typography>
      </Box>

      {state === 'ongoing' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ProgressBar
            value={progress}
            color="var(--mui-palette-ge-ok)"
            height={8}
            label={t.time}
          />
          <Box
            className="tnum"
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 13,
              color: 'text.secondary',
            }}
          >
            <span>{t.elapsed(Math.max(0, nowMin - start))}</span>
            <span>{t.untilBell(Math.max(0, end - nowMin), bell?.endsAt ?? '')}</span>
          </Box>
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        <LinkButton
          to="/lessons/$lessonId"
          params={{ lessonId: lesson.id }}
          variant="contained"
          size="large"
          startIcon={<PlayArrow />}
          sx={{ minHeight: 52, minWidth: { xs: '100%', md: 220 } }}
        >
          {t.start}
        </LinkButton>
        <LinkButton
          to="/gradebook/$loadId"
          params={{ loadId: lesson.loadId }}
          variant="outlined"
          size="large"
          sx={{ display: { xs: 'none', md: 'inline-flex' } }}
        >
          {t.openJournal}
        </LinkButton>
      </Box>
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
  const nowMin = kyivMinutes(now);
  const current = data ? pickCurrent(data.lessons, bellList, nowMin) : null;
  const others = data?.lessons.filter((l) => l.id !== current?.lesson?.id) ?? [];
  const currentTotal = data?.lessons.find((l) => l.id === current?.lesson?.id)?.total ?? null;
  const heldCount = data?.lessons.filter((l) => l.status === 'HELD').length ?? 0;

  return (
    <>
      <PageHeader
        title={t.title}
        subtitle={
          <>
            {t.welcome}, {fullName}
            {data
              ? ` · ${formatWeekdayDate(data.date)}${data.lessons.length > 0 ? ` · ${t.pairsSummary(data.lessons.length, heldCount)}` : ''}`
              : ''}
          </>
        }
        actions={
          <LinkButton
            to="/schedule"
            variant="outlined"
            startIcon={<CalendarViewWeekOutlined />}
            sx={{ display: { xs: 'none', md: 'inline-flex' } }}
          >
            {t.weekSchedule}
          </LinkButton>
        }
      />
      <ErrorAlert error={today.error} />
      {data && (
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} alignItems="flex-start">
          <Stack spacing={3} sx={{ flexGrow: 1, minWidth: 0, width: '100%' }}>
            {data.lessons.length === 0 && (
              <EmptyState
                icon={<CalendarViewWeekOutlined />}
                title={t.noLessons}
                action={
                  <LinkButton to="/schedule" variant="outlined">
                    {t.weekSchedule}
                  </LinkButton>
                }
              />
            )}
            {current?.lesson && (current.state === 'ongoing' || current.state === 'next') && (
              <CurrentCard
                lesson={current.lesson}
                total={currentTotal}
                state={current.state}
                progress={current.progress}
                bells={bellList}
                nowMin={nowMin}
              />
            )}
            {others.length > 0 && (
              <Section title={current?.lesson ? t.others : t.title}>
                <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                  {others.map((l) => (
                    <LessonRow key={l.id} lesson={l} bells={bellList} />
                  ))}
                </Paper>
              </Section>
            )}
          </Stack>

          <Stack spacing={2} sx={{ width: { xs: '100%', lg: 368 }, flexShrink: 0 }}>
            <Paper
              variant="outlined"
              component="section"
              aria-label={t.events}
              sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.75 }}
            >
              <Typography variant="subtitle1" component="h2" sx={{ fontSize: 15 }}>
                {t.events}
              </Typography>
              {data.attestations.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  {t.noEvents}
                </Typography>
              )}
              {data.attestations.map((a) => (
                <Box key={`${a.kind}-${a.dateFrom}`} sx={{ display: 'flex', gap: 1.5 }}>
                  <Box
                    className="tnum"
                    sx={{
                      width: 44,
                      flexShrink: 0,
                      border: 1,
                      borderColor: 'ge.line2',
                      borderRadius: '6px',
                      textAlign: 'center',
                      py: 0.5,
                      lineHeight: 1.15,
                    }}
                  >
                    <Box
                      sx={{
                        fontSize: 11,
                        color: 'ge.text3',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                      }}
                    >
                      {new Intl.DateTimeFormat('uk-UA', {
                        weekday: 'short',
                        timeZone: 'UTC',
                      }).format(new Date(`${a.dateFrom}T00:00:00Z`))}
                    </Box>
                    <Box sx={{ fontSize: 17, fontWeight: 600 }}>{a.dateFrom.slice(8)}</Box>
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 500 }}>{t.eventKinds[a.kind]}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {a.groups.join(', ')}
                    </Typography>
                    <Typography
                      className="tnum"
                      sx={{ fontSize: 12, fontWeight: 600, color: 'ge.warn' }}
                    >
                      {t.inDays(a.daysUntil)}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Paper>

            <Paper
              variant="outlined"
              component="section"
              aria-label={t.risk}
              sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1 }}
            >
              <Typography variant="subtitle1" component="h2" sx={{ fontSize: 15 }}>
                {t.risk}{' '}
                {data.risk.length > 0 && (
                  <Box
                    component="span"
                    className="tnum"
                    sx={{ color: 'ge.text3', fontWeight: 500 }}
                  >
                    · {data.risk.length}
                  </Box>
                )}
              </Typography>
              <Typography variant="caption" color="ge.text3">
                {t.riskHint}
              </Typography>
              {data.risk.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  {t.noRisk}
                </Typography>
              )}
              {data.risk.slice(0, 8).map((r) => (
                <Box
                  key={`${r.loadId}-${r.enrollmentId}`}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    py: 1,
                    borderTop: 1,
                    borderColor: 'divider',
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <LinkBase
                      to="/gradebook/$loadId"
                      params={{ loadId: r.loadId }}
                      sx={{ fontWeight: 500, color: 'text.primary', textAlign: 'left' }}
                    >
                      {r.lastName} {r.firstName}
                    </LinkBase>{' '}
                    <Typography component="span" variant="caption" color="ge.text3">
                      {r.group} · {r.discipline}
                    </Typography>
                  </Box>
                  {r.reasons.includes('LOW_GRADE') && r.average !== null && (
                    <Box
                      component="span"
                      className="tnum"
                      sx={{
                        px: 1,
                        height: 22,
                        display: 'inline-flex',
                        alignItems: 'center',
                        borderRadius: '11px',
                        bgcolor: 'ge.grade.low',
                        color: 'ge.errFg',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {`сер. ${r.average.toFixed(1).replace('.', ',')}`}
                    </Box>
                  )}
                  {r.reasons.includes('ABSENCES') && (
                    <Box
                      component="span"
                      className="tnum"
                      sx={{
                        px: 1,
                        height: 22,
                        display: 'inline-flex',
                        alignItems: 'center',
                        borderRadius: '11px',
                        bgcolor: 'ge.att.excused.bg',
                        color: 'ge.att.excused.fg',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {`${String(Math.round(r.absencePercent))}%`}
                    </Box>
                  )}
                </Box>
              ))}
            </Paper>

            <Paper
              variant="outlined"
              component="section"
              aria-label={t.hours}
              sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.75 }}
            >
              <Box
                sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}
              >
                <Typography variant="subtitle1" component="h2" sx={{ fontSize: 15 }}>
                  {t.hours}
                </Typography>
                <LinkBase to="/hours" sx={{ fontSize: 13, color: 'primary.main' }}>
                  {t.details}
                </LinkBase>
              </Box>
              {data.hours.map((h) => {
                const short = h.hours.forecast < h.plannedHours;
                return (
                  <Box key={h.id} sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    <Box
                      className="tnum"
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 1,
                        fontSize: 13,
                      }}
                    >
                      <Box
                        component="span"
                        sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}
                      >
                        <DisciplineDot color={h.discipline.color} size={8} gap={0.75} />
                        <Box
                          component="span"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {h.discipline.shortTitle} · {h.group.name} · {uk.loads.kindsShort[h.kind]}
                        </Box>
                      </Box>
                      <Box
                        component="span"
                        sx={{
                          whiteSpace: 'nowrap',
                          color: short ? 'ge.warn' : 'text.secondary',
                          fontWeight: short ? 500 : 400,
                        }}
                      >
                        {h.hours.held} {t.hoursOf} {h.plannedHours} {t.hoursUnit}
                      </Box>
                    </Box>
                    <ProgressBar
                      value={h.plannedHours === 0 ? 0 : h.hours.held / h.plannedHours}
                      color={h.discipline.color}
                      label={`${h.discipline.shortTitle} · ${h.group.name}`}
                    />
                  </Box>
                );
              })}
            </Paper>
          </Stack>
        </Stack>
      )}
    </>
  );
}

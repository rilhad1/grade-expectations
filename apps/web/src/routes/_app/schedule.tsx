import { weekParity } from '@ge/domain';
import type { LessonItemDto } from '@ge/shared';
import { rescheduleRequestDtoSchema } from '@ge/shared';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import EventAvailableOutlined from '@mui/icons-material/EventAvailableOutlined';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { getAll } from '../../api/http';
import { q } from '../../api/queries';
import { fetchLessons } from '../../api/teaching';
import { useCurrentSemester } from '../../app/SemesterSwitcher';
import { WeekGlyph, toSemesterInput } from '../../app/WeekBadge';
import { todayKyiv } from '../../app/today';
import { RequestDialog } from '../../features/teacher-schedule/RequestDialog';
import {
  canRequestMove,
  lessonsAt,
  shiftWeek,
  weekDays,
  weekEnd,
  weekStartOf,
} from '../../features/teacher-schedule/model';
import { formatShortDate } from '../../shared/format';
import { uk } from '../../shared/i18n/uk';
import { DisciplineDot } from '../../shared/ui/DisciplineDot';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';
import { LessonCard } from '../../shared/ui/LessonCard';
import { PageHeader } from '../../shared/ui/PageHeader';
import { ListSkeleton } from '../../shared/ui/Skeletons';
import { LinkButton } from '../../shared/ui/links';

export const Route = createFileRoute('/_app/schedule')({ component: SchedulePage });

const t = uk.teacherSchedule;
const statusLabel = {
  MOVED: t.statusMoved,
  CANCELLED: t.statusCancelled,
  SUBSTITUTED: t.statusSubstituted,
} as const;

function SchedulePage() {
  const today = todayKyiv();
  const navigate = useNavigate();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const { semester } = useCurrentSemester();
  const [weekStart, setWeekStart] = useState(() => weekStartOf(today));
  const [dayPick, setDayPick] = useState<string | null>(null);
  const bells = useQuery(q.bells());
  const lessons = useQuery({
    queryKey: ['lessons', weekStart],
    queryFn: () => fetchLessons(weekStart, weekEnd(weekStart)),
  });
  const myRequests = useQuery({
    queryKey: ['reschedule-requests', 'mine'],
    queryFn: () => getAll('/reschedule-requests', rescheduleRequestDtoSchema),
  });
  const [menu, setMenu] = useState<{ el: HTMLElement; lesson: LessonItemDto } | null>(null);
  const [requesting, setRequesting] = useState<LessonItemDto | null>(null);

  const allDays = weekDays(weekStart);
  const list = lessons.data ?? [];
  // Субота показується, лише якщо в ній є заняття
  const days = list.some((l) => l.date === allDays[5]) ? allDays : allDays.slice(0, 5);
  const parity =
    semester && weekStart >= semester.startDate && weekStart <= semester.endDate
      ? weekParity(weekStart, toSemesterInput(semester))
      : null;
  const activeDay =
    dayPick && days.includes(dayPick)
      ? dayPick
      : days.includes(today)
        ? today
        : (days[0] ?? weekStart);
  const disciplines = [...new Map(list.map((l) => [l.discipline.id, l.discipline])).values()];

  const card = (l: LessonItemDto) => {
    const tag =
      l.status in statusLabel
        ? {
            label: statusLabel[l.status as keyof typeof statusLabel],
            tone:
              l.status === 'CANCELLED'
                ? ('err' as const)
                : l.status === 'SUBSTITUTED'
                  ? ('warn' as const)
                  : ('accent' as const),
          }
        : l.status === 'HELD'
          ? { label: t.held, tone: 'ok' as const }
          : undefined;
    return (
      <LessonCard
        key={l.id}
        color={l.discipline.color}
        title={l.discipline.shortTitle}
        kind={uk.loads.kindsShort[l.kind]}
        meta={[
          `${l.group.name}${l.subgroup ? ` · ${l.subgroup.name}` : ''}`,
          ...(l.room ? [`${uk.today.room} ${l.room.name}`] : []),
        ]}
        state={l.status === 'CANCELLED' ? 'cancelled' : l.status === 'HELD' ? 'held' : 'planned'}
        {...(tag && { tag })}
        ariaLabel={`${l.discipline.shortTitle} ${l.group.name}`}
        minHeight={desktop ? 108 : 84}
        onClick={(e) => {
          setMenu({ el: e.currentTarget, lesson: l });
        }}
      />
    );
  };

  return (
    <>
      <PageHeader
        title={t.title}
        actions={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <IconButton
              aria-label={t.prev}
              onClick={() => {
                setWeekStart(shiftWeek(weekStart, -1));
              }}
            >
              <ChevronLeft />
            </IconButton>
            <Button
              variant="outlined"
              onClick={() => {
                setWeekStart(weekStartOf(today));
                setDayPick(null);
              }}
            >
              {t.thisWeek}
            </Button>
            <IconButton
              aria-label={t.next}
              onClick={() => {
                setWeekStart(shiftWeek(weekStart, 1));
              }}
            >
              <ChevronRight />
            </IconButton>
            <Typography className="tnum" sx={{ fontSize: 16, fontWeight: 600, ml: 0.5 }}>
              {formatShortDate(days[0] ?? weekStart)} —{' '}
              {formatShortDate(days[days.length - 1] ?? weekStart)}
            </Typography>
            {parity && (
              <Box
                component="span"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 1,
                  height: 24,
                  pl: 1,
                  pr: 1.25,
                  borderRadius: '12px',
                  bgcolor: 'ge.accentSoft',
                  border: '1px solid',
                  borderColor: 'ge.accentLine',
                  color: 'primary.main',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <WeekGlyph parity={parity} />
                {parity === 'TOP' ? uk.header.topWeek : uk.header.bottomWeek}
              </Box>
            )}
            {desktop && (
              <LinkButton to="/profile" variant="outlined" startIcon={<EventAvailableOutlined />}>
                {t.addToCalendar}
              </LinkButton>
            )}
          </Stack>
        }
      />
      <ErrorAlert error={lessons.error} />
      {lessons.isPending && <ListSkeleton rows={5} label={uk.common.loading} />}
      {lessons.isSuccess && list.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t.noLessons}
        </Alert>
      )}

      {desktop ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `88px repeat(${String(days.length)}, minmax(0, 1fr))`,
            border: 1,
            borderColor: 'divider',
            borderRadius: '10px',
            overflow: 'hidden',
            bgcolor: 'background.paper',
          }}
        >
          <Box sx={{ borderBottom: 1, borderColor: 'ge.line2' }} />
          {days.map((d, i) => (
            <Box
              key={d}
              sx={{
                height: 52,
                px: 1.5,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                borderBottom: 1,
                borderLeft: 1,
                borderColor: 'divider',
                bgcolor: d === today ? 'ge.accentSoft' : undefined,
                color: d === today ? 'primary.main' : 'text.secondary',
                fontSize: 13,
              }}
            >
              <Box
                component="b"
                className="tnum"
                sx={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: d === today ? 'primary.main' : 'text.primary',
                }}
              >
                {uk.weekday[i]}, {formatShortDate(d)}
              </Box>
              {d === today && t.today}
            </Box>
          ))}
          {(bells.data ?? []).map((b, bi, all) => (
            <Box key={b.pairNumber} sx={{ display: 'contents' }}>
              <Box
                className="tnum"
                sx={{
                  px: 1.5,
                  py: 1.25,
                  borderBottom: bi === all.length - 1 ? 0 : 1,
                  borderColor: 'divider',
                  fontSize: 12,
                  color: 'ge.text3',
                }}
              >
                <Box component="b" sx={{ display: 'block', fontSize: 15, color: 'text.primary' }}>
                  {b.pairNumber}
                </Box>
                {b.startsAt}–{b.endsAt}
              </Box>
              {days.map((d) => (
                <Box
                  key={d}
                  sx={{
                    p: 0.75,
                    minHeight: 120,
                    borderBottom: bi === all.length - 1 ? 0 : 1,
                    borderLeft: 1,
                    borderColor: 'divider',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5,
                  }}
                >
                  {lessonsAt(list, d, b.pairNumber).map(card)}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      ) : (
        <>
          <Box
            role="tablist"
            aria-label={t.days}
            sx={{
              display: 'grid',
              gridTemplateColumns: `repeat(${String(days.length)}, minmax(0, 1fr))`,
              gap: 0.5,
              mb: 2,
            }}
          >
            {days.map((d, i) => {
              const on = d === activeDay;
              return (
                <ButtonBase
                  key={d}
                  role="tab"
                  aria-selected={on}
                  onClick={() => {
                    setDayPick(d);
                  }}
                  sx={{
                    height: 56,
                    borderRadius: '8px',
                    flexDirection: 'column',
                    gap: '2px',
                    bgcolor: on ? 'primary.main' : 'transparent',
                    color: on ? 'primary.contrastText' : 'text.secondary',
                  }}
                >
                  <Box
                    component="small"
                    sx={{ fontSize: 12, fontWeight: 600, opacity: on ? 0.85 : 1 }}
                  >
                    {uk.weekday[i]}
                  </Box>
                  <Box component="b" className="tnum" sx={{ fontSize: 17 }}>
                    {d.slice(8)}
                  </Box>
                </ButtonBase>
              );
            })}
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {(bells.data ?? []).map((b) => {
              const items = lessonsAt(list, activeDay, b.pairNumber);
              return (
                <Box
                  key={b.pairNumber}
                  sx={{ display: 'grid', gridTemplateColumns: '56px minmax(0, 1fr)', gap: 1.5 }}
                >
                  <Box className="tnum" sx={{ pt: 1.5, fontSize: 13, color: 'ge.text3' }}>
                    <Box
                      component="b"
                      sx={{ display: 'block', fontSize: 17, color: 'text.primary' }}
                    >
                      {b.pairNumber}
                    </Box>
                    {b.startsAt}
                  </Box>
                  {items.length > 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {items.map(card)}
                    </Box>
                  ) : (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        minHeight: 52,
                        px: 1.75,
                        border: '1px dashed',
                        borderColor: 'ge.line2',
                        borderRadius: '10px',
                        color: 'ge.text3',
                      }}
                    >
                      {t.window}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        </>
      )}

      {disciplines.length > 0 && (
        <Box
          aria-label={t.legend}
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 2.5,
            mt: 2,
            fontSize: 12,
            color: 'text.secondary',
          }}
        >
          {disciplines.map((d) => (
            <Box key={d.id} sx={{ display: 'flex', alignItems: 'center' }}>
              <DisciplineDot color={d.color} size={8} gap={0.75} />
              {d.title}
            </Box>
          ))}
          <Box sx={{ flex: 1 }} />
          <Box component="span" sx={{ color: 'ge.text3' }}>
            {t.readOnly}
          </Box>
        </Box>
      )}

      <Menu
        anchorEl={menu?.el ?? null}
        open={menu !== null}
        onClose={() => {
          setMenu(null);
        }}
      >
        <MenuItem
          onClick={() => {
            if (menu)
              void navigate({ to: '/lessons/$lessonId', params: { lessonId: menu.lesson.id } });
            setMenu(null);
          }}
        >
          {t.open}
        </MenuItem>
        {menu && canRequestMove(menu.lesson, today) && (
          <MenuItem
            onClick={() => {
              setRequesting(menu.lesson);
              setMenu(null);
            }}
          >
            {t.requestMove}
          </MenuItem>
        )}
      </Menu>
      {requesting && (
        <RequestDialog
          lesson={requesting}
          onClose={() => {
            setRequesting(null);
          }}
        />
      )}

      <Typography variant="h6" component="h2" sx={{ mt: 4, mb: 1.5, fontSize: 16 }}>
        {t.myRequests}
      </Typography>
      {(myRequests.data ?? []).length === 0 && (
        <EmptyState
          icon={<EventAvailableOutlined />}
          title={t.noRequests}
          description={t.noRequestsHint}
        />
      )}
      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
        }}
      >
        {(myRequests.data ?? []).slice(0, 10).map((r) => {
          const tone = r.status === 'APPROVED' ? 'ok' : r.status === 'REJECTED' ? 'err' : 'warn';
          return (
            <Paper key={r.id} variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <DisciplineDot color={r.lesson.discipline.color} size={10} gap={0} />
                <Typography sx={{ fontWeight: 600, flexGrow: 1, minWidth: 0 }} noWrap>
                  {r.lesson.discipline.shortTitle} · {r.lesson.group.name}
                </Typography>
                <Box
                  component="span"
                  sx={{
                    px: 1,
                    py: '2px',
                    borderRadius: '4px',
                    fontSize: 12,
                    fontWeight: 600,
                    bgcolor: `ge.${tone}Bg`,
                    color: `ge.${tone}`,
                  }}
                >
                  {uk.requests.statuses[r.status]}
                </Box>
              </Stack>
              <Typography className="tnum" variant="body2">
                {formatShortDate(r.lesson.date)}, {r.lesson.pairNumber} {uk.today.pair} →{' '}
                <strong>
                  {formatShortDate(r.proposedDate)}, {r.proposedPair} {uk.today.pair}
                </strong>
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {r.reason}
              </Typography>
              {r.resolverComment && (
                <Typography variant="body2" sx={{ mt: 1, color: 'ge.text2' }}>
                  {r.resolvedBy?.fullName ? `${r.resolvedBy.fullName}: ` : ''}
                  {r.resolverComment}
                </Typography>
              )}
            </Paper>
          );
        })}
      </Box>
    </>
  );
}

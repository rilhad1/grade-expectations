import { weekParity } from '@ge/domain';
import type { LessonItemDto } from '@ge/shared';
import { rescheduleRequestDtoSchema } from '@ge/shared';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { getAll } from '../../api/http';
import { q } from '../../api/queries';
import { fetchLessons } from '../../api/teaching';
import { useCurrentSemester } from '../../app/SemesterSwitcher';
import { toSemesterInput } from '../../app/WeekBadge';
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
import { ErrorAlert } from '../../shared/ui/ErrorAlert';
import { PageHeader } from '../../shared/ui/PageHeader';

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
  const { semester } = useCurrentSemester();
  const [weekStart, setWeekStart] = useState(() => weekStartOf(today));
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

  const days = weekDays(weekStart);
  const parity =
    semester && weekStart >= semester.startDate && weekStart <= semester.endDate
      ? weekParity(weekStart, toSemesterInput(semester))
      : null;
  const list = lessons.data ?? [];

  return (
    <>
      <PageHeader
        title={t.title}
        actions={
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton
              aria-label={t.prev}
              onClick={() => {
                setWeekStart(shiftWeek(weekStart, -1));
              }}
            >
              <ChevronLeft />
            </IconButton>
            <Typography
              sx={{ fontVariantNumeric: 'tabular-nums', minWidth: 150, textAlign: 'center' }}
            >
              {formatShortDate(days[0] ?? weekStart)} — {formatShortDate(days[5] ?? weekStart)}
            </Typography>
            <IconButton
              aria-label={t.next}
              onClick={() => {
                setWeekStart(shiftWeek(weekStart, 1));
              }}
            >
              <ChevronRight />
            </IconButton>
            <Button
              size="small"
              onClick={() => {
                setWeekStart(weekStartOf(today));
              }}
            >
              {t.thisWeek}
            </Button>
            {parity && (
              <Chip
                size="small"
                variant="outlined"
                label={parity === 'TOP' ? uk.header.topWeek : uk.header.bottomWeek}
              />
            )}
          </Stack>
        }
      />
      <ErrorAlert error={lessons.error} />
      <Alert severity="info" icon={false} sx={{ mb: 2 }}>
        {t.readOnly}
      </Alert>
      {lessons.isSuccess && list.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t.noLessons}
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '72px repeat(6, minmax(130px, 1fr))',
          border: 1,
          borderColor: 'divider',
          borderRadius: '10px',
          overflow: 'auto',
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }} />
        {days.map((d, i) => (
          <Box
            key={d}
            sx={{
              p: 1,
              borderBottom: 1,
              borderLeft: 1,
              borderColor: 'divider',
              textAlign: 'center',
              fontWeight: d === today ? 700 : 500,
              bgcolor: d === today ? 'action.hover' : undefined,
            }}
          >
            {uk.weekday[i]}{' '}
            <Typography
              component="span"
              variant="caption"
              sx={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatShortDate(d)}
            </Typography>
          </Box>
        ))}
        {(bells.data ?? []).map((b) => (
          <Box key={b.pairNumber} sx={{ display: 'contents' }}>
            <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider', fontSize: 12 }}>
              <strong>{b.pairNumber}</strong>
              <Typography
                variant="caption"
                color="text.secondary"
                component="div"
                sx={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {b.startsAt}–{b.endsAt}
              </Typography>
            </Box>
            {days.map((d) => (
              <Box
                key={d}
                sx={{
                  p: 0.5,
                  borderBottom: 1,
                  borderLeft: 1,
                  borderColor: 'divider',
                  minHeight: 72,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.5,
                }}
              >
                {lessonsAt(list, d, b.pairNumber).map((l) => {
                  const dim = l.status === 'CANCELLED' || l.status === 'MOVED';
                  return (
                    <Paper
                      key={l.id}
                      variant="outlined"
                      component="button"
                      type="button"
                      onClick={(e: React.MouseEvent<HTMLElement>) => {
                        setMenu({ el: e.currentTarget, lesson: l });
                      }}
                      aria-label={`${l.discipline.shortTitle} ${l.group.name}`}
                      sx={{
                        textAlign: 'left',
                        p: 0.75,
                        borderLeft: `4px solid ${l.discipline.color}`,
                        bgcolor: `${l.discipline.color}1a`,
                        cursor: 'pointer',
                        font: 'inherit',
                        fontSize: 12,
                        opacity: dim ? 0.55 : 1,
                        textDecoration: l.status === 'CANCELLED' ? 'line-through' : 'none',
                      }}
                    >
                      <strong>
                        {l.discipline.shortTitle} · {uk.loads.kindsShort[l.kind]}
                      </strong>
                      <div>
                        {l.group.name}
                        {l.subgroup ? ` · ${l.subgroup.name}` : ''}
                      </div>
                      <div style={{ color: 'gray' }}>
                        {l.room ? `${uk.today.room} ${l.room.name}` : ''}
                      </div>
                      {l.status in statusLabel && (
                        <Chip
                          size="small"
                          label={statusLabel[l.status as keyof typeof statusLabel]}
                          sx={{ height: 18, fontSize: 10, mt: 0.5 }}
                        />
                      )}
                    </Paper>
                  );
                })}
              </Box>
            ))}
          </Box>
        ))}
      </Box>

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

      <Typography variant="h6" component="h2" sx={{ mt: 4, mb: 1 }}>
        {t.myRequests}
      </Typography>
      {(myRequests.data ?? []).length === 0 && (
        <Typography color="text.secondary">{t.noRequests}</Typography>
      )}
      {(myRequests.data ?? []).slice(0, 10).map((r) => (
        <Typography key={r.id} variant="body2" sx={{ mb: 0.5 }}>
          {r.lesson.discipline.shortTitle} · {r.lesson.group.name}: {formatShortDate(r.lesson.date)}{' '}
          → {formatShortDate(r.proposedDate)}, {r.proposedPair} {uk.today.pair} —{' '}
          <Chip size="small" variant="outlined" label={uk.requests.statuses[r.status]} />
          {r.resolverComment ? ` ${r.resolverComment}` : ''}
        </Typography>
      ))}
    </>
  );
}

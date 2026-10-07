import type { GradeEntry, RosterEntry } from '@ge/shared';
import ArrowBack from '@mui/icons-material/ArrowBack';
import CloudOffOutlined from '@mui/icons-material/CloudOffOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import { Alert, Box, Button, ButtonBase, Paper, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import { q } from '../../api/queries';
import { todayKyiv } from '../../app/today';
import { loadToday } from '../../offline/lessonSource';
import { useSyncStore } from '../../offline/syncStore';
import { formatShortDate, formatWeekdayDate } from '../../shared/format';
import { uk } from '../../shared/i18n/uk';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';
import { SegmentedControl } from '../../shared/ui/SegmentedControl';
import { ListSkeleton } from '../../shared/ui/Skeletons';
import { LinkBase, LinkButton } from '../../shared/ui/links';

import { GradeSheet } from './GradeSheet';
import { LessonSummary } from './LessonSummary';
import { RosterRow } from './RosterRow';
import { TopicDialog } from './TopicDialog';
import { defaultGradeKind, minutesLeft, presentCount } from './model';
import { useLesson } from './useLesson';

/** Режим «На парі»: список групи великими рядками, відмітки й оцінки одним дотиком. */
export function LessonScreen({ lessonId }: { lessonId: string }) {
  const lesson = useLesson(lessonId);
  const bells = useQuery(q.bells());
  const detail = lesson.query.data;
  const [sheet, setSheet] = useState<{ student: RosterEntry; grade?: GradeEntry } | null>(null);
  const [topicOpen, setTopicOpen] = useState(false);
  // Проведене заняття відкривається підсумком; «Змінити відмітки» вмикає редагування ростера
  const [editHeld, setEditHeld] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const sync = useSyncStore();
  const navigate = useNavigate();
  const todayQuery = useQuery({
    queryKey: ['today'],
    queryFn: loadToday,
    enabled: detail?.status === 'HELD',
  });

  // Таймер до кінця пари оновлюється щохвилини
  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date());
    }, 30_000);
    return () => {
      clearInterval(id);
    };
  }, []);

  if (lesson.query.isPending) return <ListSkeleton rows={8} label={uk.common.loading} />;
  if (!detail) return <ErrorAlert error={lesson.query.error} />;

  const total = detail.roster.length;
  const present = presentCount(detail.roster);
  const held = detail.status === 'HELD';
  const inactive = detail.status === 'CANCELLED' || detail.status === 'MOVED';
  const isFuture = detail.date > todayKyiv(now);
  const endsAt = bells.data?.find((b) => b.pairNumber === detail.pairNumber)?.endsAt;
  const left = minutesLeft(now, todayKyiv(now), detail.date, endsAt);
  const gradesCount = detail.roster.reduce((n, r) => n + r.grades.length, 0);
  const mutationError =
    lesson.attendance.error ??
    lesson.addGrade.error ??
    lesson.editGrade.error ??
    lesson.deleteGrade.error ??
    lesson.finish.error ??
    lesson.finishAll.error ??
    lesson.reopen.error ??
    lesson.saveInfo.error;

  const bell = bells.data?.find((b) => b.pairNumber === detail.pairNumber);
  const offline = !sync.online;
  const absent = detail.roster.filter((r) => r.attendance === 'ABSENT').length;
  const excused = detail.roster.filter((r) => r.attendance === 'EXCUSED').length;
  const late = detail.roster.filter((r) => r.attendance === 'LATE').length;

  if (held && !editHeld)
    return (
      <>
        <ErrorAlert error={mutationError} />
        <LessonSummary
          detail={detail}
          present={present}
          gradesCount={gradesCount}
          offline={offline || sync.pending > 0}
          today={todayQuery.data}
          onUndo={() => {
            lesson.reopen.mutate();
          }}
          undoDisabled={lesson.reopen.isPending}
          onEdit={() => {
            setEditHeld(true);
          }}
        />
      </>
    );

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', pb: 14 }}>
      <Paper
        variant="outlined"
        sx={{ mb: 2, p: 1.5, pt: 1, display: 'flex', flexDirection: 'column', gap: 1.25 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LinkBase
            to="/"
            aria-label={uk.lesson.back}
            sx={{
              width: 44,
              height: 44,
              borderRadius: '8px',
              color: 'text.primary',
              flexShrink: 0,
            }}
          >
            <ArrowBack />
          </LinkBase>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="h6"
              component="h1"
              noWrap
              sx={{ fontSize: 17, lineHeight: '22px' }}
            >
              {detail.group.name}
              {detail.subgroup ? ` · ${detail.subgroup.name}` : ''} · {detail.discipline.shortTitle}
            </Typography>
            <Typography variant="body2" color="text.secondary" className="tnum" noWrap>
              {formatWeekdayDate(detail.date)} · {detail.pairNumber} {uk.today.pair}
              {bell ? ` · ${bell.startsAt}–${bell.endsAt}` : ''}
              {detail.room ? ` · ${uk.today.room} ${detail.room.name}` : ''}
            </Typography>
          </Box>
          {left !== null && (
            <Box
              role="timer"
              aria-label={uk.lesson.minutesLeft(left)}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                px: 1.25,
                py: 0.5,
                borderRadius: '8px',
                bgcolor: 'ge.sunken',
                flexShrink: 0,
              }}
            >
              <Typography
                className="tnum"
                sx={{ fontSize: 18, fontWeight: 600, lineHeight: '22px' }}
              >
                {left}
              </Typography>
              <Typography
                variant="caption"
                color="ge.text3"
                sx={{ fontSize: 11, lineHeight: '14px' }}
              >
                {uk.lesson.untilBell}
              </Typography>
            </Box>
          )}
        </Box>
        <ButtonBase
          onClick={() => {
            setTopicOpen(true);
          }}
          disabled={inactive}
          aria-label={uk.lesson.editTopic}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            minHeight: 44,
            px: 1.5,
            py: 0.75,
            textAlign: 'left',
            border: 1,
            borderColor: 'divider',
            borderRadius: '6px',
            bgcolor: 'ge.surface2',
          }}
        >
          <Typography noWrap sx={{ flex: 1, fontSize: 15 }}>
            {uk.lesson.topic}: {detail.topic ?? uk.lesson.noTopic}
          </Typography>
          <EditOutlined sx={{ fontSize: 18, color: 'ge.text3' }} />
        </ButtonBase>
        {detail.homework && (
          <Typography variant="body2" color="text.secondary">
            {uk.lesson.homework}: {detail.homework}
          </Typography>
        )}
      </Paper>

      {(offline || sync.pending > 0) && (
        <Box
          role="status"
          className="tnum"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            minHeight: 32,
            px: 2,
            mb: 2,
            borderRadius: '6px',
            bgcolor: 'ge.warnBg',
            color: 'ge.warn',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <CloudOffOutlined sx={{ fontSize: 16 }} />
          {uk.lesson.offlineStrip(sync.pending)}
        </Box>
      )}

      {detail.stream.length > 1 && (
        <Box sx={{ mb: 2, overflowX: 'auto' }}>
          <SegmentedControl
            ariaLabel={uk.lesson.streamGroups}
            value={detail.id}
            onChange={(id) => {
              void navigate({ to: '/lessons/$lessonId', params: { lessonId: id } });
            }}
            options={detail.stream.map((s) => ({ value: s.lessonId, label: s.group.name }))}
          />
        </Box>
      )}

      <ErrorAlert error={mutationError} />
      {inactive && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {uk.lesson.cancelled}
        </Alert>
      )}
      {isFuture && !inactive && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {uk.lesson.notYet}
        </Alert>
      )}
      {total === 0 && <Alert severity="info">{uk.lesson.emptyRoster}</Alert>}

      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        {detail.roster.map((entry, i) => (
          <RosterRow
            key={entry.enrollmentId}
            index={i + 1}
            entry={entry}
            scale={detail.scale}
            onAttendance={(status) => {
              if (!inactive) lesson.attendance.mutate({ enrollmentId: entry.enrollmentId, status });
            }}
            onAddGrade={() => {
              if (!inactive) setSheet({ student: entry });
            }}
            onEditGrade={(grade) => {
              if (!inactive) setSheet({ student: entry, grade });
            }}
          />
        ))}
      </Paper>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
        {uk.lesson.rowHint}
      </Typography>

      {/* Закріплений підсумок і кнопка завершення — у нижній третині екрана */}
      <Box
        sx={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 5,
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
          px: 2,
          pt: 1.5,
          pb: 'max(24px, env(safe-area-inset-bottom))',
        }}
      >
        <Box sx={{ maxWidth: 688, mx: 'auto', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography className="tnum" sx={{ fontSize: 17, fontWeight: 600 }} aria-live="polite">
              {uk.lesson.present} {present} {uk.lesson.of} {total}
            </Typography>
            <Typography className="tnum" variant="body2" color="text.secondary">
              н {absent} · нп {excused} · з {late}
            </Typography>
          </Box>
          <LinkButton
            to="/gradebook/$loadId"
            params={{ loadId: detail.loadId }}
            color="inherit"
            sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
          >
            {uk.lesson.openJournal}
          </LinkButton>
          {!inactive && (
            <Button
              variant="contained"
              size="large"
              disabled={
                !held && (isFuture || lesson.finish.isPending || lesson.finishAll.isPending)
              }
              onClick={() => {
                if (held) setEditHeld(false);
                else if (detail.stream.length > 1)
                  lesson.finishAll.mutate(detail.stream.map((s) => s.lessonId));
                else lesson.finish.mutate();
              }}
              sx={{ minHeight: 52, px: 2.5, whiteSpace: 'nowrap' }}
            >
              {held
                ? uk.lesson.doneEditing
                : detail.stream.length > 1
                  ? uk.lesson.finishStream
                  : uk.lesson.finish}
            </Button>
          )}
        </Box>
      </Box>

      {sheet && (
        <GradeSheet
          student={sheet.student}
          scale={detail.scale}
          dateLabel={formatShortDate(detail.date)}
          defaultKind={defaultGradeKind(detail.kind)}
          {...(sheet.grade && { grade: sheet.grade })}
          onClose={() => {
            setSheet(null);
          }}
          onSave={({ kind, value }) => {
            const { student, grade } = sheet;
            if (grade)
              lesson.editGrade.mutate({
                id: grade.id,
                enrollmentId: student.enrollmentId,
                version: grade.version,
                kind,
                value,
              });
            else
              lesson.addGrade.mutate({
                id: lesson.newGradeId(),
                enrollmentId: student.enrollmentId,
                kind,
                value,
              });
            setSheet(null);
          }}
          {...(sheet.grade && {
            onDelete: () => {
              if (sheet.grade) lesson.deleteGrade.mutate({ id: sheet.grade.id });
              setSheet(null);
            },
          })}
        />
      )}
      {topicOpen && (
        <TopicDialog
          loadId={detail.loadId}
          topic={detail.topic}
          homework={detail.homework}
          onClose={() => {
            setTopicOpen(false);
          }}
          onSave={(v) => {
            lesson.saveInfo.mutate({ version: detail.version, ...v });
          }}
        />
      )}
    </Box>
  );
}

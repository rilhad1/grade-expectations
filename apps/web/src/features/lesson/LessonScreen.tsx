import type { GradeEntry, RosterEntry } from '@ge/shared';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { q } from '../../api/queries';
import { todayKyiv } from '../../app/today';
import { formatWeekdayDate } from '../../shared/format';
import { uk } from '../../shared/i18n/uk';
import { DisciplineDot } from '../../shared/ui/DisciplineDot';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';
import { LinkButton } from '../../shared/ui/links';

import { GradeSheet } from './GradeSheet';
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
  const [now, setNow] = useState(() => new Date());

  // Таймер до кінця пари оновлюється щохвилини
  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date());
    }, 30_000);
    return () => {
      clearInterval(id);
    };
  }, []);

  if (lesson.query.isPending)
    return <CircularProgress sx={{ m: 4 }} aria-label={uk.common.loading} />;
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
    lesson.reopen.error ??
    lesson.saveInfo.error;

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', pb: 12 }}>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
            <DisciplineDot color={detail.discipline.color} />
            {detail.group.name}
            {detail.subgroup ? ` · ${detail.subgroup.name}` : ''} · {detail.discipline.shortTitle}
          </Typography>
          {left !== null && (
            <Chip
              size="small"
              color="primary"
              variant="outlined"
              label={uk.lesson.minutesLeft(left)}
            />
          )}
        </Stack>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {formatWeekdayDate(detail.date)} · {detail.pairNumber} {uk.today.pair}
          {detail.room ? ` · ${uk.today.room} ${detail.room.name}` : ''}
        </Typography>
        <Button
          size="small"
          onClick={() => {
            setTopicOpen(true);
          }}
          disabled={inactive}
          aria-label={uk.lesson.editTopic}
          sx={{
            mt: 1,
            px: 0,
            textAlign: 'left',
            justifyContent: 'flex-start',
            textTransform: 'none',
            fontSize: 15,
          }}
        >
          {uk.lesson.topic}: {detail.topic ?? uk.lesson.noTopic}
        </Button>
        {detail.homework && (
          <Typography variant="body2" color="text.secondary">
            {uk.lesson.homework}: {detail.homework}
          </Typography>
        )}
      </Paper>

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

      {held && (
        <Alert
          severity="success"
          sx={{ mt: 2 }}
          action={
            detail.undoUntil ? (
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  lesson.reopen.mutate();
                }}
              >
                {uk.lesson.undo}
              </Button>
            ) : undefined
          }
        >
          <strong>{uk.lesson.finishedTitle}.</strong>{' '}
          {uk.lesson.finishedSummary(present, total, gradesCount)}
          {detail.undoUntil && (
            <Typography variant="caption" component="div">
              {uk.lesson.undoHint}
            </Typography>
          )}
        </Alert>
      )}

      {/* Закріплений підсумок і кнопка завершення — у нижній третині екрана */}
      <Paper
        elevation={3}
        sx={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 5,
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          justifyContent: 'center',
        }}
      >
        <Typography sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }} aria-live="polite">
          {uk.lesson.present} {present} {uk.lesson.of} {total}
        </Typography>
        {!held && !inactive && (
          <Button
            variant="contained"
            size="large"
            disabled={isFuture || lesson.finish.isPending}
            onClick={() => {
              lesson.finish.mutate();
            }}
            sx={{ minHeight: 52, minWidth: 200 }}
          >
            {uk.lesson.finish}
          </Button>
        )}
        <LinkButton
          to="/gradebook/$loadId"
          params={{ loadId: detail.loadId }}
          sx={{ minHeight: 52 }}
        >
          {uk.lesson.openJournal}
        </LinkButton>
      </Paper>

      {sheet && (
        <GradeSheet
          student={sheet.student}
          scale={detail.scale}
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

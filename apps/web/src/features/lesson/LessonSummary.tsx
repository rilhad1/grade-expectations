import type { LessonDetailDto, TodayDto } from '@ge/shared';
import CheckIcon from '@mui/icons-material/Check';
import CloudOffOutlined from '@mui/icons-material/CloudOffOutlined';
import { Box, Button, Paper, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

import { uk } from '../../shared/i18n/uk';
import { StatusChip } from '../../shared/ui/StatusChip';
import { LinkButton } from '../../shared/ui/links';

const StatTile = ({ label, value, hint }: { label: string; value: number; hint?: string }) => (
  <Paper variant="outlined" sx={{ p: 1.75 }}>
    <Typography variant="caption" color="ge.text3" sx={{ fontWeight: 600, fontSize: 13 }}>
      {label}
    </Typography>
    <Typography
      className="tnum"
      component="div"
      sx={{ fontSize: 26, lineHeight: 1.25, fontWeight: 600 }}
    >
      {value}
      {hint && (
        <Typography
          component="span"
          color="ge.text3"
          sx={{ fontSize: 15, fontWeight: 500, ml: 0.5 }}
        >
          {hint}
        </Typography>
      )}
    </Typography>
  </Paper>
);

/** mm:ss до кінця вікна скасування. */
function useCountdown(until: string | null): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until === null) return;
    const id = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, [until]);
  if (until === null) return null;
  const left = Math.max(0, Math.floor((Date.parse(until) - now) / 1000));
  return `${String(Math.floor(left / 60))}:${String(left % 60).padStart(2, '0')}`;
}

/** Підсумок завершеної пари з «Скасувати завершення» протягом 10 хвилин. */
export function LessonSummary({
  detail,
  present,
  gradesCount,
  offline,
  today,
  onUndo,
  undoDisabled,
}: {
  detail: LessonDetailDto;
  present: number;
  gradesCount: number;
  offline: boolean;
  today: TodayDto | undefined;
  onUndo: () => void;
  undoDisabled: boolean;
}) {
  const total = detail.roster.length;
  const count = (s: 'ABSENT' | 'EXCUSED' | 'LATE') =>
    detail.roster.filter((r) => r.attendance === s).length;
  const absent = detail.roster.filter(
    (r) => r.attendance === 'ABSENT' || r.attendance === 'EXCUSED',
  );
  const countdown = useCountdown(detail.undoUntil);
  const next = today?.lessons.find((l) => l.pairNumber > detail.pairNumber);

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', pb: 16 }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 1.25,
          mb: 2.5,
        }}
      >
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            bgcolor: 'ge.okBg',
            color: 'ge.ok',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CheckIcon />
        </Box>
        <Typography variant="h5" component="h1" sx={{ fontSize: 24 }}>
          {uk.lesson.finishedTitle}
        </Typography>
        <Typography color="text.secondary" className="tnum">
          {detail.discipline.shortTitle} · {detail.group.name} · {detail.pairNumber} {uk.today.pair}
        </Typography>
        <Typography>{uk.lesson.finishedSummary(present, total, gradesCount)}</Typography>
      </Box>

      <Box
        sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1, mb: 2 }}
      >
        <StatTile
          label={uk.lesson.summary.present}
          value={present}
          hint={`${uk.lesson.of} ${String(total)}`}
        />
        <StatTile
          label={uk.lesson.summary.absent}
          value={count('ABSENT') + count('EXCUSED')}
          hint={`н ${String(count('ABSENT'))} · нп ${String(count('EXCUSED'))}`}
        />
        <StatTile label={uk.lesson.summary.late} value={count('LATE')} />
        <StatTile label={uk.lesson.summary.grades} value={gradesCount} />
      </Box>

      {absent.length > 0 && (
        <Paper variant="outlined" sx={{ p: 1.75, mb: 2 }}>
          <Typography variant="caption" color="ge.text3" sx={{ fontWeight: 600, fontSize: 13 }}>
            {uk.lesson.summary.absentList}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
            {absent.map((r) => (
              <Box
                key={r.enrollmentId}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.75,
                  height: 30,
                  pl: 0.5,
                  pr: 1.25,
                  borderRadius: '15px',
                  bgcolor: 'ge.sunken',
                  fontSize: 14,
                }}
              >
                <StatusChip status={r.attendance} size="sm" />
                {r.lastName} {r.firstName}
              </Box>
            ))}
          </Box>
        </Paper>
      )}

      {detail.topic && (
        <Paper variant="outlined" sx={{ p: 1.75, mb: 2 }}>
          <Typography variant="caption" color="ge.text3" sx={{ fontWeight: 600, fontSize: 13 }}>
            {uk.lesson.summary.topic}
          </Typography>
          <Typography>{detail.topic}</Typography>
        </Paper>
      )}

      {offline && (
        <Box
          role="status"
          sx={{
            display: 'flex',
            gap: 1.25,
            alignItems: 'flex-start',
            p: '12px 14px',
            borderRadius: '10px',
            bgcolor: 'ge.warnBg',
            color: 'ge.warn',
            mb: 2,
          }}
        >
          <CloudOffOutlined sx={{ fontSize: 18, mt: '1px' }} />
          <span>{uk.lesson.summary.savedLocally}</span>
        </Box>
      )}

      {next && (
        <Box
          sx={{
            p: 1.75,
            border: '1px dashed',
            borderColor: 'ge.line2',
            borderRadius: '10px',
            color: 'text.secondary',
          }}
        >
          {uk.lesson.summary.next}{' '}
          <Box component="b" sx={{ color: 'text.primary', fontWeight: 600 }}>
            {next.pairNumber} {uk.today.pair} · {next.discipline.shortTitle} · {next.group.name}
          </Box>
        </Box>
      )}

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
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          alignItems: 'center',
        }}
      >
        <Box
          sx={{ width: '100%', maxWidth: 688, display: 'flex', flexDirection: 'column', gap: 1 }}
        >
          <LinkButton to="/" variant="contained" size="large" fullWidth>
            {uk.lesson.summary.toToday}
          </LinkButton>
          {detail.undoUntil && (
            <Button
              variant="outlined"
              size="large"
              fullWidth
              disabled={undoDisabled}
              onClick={onUndo}
              className="tnum"
            >
              {uk.lesson.undo}
              {countdown && (
                <Box component="span" sx={{ color: 'ge.text3', ml: 1 }}>
                  · {countdown}
                </Box>
              )}
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}

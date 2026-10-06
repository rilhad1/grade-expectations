import type { GradebookDto } from '@ge/shared';
import CloseIcon from '@mui/icons-material/Close';
import { Box, Chip, Divider, Drawer, IconButton, Stack, Typography } from '@mui/material';

import { formatDate } from '../../shared/format';
import { uk } from '../../shared/i18n/uk';

const p = uk.gradebook.panel;

/** Картка студента поверх журналу: зведення за дисципліною та хронологія останніх подій. */
export function StudentPanel({
  student,
  data,
  onClose,
}: {
  student: GradebookDto['students'][number];
  data: GradebookDto;
  onClose: () => void;
}) {
  const s = student.summary;
  const events = data.lessons
    .flatMap((lesson) => {
      const cell = student.cells[lesson.id];
      if (!cell) return [];
      const items: { id: string; date: string; text: string }[] = cell.grades.map((g) => ({
        id: g.id,
        date: lesson.date,
        text: `${p.grade} ${g.value} (${uk.lesson.gradeKinds[g.kind]})`,
      }));
      if (cell.attendance === 'ABSENT')
        items.push({ id: `${lesson.id}-a`, date: lesson.date, text: p.absent });
      if (cell.attendance === 'EXCUSED')
        items.push({ id: `${lesson.id}-e`, date: lesson.date, text: p.excused });
      if (cell.attendance === 'LATE')
        items.push({ id: `${lesson.id}-l`, date: lesson.date, text: p.late });
      return items;
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12);

  return (
    <Drawer anchor="right" open onClose={onClose}>
      <Box
        sx={{ width: { xs: '100vw', sm: 380 }, p: 2 }}
        role="complementary"
        aria-label={`${student.lastName} ${student.firstName}`}
      >
        <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {student.lastName} {student.firstName} {student.middleName ?? ''}
          </Typography>
          <IconButton onClick={onClose} aria-label={uk.common.close}>
            <CloseIcon />
          </IconButton>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {p.group}: {data.load.group.name}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {p.status}: {uk.groups.enrollmentStatus[student.enrollmentStatus]}
        </Typography>

        <Typography variant="subtitle2">
          {p.summary} · {data.load.discipline.shortTitle}
        </Typography>
        <Stack spacing={0.5} sx={{ my: 1, fontVariantNumeric: 'tabular-nums' }}>
          <Typography variant="body2">
            {p.average}:{' '}
            <strong>
              {s.average === null ? uk.common.none : s.average.toFixed(1).replace('.', ',')}
            </strong>
          </Typography>
          <Typography variant="body2">
            {p.grades}: {s.gradesCount}
          </Typography>
          <Typography variant="body2">
            {p.absences}: {s.absences.unexcused} / {s.absences.excused} / {s.absences.late}
          </Typography>
          <Typography variant="body2">
            {p.proposal}: <strong>{s.proposal.value === 'NA' ? 'н/а' : s.proposal.value}</strong>{' '}
            <Typography component="span" variant="caption" color="text.secondary">
              ({s.proposal.explanation})
            </Typography>
          </Typography>
        </Stack>
        {s.risk.length > 0 && (
          <Chip
            color="error"
            variant="outlined"
            size="small"
            label={`${p.risk}: ${s.risk.map((r) => uk.today.riskReasons[r]).join(', ')}`}
          />
        )}

        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle2" gutterBottom>
          {p.timeline}
        </Typography>
        {events.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            {p.noEvents}
          </Typography>
        )}
        {events.map((e) => (
          <Typography key={e.id} variant="body2" sx={{ mb: 0.5 }}>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatDate(e.date)}</span> —{' '}
            {e.text}
          </Typography>
        ))}
      </Box>
    </Drawer>
  );
}

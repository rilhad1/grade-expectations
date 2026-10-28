import type { GradebookDto } from '@ge/shared';
import CloseIcon from '@mui/icons-material/Close';
import { Avatar, Box, Chip, Divider, Drawer, IconButton, Stack, Typography } from '@mui/material';

import { formatDate } from '../../shared/format';
import { uk } from '../../shared/i18n/uk';
import { GradeChip, StatCard } from '../../shared/ui';

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
  const scale = data.load.gradingRules.scale;
  type Ev = { id: string; date: string; node: 'grade' | 'att'; value?: number; text: string };
  const events = data.lessons
    .flatMap((lesson) => {
      const cell = student.cells[lesson.id];
      if (!cell) return [];
      const items: Ev[] = cell.grades.map((g) => ({
        id: g.id,
        date: lesson.date,
        node: 'grade',
        value: g.value,
        text: `${p.grade} · ${uk.lesson.gradeKinds[g.kind]}`,
      }));
      if (cell.attendance === 'ABSENT')
        items.push({ id: `${lesson.id}-a`, date: lesson.date, node: 'att', text: p.absent });
      if (cell.attendance === 'EXCUSED')
        items.push({ id: `${lesson.id}-e`, date: lesson.date, node: 'att', text: p.excused });
      if (cell.attendance === 'LATE')
        items.push({ id: `${lesson.id}-l`, date: lesson.date, node: 'att', text: p.late });
      return items;
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12);
  const initials = `${student.lastName[0] ?? ''}${student.firstName[0] ?? ''}`;
  const lowAvg = s.risk.includes('LOW_GRADE');

  return (
    <Drawer anchor="right" open onClose={onClose}>
      <Box
        sx={{ width: { xs: '100vw', sm: 400 }, p: 2.5 }}
        role="complementary"
        aria-label={`${student.lastName} ${student.firstName}`}
      >
        <Stack direction="row" alignItems="flex-start" spacing={1.5} sx={{ mb: 2 }}>
          <Avatar
            sx={{
              width: 44,
              height: 44,
              bgcolor: 'ge.accentSoft',
              color: 'primary.main',
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            {initials}
          </Avatar>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h6" sx={{ lineHeight: 1.3 }}>
              {student.lastName} {student.firstName} {student.middleName ?? ''}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {p.group}: {data.load.group.name} ·{' '}
              {uk.groups.enrollmentStatus[student.enrollmentStatus]}
            </Typography>
          </Box>
          <IconButton onClick={onClose} aria-label={uk.common.close}>
            <CloseIcon />
          </IconButton>
        </Stack>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {p.summary} · {data.load.discipline.shortTitle}
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
          <StatCard
            label={p.average}
            tone={lowAvg ? 'warn' : 'default'}
            value={s.average === null ? uk.common.none : s.average.toFixed(1).replace('.', ',')}
            suffix={`· ${String(s.gradesCount)}`}
          />
          <StatCard
            label={uk.gradebook.absencesHint}
            value={s.absences.unexcused}
            suffix={`/ ${String(s.absences.excused)} / ${String(s.absences.late)}`}
          />
          <StatCard
            label={p.proposal}
            value={s.proposal.value === 'NA' ? 'н/а' : s.proposal.value}
          />
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
          {p.absences}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {p.proposal}: {s.proposal.explanation}
        </Typography>
        {s.risk.length > 0 && (
          <Chip
            color="error"
            variant="outlined"
            size="small"
            sx={{ mt: 1.5 }}
            label={`${p.risk}: ${s.risk.map((r) => uk.today.riskReasons[r]).join(', ')}`}
          />
        )}

        {data.assessments.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>
              {p.assessments}
            </Typography>
            <Stack spacing={1}>
              {data.assessments.map((a) => {
                const g = student.assessmentGrades[a.id];
                return (
                  <Stack key={a.id} direction="row" alignItems="center" spacing={1.25}>
                    {g ? (
                      <GradeChip value={g.value} scale={scale} size="sm" />
                    ) : (
                      <Box
                        component="span"
                        sx={{
                          minWidth: 26,
                          height: 24,
                          borderRadius: '4px',
                          bgcolor: 'ge.sunken',
                          color: 'ge.text3',
                          fontSize: 13,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {uk.common.none}
                      </Box>
                    )}
                    <Typography variant="body2" sx={{ flexGrow: 1 }}>
                      {a.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {a.attestationKind ? uk.attestations.modules[a.attestationKind] : ''}
                    </Typography>
                  </Stack>
                );
              })}
            </Stack>
          </>
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
        <Stack spacing={1}>
          {events.map((e) => (
            <Stack key={e.id} direction="row" alignItems="center" spacing={1.25}>
              {e.node === 'grade' && e.value !== undefined ? (
                <GradeChip value={e.value} scale={scale} size="sm" />
              ) : (
                <Box
                  component="span"
                  sx={{
                    minWidth: 26,
                    height: 24,
                    borderRadius: '4px',
                    bgcolor: 'ge.sunken',
                    color: 'ge.text3',
                    fontSize: 13,
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  н
                </Box>
              )}
              <Typography variant="body2" sx={{ flexGrow: 1 }}>
                {e.text}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatDate(e.date)}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Box>
    </Drawer>
  );
}

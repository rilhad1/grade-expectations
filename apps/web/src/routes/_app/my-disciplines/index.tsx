import { Box, Paper, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { q } from '../../../api/queries';
import { useCurrentSemester } from '../../../app/SemesterSwitcher';
import { uk } from '../../../shared/i18n/uk';
import { sectionsByCourse } from '../../../shared/sort';
import { ControlFormBadge } from '../../../shared/ui/Badges';
import { DisciplineDot } from '../../../shared/ui/DisciplineDot';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorAlert } from '../../../shared/ui/ErrorAlert';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { ProgressBar } from '../../../shared/ui/Stat';
import { LinkBase } from '../../../shared/ui/links';

export const Route = createFileRoute('/_app/my-disciplines/')({ component: MyDisciplines });

function MyDisciplines() {
  const { semester } = useCurrentSemester();
  const loads = useQuery({ ...q.loads(semester?.id ?? ''), enabled: semester !== null });
  const items = loads.data ?? [];
  // Секції за курсом; усередині — предмети, а в них групи (список уже відсортований у запиті)
  const courses = sectionsByCourse(items).map((section) => ({
    course: section.course,
    disciplines: [
      ...new Map(section.items.map((l) => [l.discipline.id, l.discipline])).values(),
    ].map((d) => ({ discipline: d, loads: section.items.filter((l) => l.discipline.id === d.id) })),
  }));
  const planned = items.reduce((n, l) => n + l.plannedHours, 0);
  const held = items.reduce((n, l) => n + l.hours.held, 0);
  return (
    <>
      <PageHeader
        title={uk.disciplines.title}
        subtitle={
          items.length > 0 ? uk.disciplines.summary(items.length, held, planned) : undefined
        }
      />
      <ErrorAlert error={loads.error} />
      {(loads.isSuccess && items.length === 0) || !semester ? (
        <EmptyState title={uk.disciplines.empty} />
      ) : null}
      {courses.length > 0 && (
        <Stack spacing={3} sx={{ maxWidth: 720 }}>
          {courses.map((section) => (
            <Box key={String(section.course)} component="section">
              {courses.length > 1 && (
                <Typography
                  variant="overline"
                  component="h2"
                  sx={{ display: 'block', mb: 1, color: 'ge.text3', fontWeight: 600 }}
                >
                  {section.course === undefined
                    ? uk.common.none
                    : uk.semesters.courseN(section.course)}
                </Typography>
              )}
              <Stack spacing={2}>
                {section.disciplines.map(({ discipline, loads: rows }) => (
                  <Paper key={discipline.id} variant="outlined" sx={{ overflow: 'hidden' }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        px: 2,
                        pt: 1.5,
                        pb: 0.75,
                        fontWeight: 600,
                      }}
                    >
                      <DisciplineDot color={discipline.color} size={8} gap={0.5} />
                      {discipline.title}
                      <Box sx={{ ml: 'auto' }}>
                        <ControlFormBadge form={rows[0]?.controlForm ?? 'CREDIT'} />
                      </Box>
                    </Box>
                    {rows.map((l) => (
                      <LinkBase
                        key={l.id}
                        to="/my-disciplines/$loadId"
                        params={{ loadId: l.id }}
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'stretch',
                          gap: 0.75,
                          width: '100%',
                          px: 2,
                          py: 1.5,
                          textAlign: 'left',
                          borderTop: 1,
                          borderColor: 'divider',
                          minHeight: 64,
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                          <span>
                            {l.group.name}
                            {l.subgroup ? ` · ${l.subgroup.name}` : ''} · {uk.loads.kinds[l.kind]}
                          </span>
                          <Box
                            component="span"
                            className="tnum"
                            sx={{
                              fontSize: 13,
                              whiteSpace: 'nowrap',
                              color: l.hours.deficit > 0 ? 'ge.warn' : 'text.secondary',
                              fontWeight: l.hours.deficit > 0 ? 500 : 400,
                            }}
                          >
                            {l.hours.held} {uk.loads.hoursOf} {l.plannedHours} {uk.today.hoursUnit}
                            {l.hours.deficit > 0 ? ` · −${String(l.hours.deficit)}` : ''}
                          </Box>
                        </Box>
                        <ProgressBar
                          value={l.plannedHours === 0 ? 0 : l.hours.held / l.plannedHours}
                          color={discipline.color}
                          height={4}
                          label={`${discipline.shortTitle} · ${l.group.name}`}
                        />
                      </LinkBase>
                    ))}
                  </Paper>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </>
  );
}

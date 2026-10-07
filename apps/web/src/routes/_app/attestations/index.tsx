import { Alert, List, ListItemText, Paper, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { q } from '../../../api/queries';
import { useCurrentSemester } from '../../../app/SemesterSwitcher';
import { uk } from '../../../shared/i18n/uk';
import { sectionsByCourse } from '../../../shared/sort';
import { CourseSubheader } from '../../../shared/ui/CourseSubheader';
import { DisciplineDot } from '../../../shared/ui/DisciplineDot';
import { ErrorAlert } from '../../../shared/ui/ErrorAlert';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { LinkListItem } from '../../../shared/ui/links';

export const Route = createFileRoute('/_app/attestations/')({ component: AttestationsIndex });

/** Вибір навантаження для атестації. */
function AttestationsIndex() {
  const { semester } = useCurrentSemester();
  const loads = useQuery({ ...q.loads(semester?.id ?? ''), enabled: semester !== null });
  if (!semester) return <Alert severity="info">{uk.gradebook.noSemester}</Alert>;
  const items = loads.data ?? [];

  return (
    <>
      <PageHeader title={uk.attestations.title} />
      <ErrorAlert error={loads.error} />
      {loads.isSuccess && items.length === 0 && (
        <Alert severity="info">{uk.gradebook.noLoads}</Alert>
      )}
      {items.length > 0 && (
        <>
          <Typography color="text.secondary" sx={{ mb: 1 }}>
            {uk.attestations.pick}
          </Typography>
          <Paper variant="outlined" sx={{ maxWidth: 640 }}>
            <List disablePadding>
              {sectionsByCourse(items).flatMap((section, _i, all) => [
                all.length > 1 && (
                  <CourseSubheader key={`c${String(section.course)}`} course={section.course} />
                ),
                ...section.items.map((l) => (
                  <LinkListItem
                    key={l.id}
                    to="/attestations/$loadId"
                    params={{ loadId: l.id }}
                    sx={{ minHeight: 56 }}
                  >
                    <ListItemText
                      primary={
                        <>
                          <DisciplineDot color={l.discipline.color} />
                          {l.discipline.title}
                        </>
                      }
                      secondary={`${l.group.name}${l.subgroup ? ` · ${l.subgroup.name}` : ''} · ${uk.loads.kinds[l.kind]} · ${uk.loads.controlForms[l.controlForm]}`}
                    />
                  </LinkListItem>
                )),
              ])}
            </List>
          </Paper>
        </>
      )}
    </>
  );
}

import { Alert, List, ListItemText, Paper, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { q } from '../../../api/queries';
import { useCurrentSemester } from '../../../app/SemesterSwitcher';
import { uk } from '../../../shared/i18n/uk';
import { DisciplineDot } from '../../../shared/ui/DisciplineDot';
import { ErrorAlert } from '../../../shared/ui/ErrorAlert';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { LinkListItem } from '../../../shared/ui/links';

export const Route = createFileRoute('/_app/gradebook/')({ component: GradebookIndex });

/** Вибір журналу: навантаження викладача в обраному семестрі. */
function GradebookIndex() {
  const { semester } = useCurrentSemester();
  const loads = useQuery({ ...q.loads(semester?.id ?? ''), enabled: semester !== null });
  if (!semester) return <Alert severity="info">{uk.gradebook.noSemester}</Alert>;
  const items = loads.data ?? [];

  return (
    <>
      <PageHeader title={uk.gradebook.title} />
      <ErrorAlert error={loads.error} />
      {loads.isSuccess && items.length === 0 && (
        <Alert severity="info">{uk.gradebook.noLoads}</Alert>
      )}
      {items.length > 0 && (
        <>
          <Typography color="text.secondary" sx={{ mb: 1 }}>
            {uk.gradebook.pick}
          </Typography>
          <Paper variant="outlined" sx={{ maxWidth: 640 }}>
            <List disablePadding>
              {items.map((l) => (
                <LinkListItem
                  key={l.id}
                  to="/gradebook/$loadId"
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
                    secondary={`${l.group.name}${l.subgroup ? ` · ${l.subgroup.name}` : ''} · ${uk.loads.kinds[l.kind]} · ${l.hours.held} ${uk.loads.hoursOf} ${l.plannedHours} год`}
                  />
                </LinkListItem>
              ))}
            </List>
          </Paper>
        </>
      )}
    </>
  );
}

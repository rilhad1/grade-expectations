import { Alert, List, ListItemText, Paper, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { q } from '../../../api/queries';
import { useCurrentSemester } from '../../../app/SemesterSwitcher';
import { journalsOf } from '../../../features/gradebook/loadNav';
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
  const items = journalsOf(loads.data ?? []);

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
              {items.map((j) => (
                <LinkListItem
                  key={`${j.discipline.id}|${j.group.id}|${j.subgroup?.id ?? ''}`}
                  to="/gradebook/$loadId"
                  params={{ loadId: j.primaryId }}
                  sx={{ minHeight: 56 }}
                >
                  <ListItemText
                    primary={
                      <>
                        <DisciplineDot color={j.discipline.color} />
                        {j.discipline.title}
                      </>
                    }
                    secondary={`${j.group.name}${j.subgroup ? ` · ${j.subgroup.name}` : ''} · ${j.kinds.map((k) => uk.loads.kinds[k]).join(', ')} · ${String(j.held)} ${uk.loads.hoursOf} ${String(j.planned)} год`}
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

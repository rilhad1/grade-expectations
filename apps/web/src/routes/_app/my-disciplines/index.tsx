import { Alert, List, ListItemText, Paper } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { q } from '../../../api/queries';
import { useCurrentSemester } from '../../../app/SemesterSwitcher';
import { uk } from '../../../shared/i18n/uk';
import { DisciplineDot } from '../../../shared/ui/DisciplineDot';
import { ErrorAlert } from '../../../shared/ui/ErrorAlert';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { LinkListItem } from '../../../shared/ui/links';

export const Route = createFileRoute('/_app/my-disciplines/')({ component: MyDisciplines });

function MyDisciplines() {
  const { semester } = useCurrentSemester();
  const loads = useQuery({ ...q.loads(semester?.id ?? ''), enabled: semester !== null });
  const items = loads.data ?? [];
  return (
    <>
      <PageHeader title={uk.disciplines.title} />
      <ErrorAlert error={loads.error} />
      {(loads.isSuccess && items.length === 0) || !semester ? (
        <Alert severity="info">{uk.disciplines.empty}</Alert>
      ) : null}
      {items.length > 0 && (
        <Paper variant="outlined" sx={{ maxWidth: 720 }}>
          <List disablePadding>
            {items.map((l) => (
              <LinkListItem
                key={l.id}
                to="/my-disciplines/$loadId"
                params={{ loadId: l.id }}
                sx={{ minHeight: 64 }}
              >
                <ListItemText
                  primary={
                    <>
                      <DisciplineDot color={l.discipline.color} />
                      {l.discipline.title}
                    </>
                  }
                  secondary={`${l.group.name}${l.subgroup ? ` · ${l.subgroup.name}` : ''} · ${uk.loads.kinds[l.kind]} · ${uk.loads.controlForms[l.controlForm]} · ${l.hours.held} ${uk.loads.hoursOf} ${l.plannedHours} год`}
                />
              </LinkListItem>
            ))}
          </List>
        </Paper>
      )}
    </>
  );
}

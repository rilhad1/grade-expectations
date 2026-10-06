import LockOutlined from '@mui/icons-material/LockOutlined';
import { Box, Button, Typography } from '@mui/material';

import { uk } from '../shared/i18n/uk';

import { SemesterSwitcher, useCurrentSemester } from './SemesterSwitcher';
import { SyncIndicator } from './SyncIndicator';
import { WeekBadge } from './WeekBadge';
import { semesterLabel } from './semesterLabel';
import { useSemesterStore } from './semesterStore';

/** Бейдж архівного семестру. */
export function ArchivePill() {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        height: 24,
        px: 1.25,
        borderRadius: '12px',
        bgcolor: 'ge.sunken',
        border: '1px solid',
        borderColor: 'ge.line2',
        color: 'text.secondary',
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      <LockOutlined sx={{ fontSize: 14 }} />
      {uk.header.archive}
    </Box>
  );
}

/** Шапка десктопу: семестр, тиждень (або «Архів»), стан синхронізації; під нею — банер архіву. */
export function AppTopbar() {
  const { semester, semesters, years } = useCurrentSemester();
  const setSemesterId = useSemesterStore((s) => s.setSemesterId);
  const archivedSemester = semester?.status === 'CLOSED' ? semester : null;
  const archived = archivedSemester !== null;
  const current = semesters.find((s) => s.status === 'ACTIVE');

  return (
    <>
      <Box
        component="header"
        sx={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: { md: 3, lg: 4 },
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <SemesterSwitcher />
        {archived ? <ArchivePill /> : <WeekBadge semester={semester} />}
        <Box sx={{ flex: 1 }} />
        <SyncIndicator />
      </Box>
      {archivedSemester && (
        <Box
          role="status"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: { md: 3, lg: 4 },
            py: 1.5,
            bgcolor: 'ge.sunken',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <LockOutlined sx={{ fontSize: 18, color: 'text.secondary' }} />
          <Typography sx={{ flex: 1 }}>
            <b>
              {semesterLabel(archivedSemester, years)} — {uk.header.archiveBanner}
            </b>{' '}
            <Box component="span" sx={{ color: 'text.secondary' }}>
              {uk.header.archiveHint}
            </Box>
          </Typography>
          {current && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                setSemesterId(current.id);
              }}
            >
              {uk.header.backToCurrent}
            </Button>
          )}
        </Box>
      )}
    </>
  );
}

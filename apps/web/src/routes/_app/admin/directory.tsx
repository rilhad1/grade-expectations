import { Box, Tab, Tabs } from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { BellsTab } from '../../../features/directory/BellsTab';
import { DisciplinesTab } from '../../../features/directory/DisciplinesTab';
import { RoomsTab } from '../../../features/directory/RoomsTab';
import { UsersTab } from '../../../features/directory/UsersTab';
import { uk } from '../../../shared/i18n/uk';
import { PageHeader } from '../../../shared/ui/PageHeader';

export const Route = createFileRoute('/_app/admin/directory')({ component: DirectoryPage });

const TABS = ['disciplines', 'rooms', 'bells', 'users'] as const;

function DirectoryPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('disciplines');
  return (
    <>
      <PageHeader title={uk.directory.title} />
      <Tabs
        value={tab}
        onChange={(_, v: (typeof TABS)[number]) => {
          setTab(v);
        }}
        sx={{ mb: 3 }}
        variant="scrollable"
      >
        {TABS.map((t) => (
          <Tab key={t} value={t} label={uk.directory.tabs[t]} />
        ))}
      </Tabs>
      <Box>
        {tab === 'disciplines' && <DisciplinesTab />}
        {tab === 'rooms' && <RoomsTab />}
        {tab === 'bells' && <BellsTab />}
        {tab === 'users' && <UsersTab />}
      </Box>
    </>
  );
}

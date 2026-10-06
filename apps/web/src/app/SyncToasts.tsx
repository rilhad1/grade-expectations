import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import SyncOutlined from '@mui/icons-material/SyncOutlined';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import { Alert, Snackbar } from '@mui/material';
import { useEffect, useRef, useState } from 'react';

import { useSyncStore } from '../offline/syncStore';
import { uk } from '../shared/i18n/uk';

interface Toast {
  id: number;
  kind: 'info' | 'success' | 'error';
  text: string;
}

/** Тости станів синхронізації: «Зв'язок відновлено», «Усі зміни збережено», «N змін не прийнято». */
export function SyncToasts() {
  const online = useSyncStore((s) => s.online);
  const pending = useSyncStore((s) => s.pending);
  const notices = useSyncStore((s) => s.notices.length);
  const [toast, setToast] = useState<Toast | null>(null);
  const prev = useRef({ online, pending, notices });
  const seq = useRef(0);

  useEffect(() => {
    const before = prev.current;
    prev.current = { online, pending, notices };
    const show = (kind: Toast['kind'], text: string) => {
      seq.current += 1;
      setToast({ id: seq.current, kind, text });
    };
    if (notices > before.notices) show('error', uk.sync.toastRejected(notices - before.notices));
    else if (online && !before.online && pending > 0) show('info', uk.sync.toastRestored(pending));
    else if (online && before.pending > 0 && pending === 0) show('success', uk.sync.toastSaved);
  }, [online, pending, notices]);

  return (
    <Snackbar
      key={toast?.id}
      open={toast !== null}
      autoHideDuration={toast?.kind === 'error' ? 8000 : 4000}
      onClose={(_, reason) => {
        if (reason !== 'clickaway') setToast(null);
      }}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      sx={{ mb: { xs: 12, md: 0 } }}
    >
      {toast ? (
        <Alert
          role={toast.kind === 'error' ? 'alert' : 'status'}
          severity={
            toast.kind === 'error' ? 'error' : toast.kind === 'success' ? 'success' : 'info'
          }
          icon={
            toast.kind === 'error' ? (
              <WarningAmberOutlined />
            ) : toast.kind === 'success' ? (
              <CheckCircleOutlined />
            ) : (
              <SyncOutlined />
            )
          }
          onClose={() => {
            setToast(null);
          }}
          sx={{ boxShadow: '0 8px 20px rgba(31,35,40,.12)', alignItems: 'center' }}
        >
          {toast.text}
        </Alert>
      ) : undefined}
    </Snackbar>
  );
}

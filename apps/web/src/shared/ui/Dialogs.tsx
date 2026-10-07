import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Drawer,
  Typography,
} from '@mui/material';
import type { ReactNode } from 'react';

import { uk } from '../i18n/uk';

/** Підтвердження дії: заголовок 20/28, футер з роздільником, кнопки 40 px. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = uk.common.cancel,
  tone = 'primary',
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'primary' | 'error';
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="confirm-title">
      <DialogTitle id="confirm-title">{title}</DialogTitle>
      {description && (
        <DialogContent>
          <DialogContentText component="div">{description}</DialogContentText>
        </DialogContent>
      )}
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button variant="contained" color={tone} disabled={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Нижня шторка (оцінка на парі, меню): радіус 16, «ручка» 36×4. */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  ariaLabel,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  ariaLabel: string;
}) {
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      // Над діалогами (в тому числі повноекранними), як і належить шторці вибору
      sx={{ zIndex: (t) => t.zIndex.modal + 1 }}
      slotProps={{
        paper: {
          role: 'dialog',
          'aria-label': ariaLabel,
          sx: {
            borderRadius: '16px 16px 0 0',
            px: 2,
            pt: 1,
            pb: 3,
            maxWidth: 560,
            mx: 'auto',
            boxShadow: '0 -8px 24px rgba(0,0,0,.14)',
          },
        },
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 36,
          height: 4,
          borderRadius: 2,
          bgcolor: 'ge.line2',
          alignSelf: 'center',
          mb: 1.5,
        }}
      />
      {title && (
        <Typography variant="h6" component="div" sx={{ mb: 1.5 }}>
          {title}
        </Typography>
      )}
      {children}
    </Drawer>
  );
}

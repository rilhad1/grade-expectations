import type { UserDto } from '@ge/shared';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { q } from '../../api/queries';
import { uk } from '../../shared/i18n/uk';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';

import { createUser, updateUserRoles } from './api';

const u = uk.directory.users;
type RoleName = 'TEACHER' | 'MODERATOR';

function RoleChecks({
  roles,
  onChange,
}: {
  roles: RoleName[];
  onChange: (roles: RoleName[]) => void;
}) {
  const toggle = (role: RoleName, on: boolean) => {
    onChange(on ? [...roles, role] : roles.filter((r) => r !== role));
  };
  return (
    <Stack direction="row">
      {(['TEACHER', 'MODERATOR'] as const).map((role) => (
        <FormControlLabel
          key={role}
          control={
            <Checkbox
              checked={roles.includes(role)}
              onChange={(e) => {
                toggle(role, e.target.checked);
              }}
            />
          }
          label={uk.roles[role]}
        />
      ))}
    </Stack>
  );
}

function CreateUserDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [roles, setRoles] = useState<RoleName[]>(['TEACHER']);

  const create = useMutation({
    mutationFn: () => createUser({ email: email.trim(), fullName: fullName.trim(), roles }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
  const result = create.data;

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{result ? u.created : u.add}</DialogTitle>
      <DialogContent>
        {result ? (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography>
              {result.fullName} · {result.email}
            </Typography>
            <Alert severity="warning">
              <strong>{u.tempPassword}:</strong>
              <Box
                component="code"
                sx={{ display: 'block', fontSize: 20, my: 1, userSelect: 'all' }}
              >
                {result.temporaryPassword}
              </Box>
              {u.tempHint}
            </Alert>
          </Stack>
        ) : (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              autoFocus
              type="email"
              label={u.email}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
              }}
            />
            <TextField
              label={u.fullName}
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
              }}
            />
            <RoleChecks roles={roles} onChange={setRoles} />
            <ErrorAlert error={create.error} />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {result ? (
          <Button variant="contained" onClick={onClose}>
            {uk.common.done}
          </Button>
        ) : (
          <>
            <Button onClick={onClose}>{uk.common.cancel}</Button>
            <Button
              variant="contained"
              disabled={
                email.trim() === '' ||
                fullName.trim() === '' ||
                roles.length === 0 ||
                create.isPending
              }
              onClick={() => {
                create.mutate();
              }}
            >
              {uk.common.create}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

function RolesDialog({ user, onClose }: { user: UserDto; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [roles, setRoles] = useState<RoleName[]>(user.roles);
  const save = useMutation({
    mutationFn: () => updateUserRoles(user.id, roles),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
  });
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{user.fullName}</DialogTitle>
      <DialogContent>
        <RoleChecks roles={roles} onChange={setRoles} />
        <ErrorAlert error={save.error} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{uk.common.cancel}</Button>
        <Button
          variant="contained"
          disabled={roles.length === 0 || save.isPending}
          onClick={() => {
            save.mutate();
          }}
        >
          {uk.common.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function UsersTab() {
  const query = useQuery(q.users());
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserDto | null>(null);
  const rows = query.data ?? [];

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <Button
          variant="contained"
          onClick={() => {
            setCreating(true);
          }}
        >
          {u.add}
        </Button>
      </Box>
      <ErrorAlert error={query.error} />
      {query.isSuccess && rows.length === 0 && <Alert severity="info">{u.empty}</Alert>}
      {rows.length > 0 && (
        <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{u.fullName}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.roles}</TableCell>
                <TableCell align="right">{uk.common.actions}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((x) => (
                <TableRow key={x.id} hover>
                  <TableCell>{x.fullName}</TableCell>
                  <TableCell>{x.email}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      {x.roles.map((r) => (
                        <Chip
                          key={r}
                          size="small"
                          variant="outlined"
                          color="primary"
                          label={uk.roles[r]}
                        />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      onClick={() => {
                        setEditing(x);
                      }}
                    >
                      {uk.common.edit}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
      {creating && (
        <CreateUserDialog
          onClose={() => {
            setCreating(false);
          }}
        />
      )}
      {editing && (
        <RolesDialog
          user={editing}
          onClose={() => {
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

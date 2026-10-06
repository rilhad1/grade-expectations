import {
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { fetchTopics } from '../../api/teaching';
import { uk } from '../../shared/i18n/uk';

/** Тема й домашнє завдання заняття. Теми тематичного плану пропонуються як підказки. */
export function TopicDialog({
  loadId,
  topic,
  homework,
  onSave,
  onClose,
}: {
  loadId: string;
  topic: string | null;
  homework: string | null;
  onSave: (v: { topicText: string | null; homework: string | null }) => void;
  onClose: () => void;
}) {
  const plan = useQuery({ queryKey: ['topics', loadId], queryFn: () => fetchTopics(loadId) });
  const [text, setText] = useState(topic ?? '');
  const [hw, setHw] = useState(homework ?? '');

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{uk.lesson.editTopic}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Autocomplete
            freeSolo
            options={(plan.data?.topics ?? []).map((t) => t.title)}
            inputValue={text}
            onInputChange={(_, v) => {
              setText(v);
            }}
            renderInput={(params) => (
              <TextField {...params} autoFocus multiline label={uk.lesson.topicLabel} />
            )}
          />
          <TextField
            multiline
            minRows={2}
            label={uk.lesson.homework}
            value={hw}
            onChange={(e) => {
              setHw(e.target.value);
            }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{uk.common.cancel}</Button>
        <Button
          variant="contained"
          onClick={() => {
            onSave({ topicText: text.trim() || null, homework: hw.trim() || null });
            onClose();
          }}
        >
          {uk.lesson.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

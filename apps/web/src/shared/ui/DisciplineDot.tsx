import { Box } from '@mui/material';

/** Мітка дисципліни: однакового кольору в розкладі, журналі та фільтрах. */
export function DisciplineDot({ color, size = 10 }: { color: string; size?: number }) {
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        bgcolor: color,
        mr: 1,
        flexShrink: 0,
      }}
    />
  );
}

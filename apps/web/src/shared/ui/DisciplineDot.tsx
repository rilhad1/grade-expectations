import { Box } from '@mui/material';

/** Мітка дисципліни: однакового кольору в розкладі, журналі, картках і фільтрах. */
export function DisciplineDot({
  color,
  size = 10,
  gap = 1,
}: {
  color: string;
  size?: number;
  gap?: number;
}) {
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: `${Math.max(2, Math.round(size / 4))}px`,
        bgcolor: color,
        mr: gap,
        flexShrink: 0,
      }}
    />
  );
}

export { DisciplineDot as DisciplineMark };

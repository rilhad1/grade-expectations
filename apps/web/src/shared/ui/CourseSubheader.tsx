import { ListSubheader } from '@mui/material';

import { uk } from '../i18n/uk';

/** Заголовок секції «N курс» у списках, відсортованих за курсом. */
export function CourseSubheader({ course }: { course: number | undefined }) {
  return (
    <ListSubheader
      disableSticky
      sx={{
        lineHeight: '32px',
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: 'ge.text3',
        bgcolor: 'ge.surface2',
        borderTop: 1,
        borderBottom: 1,
        borderColor: 'divider',
        '&:first-of-type': { borderTop: 0 },
      }}
    >
      {course === undefined ? uk.common.none : uk.semesters.courseN(course)}
    </ListSubheader>
  );
}

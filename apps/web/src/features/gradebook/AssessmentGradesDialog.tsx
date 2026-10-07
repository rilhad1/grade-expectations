import type { AssessmentDto, GradebookDto } from '@ge/shared';
import CloseIcon from '@mui/icons-material/Close';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import { Box, ButtonBase, Dialog, IconButton, List, Stack, Typography } from '@mui/material';
import { useState } from 'react';

import { uk } from '../../shared/i18n/uk';
import { GradeChip } from '../../shared/ui/GradeChip';
import { GradeSheet } from '../lesson/GradeSheet';

type Student = GradebookDto['students'][number];

/**
 * Введення оцінок колонки оцінювання на телефоні: список студентів, тап — клавіатура оцінки.
 * Після збереження одразу відкривається наступний студент, щоб пройти групу без зайвих кроків.
 */
export function AssessmentGradesDialog({
  assessment,
  students,
  scale,
  onSet,
  onClear,
  onEdit,
  onClose,
}: {
  assessment: AssessmentDto;
  students: readonly Student[];
  scale: GradebookDto['load']['gradingRules']['scale'];
  onSet: (enrollmentId: string, value: number) => void;
  onClear: (enrollmentId: string) => void;
  onEdit: () => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const student = index === null ? undefined : students[index];
  const grade = student?.assessmentGrades[assessment.id];
  const filled = students.filter((s) => s.assessmentGrades[assessment.id]).length;

  return (
    <Dialog open fullScreen onClose={onClose} aria-label={assessment.title}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: 1.5, height: 56, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}
      >
        <IconButton onClick={onClose} aria-label={uk.gradebook.mobile.back}>
          <CloseIcon />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontWeight: 600 }}>
            {assessment.title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {uk.gradebook.mobile.filled(filled, students.length)}
          </Typography>
        </Box>
        <IconButton onClick={onEdit} aria-label={uk.gradebook.mobile.editColumn}>
          <SettingsOutlined />
        </IconButton>
      </Stack>

      <List disablePadding sx={{ overflowY: 'auto', flex: 1 }}>
        {students.map((s, i) => {
          const g = s.assessmentGrades[assessment.id];
          return (
            <ButtonBase
              key={s.enrollmentId}
              onClick={() => {
                setIndex(i);
              }}
              sx={{
                width: '100%',
                minHeight: 56,
                px: 2,
                gap: 1.5,
                justifyContent: 'flex-start',
                borderBottom: 1,
                borderColor: 'divider',
                textAlign: 'left',
              }}
            >
              <Typography className="tnum" sx={{ width: 22, fontSize: 13, color: 'ge.text3' }}>
                {i + 1}
              </Typography>
              <Typography noWrap sx={{ flex: 1 }}>
                {s.lastName} {s.firstName}
              </Typography>
              {g ? (
                <GradeChip value={g.value} scale={scale} />
              ) : (
                <Typography color="ge.text3" sx={{ minWidth: 30, textAlign: 'center' }}>
                  {uk.common.none}
                </Typography>
              )}
            </ButtonBase>
          );
        })}
      </List>

      {student && index !== null && (
        <GradeSheet
          student={{
            enrollmentId: student.enrollmentId,
            studentId: student.studentId,
            lastName: student.lastName,
            firstName: student.firstName,
            middleName: student.middleName,
            attendance: 'PRESENT',
            marked: false,
            grades: [],
          }}
          scale={scale}
          showKind={false}
          defaultKind="PRACTICE"
          dateLabel={assessment.title}
          {...(grade && {
            grade: {
              id: grade.id,
              kind: 'PRACTICE',
              value: grade.value,
              comment: grade.comment,
              version: grade.version,
            },
            onDelete: () => {
              onClear(student.enrollmentId);
              setIndex(null);
            },
          })}
          onClose={() => {
            setIndex(null);
          }}
          onSave={({ value }) => {
            onSet(student.enrollmentId, value);
            setIndex(index + 1 < students.length ? index + 1 : null);
          }}
        />
      )}
    </Dialog>
  );
}

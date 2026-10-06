import type { GradebookDto } from '@ge/shared';
import {
  Alert,
  CircularProgress,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';

import { uk } from '../../shared/i18n/uk';
import { DisciplineDot } from '../../shared/ui/DisciplineDot';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';
import { GradeSheet } from '../lesson/GradeSheet';
import { defaultGradeKind, isValidGrade, scaleRange } from '../lesson/model';

import { GradebookGrid, type GridSelection } from './GradebookGrid';
import { StudentPanel } from './StudentPanel';
import { bufferIsFinal, interpretKey, moveSelection } from './model';
import { useGradebook, type Range } from './useGradebook';

type Student = GradebookDto['students'][number];
const COMMIT_DELAY_MS = 700;

/** Фільтр періоду: весь семестр або до кінця періоду атестації/сесії. */
function periodOptions(data: GradebookDto | undefined) {
  const options: { value: string; label: string; range: Range }[] = [
    { value: 'all', label: uk.gradebook.wholeSemester, range: {} },
  ];
  for (const p of data?.periods ?? []) {
    options.push({
      value: `${p.kind}-${p.startDate}`,
      label: `${uk.gradebook.untilPeriod} ${uk.gradebook.periodKinds[p.kind as keyof typeof uk.gradebook.periodKinds]}`,
      range: { to: p.endDate },
    });
  }
  return options;
}

export function GradebookScreen({ loadId }: { loadId: string }) {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  // Вибраний фільтр зберігає й власний діапазон: перелік періодів приходить разом із даними журналу
  const [period, setPeriod] = useState<{ value: string; range: Range }>({
    value: 'all',
    range: {},
  });
  const book = useGradebook(loadId, period.range);
  const data = book.query.data;
  const options = periodOptions(data);

  const [selection, setSelection] = useState<GridSelection>({ row: 0, col: 0 });
  const [sheet, setSheet] = useState<{ student: Student; lessonId: string } | null>(null);
  const [panel, setPanel] = useState<Student | null>(null);
  const buffer = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Лишаємося на останньому занятті проведеного: курсор стартує на найближчому до сьогодні
  const startCol = useRef(false);
  useEffect(() => {
    if (!data || startCol.current || data.lessons.length === 0) return;
    startCol.current = true;
    const held = data.lessons.filter((l) => l.status === 'HELD').length;
    setSelection({ row: 0, col: Math.max(0, Math.min(held, data.lessons.length - 1)) });
  }, [data]);

  if (book.query.isPending)
    return <CircularProgress sx={{ m: 4 }} aria-label={uk.common.loading} />;
  if (!data) return <ErrorAlert error={book.query.error} />;

  const scale = data.load.gradingRules.scale;
  const { max } = scaleRange[scale];
  const lessonAt = (col: number) => data.lessons[col];
  const studentAt = (row: number) => data.students[row];
  const current = () => {
    const student = studentAt(selection.row);
    const lesson = lessonAt(selection.col);
    return student && lesson ? { student, lesson, cell: student.cells[lesson.id] } : null;
  };

  const commitValue = (value: number) => {
    const c = current();
    if (!c || !isValidGrade(scale, value)) return;
    const last = c.cell?.grades.at(-1);
    book.upsertGrade.mutate({
      lessonId: c.lesson.id,
      enrollmentId: c.student.enrollmentId,
      kind: last?.kind ?? defaultGradeKind(data.load.kind),
      value,
      newId: book.newId(),
      ...(last && { gradeId: last.id, version: last.version }),
    });
  };

  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const value = Number(buffer.current);
    buffer.current = '';
    if (value > 0 || scale === 'HUNDRED' || scale === 'PASS_FAIL') commitValue(value);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const action = interpretKey(e.key, buffer.current);
    if (!action) return;
    e.preventDefault();
    const size = { rows: data.students.length, cols: data.lessons.length };

    if (action.type === 'move') {
      if (buffer.current) flush();
      setSelection((s) => moveSelection(s, action, size));
    } else if (action.type === 'digit') {
      buffer.current = action.buffer;
      if (timer.current) clearTimeout(timer.current);
      if (bufferIsFinal(buffer.current, max)) flush();
      else timer.current = setTimeout(flush, COMMIT_DELAY_MS);
    } else if (action.type === 'attendance') {
      const c = current();
      if (c)
        book.attendance.mutate({
          lessonId: c.lesson.id,
          enrollmentId: c.student.enrollmentId,
          status: action.status,
        });
    } else if (action.type === 'delete') {
      const c = current();
      const last = c?.cell?.grades.at(-1);
      if (c && last)
        book.clearGrade.mutate({
          lessonId: c.lesson.id,
          enrollmentId: c.student.enrollmentId,
          gradeId: last.id,
        });
      else if (c && c.cell?.attendance && c.cell.attendance !== 'PRESENT') {
        book.attendance.mutate({
          lessonId: c.lesson.id,
          enrollmentId: c.student.enrollmentId,
          status: 'PRESENT',
        });
      }
    } else {
      // action.type === 'open'
      const c = current();
      if (c) setSheet({ student: c.student, lessonId: c.lesson.id });
    }
  };

  const mutationError = book.attendance.error ?? book.upsertGrade.error ?? book.clearGrade.error;
  const sheetCell = sheet ? sheet.student.cells[sheet.lessonId] : undefined;
  const sheetGrade = sheetCell?.grades.at(-1);

  return (
    <>
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" sx={{ mb: 2 }}>
        <Typography variant="h5" component="h1" sx={{ flexGrow: 1 }}>
          <DisciplineDot color={data.load.discipline.color} size={12} />
          {uk.gradebook.title}: {data.load.discipline.shortTitle} · {data.load.group.name}
          {data.load.subgroup ? ` · ${data.load.subgroup.name}` : ''} ·{' '}
          {uk.loads.kindsShort[data.load.kind]}
        </Typography>
        {options.length > 1 && (
          <TextField
            select
            size="small"
            label={uk.gradebook.period}
            value={period.value}
            onChange={(e) => {
              const picked = options.find((o) => o.value === e.target.value);
              if (picked) setPeriod({ value: picked.value, range: picked.range });
            }}
            sx={{ minWidth: 260 }}
          >
            {options.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
        )}
      </Stack>

      <ErrorAlert error={mutationError} />
      {data.students.length === 0 && <Alert severity="info">{uk.gradebook.emptyStudents}</Alert>}
      {data.students.length > 0 && data.lessons.length === 0 && (
        <Alert severity="info">{uk.gradebook.noLessons}</Alert>
      )}

      {desktop && data.students.length > 0 && data.lessons.length > 0 && (
        <>
          <GradebookGrid
            data={data}
            selection={selection}
            onSelect={setSelection}
            onOpenStudent={setPanel}
            onKeyDown={onKeyDown}
          />
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
            {uk.gradebook.hint}
          </Typography>
        </>
      )}

      {!desktop && (
        <Paper variant="outlined">
          <List disablePadding>
            {data.students.map((s) => {
              const recent = data.lessons
                .flatMap((l) => s.cells[l.id]?.grades.map((g) => g.value) ?? [])
                .slice(-6);
              return (
                <ListItemButton
                  key={s.enrollmentId}
                  onClick={() => {
                    setPanel(s);
                  }}
                  sx={{ minHeight: 56 }}
                >
                  <ListItemText
                    primary={`${s.lastName} ${s.firstName}`}
                    secondary={`${recent.join(', ') || uk.common.none} · ${uk.gradebook.average} ${s.summary.average === null ? uk.common.none : s.summary.average.toFixed(1).replace('.', ',')} · ${uk.gradebook.absences} ${s.summary.absences.unexcused} (${s.summary.absences.excused})`}
                    slotProps={{
                      primary: {
                        sx: { color: s.summary.risk.length > 0 ? 'error.main' : undefined },
                      },
                    }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        </Paper>
      )}

      {panel && (
        <StudentPanel
          student={data.students.find((s) => s.enrollmentId === panel.enrollmentId) ?? panel}
          data={data}
          onClose={() => {
            setPanel(null);
          }}
        />
      )}
      {sheet && (
        <GradeSheet
          student={{
            enrollmentId: sheet.student.enrollmentId,
            studentId: sheet.student.studentId,
            lastName: sheet.student.lastName,
            firstName: sheet.student.firstName,
            middleName: sheet.student.middleName,
            attendance: 'PRESENT',
            marked: false,
            grades: [],
          }}
          scale={scale}
          defaultKind={defaultGradeKind(data.load.kind)}
          {...(sheetGrade && { grade: sheetGrade })}
          onClose={() => {
            setSheet(null);
          }}
          onSave={({ kind, value }) => {
            book.upsertGrade.mutate({
              lessonId: sheet.lessonId,
              enrollmentId: sheet.student.enrollmentId,
              kind,
              value,
              newId: book.newId(),
              ...(sheetGrade && { gradeId: sheetGrade.id, version: sheetGrade.version }),
            });
            setSheet(null);
          }}
          {...(sheetGrade && {
            onDelete: () => {
              book.clearGrade.mutate({
                lessonId: sheet.lessonId,
                enrollmentId: sheet.student.enrollmentId,
                gradeId: sheetGrade.id,
              });
              setSheet(null);
            },
          })}
        />
      )}
    </>
  );
}

import type { GradebookDto } from '@ge/shared';
import {
  Alert,
  Box,
  List,
  ListItemButton,
  MenuItem,
  Paper,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { q } from '../../api/queries';
import { useCurrentSemester } from '../../app/SemesterSwitcher';
import { uk } from '../../shared/i18n/uk';
import { DisciplineDot } from '../../shared/ui/DisciplineDot';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';
import { TableSkeleton } from '../../shared/ui/Skeletons';
import { GradeSheet } from '../lesson/GradeSheet';
import { defaultGradeKind, gradeTone, isValidGrade, scaleRange } from '../lesson/model';

import { GradebookGrid, type GridSelection } from './GradebookGrid';
import { GradebookToolbar } from './GradebookToolbar';
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

export function GradebookScreen({
  loadId,
  onPickLoad,
}: {
  loadId: string;
  /** Перехід до журналу іншого навантаження (вибір дисципліни, групи, виду). */
  onPickLoad?: (loadId: string) => void;
}) {
  const { semester } = useCurrentSemester();
  const myLoads = useQuery({
    ...q.loads(semester?.id ?? ''),
    enabled: semester !== null && onPickLoad !== undefined,
  });
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

  if (book.query.isPending) return <TableSkeleton rows={8} cols={7} label={uk.common.loading} />;
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

  const periodSelect =
    options.length > 1 ? (
      <TextField
        select
        size="small"
        label={uk.gradebook.period}
        value={period.value}
        onChange={(e) => {
          const picked = options.find((o) => o.value === e.target.value);
          if (picked) setPeriod({ value: picked.value, range: picked.range });
        }}
        sx={{ minWidth: 260, mb: onPickLoad ? 0 : 2 }}
      >
        {options.map((o) => (
          <MenuItem key={o.value} value={o.value}>
            {o.label}
          </MenuItem>
        ))}
      </TextField>
    ) : null;

  const mutationError = book.attendance.error ?? book.upsertGrade.error ?? book.clearGrade.error;
  const sheetCell = sheet ? sheet.student.cells[sheet.lessonId] : undefined;
  const sheetGrade = sheetCell?.grades.at(-1);

  return (
    <>
      <Typography
        variant="h5"
        component="h1"
        sx={{ mb: 1.5, display: 'flex', alignItems: 'center' }}
      >
        <DisciplineDot color={data.load.discipline.color} size={12} gap={1.25} />
        {uk.gradebook.title}: {data.load.discipline.shortTitle} · {data.load.group.name}
        {data.load.subgroup ? ` · ${data.load.subgroup.name}` : ''} ·{' '}
        {uk.loads.kindsShort[data.load.kind]}
      </Typography>
      {onPickLoad && (
        <GradebookToolbar
          loads={myLoads.data ?? []}
          currentId={loadId}
          onPick={onPickLoad}
          period={periodSelect}
        />
      )}
      {!onPickLoad && periodSelect}

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
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          <List disablePadding>
            {data.students.map((s, index) => {
              const avg = s.summary.average;
              const tone = avg === null ? 'none' : gradeTone(scale, Math.round(avg));
              return (
                <ListItemButton
                  key={s.enrollmentId}
                  onClick={() => {
                    setPanel(s);
                  }}
                  sx={{ minHeight: 60, gap: 1.25, borderBottom: 1, borderColor: 'divider' }}
                >
                  <Typography
                    className="tnum"
                    sx={{ width: 20, fontSize: 13, color: 'ge.text3', textAlign: 'right' }}
                  >
                    {index + 1}
                  </Typography>
                  <Typography
                    noWrap
                    sx={{ flex: 1, color: s.summary.risk.length > 0 ? 'ge.errFg' : 'text.primary' }}
                  >
                    {s.lastName} {s.firstName}
                  </Typography>
                  {s.summary.absences.unexcused > 0 && (
                    <Typography
                      className="tnum"
                      sx={{
                        fontSize: 14,
                        color: s.summary.absencePercent > 30 ? 'ge.errFg' : 'text.secondary',
                      }}
                    >
                      {s.summary.absences.unexcused} {uk.gradebook.absShort}
                    </Typography>
                  )}
                  <Box
                    component="span"
                    className="tnum"
                    sx={{
                      minWidth: 40,
                      height: 30,
                      px: 0.75,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '6px',
                      fontSize: 15,
                      fontWeight: 600,
                      bgcolor:
                        tone === 'low'
                          ? 'ge.grade.low'
                          : tone === 'high'
                            ? 'ge.grade.high'
                            : 'ge.sunken',
                    }}
                  >
                    {avg === null ? uk.common.none : avg.toFixed(1).replace('.', ',')}
                  </Box>
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

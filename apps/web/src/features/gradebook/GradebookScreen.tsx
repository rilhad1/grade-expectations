import type { GradebookDto, LessonKind } from '@ge/shared';
import {
  Alert,
  Box,
  Button,
  MenuItem,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';

import { q } from '../../api/queries';
import { useCurrentSemester } from '../../app/SemesterSwitcher';
import { todayKyiv } from '../../app/today';
import { uk } from '../../shared/i18n/uk';
import { ConfirmDialog } from '../../shared/ui/Dialogs';
import { DisciplineDot } from '../../shared/ui/DisciplineDot';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';
import { TableSkeleton } from '../../shared/ui/Skeletons';
import { GradeSheet } from '../lesson/GradeSheet';
import { defaultGradeKind, isValidGrade, scaleRange } from '../lesson/model';

import { AssessmentDialog } from './AssessmentDialog';
import { AssessmentGradesDialog } from './AssessmentGradesDialog';
import { GradebookGrid, type GridSelection } from './GradebookGrid';
import { GradebookToolbar } from './GradebookToolbar';
import { MobileJournal } from './MobileJournal';
import { StudentPanel } from './StudentPanel';
import { KIND_ORDER } from './loadNav';
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
  const full = book.query.data;
  const options = periodOptions(full);
  // Фільтр виду занять: журнал один, фільтр лише ховає колонки інших видів
  const [kindFilter, setKindFilter] = useState<'ALL' | LessonKind>('ALL');
  const kinds = useMemo(
    () => KIND_ORDER.filter((k) => full?.lessons.some((l) => l.kind === k)),
    [full],
  );
  const activeFilter = kindFilter === 'ALL' || kinds.includes(kindFilter) ? kindFilter : 'ALL';
  // Майбутні заняття за замовчуванням сховано: сітка закінчується сьогоднішнім днем
  const today = todayKyiv();
  const [showFuture, setShowFuture] = useState(false);
  const hasPast = full?.lessons.some((l) => l.date <= today) ?? false;
  const hasFuture = full?.lessons.some((l) => l.date > today) ?? false;
  const hideFuture = !showFuture && hasPast;
  const data = useMemo(
    () =>
      full && (activeFilter !== 'ALL' || hideFuture)
        ? {
            ...full,
            lessons: full.lessons.filter(
              (l) =>
                (activeFilter === 'ALL' || l.kind === activeFilter) &&
                !(hideFuture && l.date > today),
            ),
          }
        : full,
    [full, activeFilter, hideFuture, today],
  );

  const [selection, setSelection] = useState<GridSelection>({ row: 0, col: 0 });
  const [sheet, setSheet] = useState<{ student: Student; lessonId: string } | null>(null);
  const [panel, setPanel] = useState<Student | null>(null);
  // Діалог колонки оцінювання: 'create' — нова колонка, інакше id колонки для редагування; і підтвердження видалення
  const [columnDialog, setColumnDialog] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  // Телефон: колонка, оцінки якої вводяться списком
  const [gradesColumn, setGradesColumn] = useState<string | null>(null);
  const buffer = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Курсор стартує на найближчому до сьогодні занятті; після зміни фільтра — теж
  const startedFor = useRef<string | null>(null);
  useEffect(() => {
    const key = `${activeFilter}|${String(hideFuture)}`;
    if (!data || data.lessons.length === 0 || startedFor.current === key) return;
    startedFor.current = key;
    const next = data.lessons.findIndex((l) => l.date >= today);
    setSelection({ row: 0, col: next === -1 ? data.lessons.length - 1 : next });
  }, [data, activeFilter, hideFuture, today]);

  if (book.query.isPending) return <TableSkeleton rows={8} cols={7} label={uk.common.loading} />;
  if (!data) return <ErrorAlert error={book.query.error} />;

  const scale = data.load.gradingRules.scale;
  const { max } = scaleRange[scale];
  const lessonCount = data.lessons.length;
  const lessonAt = (col: number) => data.lessons[col];
  const studentAt = (row: number) => data.students[row];
  const current = () => {
    const student = studentAt(selection.row);
    const lesson = lessonAt(selection.col);
    return student && lesson ? { student, lesson, cell: student.cells[lesson.id] } : null;
  };
  /** Вибрана клітинка колонки оцінювання (колонки йдуть після занять). */
  const currentAssessment = () => {
    const student = studentAt(selection.row);
    const assessment = data.assessments[selection.col - lessonCount];
    return student && assessment
      ? { student, assessment, grade: student.assessmentGrades[assessment.id] }
      : null;
  };

  const commitValue = (value: number) => {
    const a = currentAssessment();
    if (a) {
      if (isValidGrade(scale, value))
        book.setAssessmentGrade.mutate({
          assessmentId: a.assessment.id,
          enrollmentId: a.student.enrollmentId,
          value,
        });
      return;
    }
    const c = current();
    if (!c || !isValidGrade(scale, value)) return;
    const last = c.cell?.grades.at(-1);
    book.upsertGrade.mutate({
      lessonId: c.lesson.id,
      enrollmentId: c.student.enrollmentId,
      kind: last?.kind ?? defaultGradeKind(c.lesson.kind),
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
    const size = { rows: data.students.length, cols: lessonCount + data.assessments.length };

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
      const a = currentAssessment();
      if (a) {
        if (a.grade)
          book.clearAssessmentGrade.mutate({
            assessmentId: a.assessment.id,
            enrollmentId: a.student.enrollmentId,
          });
        return;
      }
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

  const mutationError =
    book.attendance.error ??
    book.upsertGrade.error ??
    book.clearGrade.error ??
    book.setAssessmentGrade.error ??
    book.clearAssessmentGrade.error;

  // Підказка назви нової колонки: наступний номер серед колонок того ж виду
  const suggestTitle = (kind: 'LAB' | 'TEST') => {
    const base = uk.gradebook.assessment.suggest[kind];
    const numbers = data.assessments
      .filter((x) => x.title.toLowerCase().startsWith(base.toLowerCase()))
      .map((x) => Number(/(\d+)\s*$/.exec(x.title)?.[1] ?? 0));
    return `${base} ${String(Math.max(0, ...numbers) + 1)}`;
  };
  const gradesAssessment = data.assessments.find((x) => x.id === gradesColumn);
  const editing =
    columnDialog && columnDialog !== 'create'
      ? data.assessments.find((x) => x.id === columnDialog)
      : undefined;
  const closeColumnDialog = () => {
    setColumnDialog(null);
    if (gradesColumn !== null && !data.assessments.some((x) => x.id === gradesColumn))
      setGradesColumn(null);
    setConfirmDelete(null);
    book.createColumn.reset();
    book.updateColumn.reset();
    book.deleteColumn.reset();
  };
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
        {data.load.subgroup ? ` · ${data.load.subgroup.name}` : ''}
      </Typography>
      {onPickLoad && (
        <GradebookToolbar
          loads={myLoads.data ?? []}
          currentId={loadId}
          onPick={onPickLoad}
          period={periodSelect}
          kinds={kinds}
          kindFilter={activeFilter}
          onKindFilter={setKindFilter}
          hasFuture={hasFuture}
          showFuture={showFuture}
          onShowFuture={setShowFuture}
        />
      )}
      {!onPickLoad && periodSelect}

      <ErrorAlert error={mutationError} />
      {data.students.length === 0 && <Alert severity="info">{uk.gradebook.emptyStudents}</Alert>}
      {data.students.length > 0 && data.lessons.length === 0 && (
        <Alert severity="info">
          {activeFilter === 'ALL' ? uk.gradebook.noLessons : uk.gradebook.noLessonsOfKind}
        </Alert>
      )}

      {desktop && data.students.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              setColumnDialog('create');
            }}
          >
            + {uk.gradebook.assessment.add}
          </Button>
        </Box>
      )}

      {desktop && data.students.length > 0 && lessonCount + data.assessments.length > 0 && (
        <>
          <GradebookGrid
            data={data}
            selection={selection}
            onSelect={setSelection}
            onOpenStudent={setPanel}
            onEditAssessment={setColumnDialog}
            onKeyDown={onKeyDown}
          />
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
            {uk.gradebook.hint}
          </Typography>
        </>
      )}

      {!desktop && (
        <MobileJournal
          data={data}
          onOpenStudent={setPanel}
          onAddColumn={() => {
            setColumnDialog('create');
          }}
          onOpenColumn={setGradesColumn}
        />
      )}

      {!desktop && gradesAssessment && (
        <AssessmentGradesDialog
          assessment={gradesAssessment}
          students={data.students}
          scale={scale}
          onSet={(enrollmentId, value) => {
            book.setAssessmentGrade.mutate({
              assessmentId: gradesAssessment.id,
              enrollmentId,
              value,
            });
          }}
          onClear={(enrollmentId) => {
            book.clearAssessmentGrade.mutate({
              assessmentId: gradesAssessment.id,
              enrollmentId,
            });
          }}
          onEdit={() => {
            setColumnDialog(gradesAssessment.id);
          }}
          onClose={() => {
            setGradesColumn(null);
          }}
        />
      )}

      {columnDialog !== null && !confirmDelete && (columnDialog === 'create' || editing) && (
        <AssessmentDialog
          key={columnDialog}
          {...(editing && { initial: editing })}
          suggestedTitle={suggestTitle}
          busy={book.createColumn.isPending || book.updateColumn.isPending}
          error={book.createColumn.error ?? book.updateColumn.error}
          onClose={closeColumnDialog}
          onSubmit={(values) => {
            if (editing)
              book.updateColumn.mutate(
                { id: editing.id, version: editing.version, ...values },
                { onSuccess: closeColumnDialog },
              );
            else book.createColumn.mutate(values, { onSuccess: closeColumnDialog });
          }}
          {...(editing && {
            onDelete: () => {
              setConfirmDelete(editing.id);
            },
          })}
        />
      )}
      <ConfirmDialog
        open={confirmDelete !== null}
        tone="error"
        title={uk.common.delete}
        description={uk.gradebook.assessment.deleteConfirm(
          data.assessments.find((x) => x.id === confirmDelete)?.title ?? '',
        )}
        confirmLabel={uk.common.delete}
        busy={book.deleteColumn.isPending}
        onClose={() => {
          setConfirmDelete(null);
        }}
        onConfirm={() => {
          if (confirmDelete)
            book.deleteColumn.mutate(confirmDelete, { onSuccess: closeColumnDialog });
        }}
      />

      {panel && (
        <StudentPanel
          student={data.students.find((s) => s.enrollmentId === panel.enrollmentId) ?? panel}
          data={full ?? data}
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
          defaultKind={defaultGradeKind(
            data.lessons.find((l) => l.id === sheet.lessonId)?.kind ?? data.load.kind,
          )}
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

import type { GradebookDto } from '@ge/shared';
import { Box, Tooltip } from '@mui/material';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useMemo, useRef } from 'react';

import { formatShortDate } from '../../shared/format';
import { uk } from '../../shared/i18n/uk';
import { gradeTone } from '../lesson/model';

import { cellText } from './model';

type Student = GradebookDto['students'][number];

const NAME_W = 196;
const INDEX_W = 36;
const CELL_W = 46;
const SUMMARY_W = 64;
const ROW_H = 30;
const BAND_H = 18;
const HEAD_H = 44;

export interface GridSelection {
  row: number;
  col: number;
}

const helper = createColumnHelper<Student>();

const TONE = { low: 'ge.grade.low', high: 'ge.grade.high', none: 'transparent' } as const;
const ATT = { ABSENT: 'absent', EXCUSED: 'excused', LATE: 'late' } as const;

/**
 * Журнал «студенти × заняття», як паперовий: закріплені № і ПІБ ліворуч, підсумки праворуч,
 * рядки віртуалізовані. Виділення й редагування обробляє батьківський компонент.
 */
export function GradebookGrid({
  data,
  selection,
  onSelect,
  onOpenStudent,
  onKeyDown,
}: {
  data: GradebookDto;
  selection: GridSelection;
  onSelect: (s: GridSelection) => void;
  onOpenStudent: (student: Student) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const scale = data.load.gradingRules.scale;

  const columns = useMemo(
    () => [
      helper.display({ id: 'index', header: '№' }),
      helper.accessor((s) => `${s.lastName} ${s.firstName}`, {
        id: 'name',
        header: uk.gradebook.student,
      }),
      ...data.lessons.map((l) => helper.display({ id: l.id, header: formatShortDate(l.date) })),
      helper.display({ id: 'average', header: uk.gradebook.average }),
      helper.display({ id: 'absences', header: uk.gradebook.absences }),
      helper.display({ id: 'forecast', header: uk.gradebook.forecast }),
    ],
    [data.lessons],
  );
  // TanStack Table повертає немемоізовані функції (відоме обмеження React Compiler); тут це безпечно:
  // таблиця використовується лише для моделі колонок і рядків.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: data.students, columns, getCoreRowModel: getCoreRowModel() });
  const rows = table.getRowModel().rows;

  const virtual = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_H,
    initialRect: { width: 1200, height: 600 },
    overscan: 8,
  });

  const lessonCount = data.lessons.length;
  const template = `${INDEX_W}px ${NAME_W}px repeat(${lessonCount}, ${CELL_W}px) ${SUMMARY_W}px ${SUMMARY_W + 28}px ${SUMMARY_W + 28}px`;
  const totalWidth = INDEX_W + NAME_W + lessonCount * CELL_W + SUMMARY_W * 3 + 56;
  const periodOf = (date: string) =>
    data.periods.find((p) => date >= p.startDate && date <= p.endDate);

  // Смуги періодів над датами: підряд ідучі заняття одного періоду
  const bands: { key: string; label: string; start: number; span: number }[] = [];
  data.lessons.forEach((l, i) => {
    const p = periodOf(l.date);
    if (!p) return;
    const last = bands[bands.length - 1];
    const key = `${p.kind}-${p.startDate}`;
    if (last?.key === key && last.start + last.span === i) last.span += 1;
    else bands.push({ key, label: uk.semesters.periodKinds[p.kind], start: i, span: 1 });
  });
  const hasBands = bands.length > 0;

  const sticky = (left: number, bg = 'background.paper') => ({
    position: 'sticky' as const,
    left,
    zIndex: 2,
    bgcolor: bg,
  });

  return (
    <Box
      ref={scroller}
      tabIndex={0}
      role="grid"
      aria-label={uk.gradebook.title}
      aria-rowcount={rows.length}
      onKeyDown={onKeyDown}
      sx={{
        overflow: 'auto',
        maxHeight: 'calc(100vh - 260px)',
        border: 1,
        borderColor: 'divider',
        borderRadius: '10px',
        bgcolor: 'background.paper',
        outline: 'none',
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
      }}
    >
      <Box sx={{ width: totalWidth, position: 'relative' }}>
        {/* Шапка */}
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 4,
            bgcolor: 'background.paper',
            borderBottom: 1,
            borderColor: 'ge.line2',
          }}
        >
          {hasBands && (
            <Box
              aria-hidden
              sx={{ display: 'grid', gridTemplateColumns: template, height: BAND_H }}
            >
              {bands.map((b) => (
                <Box
                  key={`${b.key}-${String(b.start)}`}
                  sx={{
                    gridColumn: `${b.start + 3} / span ${b.span}`,
                    bgcolor: 'ge.accentSoft',
                    color: 'primary.main',
                    fontSize: 10,
                    fontWeight: 600,
                    px: 0.75,
                    display: 'flex',
                    alignItems: 'center',
                    borderLeft: 1,
                    borderColor: 'ge.accentLine',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {b.label}
                </Box>
              ))}
            </Box>
          )}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: template,
              height: HEAD_H,
              fontSize: 11,
              color: 'ge.text3',
            }}
          >
            {table.getHeaderGroups()[0]?.headers.map((header, i) => {
              const lesson = data.lessons.find((l) => l.id === header.column.id);
              const period = lesson ? periodOf(lesson.date) : undefined;
              const left = i === 0 ? 0 : i === 1 ? INDEX_W : undefined;
              const content = (
                <Box
                  role="columnheader"
                  sx={{
                    px: 0.5,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: i < 2 ? 'flex-start' : 'center',
                    borderLeft: 1,
                    borderColor: 'divider',
                    bgcolor: period
                      ? 'ge.accentSoft'
                      : i > 1 + lessonCount
                        ? 'ge.surface2'
                        : 'background.paper',
                    color: period ? 'primary.main' : undefined,
                    fontVariantNumeric: 'tabular-nums',
                    opacity: lesson?.status === 'PLANNED' ? 0.7 : 1,
                    ...(left !== undefined ? sticky(left) : {}),
                  }}
                >
                  <strong>{String(header.column.columnDef.header)}</strong>
                  {lesson && <span>{uk.loads.kindsShort[lesson.kind]}</span>}
                </Box>
              );
              return lesson?.topic ? (
                <Tooltip key={header.id} title={lesson.topic} placement="top">
                  {content}
                </Tooltip>
              ) : (
                <Box key={header.id} sx={{ display: 'contents' }}>
                  {content}
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Рядки (віртуалізовані) */}
        <Box sx={{ height: virtual.getTotalSize(), position: 'relative' }}>
          {virtual.getVirtualItems().map((item) => {
            const student = rows[item.index]?.original;
            if (!student) return null;
            const inactive = student.enrollmentStatus !== 'ACTIVE';
            const s = student.summary;
            const rowSelected = selection.row === item.index;
            const rowBg = rowSelected
              ? 'ge.sunken'
              : item.index % 2 === 1
                ? 'ge.surface2'
                : 'background.paper';
            return (
              <Box
                key={student.enrollmentId}
                role="row"
                aria-rowindex={item.index + 1}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: template,
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: ROW_H,
                  transform: `translateY(${item.start}px)`,
                  borderBottom: 1,
                  borderColor: 'divider',
                  alignItems: 'stretch',
                  opacity: inactive ? 0.55 : 1,
                  bgcolor: rowBg,
                }}
              >
                <Box
                  sx={{
                    ...sticky(0, rowBg),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'ge.text3',
                    fontSize: 12,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {item.index + 1}
                </Box>
                <Box
                  component="button"
                  type="button"
                  onClick={() => {
                    onOpenStudent(student);
                  }}
                  sx={{
                    ...sticky(INDEX_W, rowBg),
                    border: 0,
                    borderRight: 1,
                    borderColor: 'divider',
                    textAlign: 'left',
                    px: 1,
                    font: 'inherit',
                    fontSize: 13,
                    cursor: 'pointer',
                    color: s.risk.length > 0 ? 'ge.errFg' : 'text.primary',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {student.lastName} {student.firstName[0]}.
                </Box>
                {data.lessons.map((lesson, col) => {
                  const cell = student.cells[lesson.id];
                  const selected = selection.row === item.index && selection.col === col;
                  const first = cell?.grades[0];
                  const att =
                    cell && cell.attendance && cell.attendance !== 'PRESENT'
                      ? ATT[cell.attendance]
                      : null;
                  const planned = lesson.status === 'PLANNED';
                  const bg = att
                    ? `ge.att.${att}.bg`
                    : first
                      ? TONE[gradeTone(scale, first.value)]
                      : planned
                        ? 'ge.surface2'
                        : 'transparent';
                  const tipLines = cell
                    ? [
                        ...(att ? [uk.lesson.attendance[cell.attendance ?? 'PRESENT']] : []),
                        ...cell.grades.map(
                          (g) =>
                            `${uk.lesson.gradeKinds[g.kind]}: ${String(g.value)}${g.comment ? ` — ${g.comment}` : ''}`,
                        ),
                      ]
                    : [];
                  const cellBox = (
                    <Box
                      key={lesson.id}
                      role="gridcell"
                      aria-selected={selected}
                      aria-label={uk.gradebook.cellLabel(
                        `${student.lastName} ${student.firstName}`,
                        formatShortDate(lesson.date),
                      )}
                      data-testid={`cell-${item.index}-${col}`}
                      onClick={() => {
                        onSelect({ row: item.index, col });
                      }}
                      sx={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderLeft: 1,
                        borderColor: 'divider',
                        cursor: 'cell',
                        bgcolor: bg,
                        fontVariantNumeric: 'tabular-nums',
                        fontSize: att ? 12 : 13,
                        fontWeight: att ? 700 : cell?.grades.length ? 500 : 400,
                        color: att ? `ge.att.${att}.fg` : 'text.primary',
                        boxShadow: selected
                          ? 'inset 0 0 0 2px var(--mui-palette-primary-main)'
                          : 'none',
                        zIndex: selected ? 1 : 0,
                      }}
                    >
                      {cellText(cell, uk.lesson.attendanceShort)}
                    </Box>
                  );
                  if (tipLines.length === 0) return cellBox;
                  return (
                    <Tooltip
                      key={lesson.id}
                      placement="top"
                      title={
                        <>
                          <strong>
                            {formatShortDate(lesson.date)} · {uk.loads.kinds[lesson.kind]}
                          </strong>
                          {tipLines.map((l) => (
                            <div key={l}>{l}</div>
                          ))}
                        </>
                      }
                    >
                      {cellBox}
                    </Tooltip>
                  );
                })}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderLeft: 1,
                    borderColor: 'divider',
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 600,
                    fontSize: 13,
                    color: s.average !== null && s.average < 4 ? 'ge.errFg' : 'text.primary',
                  }}
                >
                  {s.average === null ? uk.common.none : s.average.toFixed(1).replace('.', ',')}
                </Box>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderLeft: 1,
                    borderColor: 'divider',
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: 13,
                  }}
                >
                  {s.absences.unexcused}
                  {s.absences.excused > 0 && (
                    <Box component="span" sx={{ ml: 0.5, fontSize: 12, color: 'ge.text3' }}>
                      ({s.absences.excused} {uk.gradebook.excusedShort})
                    </Box>
                  )}
                </Box>
                <Tooltip title={s.proposal.explanation} placement="left">
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderLeft: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <Box
                      component="span"
                      className="tnum"
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 34,
                        height: 22,
                        px: 0.75,
                        borderRadius: '4px',
                        fontSize: 13,
                        fontWeight: 600,
                        ...(s.proposal.value === 'NA'
                          ? { bgcolor: 'ge.grade.naBg', color: 'ge.grade.naFg' }
                          : {
                              bgcolor: TONE[gradeTone(scale, s.proposal.value)],
                            }),
                      }}
                    >
                      {s.proposal.value === 'NA' ? 'н/а' : s.proposal.value}
                    </Box>
                  </Box>
                </Tooltip>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

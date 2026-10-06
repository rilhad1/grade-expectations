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

const NAME_W = 220;
const INDEX_W = 40;
const CELL_W = 72;
const SUMMARY_W = 88;
const ROW_H = 40;
const HEAD_H = 56;

export interface GridSelection {
  row: number;
  col: number;
}

const helper = createColumnHelper<Student>();

const TONE = { low: '#f3d9d6', high: '#d9ecd9', none: 'transparent' } as const;

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
  const template = `${INDEX_W}px ${NAME_W}px repeat(${lessonCount}, ${CELL_W}px) ${SUMMARY_W}px ${SUMMARY_W + 16}px ${SUMMARY_W}px`;
  const totalWidth = INDEX_W + NAME_W + lessonCount * CELL_W + SUMMARY_W * 3 + 16;
  const periodOf = (date: string) =>
    data.periods.find((p) => date >= p.startDate && date <= p.endDate);

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
            display: 'grid',
            gridTemplateColumns: template,
            height: HEAD_H,
            position: 'sticky',
            top: 0,
            zIndex: 4,
            bgcolor: 'background.paper',
            borderBottom: 1,
            borderColor: 'divider',
            fontSize: 12,
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
                  bgcolor: period ? '#e9eef6' : 'background.paper',
                  fontVariantNumeric: 'tabular-nums',
                  opacity: lesson?.status === 'PLANNED' ? 0.7 : 1,
                  ...(left !== undefined ? sticky(left) : {}),
                }}
              >
                <strong>{String(header.column.columnDef.header)}</strong>
                {lesson && (
                  <span>
                    {uk.loads.kindsShort[lesson.kind]} · {lesson.pairNumber}
                  </span>
                )}
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

        {/* Рядки (віртуалізовані) */}
        <Box sx={{ height: virtual.getTotalSize(), position: 'relative' }}>
          {virtual.getVirtualItems().map((item) => {
            const student = rows[item.index]?.original;
            if (!student) return null;
            const inactive = student.enrollmentStatus !== 'ACTIVE';
            const s = student.summary;
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
                }}
              >
                <Box
                  sx={{
                    ...sticky(0),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'text.secondary',
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
                    ...sticky(INDEX_W),
                    border: 0,
                    borderRight: 1,
                    borderColor: 'divider',
                    textAlign: 'left',
                    px: 1,
                    font: 'inherit',
                    cursor: 'pointer',
                    color: s.risk.length > 0 ? 'error.main' : 'text.primary',
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
                  const bg = first ? TONE[gradeTone(scale, first.value)] : 'transparent';
                  return (
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
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderLeft: 1,
                        borderColor: 'divider',
                        cursor: 'cell',
                        bgcolor: bg,
                        fontVariantNumeric: 'tabular-nums',
                        fontSize: 14,
                        fontWeight: cell?.grades.length ? 600 : 400,
                        color:
                          cell?.attendance === 'ABSENT'
                            ? '#8c2f27'
                            : cell?.attendance === 'EXCUSED'
                              ? '#7a5200'
                              : cell?.attendance === 'LATE'
                                ? '#1d4e89'
                                : 'text.primary',
                        outline: selected ? '2px solid' : 'none',
                        outlineColor: 'primary.main',
                        outlineOffset: -2,
                      }}
                    >
                      {cellText(cell, uk.lesson.attendanceShort)}
                    </Box>
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
                  }}
                >
                  {s.absences.unexcused} ({s.absences.excused})
                </Box>
                <Tooltip title={s.proposal.explanation} placement="left">
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderLeft: 1,
                      borderColor: 'divider',
                      fontVariantNumeric: 'tabular-nums',
                      color: s.proposal.value === 'NA' ? 'error.main' : 'text.primary',
                    }}
                  >
                    {s.proposal.value === 'NA' ? 'н/а' : s.proposal.value}
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

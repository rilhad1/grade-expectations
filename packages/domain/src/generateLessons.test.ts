import { describe, expect, it } from 'vitest';

import { generateLessons, lessonKey } from './generateLessons.js';
import type { ExistingLesson, ScheduleSlotInput, SemesterInput } from './types.js';

const semester: SemesterInput = {
  startDate: '2026-09-01',
  endDate: '2026-09-30',
  firstWeekParity: 'TOP',
  parityAfterBreak: 'CONTINUE',
  periods: [],
};

const slot = (id: string, o: Partial<ScheduleSlotInput> = {}): ScheduleSlotInput => ({
  id,
  loadId: 'load1',
  weekday: 1, // понеділок
  pairNumber: 2,
  parity: 'EVERY',
  roomId: 'r1',
  validFrom: '2026-09-01',
  validTo: null,
  ...o,
});

const dates = (r: ReturnType<typeof generateLessons>) => r.create.map((l) => l.date);

describe('generateLessons', () => {
  it('EVERY: кожен понеділок семестру', () => {
    const r = generateLessons(semester, { version: 1, slots: [slot('s1')] }, []);
    expect(dates(r)).toEqual(['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28']);
    expect(r.create[0]).toMatchObject({
      loadId: 'load1',
      slotId: 's1',
      pairNumber: 2,
      roomId: 'r1',
      scheduleVersion: 1,
    });
  });

  it('TOP дає заняття лише у верхні тижні, BOTTOM — лише в нижні', () => {
    // 31.08 TOP; 7.09 BOTTOM; 14.09 TOP; 21.09 BOTTOM; 28.09 TOP
    const top = generateLessons(
      semester,
      { version: 1, slots: [slot('s1', { parity: 'TOP', weekday: 2 })] },
      [],
    );
    expect(dates(top)).toEqual(['2026-09-01', '2026-09-15', '2026-09-29']);
    const bottom = generateLessons(
      semester,
      { version: 1, slots: [slot('s1', { parity: 'BOTTOM' })] },
      [],
    );
    expect(dates(bottom)).toEqual(['2026-09-07', '2026-09-21']);
  });

  it('пропускає канікули й свята', () => {
    const r = generateLessons(
      {
        ...semester,
        periods: [{ kind: 'HOLIDAY', startDate: '2026-09-14', endDate: '2026-09-20' }],
      },
      { version: 1, slots: [slot('s1')] },
      [],
    );
    expect(dates(r)).toEqual(['2026-09-07', '2026-09-21', '2026-09-28']);
  });

  it('враховує validFrom і validTo', () => {
    const r = generateLessons(
      semester,
      { version: 1, slots: [slot('s1', { validFrom: '2026-09-10', validTo: '2026-09-21' })] },
      [],
    );
    expect(dates(r)).toEqual(['2026-09-14', '2026-09-21']);
  });

  it('повторний запуск ідемпотентний', () => {
    const schedule = { version: 1, slots: [slot('s1')] };
    const first = generateLessons(semester, schedule, []);
    const existing: ExistingLesson[] = first.create.map((l, i) => ({
      id: `e${i}`,
      loadId: l.loadId,
      slotId: l.slotId,
      date: l.date,
      pairNumber: l.pairNumber,
      status: 'PLANNED',
      hasMarks: false,
      manuallyEdited: false,
    }));
    const second = generateLessons(semester, schedule, existing);
    expect(second.create).toEqual([]);
    expect(second.cancel).toEqual([]);
    expect(second.keep).toHaveLength(first.create.length);
  });

  describe('регенерація після зміни шаблону', () => {
    const existing = (o: Partial<ExistingLesson> = {}): ExistingLesson => ({
      id: 'e1',
      loadId: 'load1',
      slotId: 's1',
      date: '2026-09-07',
      pairNumber: 2,
      status: 'PLANNED',
      hasMarks: false,
      manuallyEdited: false,
      ...o,
    });
    const emptySchedule = { version: 2, slots: [] as ScheduleSlotInput[] };

    it('скасовує застарілі заплановані заняття без відміток', () => {
      expect(generateLessons(semester, emptySchedule, [existing()]).cancel).toEqual(['e1']);
    });

    it.each([
      ['проведене', { status: 'HELD' as const }],
      ['з відмітками', { hasMarks: true }],
      ['змінене вручну', { manuallyEdited: true }],
      ['додаткова пара', { slotId: null }],
      ['скасоване', { status: 'CANCELLED' as const }],
    ])('ніколи не чіпає заняття: %s', (_name, override) => {
      const r = generateLessons(semester, emptySchedule, [existing(override)]);
      expect(r.cancel).toEqual([]);
      expect(r.keep).toEqual(['e1']);
    });

    it('з today не скасовує минулі заняття і не створює минулі', () => {
      const r = generateLessons(
        semester,
        { version: 2, slots: [slot('s1')] },
        [existing({ date: '2026-09-07', loadId: 'old' })],
        { today: '2026-09-15' },
      );
      expect(r.cancel).toEqual([]);
      expect(dates(r)).toEqual(['2026-09-21', '2026-09-28']);
    });

    it('перенесене заняття (інша дата) не дублюється на місці оригіналу, якщо ключ збігається', () => {
      const r = generateLessons(semester, { version: 1, slots: [slot('s1')] }, [existing()]);
      expect(
        r.create.some((l) => lessonKey(l.loadId, l.date, l.pairNumber) === 'load1|2026-09-07|2'),
      ).toBe(false);
    });
  });

  it('сесія одного курсу не скасовує пари інших курсів', () => {
    const semester = {
      startDate: '2026-12-07',
      endDate: '2026-12-23',
      firstWeekParity: 'TOP' as const,
      parityAfterBreak: 'CONTINUE' as const,
      periods: [
        {
          kind: 'EXAM_SESSION' as const,
          startDate: '2026-12-14',
          endDate: '2026-12-23',
          course: 2,
        },
      ],
    };
    const slots = [
      {
        id: 's1',
        loadId: 'first',
        weekday: 1,
        pairNumber: 1,
        parity: 'EVERY' as const,
        roomId: null,
        validFrom: '2026-12-07',
        validTo: null,
      },
      {
        id: 's2',
        loadId: 'second',
        weekday: 1,
        pairNumber: 2,
        parity: 'EVERY' as const,
        roomId: null,
        validFrom: '2026-12-07',
        validTo: null,
      },
    ];
    const loadCourses = new Map([
      ['first', 1],
      ['second', 2],
    ]);
    const { create } = generateLessons(semester, { version: 1, slots }, [], { loadCourses });
    const dates = (load: string) => create.filter((l) => l.loadId === load).map((l) => l.date);
    // Перший курс вчиться до кінця семестру, другий — лише до початку сесії
    expect(dates('first')).toEqual(['2026-12-07', '2026-12-14', '2026-12-21']);
    expect(dates('second')).toEqual(['2026-12-07']);
    // Без відомостей про курс сесія з курсом блокує всім (як і раніше)
    const noCourses = generateLessons(semester, { version: 1, slots }, []).create;
    expect(noCourses.filter((l) => l.loadId === 'first').map((l) => l.date)).toEqual([
      '2026-12-07',
    ]);
  });
});

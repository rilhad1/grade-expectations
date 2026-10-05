import type { LoadDto, RoomDto, SlotDto } from '@ge/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { uk } from '../../shared/i18n/uk';

import { ScheduleGrid } from './ScheduleGrid';

const load: LoadDto = {
  id: 'load1',
  semesterId: 's',
  kind: 'LAB',
  plannedHours: 32,
  controlForm: 'EXAM',
  gradingRules: {
    scale: 'TWELVE',
    weights: {},
    minGrades: 3,
    maxUnexcusedAbsencePercent: 50,
    rounding: 'HALF_UP',
    missedTest: 'IGNORE',
  },
  discipline: { id: 'd', title: 'Інформатика', shortTitle: 'Інформ.', color: '#3B6EA5' },
  group: { id: 'g', name: 'ПДт-12' },
  subgroup: { id: 'sg', name: '2 підгрупа' },
  teacher: { id: 't', fullName: 'Бойчук В.В.' },
  hours: { planned: 32, held: 0, forecast: 0, deficit: 32, extraPairsNeeded: 16 },
  version: 0,
};
const slot = (id: string, o: Partial<SlotDto> = {}): SlotDto => ({
  id,
  scheduleId: 'sc',
  loadId: 'load1',
  weekday: 1,
  pairNumber: 1,
  parity: 'EVERY',
  roomId: 'r1',
  validFrom: '2026-09-01',
  validTo: null,
  version: 0,
  ...o,
});
const room: RoomDto = { id: 'r1', name: '214', capacity: null, kind: null, version: 0 };
const bells = [
  { pairNumber: 1, startsAt: '08:30', endsAt: '09:50' },
  { pairNumber: 2, startsAt: '10:00', endsAt: '11:20' },
];

const setup = (over: Partial<Parameters<typeof ScheduleGrid>[0]> = {}) => {
  const onDrop = vi.fn();
  const onSelectSlot = vi.fn();
  render(
    <ScheduleGrid
      bells={bells}
      slots={[slot('s1')]}
      loadsById={new Map([[load.id, load]])}
      roomsById={new Map([[room.id, room]])}
      conflictSlotIds={new Set()}
      readOnly={false}
      onDrop={onDrop}
      onSelectSlot={onSelectSlot}
      {...over}
    />,
  );
  return { onDrop, onSelectSlot };
};

const payload = (kind: 'load' | 'slot', id: string) => ({
  dataTransfer: {
    getData: () => JSON.stringify({ kind, id }),
    setData: vi.fn(),
    effectAllowed: '',
  },
});

describe('ScheduleGrid', () => {
  it('показує дні, пари з часом і картку слота з викладачем та аудиторією', () => {
    setup();
    expect(screen.getByText('Пн')).toBeInTheDocument();
    expect(screen.getByText('08:30–09:50')).toBeInTheDocument();
    const card = screen.getByTestId('slot-s1');
    expect(card).toHaveTextContent('Інформ. · ЛР');
    expect(card).toHaveTextContent('ПДт-12 · 2 підгрупа');
    expect(card).toHaveTextContent('Бойчук В.В. · 214');
  });

  it('скидання навантаження на верхню половину → parity TOP; на заголовок → EVERY; на нижню → BOTTOM', () => {
    const { onDrop } = setup();
    fireEvent.drop(screen.getByTestId('zone-2-2-TOP'), payload('load', 'load1'));
    fireEvent.drop(screen.getByTestId('zone-3-1-EVERY'), payload('load', 'load1'));
    fireEvent.drop(screen.getByTestId('zone-4-2-BOTTOM'), payload('load', 'load1'));
    expect(onDrop).toHaveBeenNthCalledWith(1, { kind: 'load', id: 'load1' }, 2, 2, 'TOP');
    expect(onDrop).toHaveBeenNthCalledWith(2, { kind: 'load', id: 'load1' }, 3, 1, 'EVERY');
    expect(onDrop).toHaveBeenNthCalledWith(3, { kind: 'load', id: 'load1' }, 4, 2, 'BOTTOM');
  });

  it('перетягування існуючого слота передає kind=slot', () => {
    const { onDrop } = setup();
    fireEvent.drop(screen.getByTestId('zone-5-1-TOP'), payload('slot', 's1'));
    expect(onDrop).toHaveBeenCalledWith({ kind: 'slot', id: 's1' }, 5, 1, 'TOP');
  });

  it('слоти відображаються у зоні своєї періодичності', () => {
    setup({
      slots: [
        slot('top', { parity: 'TOP', weekday: 2, pairNumber: 2 }),
        slot('bottom', { parity: 'BOTTOM', weekday: 2, pairNumber: 2 }),
      ],
    });
    expect(screen.getByTestId('zone-2-2-TOP')).toContainElement(screen.getByTestId('slot-top'));
    expect(screen.getByTestId('zone-2-2-BOTTOM')).toContainElement(
      screen.getByTestId('slot-bottom'),
    );
  });

  it('конфліктний слот позначається', () => {
    setup({ conflictSlotIds: new Set(['s1']) });
    expect(screen.getByTestId('slot-s1')).toHaveAttribute('data-conflict', 'true');
  });

  it('клік по слоту відкриває його редагування', () => {
    const { onSelectSlot } = setup();
    fireEvent.click(screen.getByTestId('slot-s1'));
    expect(onSelectSlot).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }));
  });

  it('у режимі лише для читання скидання ігнорується, а слот не перетягується', () => {
    const { onDrop } = setup({ readOnly: true });
    fireEvent.drop(screen.getByTestId('zone-2-2-TOP'), payload('load', 'load1'));
    expect(onDrop).not.toHaveBeenCalled();
    expect(screen.getByTestId('slot-s1')).not.toHaveAttribute('draggable', 'true');
  });

  it('некоректний вміст перетягування ігнорується', () => {
    const { onDrop } = setup();
    fireEvent.drop(screen.getByTestId('zone-2-2-TOP'), {
      dataTransfer: { getData: () => 'не json' },
    });
    fireEvent.drop(screen.getByTestId('zone-2-2-TOP'), {
      dataTransfer: { getData: () => JSON.stringify({ kind: 'x', id: 1 }) },
    });
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('зони мають доступні назви з днем і парою', () => {
    setup();
    expect(
      screen.getByRole('group', {
        name: `Пн, 1 ${uk.builder.pairLabel}, ${uk.builder.parity.TOP}`,
      }),
    ).toBeInTheDocument();
  });
});

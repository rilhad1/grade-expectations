import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithClient } from '../../test/renderWithProviders';
import { uk } from '../i18n/uk';

import {
  ConfirmDialog,
  ControlFormBadge,
  EmptyState,
  GradeChip,
  LessonCard,
  ListSkeleton,
  ProgressBar,
  RoleBadge,
  SegmentedControl,
  StatCard,
  StatusChip,
  TableSkeleton,
  CardSkeleton,
  BottomSheet,
  PageHeader,
  disciplineTone,
} from '.';

const wrap = (ui: React.ReactElement) => renderWithClient(ui);

describe('StatusChip', () => {
  it('показує літеру статусу з підказкою; присутній за замовчуванням не показується', () => {
    wrap(
      <>
        <StatusChip status="ABSENT" />
        <StatusChip status="EXCUSED" />
        <StatusChip status="LATE" />
        <StatusChip status="PRESENT" />
      </>,
    );
    expect(screen.getByText('н')).toHaveAttribute('title', uk.lesson.attendance.ABSENT);
    expect(screen.getByText('нп')).toBeInTheDocument();
    expect(screen.getByText('з')).toBeInTheDocument();
    expect(screen.queryByText('✓')).not.toBeInTheDocument();
  });

  it('присутній із present показується галочкою', () => {
    wrap(<StatusChip status="PRESENT" present size="sm" />);
    expect(screen.getByText('✓')).toBeInTheDocument();
  });
});

describe('GradeChip', () => {
  it('число, підпис для заліку й службові стани', () => {
    wrap(
      <>
        <GradeChip value={9} ariaLabel="оцінка 9" />
        <GradeChip value={1} scale="PASS_FAIL" />
        <GradeChip value={7} state="pending" size="sm" />
        <GradeChip value={11} state="error" />
        <GradeChip value={5} state="conflict" label="5!" />
        <GradeChip value={5} state="editing" />
      </>,
    );
    expect(screen.getByLabelText('оцінка 9')).toHaveTextContent('9');
    expect(screen.getByText('зар.')).toBeInTheDocument();
    expect(screen.getByText('!')).toBeInTheDocument();
    expect(screen.getByText('5!')).toBeInTheDocument();
  });
});

describe('SegmentedControl', () => {
  it('позначає обраний варіант і повідомляє про вибір іншого', () => {
    const onChange = vi.fn();
    wrap(
      <SegmentedControl
        ariaLabel="Група"
        value="b"
        onChange={onChange}
        options={[
          { value: 'a', label: 'ПДт-11' },
          { value: 'b', label: 'ПДт-12' },
          { value: 'c', label: 'ПДт-13', disabled: true },
        ]}
      />,
    );
    expect(screen.getByRole('group', { name: 'Група' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ПДт-12' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'ПДт-11' }));
    expect(onChange).toHaveBeenCalledWith('a');
    fireEvent.click(screen.getByRole('button', { name: 'ПДт-12' })); // повторний клік не знімає вибір
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'ПДт-13' })).toBeDisabled();
  });
});

describe('бейджі', () => {
  it('роль і форма контролю', () => {
    wrap(
      <>
        <RoleBadge role="TEACHER" />
        <RoleBadge role="MODERATOR" />
        <ControlFormBadge form="EXAM" />
        <ControlFormBadge form="CREDIT" />
      </>,
    );
    expect(screen.getByText(uk.roles.TEACHER)).toBeInTheDocument();
    expect(screen.getByText(uk.roles.MODERATOR)).toBeInTheDocument();
    expect(screen.getByText(uk.loads.controlForms.EXAM)).toBeInTheDocument();
    expect(screen.getByText(uk.loads.controlForms.CREDIT)).toBeInTheDocument();
  });
});

describe('LessonCard', () => {
  it('показує назву, вид, рядки, тег і реагує на клік', () => {
    const onClick = vi.fn();
    wrap(
      <LessonCard
        color="#4C6A92"
        title="Інформатика"
        kind="ПР"
        meta={['ПДт-12 · ауд. 214']}
        state="current"
        tag={{ label: 'Триває', tone: 'ok' }}
        onClick={onClick}
        ariaLabel="Інформатика, ПДт-12"
      />,
    );
    const card = screen.getByRole('button', { name: 'Інформатика, ПДт-12' });
    expect(card).toHaveTextContent('ПР');
    expect(card).toHaveTextContent('ПДт-12 · ауд. 214');
    expect(card).toHaveTextContent('Триває');
    fireEvent.click(card);
    expect(onClick).toHaveBeenCalled();
  });

  it('скасована картка без обробника не є кнопкою, що натискається', () => {
    wrap(<LessonCard color="#7A5C8C" title="Осн. програмування" state="cancelled" />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});

describe('disciplineTone', () => {
  it('рахує заливку й межу змішуванням із поверхнею', () => {
    const tone = disciplineTone('#3D7A72');
    expect(tone.solid).toBe('#3D7A72');
    expect(tone.tint).toContain('color-mix');
    expect(tone.border).toContain('#3D7A72');
  });
});

describe('показники й порожні стани', () => {
  it('StatCard, ProgressBar і PageHeader', () => {
    wrap(
      <>
        <PageHeader
          title="Вичитка годин"
          subtitle="станом на 5 жовт."
          actions={<button>дія</button>}
        />
        <StatCard label="План" value={306} suffix="год" />
        <StatCard label="Нестача" value="−4" tone="warn" />
        <ProgressBar value={1.4} label="Прогрес" />
      </>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Вичитка годин' })).toBeInTheDocument();
    expect(screen.getByText('станом на 5 жовт.')).toBeInTheDocument();
    expect(screen.getByText('306')).toBeInTheDocument();
    // значення прогресу обмежене діапазоном 0–100
    expect(screen.getByRole('progressbar', { name: 'Прогрес' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
  });

  it('EmptyState з дією', () => {
    wrap(
      <EmptyState
        title="Порожньо"
        description="Нічого немає"
        action={<button>Створити</button>}
        icon={<span>i</span>}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Порожньо' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Створити' })).toBeInTheDocument();
  });

  it('скелетони позначені як завантаження', () => {
    wrap(
      <>
        <CardSkeleton label="картка" />
        <ListSkeleton rows={2} label="список" />
        <TableSkeleton rows={2} cols={3} label="таблиця" />
      </>,
    );
    for (const name of ['картка', 'список', 'таблиця']) {
      expect(screen.getByLabelText(name)).toHaveAttribute('aria-busy', 'true');
    }
  });
});

describe('діалоги', () => {
  it('ConfirmDialog підтверджує й скасовує', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    wrap(
      <ConfirmDialog
        open
        title="Видалити?"
        description="Дію не можна скасувати"
        confirmLabel="Видалити"
        tone="error"
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Видалити?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Видалити' }));
    expect(onConfirm).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: uk.common.cancel }));
    expect(onClose).toHaveBeenCalled();
  });

  it('BottomSheet має доступну назву й показує вміст', () => {
    render(
      <BottomSheet open onClose={() => undefined} ariaLabel="Оцінка" title="Оцінка · 5 жовт.">
        <button>10</button>
      </BottomSheet>,
    );
    expect(screen.getByRole('dialog', { name: 'Оцінка' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '10' })).toBeInTheDocument();
  });
});

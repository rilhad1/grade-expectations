import type { AttestationSheetDto, LoadAttestationsDto } from '@ge/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { uk } from '../../shared/i18n/uk';
import { renderWithClient } from '../../test/renderWithProviders';

const api = vi.hoisted(() => ({
  fetchLoadAttestations: vi.fn(),
  fetchSheet: vi.fn(),
  saveResults: vi.fn(),
  createDocument: vi.fn(),
  fetchDocument: vi.fn(),
  documentFileUrl: (id: string) => `/api/v1/documents/${id}/file`,
}));
vi.mock('../../api/attestations', () => api);
vi.mock('../../shared/ui/links', () => ({
  LinkBase: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
}));
vi.mock('../../app/useMe', () => ({ useMe: () => ({ data: { features: { pdf: true } } }) }));

const { AttestationScreen } = await import('./AttestationScreen');
const t = uk.attestations;

const load = {
  id: 'load1',
  kind: 'LECTURE',
  controlForm: 'EXAM',
  gradingRules: {
    scale: 'TWELVE',
    weights: { TEST: 2, PRACTICE: 1, LAB: 1, ORAL: 0.5 },
    minGrades: 3,
    maxUnexcusedAbsencePercent: 30,
    rounding: 'HALF_UP',
    missedTest: 'IGNORE',
  },
  discipline: { id: 'd', title: 'Інформатика', shortTitle: 'Інф', color: '#3B6EA5' },
  group: { id: 'g', name: 'ПДт-12' },
  subgroup: null,
} as unknown as LoadAttestationsDto['load'];

const modules = (confirmed = 0): LoadAttestationsDto => ({
  load,
  modules: [
    {
      id: 'a1',
      semesterId: 's',
      kind: 'INTERIM',
      course: 1,
      dateFrom: '2026-10-12',
      dateTo: '2026-10-16',
      total: 2,
      confirmed,
    },
    {
      id: 'a2',
      semesterId: 's',
      kind: 'AVERAGE',
      course: 1,
      dateFrom: '2026-09-01',
      dateTo: '2026-12-28',
      total: 2,
      confirmed: 0,
    },
  ],
});

const student = (id: string, last: string, proposal: string, final: string | null = null) => ({
  enrollmentId: id,
  studentId: id,
  lastName: last,
  firstName: 'Тест',
  middleName: null,
  enrollmentStatus: 'ACTIVE' as const,
  proposal: { text: proposal, isNa: proposal === 'н/а', explanation: `пояснення ${last}` },
  average: 9,
  gradesCount: 3,
  absencePercent: 10,
  result: final === null ? null : { final, comment: null, confirmed: true, version: 0 },
});

const sheet = (students: AttestationSheetDto['students']): AttestationSheetDto => ({
  attestation: {
    id: 'a1',
    semesterId: 's',
    kind: 'INTERIM',
    course: 1,
    dateFrom: '2026-10-12',
    dateTo: '2026-10-16',
  },
  load: {
    id: 'load1',
    kind: 'LECTURE',
    controlForm: 'EXAM',
    scale: 'TWELVE',
    disciplineTitle: 'Інформатика',
    groupName: 'ПДт-12',
    subgroupName: null,
    teacherName: 'Бойчук',
  },
  range: { from: '2026-09-01', to: '2026-10-16' },
  students,
});

const pending = () => sheet([student('e1', 'Бондар', '11'), student('e2', 'Мельник', 'н/а')]);
const confirmedSheet = () =>
  sheet([student('e1', 'Бондар', '11', '11'), student('e2', 'Мельник', 'н/а', 'н/а')]);

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchLoadAttestations.mockResolvedValue(modules());
  api.fetchSheet.mockResolvedValue(pending());
});

describe('AttestationScreen', () => {
  it('показує модулі з прогресом і пропозиції з поясненнями', async () => {
    renderWithClient(<AttestationScreen loadId="load1" />);
    expect(await screen.findByText('Бондар Тест')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: new RegExp(t.modules.INTERIM) })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: new RegExp(t.modules.AVERAGE) })).toBeInTheDocument();
    expect(screen.getAllByText('пояснення Бондар').length).toBeGreaterThan(0);
    // значення поля за замовчуванням — пропозиція
    expect(screen.getByLabelText(`${t.grade}: Бондар`)).toHaveValue('11');
    expect(screen.getByLabelText(`${t.grade}: Мельник`)).toHaveValue('н/а');
  });

  it('«Прийняти всі пропозиції» підтверджує кожного значенням пропозиції', async () => {
    api.saveResults.mockResolvedValue(confirmedSheet());
    renderWithClient(<AttestationScreen loadId="load1" />);
    await screen.findByText('Бондар Тест');
    fireEvent.click(screen.getByRole('button', { name: t.acceptAll }));
    await waitFor(() => {
      expect(api.saveResults).toHaveBeenCalledWith('load1', 'INTERIM', [
        { enrollmentId: 'e1', final: '11', comment: null, confirmed: true },
        { enrollmentId: 'e2', final: 'н/а', comment: null, confirmed: true },
      ]);
    });
    expect(await screen.findByRole('checkbox', { name: `${t.checked}: Бондар` })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: `${t.checked}: Мельник` })).toBeChecked();
  });

  it('редагована оцінка підтверджується окремо; некоректна блокує кнопку', async () => {
    api.saveResults.mockResolvedValue(pending());
    renderWithClient(<AttestationScreen loadId="load1" />);
    await screen.findByText('Бондар Тест');
    const input = screen.getByLabelText(`${t.grade}: Бондар`);
    const row = input.closest('tr');
    if (!row) throw new Error('немає рядка');

    fireEvent.change(input, { target: { value: '15' } });
    expect(within(row).getByRole('checkbox')).toBeDisabled();

    fireEvent.change(input, { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText(`${t.comment}: Бондар`), {
      target: { value: 'Відмінна КР' },
    });
    fireEvent.click(within(row).getByRole('checkbox'));
    await waitFor(() => {
      expect(api.saveResults).toHaveBeenCalledWith('load1', 'INTERIM', [
        { enrollmentId: 'e1', final: '10', comment: 'Відмінна КР', confirmed: true },
      ]);
    });
  });

  it('відомість доступна лише після підтвердження всіх; після генерації є посилання', async () => {
    api.fetchSheet.mockResolvedValue(pending());
    renderWithClient(<AttestationScreen loadId="load1" />);
    await screen.findByText('Бондар Тест');
    expect(screen.getByRole('button', { name: t.statementDocx })).toBeDisabled();
    expect(screen.getByText(t.needAll)).toBeInTheDocument();
  });

  it('створює відомість і показує готовий файл', async () => {
    api.fetchLoadAttestations.mockResolvedValue(modules(2));
    api.fetchSheet.mockResolvedValue(confirmedSheet());
    const doc = {
      id: 'doc1',
      kind: 'STATEMENT',
      format: 'DOCX',
      status: 'READY',
      fileName: 'Відомість.docx',
      error: null,
      createdAt: '2026-10-12T10:00:00.000Z',
    };
    api.createDocument.mockResolvedValue(doc);
    api.fetchDocument.mockResolvedValue(doc);
    renderWithClient(<AttestationScreen loadId="load1" />);
    await screen.findByText('Бондар Тест');
    fireEvent.click(screen.getByRole('button', { name: t.statementDocx }));
    await waitFor(() => {
      expect(api.createDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'STATEMENT',
          format: 'DOCX',
          loadId: 'load1',
          attestationKind: 'INTERIM',
        }),
      );
    });
    const link = await screen.findByRole('link', { name: new RegExp(uk.documents.download) });
    expect(link).toHaveAttribute('href', '/api/v1/documents/doc1/file');
    expect(screen.getByRole('button', { name: t.statementPdf })).toBeEnabled();
  });
});

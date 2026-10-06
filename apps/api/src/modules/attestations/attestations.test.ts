import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import {
  type AttestationSheetDto,
  type DocumentDto,
  type LoadAttestationsDto,
  type LoadDto,
} from '@ge/shared';
import type { FastifyInstance } from 'fastify';
import PizZip from 'pizzip';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';
import {
  buildTestApp,
  client,
  createOrganization,
  deleteOrganization,
  login,
  testEnv,
  testPrisma,
} from '../../test/helpers.js';

const prisma = testPrisma();
let app: FastifyInstance;
let pdfApp: FastifyInstance;
let gotenberg: Server;
let gotenbergFails = false;
let orgs: string[] = [];
let orgId = '';
let mod: ReturnType<typeof client>;
let teacher: ReturnType<typeof client>;
let teacher2: ReturnType<typeof client>;
let teacherCookie = '';
let teacherPdf: ReturnType<typeof client>;

const ids = {
  teacher: '',
  semesterId: '',
  examLoad: '',
  creditLoad: '',
  otherLoad: '',
  enrollments: [] as string[],
};

const lessonOn = async (date: string, loadId = ids.examLoad) => {
  const l = await prisma.lesson.findFirst({ where: { loadId, date: new Date(date) } });
  if (!l) throw new Error(`Немає заняття ${date}`);
  return l.id;
};
const grade = async (date: string, enrollmentId: string, value: number) =>
  teacher('POST', `/lessons/${await lessonOn(date)}/grades`, {
    enrollmentId,
    kind: 'PRACTICE',
    value,
  });
const sheet = async (kind: string, loadId = ids.examLoad) =>
  (await teacher<AttestationSheetDto>('GET', `/loads/${loadId}/attestations/${kind}`)).body;
const save = (kind: string, results: object[], loadId = ids.examLoad, who = teacher) =>
  who<AttestationSheetDto>('PUT', `/loads/${loadId}/attestations/${kind}/results`, { results });

const unzip = (buffer: Buffer) => new PizZip(buffer);

beforeAll(async () => {
  app = await buildTestApp();
  app.clock.today = () => '2026-09-01';

  const org = await createOrganization(prisma, 'att', {
    mod: ['MODERATOR'],
    teacher: ['TEACHER'],
    teacher2: ['TEACHER'],
  });
  orgs = [org.organizationId];
  orgId = org.organizationId;
  mod = client(app, await login(app, org.users['mod']?.email ?? ''));
  teacherCookie = await login(app, org.users['teacher']?.email ?? '');
  teacher = client(app, teacherCookie);
  teacher2 = client(app, await login(app, org.users['teacher2']?.email ?? ''));
  ids.teacher = org.users['teacher']?.id ?? '';

  await mod(
    'PUT',
    '/bells',
    [1, 2].map((n) => ({
      pairNumber: n,
      startsAt: `${String(7 + n).padStart(2, '0')}:30`,
      endsAt: `${String(8 + n).padStart(2, '0')}:50`,
    })),
  );
  const room = await mod<{ id: string }>('POST', '/rooms', { name: '214' });
  const year = await mod<{ id: string }>('POST', '/academic-years', {
    title: '2026/2027',
    startDate: '2026-09-01',
    endDate: '2027-06-30',
  });
  ids.semesterId = (
    await mod<{ id: string }>('POST', '/semesters', {
      academicYearId: year.body.id,
      number: 1,
      startDate: '2026-09-01',
      endDate: '2026-12-28',
      firstWeekParity: 'TOP',
      periods: [
        { kind: 'INTERIM_ATTESTATION', startDate: '2026-10-12', endDate: '2026-10-16' },
        { kind: 'EXAM_SESSION', startDate: '2026-12-15', endDate: '2026-12-28' },
      ],
    })
  ).body.id;
  await mod('POST', `/semesters/${ids.semesterId}/activate`);
  const cohort = await mod<{ id: string }>('POST', '/cohorts', {
    specialty: 'ПЗ',
    entryYear: 2026,
  });
  const groupId = (
    await mod<{ id: string }>('POST', '/groups', {
      cohortId: cohort.body.id,
      academicYearId: year.body.id,
      name: 'ПДт-12',
      course: 1,
    })
  ).body.id;
  for (const [lastName, firstName] of [
    ['Бондар', 'Максим'],
    ['Коваленко', 'Анна'],
    ['Мельник', 'Остап'],
  ]) {
    const s = await mod<{ enrollments: { id: string }[] }>('POST', '/students', {
      lastName,
      firstName,
      groupId,
      fromDate: '2026-09-01',
    });
    ids.enrollments.push(s.body.enrollments[0]?.id ?? '');
  }
  const disciplineId = (
    await mod<{ id: string }>('POST', '/disciplines', {
      title: 'Інформатика',
      shortTitle: 'Інф',
      color: '#3B6EA5',
    })
  ).body.id;
  const mk = async (teacherId: string, kind: string, controlForm: string) =>
    (
      await mod<LoadDto>('POST', '/loads', {
        semesterId: ids.semesterId,
        disciplineId,
        groupId,
        teacherId,
        kind,
        plannedHours: 40,
        controlForm,
      })
    ).body.id;
  ids.examLoad = await mk(ids.teacher, 'LECTURE', 'EXAM');
  ids.creditLoad = await mk(ids.teacher, 'PRACTICE', 'CREDIT');
  ids.otherLoad = await mk(org.users['teacher2']?.id ?? '', 'PRACTICE', 'CREDIT');

  const draft = await mod<{ id: string }>('POST', '/schedules', { semesterId: ids.semesterId });
  await mod('POST', `/schedules/${draft.body.id}/slots`, {
    loadId: ids.examLoad,
    weekday: 1,
    pairNumber: 1,
    roomId: room.body.id,
  });
  expect((await mod('POST', `/schedules/${draft.body.id}/publish`, {})).status).toBe(200);
  app.clock.today = () => '2026-11-09';

  // Друга інстанція з Gotenberg (локальний фейк) для PDF
  gotenberg = createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      if (gotenbergFails) {
        res.writeHead(500).end('boom');
      } else {
        res.writeHead(200, { 'content-type': 'application/pdf' }).end('%PDF-1.7 fake');
      }
    });
  });
  await new Promise<void>((resolve) => gotenberg.listen(0, '127.0.0.1', resolve));
  const port = (gotenberg.address() as AddressInfo).port;
  pdfApp = await buildApp({ ...testEnv(), GOTENBERG_URL: `http://127.0.0.1:${String(port)}` });
  pdfApp.clock.today = () => '2026-11-09';
  teacherPdf = client(pdfApp, await login(pdfApp, org.users['teacher']?.email ?? ''));
});

afterAll(async () => {
  await prisma.changeLog.deleteMany({ where: { organizationId: orgId } });
  for (const id of orgs) await deleteOrganization(prisma, id);
  await prisma.$disconnect();
  await app.close();
  await pdfApp.close();
  await new Promise((resolve) => gotenberg.close(resolve));
});

describe('модулі атестації', () => {
  it('набір модулів залежить від форми контролю; періоди беруться із семестру', async () => {
    const exam = await teacher<LoadAttestationsDto>('GET', `/loads/${ids.examLoad}/attestations`);
    expect(exam.status).toBe(200);
    expect(exam.body.modules.map((m) => m.kind)).toEqual([
      'INTERIM',
      'DIRECTOR_TEST',
      'AVERAGE',
      'EXAM',
    ]);
    expect(exam.body.modules[0]).toMatchObject({
      dateFrom: '2026-10-12',
      dateTo: '2026-10-16',
      total: 3,
      confirmed: 0,
    });
    // Директорська без свого періоду і середній — увесь семестр
    expect(exam.body.modules[2]).toMatchObject({ dateFrom: '2026-09-01', dateTo: '2026-12-28' });
    expect(exam.body.modules[3]).toMatchObject({ dateFrom: '2026-12-15', dateTo: '2026-12-28' });

    const credit = await teacher<LoadAttestationsDto>(
      'GET',
      `/loads/${ids.creditLoad}/attestations`,
    );
    expect(credit.body.modules.map((m) => m.kind)).toEqual(['INTERIM', 'DIRECTOR_TEST', 'AVERAGE']);
    expect((await sheetStatus('EXAM', ids.creditLoad)).status).toBe(422);
  });

  it('повторні запити не дублюють модулі семестру', async () => {
    await teacher('GET', `/loads/${ids.examLoad}/attestations`);
    expect(await prisma.attestation.count({ where: { semesterId: ids.semesterId } })).toBe(4);
  });
});

const sheetStatus = (kind: string, loadId: string) =>
  teacher('GET', `/loads/${loadId}/attestations/${kind}`);

describe('пропозиції', () => {
  it('рахуються за оцінками до кінця періоду; «н/а» з поясненням', async () => {
    const [a, b] = ids.enrollments;
    for (const [date, value] of [
      ['2026-09-07', 10],
      ['2026-09-14', 11],
      ['2026-09-21', 12],
    ] as const) {
      expect((await grade(date, a ?? '', value)).status).toBe(201);
    }
    expect((await grade('2026-09-07', b ?? '', 8)).status).toBe(201);
    // Після періоду проміжної атестації: на INTERIM не впливає, у AVERAGE враховується
    expect((await grade('2026-11-02', a ?? '', 5)).status).toBe(201);

    const interim = await sheet('INTERIM');
    expect(interim.range).toEqual({ from: '2026-09-01', to: '2026-10-16' });
    const first = interim.students.find((s) => s.enrollmentId === a);
    expect(first?.proposal).toMatchObject({ text: '11', isNa: false });
    expect(first?.proposal.explanation).toContain('середнє 11');
    const second = interim.students.find((s) => s.enrollmentId === b);
    expect(second?.proposal).toMatchObject({ text: 'н/а', isNa: true });
    expect(second?.proposal.explanation).toContain('замало оцінок');
    expect(first?.result).toBeNull();

    const average = await sheet('AVERAGE');
    expect(average.students.find((s) => s.enrollmentId === a)?.proposal.text).toBe('10');
  });
});

describe('підтвердження результатів', () => {
  it('перевіряє значення за шкалою й обов’язковість оцінки', async () => {
    const [a] = ids.enrollments;
    const bad = await save('INTERIM', [{ enrollmentId: a, final: '15', confirmed: true }]);
    expect(bad.status).toBe(422);
    expect(bad.body).toMatchObject({ code: 'INVALID_FINAL' });
    const empty = await save('INTERIM', [{ enrollmentId: a, final: null, confirmed: true }]);
    expect(empty.body).toMatchObject({ code: 'FINAL_REQUIRED' });
    const alien = await save('INTERIM', [
      { enrollmentId: '0190a000-0000-7000-8000-000000000000', final: '9', confirmed: true },
    ]);
    expect(alien.body).toMatchObject({ code: 'NOT_IN_ROSTER' });
    expect((await sheet('INTERIM')).students.every((s) => s.result === null)).toBe(true);
  });

  it('зберігає, підтверджує, фіксує в аудиті; чужі й деканат не пишуть', async () => {
    const [a, b] = ids.enrollments;
    const res = await save('INTERIM', [
      { enrollmentId: a, final: '11', confirmed: true },
      { enrollmentId: b, final: 'на', comment: 'не з’являвся', confirmed: false },
    ]);
    expect(res.status).toBe(200);
    expect(res.body.students.find((s) => s.enrollmentId === a)?.result).toMatchObject({
      final: '11',
      confirmed: true,
    });
    expect(res.body.students.find((s) => s.enrollmentId === b)?.result).toMatchObject({
      final: 'н/а',
      comment: 'не з’являвся',
      confirmed: false,
    });
    const logs = await prisma.changeLog.findMany({
      where: { organizationId: orgId, entity: 'AttestationResult' },
    });
    expect(logs).toHaveLength(2);

    // повтор без змін аудит не збільшує
    await save('INTERIM', [{ enrollmentId: a, final: '11', confirmed: true }]);
    expect(
      await prisma.changeLog.count({
        where: { organizationId: orgId, entity: 'AttestationResult' },
      }),
    ).toBe(2);

    const progress = await teacher<LoadAttestationsDto>(
      'GET',
      `/loads/${ids.examLoad}/attestations`,
    );
    expect(progress.body.modules[0]).toMatchObject({ confirmed: 1, total: 3 });

    expect(
      (
        await save(
          'INTERIM',
          [{ enrollmentId: a, final: '5', confirmed: true }],
          ids.examLoad,
          teacher2,
        )
      ).status,
    ).toBe(403);
    expect(
      (await save('INTERIM', [{ enrollmentId: a, final: '5', confirmed: true }], ids.examLoad, mod))
        .status,
    ).toBe(403);
    expect((await mod('GET', `/loads/${ids.examLoad}/attestations/INTERIM`)).status).toBe(200);
    expect((await teacher2('GET', `/loads/${ids.examLoad}/attestations/INTERIM`)).status).toBe(403);
  });

  it('закритий семестр доступний лише для читання', async () => {
    await prisma.semester.update({ where: { id: ids.semesterId }, data: { status: 'CLOSED' } });
    const res = await save('INTERIM', [
      { enrollmentId: ids.enrollments[0], final: '12', confirmed: true },
    ]);
    expect(res.body).toMatchObject({ code: 'SEMESTER_CLOSED' });
    await prisma.semester.update({ where: { id: ids.semesterId }, data: { status: 'ACTIVE' } });
  });
});

describe('відомості', () => {
  const poll = async (cli: ReturnType<typeof client>, id: string) => {
    for (let i = 0; i < 50; i++) {
      const res = await cli<DocumentDto>('GET', `/documents/${id}`);
      if (res.body.status !== 'PENDING') return res.body;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('Документ не сформувався');
  };

  it('без підтверджених оцінок відомість не створюється', async () => {
    const res = await teacher('POST', '/documents', {
      kind: 'STATEMENT',
      format: 'DOCX',
      loadId: ids.examLoad,
      attestationKind: 'INTERIM',
    });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'ATTESTATION_NOT_CONFIRMED' });
  });

  it('формує DOCX з даними студентів; файл доступний лише автору', async () => {
    await save(
      'INTERIM',
      ids.enrollments.map((enrollmentId, i) => ({
        enrollmentId,
        final: ['11', 'н/а', '7'][i] ?? '7',
        confirmed: true,
      })),
    );
    const created = await teacher<DocumentDto>('POST', '/documents', {
      kind: 'STATEMENT',
      format: 'DOCX',
      loadId: ids.examLoad,
      attestationKind: 'INTERIM',
    });
    expect(created.status).toBe(202);
    expect(created.body).toMatchObject({ status: 'PENDING', format: 'DOCX' });
    await app.jobs.idle();
    const doc = await poll(teacher, created.body.id);
    expect(doc).toMatchObject({ status: 'READY', error: null });
    expect(doc.fileName).toMatch(/\.docx$/);

    const file = await app.inject({
      method: 'GET',
      url: `/api/v1/documents/${created.body.id}/file`,
      headers: { cookie: teacherCookie },
    });
    expect(file.statusCode).toBe(200);
    expect(file.headers['content-type']).toContain('wordprocessingml');
    expect(String(file.headers['content-disposition'])).toContain("filename*=UTF-8''");
    const xml = unzip(file.rawPayload).file('word/document.xml')?.asText() ?? '';
    for (const text of [
      'Бондар Максим',
      'Коваленко Анна',
      'Мельник Остап',
      'Проміжна атестація',
      'ПДт-12',
      'Інформатика',
      '2026/2027, 1 семестр',
    ]) {
      expect(xml).toContain(text);
    }
    expect(xml).toContain('Оцінено: 2. Не атестовано (н/а): 1');

    expect((await teacher2('GET', `/documents/${created.body.id}`)).status).toBe(404);
    expect(
      (
        await teacher2('POST', '/documents', {
          kind: 'STATEMENT',
          format: 'DOCX',
          loadId: ids.examLoad,
          attestationKind: 'INTERIM',
        })
      ).status,
    ).toBe(404);
    const list = await teacher<{ items: DocumentDto[] }>('GET', '/documents');
    expect(list.body.items.map((d) => d.id)).toContain(created.body.id);

    // той самий id: повторний запит повертає наявний документ
    const again = await teacher<DocumentDto>('POST', '/documents', {
      id: created.body.id,
      kind: 'STATEMENT',
      format: 'DOCX',
      loadId: ids.examLoad,
      attestationKind: 'INTERIM',
    });
    expect(again.body.id).toBe(created.body.id);
  });

  it('PDF: без Gotenberg — 422; з Gotenberg — конвертація; збій сервера → FAILED', async () => {
    const body = {
      kind: 'STATEMENT',
      format: 'PDF',
      loadId: ids.examLoad,
      attestationKind: 'INTERIM',
    };
    const off = await teacher('POST', '/documents', body);
    expect(off.status).toBe(422);
    expect(off.body).toMatchObject({ code: 'PDF_NOT_CONFIGURED' });

    expect((await teacherPdf<{ features: { pdf: boolean } }>('GET', '/me')).body.features.pdf).toBe(
      true,
    );
    const ok = await teacherPdf<DocumentDto>('POST', '/documents', body);
    await pdfApp.jobs.idle();
    const ready = await poll(teacherPdf, ok.body.id);
    expect(ready).toMatchObject({ status: 'READY', format: 'PDF' });
    expect(ready.fileName).toMatch(/\.pdf$/);

    gotenbergFails = true;
    const bad = await teacherPdf<DocumentDto>('POST', '/documents', body);
    await pdfApp.jobs.idle();
    const failed = await poll(teacherPdf, bad.body.id);
    gotenbergFails = false;
    expect(failed).toMatchObject({ status: 'FAILED', error: 'Помилка формування' });
    const file = await teacherPdf('GET', `/documents/${bad.body.id}/file`);
    expect(file.status).toBe(409);
  });
});

describe('експорт даних', () => {
  it('архів містить навантаження, журнали й сирі дані', async () => {
    const created = await teacher<DocumentDto>('POST', '/documents', { kind: 'DATA_EXPORT' });
    expect(created.status).toBe(202);
    expect(created.body.format).toBe('ZIP');
    await app.jobs.idle();
    const file = await app.inject({
      method: 'GET',
      url: `/api/v1/documents/${created.body.id}/file`,
      headers: { cookie: teacherCookie },
    });
    expect(file.statusCode).toBe(200);
    const zip = unzip(file.rawPayload);
    const names = Object.keys(zip.files);
    expect(names).toContain('README.txt');
    expect(names).toContain('loads.json');
    const journal = names.find((n) => n.startsWith('journal-01'));
    expect(journal).toBeDefined();
    const csv = zip.file(journal ?? '')?.asText() ?? '';
    expect(csv).toContain('Бондар Максим');
    expect(csv).toContain('2026-09-07 п1');
    const loads = JSON.parse(zip.file('loads.json')?.asText() ?? '[]') as unknown[];
    expect(loads).toHaveLength(2); // лише навантаження цього викладача
    expect(names.some((n) => n.startsWith('raw-'))).toBe(true);
  });
});

describe('ICS-підписка', () => {
  it('токен у URL без сесії; ротація скасовує старе посилання', async () => {
    const feed = await teacher<{ path: string }>('GET', '/me/calendar');
    expect(feed.status).toBe(200);
    expect(feed.body.path).toMatch(/^\/api\/v1\/calendar\/[\w-]+\.ics$/);
    expect((await teacher<{ path: string }>('GET', '/me/calendar')).body.path).toBe(feed.body.path);

    const ics = await app.inject({ method: 'GET', url: feed.body.path });
    expect(ics.statusCode).toBe(200);
    expect(ics.headers['content-type']).toContain('text/calendar');
    expect(ics.body).toContain('BEGIN:VCALENDAR');
    expect(ics.body).toContain('SUMMARY:Інф · ПДт-12');
    expect(ics.body).toContain('LOCATION:214');
    expect(ics.body).toContain('DTSTART:20261109T083000');

    const otherFeed = await teacher2<{ path: string }>('GET', '/me/calendar');
    const otherIcs = await app.inject({ method: 'GET', url: otherFeed.body.path });
    expect(otherIcs.body).not.toContain('SUMMARY:Інф');

    const rotated = await teacher<{ path: string }>('POST', '/me/calendar/rotate');
    expect(rotated.body.path).not.toBe(feed.body.path);
    expect((await app.inject({ method: 'GET', url: feed.body.path })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: rotated.body.path })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/v1/calendar/abc.ics' })).statusCode).toBe(
      404,
    );
    expect(
      (await app.inject({ method: 'GET', url: '/api/v1/calendar/zzzzzzzzzzzzzzzzzzzz.ics' }))
        .statusCode,
    ).toBe(404);
  });

  it('вимагає входу для керування посиланням', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/v1/me/calendar' })).statusCode).toBe(401);
  });
});

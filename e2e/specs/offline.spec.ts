import { expect, test } from '@playwright/test';

import { login, users } from './helpers.js';

test.describe('офлайн «На парі»: зміни без мережі синхронізуються після її повернення', () => {
  test('відмітка й оцінка без інтернету → «Офлайн · N змін» → синхронізація на сервер', async ({
    page,
    context,
  }) => {
    await login(page, users.teacher);

    // Беремо пару наступного тижня, щоб не чіпати стан, який перевіряють інші сценарії
    const list = await page.request.get('/api/v1/lessons?from=2026-10-19&to=2026-10-19');
    const lessons = (await list.json()) as { id: string; discipline: { shortTitle: string } }[];
    const lessonId = lessons[0]?.id ?? '';
    expect(lessonId).not.toBe('');

    await page.goto(`/lessons/${lessonId}`);
    const rows = page.getByTestId(/^row-/);
    await expect(rows).toHaveCount(25);
    await expect(page.getByText('Присутні 25 з 25')).toBeVisible();

    await context.setOffline(true);
    await expect(page.getByRole('banner').getByRole('status')).toContainText('Офлайн');

    await rows.first().click(); // «н»
    await page
      .getByRole('button', { name: /Додати оцінку/ })
      .nth(1)
      .click();
    await page.getByRole('button', { name: '9', exact: true }).click();
    await expect(page.getByText('Присутні 24 з 25')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Усна 9' })).toBeVisible();
    await expect(page.getByRole('banner').getByRole('status')).toContainText(
      'Офлайн · 2 змін на пристрої',
    );

    // сервер змін ще не бачить
    await context.setOffline(false);
    await expect(page.getByRole('banner').getByRole('status')).toContainText('Синхронізовано', {
      timeout: 30_000,
    });

    const detail = await page.request.get(`/api/v1/lessons/${lessonId}`);
    const body = (await detail.json()) as {
      roster: { attendance: string; grades: { value: number }[] }[];
    };
    expect(body.roster.filter((r) => r.attendance === 'ABSENT')).toHaveLength(1);
    expect(body.roster.flatMap((r) => r.grades.map((g) => g.value))).toEqual([9]);

    // після перезавантаження (онлайн) стан збігається
    await page.reload();
    await expect(page.getByText('Присутні 24 з 25')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Усна 9' })).toBeVisible();
  });
});

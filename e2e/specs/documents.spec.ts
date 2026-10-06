import { expect, test } from '@playwright/test';

import { login, users } from './helpers.js';

test.describe.configure({ mode: 'serial' });

test.describe('атестація, відомість, календар і вичитка (сьогодні — 12 жовтня 2026)', () => {
  test('атестація: прийняти пропозиції, підтвердити всіх і отримати відомість DOCX', async ({
    page,
  }) => {
    await login(page, users.teacher);
    await page
      .getByRole('navigation', { name: 'Меню' })
      .getByRole('link', { name: 'Атестація' })
      .click();
    await expect(page.getByRole('heading', { name: 'Атестація' })).toBeVisible();
    await page
      .getByRole('link', { name: /Інформатика.*Лекція/ })
      .first()
      .click();
    await expect(page.getByRole('tab', { name: /Проміжна атестація/ })).toBeVisible();

    // у демо-даних ще немає оцінок, тому всі пропозиції — «н/а»
    await expect(page.getByLabel(/^Оцінка: /)).toHaveCount(25);
    await expect(page.getByRole('button', { name: 'Відомість DOCX' })).toBeDisabled();

    await page.getByRole('button', { name: 'Прийняти всі пропозиції' }).click();
    await expect(page.getByText('Підтверджено: 25 з 25')).toBeVisible();

    await page.getByRole('button', { name: 'Відомість DOCX' }).click();
    const link = page.getByRole('link', { name: /Завантажити/ });
    await expect(link).toBeVisible({ timeout: 30_000 });
    const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
    expect(download.suggestedFilename()).toMatch(/\.docx$/);

    // підтвердження переживає перезавантаження
    await page.reload();
    await expect(page.getByText('Підтверджено: 25 з 25')).toBeVisible();
  });

  test('календар: ICS-посилання працює без входу й перестає діяти після заміни', async ({
    page,
    request,
  }) => {
    await login(page, users.teacher);
    await page.getByRole('link', { name: 'Дані й календар' }).click();
    const field = page.getByLabel('Посилання на календар');
    await expect(field).toHaveValue(/\/api\/v1\/calendar\/[\w-]+\.ics$/);
    const url = await field.inputValue();

    const ics = await request.get(url);
    expect(ics.status()).toBe(200);
    expect(await ics.text()).toContain('BEGIN:VCALENDAR');

    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Створити нове посилання' }).click();
    await expect(field).not.toHaveValue(url);
    expect((await request.get(url)).status()).toBe(404);
  });

  test('експорт даних і звіт про вичитку', async ({ page }) => {
    await login(page, users.teacher);
    await page.getByRole('link', { name: 'Дані й календар' }).click();
    await page.getByRole('button', { name: 'Сформувати архів' }).click();
    const link = page.getByRole('link', { name: /Завантажити/ });
    await expect(link).toBeVisible({ timeout: 30_000 });
    const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
    expect(download.suggestedFilename()).toMatch(/\.zip$/);

    await page
      .getByRole('navigation', { name: 'Меню' })
      .getByRole('link', { name: 'Вичитка годин' })
      .click();
    await expect(page.getByRole('heading', { name: 'Вичитка годин' })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Вичитка годин' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Експорт у CSV' })).toBeEnabled();
  });
});

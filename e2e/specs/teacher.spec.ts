import { expect, test } from '@playwright/test';

import { login, users } from './helpers.js';

test.describe.configure({ mode: 'serial' });

test.describe('сценарії викладача (сьогодні — 12 жовтня 2026, 10:30)', () => {
  test('«Сьогодні»: поточна пара, події, вичитка', async ({ page }) => {
    await login(page, users.teacher);
    await expect(page.getByRole('heading', { name: 'Сьогодні' })).toBeVisible();
    await expect(page.getByText('Пара триває')).toBeVisible();
    await expect(page.getByText(/2 пара · 10:00–11:20/)).toBeVisible();
    await expect(page.getByRole('main').getByText('Інформатика', { exact: true })).toBeVisible();
    await expect(page.getByRole('main').getByText('ПДт-12', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Почати пару' })).toBeVisible();
    await expect(page.getByText('1-ша рубіжна атестація')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Вичитка годин' })).toBeVisible();
  });

  test('«На парі»: відмітка «н», оцінка, збереження після перезавантаження, завершення й скасування', async ({
    page,
  }) => {
    await login(page, users.teacher);
    await page.getByRole('link', { name: 'Почати пару' }).click();
    await expect(page.getByText('ПДт-12 · Інф')).toBeVisible();
    const rows = page.getByTestId(/^row-/);
    await expect(rows).toHaveCount(25);
    await expect(page.getByText('Присутні 25 з 25')).toBeVisible();

    await rows.first().click(); // тап → «н»
    await expect(page.getByText('Присутні 24 з 25')).toBeVisible();
    await expect(rows.first().getByText('н')).toBeVisible();

    await page
      .getByRole('button', { name: /Додати оцінку/ })
      .nth(1)
      .click(); // другий студент
    await page.getByRole('button', { name: '10', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Усна 10' })).toBeVisible();

    await page.reload(); // дані з сервера
    await expect(page.getByText('Присутні 24 з 25')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Усна 10' })).toBeVisible();

    await page.getByRole('button', { name: 'Завершити пару' }).click();
    await expect(page.getByText(/Присутні 24 з 25\. Виставлено оцінок: 1\./)).toBeVisible();
    await page.getByRole('button', { name: 'Скасувати завершення' }).click();
    await expect(page.getByRole('button', { name: 'Завершити пару' })).toBeVisible();
  });

  test('журнал: оцінка з клавіатури, «н», Delete; зміни переживають перезавантаження', async ({
    page,
  }) => {
    await login(page, users.teacher);
    await page.getByRole('link', { name: 'Журнал' }).click();
    await page
      .getByText(/Інформатика/)
      .first()
      .click();
    const grid = page.getByRole('grid');
    await expect(grid).toBeVisible();

    const first = page.getByTestId('cell-0-0');
    await first.click();
    await page.keyboard.press('9');
    await expect(first).toContainText('9');

    await page.getByTestId('cell-1-0').click();
    await page.keyboard.press('n'); // латинська розкладка теж ставить «н»
    await expect(page.getByTestId('cell-1-0')).toContainText('н');

    await page.reload();
    await expect(page.getByTestId('cell-0-0')).toContainText('9');
    await expect(page.getByTestId('cell-1-0')).toContainText('н');

    await page.getByTestId('cell-0-0').click();
    await page.keyboard.press('Delete');
    await expect(page.getByTestId('cell-0-0')).not.toContainText('9');
    await page.getByTestId('cell-1-0').click();
    await page.keyboard.press('Delete'); // знімає «н»
    await expect(page.getByTestId('cell-1-0')).not.toContainText('н');
  });

  test('журнал: колонка оцінювання — створити, виставити оцінку з клавіатури, перейменувати, видалити', async ({
    page,
  }) => {
    await login(page, users.teacher);
    await page.getByRole('link', { name: 'Журнал' }).click();
    await page
      .getByText(/Інформатика/)
      .first()
      .click();
    await expect(page.getByRole('grid')).toBeVisible();

    await page.getByRole('button', { name: '+ Колонка' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Назва')).toHaveValue('Практична 1');
    await dialog.getByRole('button', { name: 'Зберегти' }).click();
    await expect(dialog).toBeHidden();

    const header = page.getByRole('button', { name: 'Колонка: Практична 1' });
    await expect(header).toBeVisible();
    const cell = page.getByTestId(/^assessment-0-/);
    await cell.click();
    await page.keyboard.press('9');
    await expect(cell).toContainText('9');

    await page.reload();
    await expect(page.getByTestId(/^assessment-0-/)).toContainText('9');

    await page.getByRole('button', { name: 'Колонка: Практична 1' }).click();
    await page.getByRole('dialog').getByLabel('Назва').fill('Модуль 1');
    await page.getByRole('dialog').getByRole('button', { name: 'Зберегти' }).click();
    await expect(page.getByRole('button', { name: 'Колонка: Модуль 1' })).toBeVisible();

    await page.getByRole('button', { name: 'Колонка: Модуль 1' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Видалити' }).click();
    await page
      .getByRole('dialog')
      .filter({ hasText: 'Видалити колонку' })
      .getByRole('button', { name: 'Видалити' })
      .click();
    await expect(page.getByRole('button', { name: 'Колонка: Модуль 1' })).toHaveCount(0);
  });

  test('картка студента відкривається з журналу', async ({ page }) => {
    await login(page, users.teacher);
    await page.getByRole('link', { name: 'Журнал' }).click();
    await page
      .getByText(/Інформатика/)
      .first()
      .click();
    await page.getByRole('row').nth(1).getByRole('button').click();
    await expect(page.getByRole('complementary')).toContainText('Середній бал');
  });

  test('тематичний план: додати тему і зберегти', async ({ page }) => {
    await login(page, users.teacher);
    await page.getByRole('link', { name: 'Мої дисципліни' }).click();
    await page.getByRole('main').getByRole('link').first().click();
    await expect(page.getByRole('region', { name: 'Тематичний план' })).toBeVisible();

    await page.getByRole('button', { name: 'Додати тему' }).click();
    await page.getByLabel('Тема').last().fill('Нова тема з e2e');
    await page.getByRole('button', { name: 'Зберегти план' }).click();
    await expect(page.getByText('Тематичний план збережено')).toBeVisible();
    await expect(page.getByLabel('Тема').last()).toHaveValue('Нова тема з e2e');
  });

  test('правила оцінювання: ваги й поріг пропусків', async ({ page }) => {
    await login(page, users.teacher);
    await page.getByRole('link', { name: 'Мої дисципліни' }).click();
    await page.getByRole('main').getByRole('link').first().click();
    await page.getByLabel('Поріг неповажних пропусків, %', { exact: true }).fill('40');
    await expect(page.getByText(/понад 40%/)).toBeVisible();
    await page.getByRole('button', { name: 'Зберегти правила' }).click();
    await expect(page.getByText('Правила збережено')).toBeVisible();
  });
});

test.describe('запит на перенесення: викладач → деканат → розклад', () => {
  test('повний цикл', async ({ browser }) => {
    const opts = {
      locale: 'uk-UA',
      timezoneId: 'Europe/Kyiv',
      baseURL: 'http://localhost:5273',
    } as const;

    // Викладач подає запит на пару 19 жовтня
    const teacherCtx = await browser.newContext(opts);
    const teacher = await teacherCtx.newPage();
    await login(teacher, users.teacher);
    await teacher.getByRole('link', { name: 'Розклад', exact: true }).click();
    await teacher.getByRole('button', { name: 'Наступний тиждень' }).click();
    await teacher.getByRole('button', { name: 'Інформ. ПДт-12' }).first().click(); // понеділкова лекція
    await teacher.getByRole('menuitem', { name: 'Запит на перенесення' }).click();
    const dialog = teacher.getByRole('dialog');
    await dialog.getByLabel('Бажана дата').fill('2026-10-20');
    await dialog.getByLabel('Причина').fill('Відрядження на конференцію');
    await dialog.getByRole('button', { name: 'Надіслати запит' }).click();
    await expect(dialog.getByText('Запит надіслано деканату')).toBeVisible();
    await dialog.getByRole('button', { name: 'Готово' }).click();
    await expect(teacher.getByText(/Відрядження|Очікує/).first()).toBeVisible();

    // Деканат бачить лічильник і погоджує
    const deanCtx = await browser.newContext(opts);
    const dean = await deanCtx.newPage();
    await login(dean, users.dekanat);
    await expect(dean.getByRole('link', { name: /Запити/ })).toContainText('1');
    await dean.getByRole('link', { name: /Запити/ }).click();
    await dean
      .getByText(/Інформ\. · ПДт-12/)
      .first()
      .click();
    await expect(dean.getByText('Відрядження на конференцію')).toBeVisible();
    await dean.getByRole('button', { name: 'Погодити', exact: true }).click();
    await expect(dean.getByText('Запитів немає')).toBeVisible(); // список «Очікує» спорожнів

    // У розкладі викладача оригінал позначено «перенесено», нова пара з’явилась 20 жовтня
    await teacher.reload();
    await teacher.getByRole('button', { name: 'Наступний тиждень' }).click();
    await expect(teacher.getByText('перенесено')).toBeVisible();
    await expect(teacher.getByRole('button', { name: 'Інформ. ПДт-12' })).toHaveCount(4); // лекція (перенесена), 2 лаби й нова лекція

    await teacherCtx.close();
    await deanCtx.close();
  });
});

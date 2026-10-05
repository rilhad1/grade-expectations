import { expect, test } from '@playwright/test';

import { login, users } from './helpers.js';

test.describe.configure({ mode: 'serial' });

test.describe('сценарії деканату', () => {
  test('імпорт списку студентів з попереднім переглядом', async ({ page }) => {
    await login(page, users.dekanat);
    await page.getByRole('link', { name: 'Групи і студенти' }).click();
    await page.getByRole('row', { name: /ПДт-13/ }).click();
    await expect(page.getByRole('heading', { name: /ПДт-13/ })).toContainText('25');

    await page.getByRole('button', { name: 'Імпорт списку' }).click();
    const dialog = page.getByRole('dialog');
    await dialog
      .getByLabel('Імпорт списку')
      .fill('1. новак ірина петрівна\n2. Лисюк Андрій\nПетренко');
    await dialog.getByRole('button', { name: 'Перевірити' }).click();

    // помилковий рядок блокує запис і показується з номером
    await expect(dialog.getByText(/рядок 3: «Петренко»/)).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Імпортувати/ })).toBeDisabled();

    await dialog.getByLabel('Імпорт списку').fill('1. новак ірина петрівна\n2. Лисюк Андрій');
    await dialog.getByRole('button', { name: 'Перевірити' }).click();
    await expect(dialog.getByRole('cell', { name: 'Новак' })).toBeVisible(); // регістр нормалізовано
    await dialog.getByRole('button', { name: /Імпортувати \(2\)/ }).click();
    await expect(dialog.getByText('Додано студентів: 2')).toBeVisible();
    await dialog.getByRole('button', { name: 'Готово' }).click();

    await expect(page.getByRole('heading', { name: /ПДт-13/ })).toContainText('27');
  });

  test('створення другого семестру навчального року', async ({ page }) => {
    await login(page, users.dekanat);
    await page.getByRole('link', { name: 'Семестри' }).click();
    await page.getByRole('button', { name: 'Додати семестр' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Номер семестру').click();
    await page.getByRole('option', { name: 'II' }).click();
    await dialog.getByLabel('Початок', { exact: true }).fill('2027-02-01');
    await dialog.getByLabel('Кінець', { exact: true }).fill('2027-06-20');
    await dialog.getByRole('button', { name: 'Додати період' }).click();
    await dialog.getByLabel('Початок').last().fill('2027-04-26');
    await dialog.getByLabel('Кінець').last().fill('2027-05-02');
    await dialog.getByRole('button', { name: 'Зберегти' }).click();

    await expect(page.getByRole('row', { name: /II семестр/ })).toContainText('Чернетка');
    await expect(page.getByRole('row', { name: /II семестр/ })).toContainText('1 лютого 2027');
  });

  test('публікація нової версії розкладу: чернетка → перегляд змін → опубліковано', async ({
    page,
  }) => {
    await login(page, users.dekanat);
    await page.getByRole('link', { name: 'Конструктор розкладу' }).click();

    await expect(page.getByText('Опублікований розклад лише для читання')).toBeVisible();
    await page.getByRole('button', { name: 'Створити чернетку для редагування' }).click();
    await expect(page.getByText('Чернетка', { exact: true })).toBeVisible();
    await expect(page.getByText(/Не розставлено: \d/)).toBeVisible();

    await page.getByRole('button', { name: 'Опублікувати' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Розклад отримають викладачів: 2')).toBeVisible();
    await expect(dialog.getByText('Буде створено занять: 0')).toBeVisible();
    await expect(dialog.getByText('Без змін: 102')).toBeVisible();

    await dialog.getByRole('button', { name: 'Опублікувати' }).click();
    await expect(dialog.getByText('Розклад опубліковано')).toBeVisible();
    await dialog.getByRole('button', { name: 'Готово' }).click();
    await expect(page.getByText(/Версія 2/)).toBeVisible();
    await expect(page.getByText(/Опубліковано/)).toBeVisible();
  });

  test('слот можна змінити без перетягування (клавіатурний шлях)', async ({ page }) => {
    await login(page, users.dekanat);
    await page.getByRole('link', { name: 'Конструктор розкладу' }).click();
    await page.getByRole('button', { name: 'Створити чернетку для редагування' }).click();
    await expect(page.getByRole('button', { name: 'Опублікувати' })).toBeVisible();

    await page
      .getByRole('button', { name: /Метр\. · ПДт-12 Л/ })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Періодичність').click();
    await page.getByRole('option', { name: 'Верхній тиждень' }).click();
    await dialog.getByRole('button', { name: 'Зберегти' }).click();

    await expect(page.getByText('Є неопубліковані зміни')).toBeVisible();
  });
});

import { expect, test } from '@playwright/test';

import { login, users } from './helpers.js';

test.describe('доступ за ролями', () => {
  test('неавторизованого перенаправляє на вхід', async ({ page }) => {
    await page.goto('/admin/groups');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Вхід' })).toBeVisible();
  });

  test('невірний пароль показує помилку українською', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Електронна пошта').fill(users.teacher);
    await page.getByLabel('Пароль').fill('wrong-password-1');
    await page.getByRole('button', { name: 'Увійти' }).click();
    await expect(page.getByText('Невірна пошта або пароль')).toBeVisible();
  });

  test('викладач не бачить розділів деканату і не потрапляє в них напряму', async ({ page }) => {
    await login(page, users.teacher);
    const nav = page.getByRole('navigation', { name: 'Меню' });
    await expect(nav.getByText('Сьогодні')).toBeVisible();
    await expect(nav.getByText('Конструктор розкладу')).toHaveCount(0);

    await page.goto('/admin/groups');
    await expect(page).toHaveURL(/\/$/);
  });

  test('деканат бачить розділи керування', async ({ page }) => {
    await login(page, users.dekanat);
    const nav = page.getByRole('navigation', { name: 'Меню' });
    for (const item of [
      'Конструктор розкладу',
      'Семестри',
      'Групи і студенти',
      'Навантаження',
      'Запити',
      'Довідники',
    ]) {
      await expect(nav.getByText(item, { exact: true })).toBeVisible();
    }
  });

  test('користувач із двома ролями перемикає навігацію', async ({ page }) => {
    await login(page, users.both);
    const nav = page.getByRole('navigation', { name: 'Меню' });
    await expect(nav.getByText('Конструктор розкладу')).toHaveCount(0); // перша роль — викладач
    await page.getByRole('button', { name: 'Обліковий запис' }).click();
    await page.getByRole('button', { name: 'Модератор', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(nav.getByText('Конструктор розкладу')).toBeVisible();
  });
});

import { expect, type Page } from '@playwright/test';

import { BROWSER_NOW, DEMO_PASSWORD } from '../env.js';

export const users = {
  teacher: 'teacher@demo.local',
  dekanat: 'dekanat@demo.local',
  both: 'both@demo.local',
} as const;

export async function login(page: Page, email: string): Promise<void> {
  // Годинник браузера збігається з FAKE_TODAY сервера: 12 жовтня 2026, 10:30 за Києвом
  await page.clock.setFixedTime(new Date(BROWSER_NOW));
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill(email);
  await page.getByLabel('Пароль').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Увійти' }).click();
  await expect(page.getByRole('navigation', { name: 'Меню' })).toBeVisible();
}

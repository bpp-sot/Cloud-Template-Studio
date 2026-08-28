import { test, expect } from '@playwright/test';

test('home page renders the product name and boundary statement', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SoT Cloud Template Studio' })).toBeVisible();
  await expect(page.getByText(/must be tested by the lab author/i)).toBeVisible();
});

test('navigates to the pattern explorer and switches providers', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Patterns', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Official Pattern Explorer' })).toBeVisible();
  await expect(page.getByText('Single Azure virtual machine (private by default)')).toBeVisible();
  await page.getByRole('button', { name: 'Amazon Web Services' }).click();
  await expect(page.getByText('Single AWS EC2 instance (private by default)')).toBeVisible();
});

test('creates a new template project and lists it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'New Template', exact: true }).click();
  await page.getByPlaceholder('e.g. Azure Linux VM Lab').fill('E2E Smoke Lab');
  await page.getByRole('button', { name: 'Create Project' }).click();
  await expect(page.getByRole('heading', { name: 'Template Projects' })).toBeVisible();
  await expect(page.getByText('E2E Smoke Lab')).toBeVisible();
});

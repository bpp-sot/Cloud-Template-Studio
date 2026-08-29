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
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  // Provider step (Azure is default)
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  // Purpose step
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  // Deployment step
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  // Region step
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  // Pattern step
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  // Compute step — add a VM
  await page.getByRole('button', { name: 'Add Virtual Machine' }).click();
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  // Networking step — add a network
  await page.getByRole('button', { name: 'Add Network' }).click();
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  // Init step
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  // Review step — generate
  await page.getByRole('button', { name: 'Generate Templates' }).click();
  await expect(page.getByRole('heading', { name: /Review & Download/i })).toBeVisible();
  await expect(page.getByText('Resource Inventory')).toBeVisible();
});

test('dedicated security review page is reachable from the review hub', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'New Template', exact: true }).click();
  await page.getByPlaceholder('e.g. Azure Linux VM Lab').fill('E2E Security Lab');
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  await page.getByRole('button', { name: 'Add Virtual Machine' }).click();
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  await page.getByRole('button', { name: 'Add Network' }).click();
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  await page.getByRole('button', { name: 'Generate Templates' }).click();
  await expect(page.getByRole('heading', { name: /Review & Download/i })).toBeVisible();
  // Navigate to the dedicated security review
  await page.getByRole('link', { name: /Security Review/ }).click();
  await expect(page.getByRole('heading', { name: 'Security Review' })).toBeVisible();
  await expect(page.getByText(/Overall Risk Assessment/i)).toBeVisible();
});

test('dedicated cost review page is reachable from the review hub', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'New Template', exact: true }).click();
  await page.getByPlaceholder('e.g. Azure Linux VM Lab').fill('E2E Cost Lab');
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  await page.getByRole('button', { name: 'Add Virtual Machine' }).click();
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  await page.getByRole('button', { name: 'Add Network' }).click();
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  await page.getByRole('button', { name: 'Generate Templates' }).click();
  await expect(page.getByRole('heading', { name: /Review & Download/i })).toBeVisible();
  await page.getByRole('link', { name: /Cost Review/ }).click();
  await expect(page.getByRole('heading', { name: 'Cost Review' })).toBeVisible();
  await expect(page.getByText(/Overall Cost Risk/i)).toBeVisible();
});

test('dedicated deployment readiness page is reachable from the review hub', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'New Template', exact: true }).click();
  await page.getByPlaceholder('e.g. Azure Linux VM Lab').fill('E2E Readiness Lab');
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  await page.getByRole('button', { name: 'Add Virtual Machine' }).click();
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  await page.getByRole('button', { name: 'Add Network' }).click();
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  await page.getByRole('button', { name: 'Generate Templates' }).click();
  await expect(page.getByRole('heading', { name: /Review & Download/i })).toBeVisible();
  await page.getByRole('link', { name: /Deployment Readiness/ }).click();
  await expect(page.getByRole('heading', { name: 'Deployment Readiness' })).toBeVisible();
  await expect(page.getByText(/Overall Readiness Status/i)).toBeVisible();
});

test('saved project appears on projects page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Projects', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Template Projects' })).toBeVisible();
});

test('completes the AWS CloudFormation journey', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'New Template', exact: true }).click();
  await page.getByPlaceholder('e.g. Azure Linux VM Lab').fill('E2E AWS Lab');
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  // Provider step — switch to AWS
  await page.getByRole('radio', { name: /Amazon Web Services/ }).check();
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  // Purpose step
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  // Deployment step
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  // Region step
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  // Pattern step
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  // Compute step — add an EC2 instance
  await page.getByRole('button', { name: 'Add EC2 Instance' }).click();
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  // Networking step — add a network
  await page.getByRole('button', { name: 'Add Network' }).click();
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  // Init step
  await page.getByRole('button', { name: 'Next \u2192' }).click();
  // Review step — generate
  await page.getByRole('button', { name: 'Generate Templates' }).click();
  await expect(page.getByRole('heading', { name: /Review & Download/i })).toBeVisible();
  await expect(page.getByText('Resource Inventory')).toBeVisible();
  await expect(page.getByText('AWS::EC2::Instance', { exact: true })).toBeVisible();
  // CloudFormation YAML tab should be available
  await expect(page.getByRole('button', { name: 'CloudFormation YAML' })).toBeVisible();
});

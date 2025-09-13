import { test, expect } from '@playwright/test';

async function ensureAssetsExist() {
  const res = await fetch('http://localhost:5050/assets?page=1&pageSize=1');
  if (!res.ok) throw new Error(`GET /assets failed: ${res.status}`);
  const json = await res.json();
  if (!json.items || json.items.length === 0) {
    throw new Error(
      'No assets in DB. Seed first (e.g. `npm -w api run seed`) so the Assign Asset modal has options.'
    );
  }
}

test.describe('i2r smoke', () => {
  test.beforeAll(async () => {
    await ensureAssetsExist();
  });

  test('create -> assign asset -> set status', async ({ page }) => {
    // 1) Go to app
    await page.goto('/');

    // 2) Fill "Create Incident"
    const title = `e2e ${Date.now()}`;
    await page.getByLabel('Title').fill(title);
    await page.getByLabel('Description').fill('created by e2e');
    await page.getByLabel('Priority').selectOption('CRITICAL');
    await page.getByLabel('Status').selectOption('OPEN');
    // Lon/Lat already defaulted in your UI; leave as-is.

    await page.getByRole('button', { name: 'Create Incident' }).click();

    // 3) Find the row with the new title
    const row = page.locator('table.md-table tbody tr', { hasText: title });
    await expect(row).toBeVisible();

    // Asset cell should be "-" initially
    const assetCell = row.locator('td').nth(4);
    await expect(assetCell).toHaveText('-');

    // 4) Click "Assign asset"
    await row.getByRole('button', { name: 'Assign asset' }).click();

    // Modal appears; pick first real option (index 1) and save
    const dialog = page.getByRole('dialog', { name: /Assign asset/i });
    await expect(dialog).toBeVisible();
    const select = dialog.getByLabel('Asset');
    // choose option index 1 (index 0 is often placeholder)
    await select.selectOption({ index: 1 });

    await dialog.getByRole('button', { name: /^Save$/ }).click();

    // Wait for asset cell to update from "-" to something else
    await expect(assetCell).not.toHaveText('-');

    // 5) Change status to IN_PROGRESS and verify
    const statusSelect = row.getByRole('combobox'); // the status select in the row
    await statusSelect.selectOption('IN_PROGRESS');
    await expect(statusSelect).toHaveValue('IN_PROGRESS');
  });
});

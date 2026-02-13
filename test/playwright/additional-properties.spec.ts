import { test, expect } from '@playwright/test';

test.describe('Additional Properties & Path Resolution', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should allow adding, renaming, and modifying nested properties without validation errors', async ({ page }) => {
    // 1. Add a new Additional Property (Route)
    const addBtn = page.locator('.js-btn-add-ap');
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // 2. Verify a new row is added
    const apRow = page.locator('.js-ap-row').first();
    await expect(apRow).toBeVisible();

    // 3. Rename the key to "MyRoute"
    const keyInput = apRow.locator('.js-ap-key');
    await keyInput.fill('MyRoute');

    // 4. Find the nested "Batch Size" input
    // The schema for Route has "batch_size". The parser formats this title to "Batch Size".
    const batchSizeInput = apRow.getByLabel('Batch Size');
    await expect(batchSizeInput).toBeVisible();

    // 5. Modify the value
    await batchSizeInput.fill('5');

    // 6. Check for validation errors
    // The specific error "must NOT have additional properties" appears if path resolution is incorrect
    // and tries to insert "Additional Property" or "Value" as keys into the Route object.
    await expect(page.locator('.invalid-feedback')).not.toBeVisible();
    await expect(page.getByText('must NOT have additional properties')).not.toBeVisible();
  });

  test('should handle oneOf switching within additional properties', async ({ page }) => {
    // 1. Add Property
    const apRow = page.locator('.js-ap-row').first();
    await apRow.locator('.js-ap-key').fill('Route1');

    // 2. Find the "input" oneOf selector (Endpoint)
    // It is inside the AP row. We select "static" option.
    // Note: The label for the oneOf wrapper is "Type / Variant".
    const selector = apRow.locator('select.js-oneof-selector').first();
    await selector.selectOption({ label: 'Static' });

    // 3. Fill the static value
    // The property name is "static", so title is "Static".
    // We target the input inside the oneOf container directly to avoid ambiguity.
    const staticInput = apRow.getByLabel('Static', { exact: false });
    await expect(staticInput).toBeVisible();
    await staticInput.fill('some-value');

    // 4. Verify no errors
    await expect(page.locator('.invalid-feedback')).not.toBeVisible();
  });
});

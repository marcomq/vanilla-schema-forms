import { test, expect } from '@playwright/test';

test.describe('Middleware Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // The default example is 'complex', which is what we want.
  });

  test('should correctly add middleware and update JSON without data corruption', async ({ page }) => {
    // 1. Find the "Add Middleware" button for the input middlewares array
    const middlewaresGroup = page.locator('.js-ap-row').first().getByRole('group', { name: 'Input' }).getByRole('group', { name: 'Middlewares' });
    const addMiddlewareBtn = middlewaresGroup.locator('button', { hasText: 'Add Middleware' });
    await addMiddlewareBtn.click();

    // 2. Select "metrics" from the dropdown that appears
    const typeSelect = addMiddlewareBtn.locator('xpath=following-sibling::select');
    await typeSelect.selectOption({ label: 'Metrics' });

    // 3. Verify the JSON output is correct
    const jsonOutput = page.locator('#output-data');
    await expect(jsonOutput).toContainText(/"metrics":/);

    const jsonText = await jsonOutput.textContent();
    const jsonData = JSON.parse(jsonText || '{}');

    // The root object should have "Default Route" but NOT a "Routes" property, which would indicate data corruption
    expect(jsonData['Default Route']?.input?.middlewares[0]?.metrics).toEqual({});
    expect(jsonData['Routes']).toBeUndefined();
  });
});
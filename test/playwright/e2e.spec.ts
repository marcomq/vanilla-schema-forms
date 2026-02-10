import { test, expect } from '@playwright/test';

test.describe('Schema Form Mechanics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Map (Additional Properties): Can add, rename, and remove routes', async ({ page }) => {
    // 1. Add a new Route
    const addBtn = page.locator('.js_btn-add-ap');
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // 2. Verify row appears
    const keyInput = page.locator('.js_ap-key').first();
    await expect(keyInput).toBeVisible();
    
    // 3. Rename the key
    await keyInput.fill('my-custom-route');
    await keyInput.blur(); // Trigger change event

    // 4. Verify JSON output reflects the new key
    // Use toContainText with a regex for non-input elements
    const jsonOutput = page.locator('#output-data');
    await expect(jsonOutput).toContainText(/"my-custom-route":/);

    // 5. Remove the route
    await page.locator('.js_btn-remove-ap').first().click();

    // The JSON output should now be an empty object "{}" or empty string
    await expect(jsonOutput).not.toContainText(/"my-custom-route":/);
  });

  test('OneOf (Polymorphism): Can switch endpoint types and render specific fields', async ({ page }) => {
    // Setup: Add a route
    // await page.locator('.js_btn-add-ap').click();

    // 1. Find the "Input" selector. 
    // Based on your HTML, the input selector is inside the route.
    // We look for the select that controls the "Input" field.
    // The schema has "input" as a property of Route.
    const inputSelector = page.locator('select[id$=".input__selector"]');
    await expect(inputSelector).toBeVisible();

    // 2. Select "memory" (Value 4 based on your HTML)
    await inputSelector.selectOption({ label: 'Memory' });

    // 3. Verify "Topic" field appears (specific to Memory)
    const topicInput = page.getByLabel('Topic', { exact: false }); // "Topic *"
    await expect(topicInput).toBeVisible();

    // 4. Switch to "file" (Value 2)
    await inputSelector.selectOption({ label: 'File' });

    // 5. Verify "File" field appears and "Topic" is gone
    await expect(page.getByLabel('Path', { exact: false })).toBeVisible();
    await expect(topicInput).not.toBeVisible();
  });

  test('Arrays: Can add and remove middleware items', async ({ page }) => {
    // Setup: Add route
    // await page.locator('.js_btn-add-ap').click();

    // 1. Find the "Add Item" button for middlewares
    // We target the specific button for the input middlewares array
    const addMiddlewareBtn = page.getByRole('group', { name: 'Input' }).locator('button', { hasText: 'Add Middleware' });
    await addMiddlewareBtn.click();

    const typeSelect = addMiddlewareBtn.locator('xpath=following-sibling::select');
    await typeSelect.selectOption({ index: 1 });

    // 2. Verify an item row appears
    const itemRow = page.locator('.js_array-item-row');
    await expect(itemRow).toHaveCount(1);

    // 4. Add a second item
    await addMiddlewareBtn.click();
    await typeSelect.selectOption({ index: 2 });
    await expect(itemRow).toHaveCount(2);

    // 5. Remove the first item
    await itemRow.first().locator('.js_btn-remove-item').click();
    await expect(itemRow).toHaveCount(1);
  });

  test('Data Binding: Deeply nested changes update JSON output', async ({ page }) => {
    // await page.locator('.js_btn-add-ap').click();
    
    // 1. Set Route Key
    const keyInput = page.locator('.js_ap-key').first();
    await keyInput.fill('deep-test');
    await keyInput.blur();

    // 2. Configure Input -> Memory
    const routeRow = page.locator('.js_ap-row').filter({ has: page.locator('input[data-original-key="deep-test"]') });
    const inputSelector = routeRow.locator('select[id$=".input__selector"]');
    await inputSelector.selectOption({ label: 'Memory' });

    // 3. Fill the Topic
    const topicInput = routeRow.getByLabel('Topic', { exact: false });
    await topicInput.fill('my-kafka-topic');
    await topicInput.blur();

    // 4. Verify JSON Structure
    // Wait for the JSON output to contain the topic we entered, to ensure update propagation
    await expect(page.locator('#output-data')).toContainText(/my-kafka-topic/);

    const jsonText = await page.locator('#output-data').textContent();
    const jsonData = JSON.parse(jsonText || '{}');

    expect(jsonData['deep-test']).toBeDefined();
    expect(jsonData['deep-test'].input).toBeDefined();
    // console.log(jsonData)
    expect(jsonData['deep-test'].input.memory).toBeDefined();
    expect(jsonData['deep-test'].input.memory.topic).toBe('my-kafka-topic');
  });
});
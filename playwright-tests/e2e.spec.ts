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
    // Use toHaveValue with a regex for <textarea> elements
    const jsonOutput = page.locator('#json-output');
    await expect(jsonOutput).toHaveValue(/"my-custom-route":/);

    // 5. Remove the route
    await page.locator('.js_btn-remove-ap').click();
    await expect(keyInput).not.toBeVisible();
    // The JSON output should now be an empty object "{}" or empty string
    await expect(jsonOutput).not.toHaveValue(/"my-custom-route":/);
  });

  test('OneOf (Polymorphism): Can switch endpoint types and render specific fields', async ({ page }) => {
    // Setup: Add a route
    await page.locator('.js_btn-add-ap').click();

    // 1. Find the "Input" selector. 
    // Based on your HTML, the input selector is inside the route.
    // We look for the select that controls the "Input" field.
    // The schema has "input" as a property of Route.
    const inputSelector = page.locator('select[id$=".input__selector"]');
    await expect(inputSelector).toBeVisible();

    // 2. Select "memory" (Value 4 based on your HTML)
    await inputSelector.selectOption({ label: 'memory' });

    // 3. Verify "Topic" field appears (specific to Memory)
    const topicInput = page.getByLabel('Topic', { exact: false }); // "Topic *"
    await expect(topicInput).toBeVisible();

    // 4. Switch to "file" (Value 2)
    await inputSelector.selectOption({ label: 'file' });

    // 5. Verify "File" field appears and "Topic" is gone
    await expect(page.getByLabel('File', { exact: false })).toBeVisible();
    await expect(topicInput).not.toBeVisible();
  });

  test('Arrays: Can add and remove middleware items', async ({ page }) => {
    // Setup: Add route
    await page.locator('.js_btn-add-ap').click();

    // 1. Find the "Add Item" button for middlewares
    // We target the specific button for the input middlewares array
    const addMiddlewareBtn = page.locator('.js_btn-add-array-item').first();
    await addMiddlewareBtn.click();

    // 2. Verify an item row appears
    const itemRow = page.locator('.js_array-item-row');
    await expect(itemRow).toHaveCount(1);

    // 3. Verify the default middleware type selector is present
    await expect(itemRow.locator('.js_oneof-selector')).toBeVisible();

    // 4. Add a second item
    await addMiddlewareBtn.click();
    await expect(itemRow).toHaveCount(2);

    // 5. Remove the first item
    await itemRow.first().locator('.js_btn-remove-item').click();
    await expect(itemRow).toHaveCount(1);
  });

  test('Data Binding: Deeply nested changes update JSON output', async ({ page }) => {
    await page.locator('.js_btn-add-ap').click();
    
    // 1. Set Route Key
    const keyInput = page.locator('.js_ap-key').first();
    await keyInput.fill('deep-test');

    // 2. Configure Input -> Memory
    const inputSelector = page.locator('select[id$=".input__selector"]');
    await inputSelector.selectOption({ label: 'memory' });

    // 3. Fill the Topic
    const topicInput = page.getByLabel('Topic', { exact: false });
    await topicInput.fill('my-kafka-topic');
    await topicInput.blur();

    // 4. Verify JSON Structure
    const jsonText = await page.locator('#json-output').inputValue();
    const jsonData = JSON.parse(jsonText);

    expect(jsonData['deep-test']).toBeDefined();
    expect(jsonData['deep-test'].input).toBeDefined();
    expect(jsonData['deep-test'].input.memory).toBeDefined();
    expect(jsonData['deep-test'].input.memory.topic).toBe('my-kafka-topic');
  });
});
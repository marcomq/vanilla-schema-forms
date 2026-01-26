import { test, expect } from '@playwright/test';

test.describe('Release Artifacts', () => {

    test('ES Module build should render form', async ({ page }) => {
        await page.goto('/verify-es.html');

        // Check if form container is populated
        const form = page.locator('#form-container form');
        await expect(form).toBeVisible();

        const header = page.locator('#MapofRoute');
        await expect(header).not.toBeEmpty();
        await expect(header).toContainText('Map_of_Route');
    });

    test('UMD build should render form and expose global', async ({ page }) => {
        await page.goto('/verify-umd.html');

        // Ensure no loading errors
        const alert = page.locator('.alert-danger');
        await expect(alert).not.toBeVisible();

        // Check global variable presence via console evaluation
        const type = await page.evaluate(() => typeof window['VanillaSchemaForms']);
        expect(type).toBe('object');

        // Check form rendering
        const form = page.locator('#form-container form');
        await expect(form).toBeVisible();
    });

});

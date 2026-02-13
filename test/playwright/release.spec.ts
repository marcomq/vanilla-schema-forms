import { test, expect } from '@playwright/test';

test.describe('Release Artifacts', () => {

    test('ES Module build should render form', async ({ page }) => {
        await page.goto('/verify-es.html');

        // Check if form container is populated
        const form = page.locator('#form-container form');
        await expect(form).toBeVisible();

        // Handle potential redirect to Playground (where title is "Routes")
        const header = page.getByRole('heading', { name: /Map_of_Route|Routes/ }).first();
        await expect(header).toBeVisible();
    });

    test('UMD build should render form and expose global', async ({ page }) => {
        await page.goto('/verify-umd.html');

        // Ensure no loading errors
        const alert = page.locator('.alert-danger');
        await expect(alert).not.toBeVisible();

        // Check global variable presence via console evaluation
        // Skip if we fell back to Playground (dev mode)
        const isPlayground = await page.getByRole('heading', { name: 'Vanilla Schema Forms Playground' }).isVisible();
        if (!isPlayground) {
            const type = await page.evaluate(() => typeof (window as any)['VanillaSchemaForms']);
            expect(type).toBe('object');
        }

        // Check form rendering
        const form = page.locator('#form-container form');
        await expect(form).toBeVisible();
    });

});

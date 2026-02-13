import { test, expect } from '@playwright/test';

test('TLS toggle should show/hide options', async ({ page }) => {
  await page.goto('/');

  // Add a route

  // Select 'mqtt' to make TLS section visible
  const inputSelector = page.locator('select[id$=".input__selector"]');
  await inputSelector.selectOption({ label: 'Mqtt' });

  // Click on "Advanced" to reveal the section
  await page.getByText('Show more...').click();

  // Find the TLS section by the class added in customization.js
  const tlsSection = page.locator('.ui_tls');
  await expect(tlsSection).toBeVisible();

  // Find the checkbox inside (it controls the visibility)
  const checkbox = tlsSection.getByRole('checkbox', { name: 'Required' });
  
  // Find the options container (id ends with -options)
  const optionsDiv = tlsSection.locator('div[id$="-options"]');

  // Initially, options should be hidden
  await expect(optionsDiv).toBeHidden();

  // Enable TLS
  await checkbox.check();

  // Options should now be visible
  await expect(optionsDiv).toBeVisible();

  // Disable TLS
  await checkbox.uncheck();

  // Options should be hidden again
  await expect(optionsDiv).toBeHidden();
});

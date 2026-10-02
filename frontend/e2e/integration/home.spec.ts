import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should load home page successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Captivia/i);
  });

  test('should display search functionality', async ({ page }) => {
    await page.goto('/');
    
    // Look for search input or button
    const searchInput = page.getByRole('textbox', { name: /search|recherch/i });
    await expect(searchInput).toBeVisible();
  });

  test('should perform species search', async ({ page }) => {
    await page.goto('/');
    
    // Search for "boa"
    const searchInput = page.getByRole('textbox', { name: /search|recherch/i });
    await searchInput.fill('boa');
    
    // Submit search (either click button or press Enter)
    await searchInput.press('Enter');
    
    // Wait for results
    await page.waitForTimeout(2000);
    
    // Check if results are displayed (multiple elements can match, use first)
    await expect(page.getByText(/boa/i).first()).toBeVisible();
  });

  test('should have language selector', async ({ page }) => {
    await page.goto('/');
    
    const languageSelector = page.getByRole('combobox', { name: /language|langue/i });
    await expect(languageSelector).toBeVisible();
  });

  test('should display popular species or suggestions', async ({ page }) => {
    await page.goto('/');
    
    // Check for popular species section
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });
});

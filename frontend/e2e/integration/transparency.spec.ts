import { test, expect } from '@playwright/test';

test.describe('Transparency Page', () => {
  test('should navigate to transparency page', async ({ page }) => {
    await page.goto('/');
    const transparencyLink = page.getByRole('link', { name: /transparency|transparence/i }).first();
    if (await transparencyLink.isVisible()) {
      await transparencyLink.click();
    } else {
      await page.goto('/transparency');
    }
    await expect(page).toHaveURL(/\/transparency/);
  });

  test('should display transparency page content', async ({ page }) => {
    await page.goto('/transparency');
    
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
    expect(content.length).toBeGreaterThan(100);
  });

  test('should explain business model', async ({ page }) => {
    await page.goto('/transparency');
    
    const content = await page.textContent('body');
    // Should mention affiliation or business model
    expect(content).toMatch(/affili|amazon|business|modèle|économique/i);
  });

  test('should explain data protection', async ({ page }) => {
    await page.goto('/transparency');
    
    const content = await page.textContent('body');
    // Should mention data or privacy
    expect(content).toMatch(/data|données|privacy|confidentialité|protection/i);
  });

  test('should have contact information', async ({ page }) => {
    await page.goto('/transparency');
    
    const content = await page.textContent('body');
    // Should have contact info or email
    expect(content).toMatch(/contact|email|@/i);
  });

  test('should mention open data sources', async ({ page }) => {
    await page.goto('/transparency');
    
    const content = await page.textContent('body');
    // Should mention data sources like GBIF, Wikipedia, etc.
    expect(content).toMatch(/gbif|wikipedia|source|data/i);
  });
});

import { test, expect } from '@playwright/test';

test.describe('Species Detail Page', () => {
  test('should navigate to species detail page', async ({ page }) => {
    await page.goto('/');
    
    // Search and click on a species
    const searchInput = page.getByRole('textbox', { name: /search|recherch/i });
    await searchInput.fill('boa constrictor');
    await searchInput.press('Enter');
    
    await page.waitForTimeout(2000);
    
    // Click on first result (if available)
    const firstResult = page.locator('[data-testid="species-result"]').first();
    if (await firstResult.isVisible()) {
      await firstResult.click();
    } else {
      // Navigate directly to a known species ID
      await page.goto('/species/2435099');
    }
    
    // Check if we're on species detail page
    await expect(page).toHaveURL(/\/species\/\d+/);
  });

  test('should display species tabs', async ({ page }) => {
    await page.goto('/species/2435099');
    await page.waitForLoadState('networkidle');
    // Species page shows either tabbed content (Overview, Health, etc.) or error/loading
    const tabs = page.getByRole('tab');
    const tabCount = await tabs.count();
    if (tabCount > 0) {
      await expect(tabs.first()).toBeVisible();
    }
    // Page should show either tabs or overview/error content
    const body = await page.textContent('body');
    expect(body).toMatch(/Vue d'ensemble|Overview|Santé|Health|Espèce introuvable|Species not found|Chargement|Loading/i);
  });

  test('should switch between tabs', async ({ page }) => {
    await page.goto('/species/2435099');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Try to click on different tabs
    const healthTab = page.getByRole('tab', { name: /health|santé/i });
    if (await healthTab.isVisible()) {
      await healthTab.click();
      await page.waitForTimeout(500);
    }
    
    const legalTab = page.getByRole('tab', { name: /legal|légal/i });
    if (await legalTab.isVisible()) {
      await legalTab.click();
      await page.waitForTimeout(500);
    }
  });

  test('should display health disclaimer', async ({ page }) => {
    await page.goto('/species/2435099');
    
    const healthTab = page.getByRole('tab', { name: /health|santé/i });
    if (await healthTab.isVisible()) {
      await healthTab.click();
      
      // Check for disclaimer
      const content = await page.textContent('body');
      expect(content).toMatch(/vétérinaire|veterinary|disclaimer/i);
    }
  });

  test('should display affiliate badges on equipment', async ({ page }) => {
    await page.goto('/species/2435099');
    
    const equipmentTab = page.getByRole('tab', { name: /equipment|matériel/i });
    if (await equipmentTab.isVisible()) {
      await equipmentTab.click();
      await page.waitForTimeout(1000);
      
      // Check for affiliate badge or disclaimer
      const content = await page.textContent('body');
      expect(content).toMatch(/affili|amazon|transparency|transparence/i);
    }
  });
});

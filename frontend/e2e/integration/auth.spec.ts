import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  const testEmail = `test-${Date.now()}@captivia.com`;
  const testPassword = 'Password123!';

  test('should navigate to register page', async ({ page }) => {
    await page.goto('/');
    
    // Look for register link
    const registerLink = page.getByRole('link', { name: /register|inscription|sign up/i });
    if (await registerLink.isVisible()) {
      await registerLink.click();
      await expect(page).toHaveURL(/\/register/);
    } else {
      await page.goto('/register');
    }
    
    await expect(page).toHaveURL(/\/register/);
  });

  test('should display registration form', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password|mot de passe/i).first()).toBeVisible();
    await expect(page.getByLabel(/confirm|confirmation/i)).toBeVisible();
  });

  test('should register a new user', async ({ page }) => {
    await page.goto('/register');
    
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password|mot de passe/i).first().fill(testPassword);
    
    // If there's a password confirmation field
    const passwordConfirm = page.getByLabel(/confirm|confirmation/i);
    if (await passwordConfirm.isVisible()) {
      await passwordConfirm.fill(testPassword);
    }
    
    // Submit form
    await page.getByRole('button', { name: /register|inscription|sign up/i }).click();
    
    // Should redirect to mes-animaux or dashboard
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/(mes-animaux|dashboard|animals)/);
  });

  test('should navigate to login page', async ({ page }) => {
    await page.goto('/');
    
    const loginLink = page.getByRole('link', { name: /login|connexion|sign in/i });
    if (await loginLink.isVisible()) {
      await loginLink.click();
    } else {
      await page.goto('/login');
    }
    
    await expect(page).toHaveURL(/\/login/);
  });

  test('should display login form', async ({ page }) => {
    await page.goto('/login');
    
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password|mot de passe/i)).toBeVisible();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.getByLabel(/email/i).fill('invalid@example.com');
    await page.getByLabel(/password|mot de passe/i).fill('wrongpassword');
    
    await page.getByRole('button', { name: /login|connexion|sign in/i }).click();
    
    // Should show error message
    await page.waitForTimeout(1000);
    const content = await page.textContent('body');
    expect(content).toMatch(/invalid|incorrect|erreur|error/i);
  });

  test('should protect mes-animaux route', async ({ page }) => {
    // Clear any existing auth
    await page.context().clearCookies();
    await page.goto('/mes-animaux');
    
    // Should redirect to login
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/\/login/);
  });
});

import { test, expect } from '@playwright/test';

test.describe('dashboard overview', () => {
  test.beforeEach(() => {
    test.skip(
      !process.env.E2E_FB_ADS_TOKEN,
      'Set E2E_FB_ADS_TOKEN (JWT) for authenticated dashboard e2e',
    );
  });

  test('loads overview when authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: 'ภาพรวม' })).toBeVisible();
    await expect(page.getByText('เริ่มต้นใช้งาน')).toBeVisible();
  });

  test('overview visual baseline', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('overview.png', {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    });
  });
});
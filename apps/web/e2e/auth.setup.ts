import { chromium, type FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const AUTH_DIR = path.join(__dirname, '.auth');
const STORAGE_PATH = path.join(AUTH_DIR, 'storageState.json');

async function globalSetup(config: FullConfig) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  const baseURL = config.projects[0]?.use?.baseURL as string;
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const token = process.env.E2E_FB_ADS_TOKEN;

  if (token && baseURL) {
    await context.addCookies([
      {
        name: 'fb_ads_token',
        value: token,
        url: baseURL,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
  }

  await context.storageState({ path: STORAGE_PATH });
  await browser.close();
}

export default globalSetup;
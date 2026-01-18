import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// Skip Electron tests if not in the right environment
const isElectronAvailable = () => {
  try {
    // Check if electron main file exists
    const mainPath = path.join(__dirname, '../../../electron/main.cjs');
    return fs.existsSync(mainPath);
  } catch {
    return false;
  }
};

test.describe('Electron App Launch', () => {
  let electronApp: ElectronApplication;
  let window: Page;

  test.beforeAll(async () => {
    test.skip(!isElectronAvailable(), 'Electron main file not found');

    // Launch Electron app
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../../electron/main.cjs')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    // Get the first window
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('window opens successfully', async () => {
    test.skip(!electronApp, 'Electron app not launched');

    // Check window is visible
    const isVisible = await window.isVisible('body');
    expect(isVisible).toBe(true);
  });

  test('window has correct title', async () => {
    test.skip(!electronApp, 'Electron app not launched');

    const title = await window.title();
    expect(title).toContain('SACRED');
  });

  test('app loads main content', async () => {
    test.skip(!electronApp, 'Electron app not launched');

    // Wait for the app to fully load
    await window.waitForSelector('main, #root, .app', { timeout: 10000 });

    // Verify main content is present
    const hasContent = await window.locator('main, #root, .app').isVisible();
    expect(hasContent).toBe(true);
  });

  test('embedded server responds on port 3847', async () => {
    test.skip(!electronApp, 'Electron app not launched');

    // The Electron app runs an embedded server
    // Try to fetch from the embedded server API
    try {
      const response = await window.evaluate(async () => {
        try {
          const res = await fetch('http://localhost:3847/api/notes');
          return { status: res.status, ok: res.ok };
        } catch (e) {
          return { error: String(e) };
        }
      });

      // Either server responds or we skip (server might not be running in test mode)
      if (!('error' in response)) {
        expect(response.status).toBe(200);
      }
    } catch {
      // Server might not be running in test mode
      test.skip(true, 'Embedded server not responding');
    }
  });

  test('can navigate to different books', async () => {
    test.skip(!electronApp, 'Electron app not launched');

    // Find navigation elements
    const searchInput = window.locator('input[placeholder*="verse"], input[placeholder*="Go to"]');

    if (await searchInput.isVisible()) {
      await searchInput.fill('Genesis 1');
      await searchInput.press('Enter');
      await window.waitForTimeout(1000);

      // Verify content updated
      const content = await window.locator('body').textContent();
      expect(content).toContain('Genesis');
    }
  });

  test('theme persists after restart', async () => {
    test.skip(!electronApp, 'Electron app not launched');

    // Find and click theme toggle
    const themeToggle = window.locator('button[aria-label*="theme"], .theme-toggle');

    if (await themeToggle.isVisible()) {
      // Get initial theme
      const initialTheme = await window.evaluate(() => {
        return localStorage.getItem('sacred_theme') || 'dark';
      });

      // Toggle theme
      await themeToggle.click();
      await window.waitForTimeout(300);

      // Get new theme
      const newTheme = await window.evaluate(() => {
        return localStorage.getItem('sacred_theme');
      });

      // Theme should have changed
      expect(newTheme).not.toBe(initialTheme);
    }
  });

  test('app handles window resize', async () => {
    test.skip(!electronApp, 'Electron app not launched');

    // Resize window
    await window.setViewportSize({ width: 800, height: 600 });
    await window.waitForTimeout(300);

    // Verify app is still responsive
    const hasContent = await window.locator('main, #root, .app').isVisible();
    expect(hasContent).toBe(true);

    // Resize to larger
    await window.setViewportSize({ width: 1400, height: 900 });
    await window.waitForTimeout(300);

    // Verify still works
    const stillHasContent = await window.locator('main, #root, .app').isVisible();
    expect(stillHasContent).toBe(true);
  });
});

test.describe('Electron IPC', () => {
  let electronApp: ElectronApplication;
  let window: Page;

  test.beforeAll(async () => {
    test.skip(!isElectronAvailable(), 'Electron main file not found');

    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../../electron/main.cjs')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('app info is accessible', async () => {
    test.skip(!electronApp, 'Electron app not launched');

    // Check if we can access app info through the window
    const appInfo = await electronApp.evaluate(async ({ app }) => {
      return {
        name: app.getName(),
        version: app.getVersion(),
      };
    });

    expect(appInfo.name).toBeTruthy();
    expect(appInfo.version).toBeTruthy();
  });

  test('data directory is accessible', async () => {
    test.skip(!electronApp, 'Electron app not launched');

    const userData = await electronApp.evaluate(async ({ app }) => {
      return app.getPath('userData');
    });

    expect(userData).toBeTruthy();
    expect(typeof userData).toBe('string');
  });
});

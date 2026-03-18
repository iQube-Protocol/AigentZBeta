import { createRequire } from 'module';
const require = createRequire(import.meta.url);
function resolvePlaywrightPackage() {
    try {
        require.resolve('playwright-core');
        return 'playwright-core';
    }
    catch { }
    try {
        require.resolve('playwright');
        return 'playwright';
    }
    catch { }
    return null;
}
export class BrowserPlaywrightExec {
    getStatus() {
        const packageName = resolvePlaywrightPackage();
        return {
            configured: Boolean(packageName),
            mode: packageName ? 'remote-cdp' : 'mock',
            packageName,
            message: packageName
                ? 'Playwright substrate is available for remote CDP control.'
                : 'Install playwright-core (or playwright) in services/aa-api to enable remote browser control.',
        };
    }
    async loadChromium() {
        const packageName = resolvePlaywrightPackage();
        if (!packageName) {
            return null;
        }
        let playwrightModule;
        try {
            playwrightModule = require(packageName);
        }
        catch (requireError) {
            const indexPath = packageName === 'playwright-core' ? 'playwright-core/index.js' : 'playwright/index.js';
            try {
                playwrightModule = require(indexPath);
            }
            catch {
                throw requireError;
            }
        }
        return playwrightModule.chromium || playwrightModule.default?.chromium || null;
    }
    async navigate(input) {
        const chromium = await this.loadChromium();
        if (!chromium) {
            return {
                executed: false,
                reason: 'playwright-not-installed',
            };
        }
        let browser;
        try {
            browser = await chromium.connectOverCDP(input.connectUrl);
            let context = browser.contexts()[0];
            if (!context) {
                context = await browser.newContext();
            }
            let page = context.pages()[0];
            if (!page) {
                page = await context.newPage();
            }
            if (input.action === 'navigate') {
                await page.goto(input.url, {
                    waitUntil: 'domcontentloaded',
                    timeout: 15000,
                });
            }
            else if (input.action === 'back') {
                await page.goBack({
                    waitUntil: 'domcontentloaded',
                    timeout: 15000,
                });
            }
            else if (input.action === 'forward') {
                await page.goForward({
                    waitUntil: 'domcontentloaded',
                    timeout: 15000,
                });
            }
            else {
                await page.reload({
                    waitUntil: 'domcontentloaded',
                    timeout: 15000,
                });
            }
            return {
                executed: true,
                currentUrl: page.url(),
                currentTitle: await page.title().catch(() => null),
            };
        }
        catch (error) {
            return {
                executed: false,
                reason: error instanceof Error ? error.message : 'playwright-navigation-failed',
            };
        }
        finally {
            if (browser) {
                await browser.close().catch(() => undefined);
            }
        }
    }
}
export const browserPlaywrightExec = new BrowserPlaywrightExec();

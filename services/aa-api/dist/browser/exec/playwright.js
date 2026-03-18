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
        const configured = packageName ? this.canLoadPackage(packageName) : false;
        return {
            configured,
            mode: configured ? 'remote-cdp' : 'mock',
            packageName: configured ? packageName : null,
            message: packageName
                ? configured
                    ? 'Playwright substrate is available for remote CDP control.'
                    : 'Playwright package is not available in the deployed runtime; falling back to provider-only mode.'
                : 'Install playwright-core (or playwright) in services/aa-api to enable remote browser control.',
        };
    }
    canLoadPackage(packageName) {
        try {
            require(packageName);
            return true;
        }
        catch {
            const indexPath = packageName === 'playwright-core' ? 'playwright-core/index.js' : 'playwright/index.js';
            try {
                require(indexPath);
                return true;
            }
            catch {
                return false;
            }
        }
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
                console.warn('[browser-playwright] unable to load Playwright package in runtime', requireError);
                return null;
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

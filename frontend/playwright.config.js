import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
    testDir: './e2e',
    testMatch: '**/*.spec.js',
    timeout: 45_000,
    expect: {
        timeout: 10_000,
    },
    fullyParallel: false,
    workers: 1,
    reporter: 'line',
    use: {
        baseURL: process.env.ALGET_BROWSER_BASE || 'http://127.0.0.1:5179',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    webServer: [
        {
            command: 'python -m uvicorn backend.server:app --host 127.0.0.1 --port 8000',
            cwd: '..',
            url: 'http://127.0.0.1:8000/api/book/inst-design/toc',
            reuseExistingServer: true,
            timeout: 120_000,
        },
        {
            command: 'set VITE_E2E_AUTH_BYPASS=true&& npm.cmd run dev -- --host 127.0.0.1 --port 5179',
            url: 'http://127.0.0.1:5179',
            reuseExistingServer: true,
            timeout: 120_000,
        },
    ],
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
})

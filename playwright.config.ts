import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'tests/browser',workers:1,fullyParallel:false,timeout:45000,
 use:{baseURL:'http://127.0.0.1:3030',headless:true,launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE??'/usr/bin/chromium',args:['--no-sandbox']}},
 webServer:{command:'npm run start -- --hostname 127.0.0.1 --port 3030',url:'http://127.0.0.1:3030/login',reuseExistingServer:false,timeout:60000},
 reporter:'list',
});

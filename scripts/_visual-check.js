// Script temporário de inspeção visual (removido após a validação).
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = 'http://127.0.0.1:3000';
const OUT = path.join(__dirname, '..', 'tmp-visual');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await sleep(600);
  await page.screenshot({ path: path.join(OUT, '01-login-desktop.png') });

  await page.type('#identifier', 'admin');
  await page.type('#password', 'Galeto@2026');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('#login-btn'),
  ]);
  await page.waitForSelector('.stats-grid .stat');
  await sleep(800);
  await page.screenshot({ path: path.join(OUT, '02-dashboard-desktop.png') });
  await page.screenshot({ path: path.join(OUT, '03-dashboard-desktop-full.png'), fullPage: true });

  await page.goto(`${BASE}/pages/estoque/`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#btn-new');
  await sleep(500);
  await page.screenshot({ path: path.join(OUT, '04-estoque-desktop.png') });

  await page.click('#btn-new');
  await page.waitForSelector('.modal-backdrop.is-open');
  await sleep(400);
  await page.screenshot({ path: path.join(OUT, '05-modal-desktop.png') });
  await page.keyboard.press('Escape');

  // Tablet
  await page.setViewport({ width: 834, height: 1112, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/pages/dashboard/`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.stats-grid .stat');
  await sleep(700);
  await page.screenshot({ path: path.join(OUT, '06-dashboard-tablet.png') });
  await page.click('#menu-toggle');
  await sleep(400);
  await page.screenshot({ path: path.join(OUT, '07-menu-tablet.png') });
  await page.keyboard.press('Escape');

  // Mobile
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/pages/dashboard/`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.stats-grid .stat');
  await sleep(700);
  await page.screenshot({ path: path.join(OUT, '08-dashboard-mobile.png'), fullPage: true });
  await page.screenshot({ path: path.join(OUT, '09-dashboard-mobile-fold.png') });
  await page.click('#mobile-menu-btn');
  await sleep(400);
  await page.screenshot({ path: path.join(OUT, '10-menu-mobile.png') });
  await page.keyboard.press('Escape');

  await page.goto(`${BASE}/pages/estoque/`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.table-stacked tbody tr');
  await sleep(500);
  await page.screenshot({ path: path.join(OUT, '11-estoque-mobile.png'), fullPage: true });

  await page.goto(`${BASE}/pages/comunicacao/`, { waitUntil: 'networkidle0' });
  await sleep(700);
  await page.screenshot({ path: path.join(OUT, '12-comunicacao-mobile.png'), fullPage: true });

  await browser.close();
  console.log('screenshots em', OUT);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

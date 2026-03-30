const { getBrowser } = require('../server/scrapers/browser');

(async () => {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  const url = 'https://play.fivetoolyouth.org/events/five-tool-youth-super-nit-fivetool-youth-park-04-18-2026';

  // Capture ALL JSON responses
  const responses = [];
  page.on('response', async (response) => {
    const u = response.url();
    const ct = response.headers()['content-type'] || '';
    if (ct.includes('json')) {
      try {
        const j = await response.json();
        responses.push({ url: u, keys: Object.keys(j), sample: JSON.stringify(j).slice(0, 300) });
      } catch (e) {}
    }
  });

  console.log('Loading event page...');
  await page.goto(url, { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(6000);

  // Try clicking "Teams" tab
  try {
    const tabs = await page.$$('a, button');
    for (const tab of tabs) {
      const text = await tab.textContent().catch(() => '');
      if (text.trim().toLowerCase() === 'teams') {
        console.log('Clicking Teams tab...');
        await tab.click();
        await page.waitForTimeout(6000);
        break;
      }
    }
  } catch (e) {
    console.log('No Teams tab found:', e.message);
  }

  // Try clicking 14U division
  try {
    const links = await page.$$('a, button, div');
    for (const link of links) {
      const text = await link.textContent().catch(() => '');
      if (text.trim() === '14U') {
        console.log('Clicking 14U...');
        await link.click();
        await page.waitForTimeout(5000);
        break;
      }
    }
  } catch (e) {
    console.log('No 14U link:', e.message);
  }

  console.log('\n=== JSON RESPONSES ===');
  responses.forEach(r => {
    console.log('URL:', r.url.slice(0, 150));
    console.log('Keys:', r.keys.join(', '));
    console.log('Sample:', r.sample.slice(0, 200));
    console.log('---');
  });

  // Get visible text
  const text = await page.evaluate(() => document.body.innerText);
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2 && l.length < 80);
  console.log('\n=== PAGE TEXT (filtered) ===');
  lines.slice(0, 50).forEach(l => console.log(' ', l));

  await context.close();
  await browser.close();
})().catch(e => console.error('Fatal:', e.message));

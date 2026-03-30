const { getBrowser } = require('../server/scrapers/browser');

(async () => {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  const url = 'https://play.fivetoolyouth.org/events/five-tool-youth-super-nit-fivetool-youth-park-04-18-2026/teams';

  // Capture JSON responses
  page.on('response', async (response) => {
    const u = response.url();
    const ct = response.headers()['content-type'] || '';
    if (ct.includes('json') && u.includes('fivetool') && !u.includes('getcart')) {
      try {
        const j = await response.json();
        console.log('AJAX:', u.slice(0, 120));
        console.log('  Keys:', Object.keys(j));
        console.log('  Sample:', JSON.stringify(j).slice(0, 400));
      } catch (e) {}
    }
  });

  console.log('Loading teams page...');
  await page.goto(url, { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(5000);

  // Click 14U specifically
  console.log('Looking for 14U division link...');
  const clicked = await page.evaluate(() => {
    const links = document.querySelectorAll('a, button, div, span');
    for (const el of links) {
      if (el.textContent.trim() === '14U' && el.offsetParent !== null) {
        el.click();
        return true;
      }
    }
    return false;
  });
  console.log('Clicked 14U:', clicked);
  await page.waitForTimeout(8000);

  // Get page text
  const text = await page.evaluate(() => document.body.innerText);
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2 && l.length < 100);

  console.log('\n=== PAGE TEXT AFTER 14U CLICK ===');
  lines.forEach(l => console.log(' ', l));

  await context.close();
  await browser.close();
})().catch(e => console.error('Fatal:', e.message));

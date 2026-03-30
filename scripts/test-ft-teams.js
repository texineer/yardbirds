const { getBrowser } = require('../server/scrapers/browser');

(async () => {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  const url = 'https://play.fivetoolyouth.org/events/five-tool-youth-super-nit-fivetool-youth-park-04-18-2026';

  // Capture JSON responses
  const responses = [];
  page.on('response', async (response) => {
    const u = response.url();
    const ct = response.headers()['content-type'] || '';
    if (ct.includes('json') && u.includes('fivetool') && !u.includes('getcart')) {
      try {
        const j = await response.json();
        responses.push({ url: u, data: j });
      } catch (e) {}
    }
  });

  console.log('Loading event page...');
  await page.goto(url, { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(5000);

  // Click the TEAMS tab within the event page (not the nav)
  // Look for tab links within the event content area
  const allLinks = await page.$$('a');
  for (const link of allLinks) {
    const href = await link.getAttribute('href').catch(() => '');
    const text = (await link.textContent().catch(() => '')).trim();
    if (text === 'TEAMS' && href && href.includes('/teams')) {
      console.log('Found event TEAMS tab:', href);
      await link.click();
      await page.waitForTimeout(6000);
      break;
    }
  }

  // Now look for division buttons (14U specifically)
  const allElements = await page.$$('a, button, span, div');
  for (const el of allElements) {
    const text = (await el.textContent().catch(() => '')).trim();
    if (text === '14U') {
      console.log('Clicking 14U division...');
      await el.click();
      await page.waitForTimeout(6000);
      break;
    }
  }

  console.log('\n=== JSON RESPONSES ===');
  responses.forEach(r => {
    console.log('URL:', r.url.slice(0, 150));
    console.log('Keys:', Object.keys(r.data));
    const str = JSON.stringify(r.data);
    console.log('Length:', str.length, 'Sample:', str.slice(0, 500));
    console.log('---');
  });

  // Get the visible text on the page now
  const text = await page.evaluate(() => document.body.innerText);
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2 && l.length < 80);

  // Filter for team-name-like entries (skip nav items)
  const navItems = ['CART','LOGIN','TOURNAMENTS','RANKINGS','PAST RESULTS','MEMBERSHIP','BUY','TRYOUTS','RULES','CALCULATOR','ABOUT','CONTACT','FIVE TOOL','WEATHER','ALL EVENTS','INFO','TEAMS','VENUES','SCHEDULE','REGISTRATION','DIVISION:','Search','State'];
  const filtered = lines.filter(l => !navItems.some(n => l.toUpperCase().includes(n)));
  console.log('\n=== POTENTIAL TEAM NAMES ===');
  filtered.forEach(l => console.log(' ', l));

  await context.close();
  await browser.close();
})().catch(e => console.error('Fatal:', e.message));

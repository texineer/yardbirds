const { getBrowser } = require('../server/scrapers/browser');

(async () => {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  // Capture JSON responses
  page.on('response', async (response) => {
    const u = response.url();
    const ct = response.headers()['content-type'] || '';
    if (ct.includes('json') && u.includes('fivetool') && !u.includes('getcart')) {
      try {
        const j = await response.json();
        console.log('AJAX:', u.slice(0, 150));
        console.log('  Sample:', JSON.stringify(j).slice(0, 500));
      } catch (e) {}
    }
  });

  // Try direct URL pattern for 14U division teams
  const url = 'https://play.fivetoolyouth.org/events/five-tool-youth-super-nit-fivetool-youth-park-04-18-2026/teams/14U';
  console.log('Loading:', url);
  await page.goto(url, { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(8000);

  // Get page content
  const text = await page.evaluate(() => document.body.innerText);
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2 && l.length < 100);
  const navSkip = ['CART','LOGIN','TOURNAMENTS','RANKINGS','PAST RESULTS','MEMBERSHIP','BUY','TRYOUTS','RULES','CALCULATOR','ABOUT','CONTACT','FIVE TOOL','WEATHER','ALL EVENTS','INFO','TEAMS','VENUES','SCHEDULE','REGISTRATION','DIVISION','Search','State','Waiver','Powered','©','There are','items','Pool','Pay umps','each team'];
  const filtered = lines.filter(l => !navSkip.some(n => l.toUpperCase().includes(n.toUpperCase())));

  console.log('\n=== TEAM NAMES ===');
  filtered.forEach(l => console.log(' ', l));

  // Also get all href links on the page
  const hrefs = await page.evaluate(() => {
    return [...document.querySelectorAll('a')].map(a => ({ href: a.href, text: a.textContent.trim() }))
      .filter(a => a.href.includes('fivetool') && a.text.length > 2 && a.text.length < 80);
  });
  const teamLinks = hrefs.filter(h => h.href.includes('/team/') || h.href.includes('orgid'));
  console.log('\n=== TEAM LINKS ===');
  teamLinks.forEach(l => console.log(' ', l.text, '->', l.href.slice(0, 100)));

  await context.close();
  await browser.close();
})().catch(e => console.error('Fatal:', e.message));

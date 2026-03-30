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
        console.log('AJAX:', u);
        console.log('  Keys:', Object.keys(j));
        const s = JSON.stringify(j);
        console.log('  Length:', s.length, 'Sample:', s.slice(0, 600));
      } catch (e) {}
    }
  });

  // Go to the teams page
  const url = 'https://play.fivetoolyouth.org/events/five-tool-youth-super-nit-fivetool-youth-park-04-18-2026/teams';
  console.log('Loading:', url);
  await page.goto(url, { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(6000);

  // Find all links and their hrefs to understand the division buttons
  const links = await page.evaluate(() => {
    return [...document.querySelectorAll('a')].map(a => ({
      text: a.textContent.trim(),
      href: a.href,
      visible: a.offsetParent !== null,
    })).filter(a => a.text && (a.text.includes('U') || a.text.includes('14')));
  });
  console.log('\nDivision-like links:');
  links.forEach(l => console.log(' ', l.text, '->', l.href, l.visible ? '' : '(hidden)'));

  // Try clicking the 14U link by href pattern
  const clicked14u = await page.evaluate(() => {
    const allAs = document.querySelectorAll('a');
    for (const a of allAs) {
      if (a.textContent.trim() === '14U' || a.href.includes('/14U') || a.href.includes('/14u')) {
        console.log('Clicking:', a.href);
        a.click();
        return a.href;
      }
    }
    // Try buttons too
    const btns = document.querySelectorAll('button, [role="button"], .division-btn, [class*=division]');
    for (const b of btns) {
      if (b.textContent.trim() === '14U') {
        b.click();
        return 'button:14U';
      }
    }
    return null;
  });
  console.log('\nClicked:', clicked14u);
  await page.waitForTimeout(8000);

  // Get page text after click
  const text = await page.evaluate(() => document.body.innerText);
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2 && l.length < 100);
  const navSkip = ['CART','There are no','LOGIN','TOURNAMENTS','BASEBALL RANK','SOFTBALL RANK','PAST RESULTS','BASEBALL MEM','SOFTBALL MEM','BUY TEAM','TEAM TRYOUTS','TOURNAMENT RULES','AGE CALC','ABOUT','CONTACT','FIVE TOOL','Weather','ALL EVENTS','INFO','VENUES','SCHEDULE','RULES','REGISTRATION','DIVISION','Waiver','Powered','©','COST','DESCRIPTION','IF YOUR','Umpire','RAMON','PRICE','CHECKLIST','LOCATION','Director','TEAMS'];
  const filtered = lines.filter(l => !navSkip.some(n => l.toUpperCase().startsWith(n.toUpperCase())));

  console.log('\n=== CONTENT AFTER 14U CLICK ===');
  filtered.forEach(l => console.log(' ', l));

  await context.close();
  await browser.close();
})().catch(e => console.error('Fatal:', e.message));

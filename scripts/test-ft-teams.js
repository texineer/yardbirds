const { getBrowser } = require('../server/scrapers/browser');

(async () => {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  const url = 'https://play.fivetoolyouth.org/events/five-tool-youth-super-nit-fivetool-youth-park-04-18-2026/teams';
  console.log('Loading:', url);
  await page.goto(url, { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(6000);

  // Check the DOM structure around team links — look for division grouping
  const structure = await page.evaluate(() => {
    const teamLinks = document.querySelectorAll('a[href*="/team/details/"]');
    const results = [];
    teamLinks.forEach(a => {
      const name = a.textContent.trim();
      // Walk up to find the division container
      let el = a;
      let divisionText = '';
      for (let i = 0; i < 10; i++) {
        el = el.parentElement;
        if (!el) break;
        // Check for data attributes or class names
        const dv = el.getAttribute('data-division') || el.getAttribute('data-age') || '';
        const cls = el.className || '';
        if (dv) { divisionText = dv; break; }
        // Check if this element has a heading or label with age group
        const heading = el.querySelector('h2, h3, h4, .division-label, [class*=division]');
        if (heading) { divisionText = heading.textContent.trim(); break; }
      }
      // Also check the parent's ID or data attributes
      let parent = a.parentElement;
      let parentInfo = '';
      for (let i = 0; i < 5; i++) {
        if (!parent) break;
        const id = parent.id || '';
        const cls = parent.className || '';
        const data = parent.getAttribute('data-division') || parent.getAttribute('data-name') || '';
        if (id || data) { parentInfo = `id=${id} data=${data} cls=${cls.slice(0,50)}`; break; }
        parent = parent.parentElement;
      }
      results.push({ name, division: divisionText, parent: parentInfo });
    });
    return results.slice(0, 10); // first 10
  });

  console.log('\nTeam link structure:');
  structure.forEach(s => console.log(` ${s.name} | div="${s.division}" | parent="${s.parent}"`));

  // Try a different approach: get the HTML around division sections
  const sections = await page.evaluate(() => {
    // Find all elements that might be division headers
    const all = document.querySelectorAll('[class*=division], [data-division], h3, h4');
    return [...all].map(el => ({
      tag: el.tagName,
      cls: el.className?.slice(0, 60),
      text: el.textContent.trim().slice(0, 60),
      data: el.getAttribute('data-division') || '',
    })).slice(0, 20);
  });
  console.log('\nDivision-like elements:');
  sections.forEach(s => console.log(` ${s.tag} cls="${s.cls}" data="${s.data}" text="${s.text}"`));

  await context.close();
  await browser.close();
})().catch(e => console.error('Fatal:', e.message));

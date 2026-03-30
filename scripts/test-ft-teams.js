const { getBrowser } = require('../server/scrapers/browser');

(async () => {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  const url = 'https://play.fivetoolyouth.org/events/five-tool-youth-super-nit-fivetool-youth-park-04-18-2026/teams';
  await page.goto(url, { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(6000);

  // Get all division panels with their team lists
  const divisions = await page.evaluate(() => {
    const results = [];
    // Find all panels with id ending in 'open' that contain team links
    document.querySelectorAll('[id$="open"]').forEach(panel => {
      const teams = [];
      panel.querySelectorAll('a[href*="/team/details/"]').forEach(a => {
        teams.push(a.textContent.trim());
      });
      if (teams.length === 0) return;

      // The panel ID format is like "24open" - find the matching division label
      // Walk up to find the division name text
      let divName = '';
      let el = panel;
      for (let i = 0; i < 5; i++) {
        el = el.parentElement;
        if (!el) break;
        // Look for text that contains age group pattern like "8U", "14U"
        const directText = el.querySelector('.division-name, h3, h4, strong');
        if (directText) {
          const t = directText.textContent.trim();
          if (/\d+U/i.test(t)) { divName = t; break; }
        }
      }

      // If not found, check preceding siblings
      if (!divName) {
        let prev = panel.previousElementSibling;
        while (prev) {
          const t = prev.textContent.trim();
          if (/^\d+U/i.test(t) && t.length < 30) { divName = t; break; }
          prev = prev.previousElementSibling;
        }
      }

      // Also check the button/link that toggles this panel
      if (!divName) {
        const toggler = document.querySelector(`[data-target="#${panel.id}"], [href="#${panel.id}"], [aria-controls="${panel.id}"]`);
        if (toggler) divName = toggler.textContent.trim();
      }

      results.push({ panelId: panel.id, divName, teamCount: teams.length, teams: teams.slice(0, 5) });
    });
    return results;
  });

  console.log('Division panels:');
  divisions.forEach(d => {
    console.log(`  ${d.panelId}: "${d.divName}" (${d.teamCount} teams) - ${d.teams.join(', ')}`);
  });

  // Try another approach: find all clickable elements that contain age group text
  const ageButtons = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('a, button, div, span').forEach(el => {
      const text = el.textContent.trim();
      if (/^\d+U(\s|$)/i.test(text) && text.length < 20 && el.offsetParent !== null) {
        const target = el.getAttribute('data-target') || el.getAttribute('href') || '';
        results.push({ text, tag: el.tagName, target, id: el.id });
      }
    });
    return results;
  });
  console.log('\nAge group buttons:');
  ageButtons.forEach(b => console.log(`  ${b.tag}: "${b.text}" target="${b.target}" id="${b.id}"`));

  await context.close();
  await browser.close();
})().catch(e => console.error('Fatal:', e.message));

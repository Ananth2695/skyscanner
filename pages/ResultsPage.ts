import { Page } from '@playwright/test';

export class ResultsPage {
  private cardSel = '[data-testid="ticket"]';
  private priceSel = '[data-testid="ticket"] [class*="Price_mainPriceContainer"] span';

  constructor(private page: Page) {}

  async waitForResults() {
    // blocks until at least one ticket card is in the DOM
    await this.page.waitForSelector(this.cardSel, { timeout: 120000 });
    await this.page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

    // log the total from the page header ("xxxx results sorted by…")
    const headerText = await this.page
      .locator('text=/\\d+\\s+results/i')
      .first()
      .textContent({ timeout: 5000 })
      .catch(() => '');
    const total = headerText?.match(/(\d[\d,]*)\s+results/i)?.[1] ?? 'some';
    console.log(`\n  Total number of flights from the Search: ${total}`);
  }

  async sortByCheapest() {
    const cheapestBtn = this.page.locator('button:has([data-testid="FqsTab_CHEAPEST"])').first();
    if (await cheapestBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await cheapestBtn.click();
    }
    await this.page.waitForTimeout(2000);
    await this.page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  }

  async getCheapestPrice(): Promise<string> {
    const el = this.page.locator(this.priceSel).first();
    return (await el.textContent({ timeout: 5000 }).catch(() => 'N/A'))?.trim() ?? 'N/A';
  }

  async scanNext5Days(startDateLabel: string) {
    const prices: { day: string; price: string }[] = [];

    // Day 1 — already on this page sorted by cheapest
    prices.push({ day: startDateLabel, price: await this.getCheapestPrice() });

    for (let i = 2; i <= 5; i++) {
      const moved = await this.moveToNextDay();
      if (!moved) break;

      // wait for the new results to load — skip networkidle since Skyscanner
      // keeps background requests running and the 20 s timeout eats the budget
      await this.page.waitForSelector(this.cardSel, { timeout: 30000 }).catch(() => {});
      await this.page.waitForTimeout(1500);

      const label = await this.currentDateLabel();
      prices.push({ day: label, price: await this.getCheapestPrice() });
    }

    // Print only the single cheapest day across the window
    const cheapest = prices
      .filter(p => p.price !== 'N/A')
      .sort((a, b) => this.toNumber(a.price) - this.toNumber(b.price))[0];

    if (cheapest) {
      console.log(`\n  Cheapest flight in the 5-day window → ${cheapest.day}: ${cheapest.price}`);
    }
  }

  private async moveToNextDay(): Promise<boolean> {
    const url = this.page.url();
    const dateRe = /\/(\d{6})\/(\d{6})\//;
    const m = url.match(dateRe);
    if (!m) return false;
 
    const bump = (s: string) => {
      const d = new Date(2000 + +s.slice(0, 2), +s.slice(2, 4) - 1, +s.slice(4, 6));
      d.setDate(d.getDate() + 1);
      return [
        String(d.getFullYear()).slice(2),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0'),
      ].join('');
    };
    const newUrl = url.replace(dateRe, `/${bump(m[1])}/${bump(m[2])}/`);
    await this.page.goto(newUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    return true;
  }
 

  // Pull the departure date label shown in the page header / URL
  private async currentDateLabel(): Promise<string> {
    try {
      const url = this.page.url();
      const m = url.match(/\/(\d{6})\//);
      if (m) {
        const s = m[1];
        const d = new Date(2000 + +s.slice(0, 2), +s.slice(2, 4) - 1, +s.slice(4, 6));
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      }
    } catch {}
    return 'unknown date';
  }

  private toNumber(priceText: string): number {
    const n = parseFloat(priceText.replace(/[^0-9.]/g, ''));
    return isNaN(n) ? Infinity : n;
  }
}
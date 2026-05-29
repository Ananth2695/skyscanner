import { Page } from '@playwright/test';

export class HomePage {
  constructor(private page: Page) {}

  async navigate() {
    await this.page.goto('https://www.skyscanner.com');
    await this.page.waitForLoadState('domcontentloaded');
    await this.dismissSignInPopup();
  }

  private async dismissSignInPopup() {
    try {
      const close = this.page.locator('[aria-label="Close modal"]').first();
      await close.waitFor({ state: 'visible', timeout: 5000 });
      await close.click();
    } catch {
      // Continue, if there is no pop-up
    }
  }

  async search(from: string, to: string, departDate: Date, returnDate: Date, guests: number): Promise<Page> {
    await this.selectReturnTrip();
    await this.fillOrigin(from);
    await this.fillDestination(to);
    await this.selectDate('depart', departDate);
    await this.selectDate('return', returnDate);
    await this.setGuests(guests);

    // Clicking search opens results in a new browser tab — capture it
    const [resultsPage] = await Promise.all([
      this.page.context().waitForEvent('page'),
      this.page.locator('[data-testid="desktop-cta"]').click(),
    ]);
    await resultsPage.waitForLoadState('domcontentloaded');
    return resultsPage;
  }

  private async selectReturnTrip() {
    try {
      const dropdown = this.page.locator('button[title="Select trip type"]').first();
      const ariaLabel = await dropdown.getAttribute('aria-label') ?? '';
      if (ariaLabel.toLowerCase().includes('return selected')) return; // already set
 
      // open the dropdown and pick the Return option
      await dropdown.click();
      await this.page.locator('[data-testid="RETURN"]').click();
    } catch {
      // already set or not found, carry on
    }
  }
 

  private async fillOrigin(city: string) {
    const input = this.page.locator('#originInput-input').first();
    await input.fill('');
    await input.pressSequentially(city, { delay: 60 });
    await this.page.waitForTimeout(1500);
    await this.pickFirstSuggestion(city);
  }

  private async fillDestination(city: string) {
    const input = this.page.locator('#destinationInput-input').first();
    await input.fill('');
    await input.pressSequentially(city, { delay: 60 });
    await this.page.waitForTimeout(1500);
    await this.pickFirstSuggestion(city);
  }

  private async pickFirstSuggestion(city: string) {
    const list = this.page.locator('[role="option"]');
    try {
      await list.first().waitFor({ state: 'visible', timeout: 5000 });
      const count = await list.count();
      for (let i = 0; i < count; i++) {
        const text = await list.nth(i).textContent() ?? '';
        if (text.toLowerCase().includes(city.toLowerCase())) {
          await list.nth(i).click();
          return;
        }
      }
      await list.first().click();
    } catch {
      await this.page.keyboard.press('Enter');
    }
    await this.page.waitForTimeout(400);
  }

  private async selectDate(type: 'depart' | 'return', date: Date) {
    const btnTestId = type === 'depart' ? 'depart-btn' : 'return-btn';
    const btn = this.page.locator(`[data-testid="${btnTestId}"]`).first();
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) await btn.click();

    await this.navigateCalendarToMonth(date);
    await this.clickDayCell(date);
    await this.page.waitForTimeout(400);
  }

  private async navigateCalendarToMonth(date: Date) {
    const today = new Date();
    const monthsToAdvance =
      (date.getFullYear() - today.getFullYear()) * 12 +
      (date.getMonth() - today.getMonth());
 
    const clicksNeeded = Math.max(0, monthsToAdvance - 1);
    await this.page.waitForSelector('[role="grid"]', { timeout: 10000 });
  
    for (let i = 0; i < clicksNeeded; i++) {
      const nextBtn = this.page.locator('button[aria-label="Next month"]').first();
      await nextBtn.waitFor({ state: 'visible', timeout: 5000 });
      await nextBtn.click();
      await this.page.waitForTimeout(300);
    }
 
    // validate the target month is visible in the UI
    const targetMonth = date.toLocaleDateString('en-US', { month: 'long' });
    const expectedPanelIndex = monthsToAdvance === 0 ? 0 : 1;
    const visibleMonths = await this.page
      .locator('[class*="_MonthName_"]')
      .allTextContents();
    const actualMonth = visibleMonths[expectedPanelIndex]?.trim();
    if (actualMonth !== targetMonth) {
      throw new Error(
        `Calendar navigation failed — expected "${targetMonth}" in panel ${expectedPanelIndex} but found "${actualMonth}" (all panels: "${visibleMonths.join(', ')}")`
      );
    }
  }

  private async clickDayCell(date: Date) {
    const day = String(date.getDate());
    const monthName = date.toLocaleDateString('en-US', { month: 'long' });

    // leading space prevents "3 June" matching "30 June"
    const cell = this.page.locator(`[role="gridcell"] button[aria-label*=" ${day} ${monthName}"]`).first();
    if (await cell.count() > 0) {
      await cell.click();
      return;
    }

    // fallback
    const fallback = this.page.locator(`[role="gridcell"]:not([aria-disabled="true"]) button:has-text("${day}")`).first();
    if (await fallback.count() > 0) await fallback.click();
  }

  private async setGuests(count: number) {
    try {
      const btn = this.page.locator('[data-testid="traveller-button"]').first();
      await btn.waitFor({ state: 'visible', timeout: 3000 });
      await btn.click();
      await this.page.waitForTimeout(500);
 
      // read current value from the nudger input
      const current = parseInt(
        await this.page.locator('#adult-nudger').inputValue().catch(() => '1')
      ) || 1;
 
      const diff = count - current;
      const nudger = diff > 0
        ? this.page.locator('[aria-label="Increase number of adults"]').first()
        : this.page.locator('[aria-label="Decrease number of adults"]').first();
 
      for (let i = 0; i < Math.abs(diff); i++) {
        await nudger.click();
        await this.page.waitForTimeout(150);
      }
 
      // verify the nudger reflects the expected count before applying
      const actual = parseInt(
        await this.page.locator('#adult-nudger').inputValue().catch(() => '0')
      ) || 0;
      if (actual !== count) {
        throw new Error(`Guest count mismatch — expected ${count}, nudger shows ${actual}`);
      }
 
      await this.page.locator('[data-testid="traveller-selector-apply-button"]').click();
    } catch {
      // picker failed, search proceeds with whatever count is set
    }
    await this.page.waitForTimeout(400);
  }
}

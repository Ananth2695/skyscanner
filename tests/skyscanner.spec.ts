import { test, Page } from '@playwright/test';
import { HomePage } from '../pages/HomePage';
import { ResultsPage } from '../pages/ResultsPage';
import { loadSearchData, formatDisplay } from '../utils/utils';

const testData = loadSearchData('test_data/searchData.csv');

for (const data of testData) {
  test(`Search flights: ${data.from} to ${data.to}`, async ({ page }) => {
    const home = new HomePage(page);
    let resultsTab: Page = page;

    await test.step('Open Skyscanner', async () => {
      await home.navigate();
    });

    await test.step('Fill and submit search form', async () => {
      console.log(`\n  ${data.from} → ${data.to} | ${formatDisplay(data.depart)} – ${formatDisplay(data.return)} | ${data.guests} guests`);
      resultsTab = await home.search(data.from, data.to, data.depart, data.return, data.guests);
    });

    const results = new ResultsPage(resultsTab);

    await test.step('Verify tickets are displayed', async () => {
      await results.waitForResults();
    });

    await test.step('Sort by cheapest and find best day across 5 days', async () => {
      await results.sortByCheapest();
      await results.scanNext5Days(formatDisplay(data.depart));
    });
  });
}
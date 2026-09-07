import { expect, test } from "@playwright/test";

test("meaningful Catch Up separates intent matches from objective significance", async ({ page, request }) => {
  const reset = await request.post("/api/demo/reset");
  expect(reset.ok()).toBeTruthy();

  await page.goto("/");
  await expect(page.getByTestId("caught-up-state")).toContainText("Nothing has changed since your baseline.");

  await page.getByRole("button", { name: "Advance demo market" }).click();
  await expect(page.getByTestId("caught-up-state")).toContainText("Prices moved, but nothing crossed your attention threshold.");

  await page.getByRole("button", { name: "Advance demo market" }).click();
  await expect(page.getByRole("heading", { name: "Saved watch reasons matched" })).toBeVisible();
  await expect(page.getByTestId("attention-TCS")).toContainText("Quarterly results were published");
  await expect(page.getByTestId("attention-HDFCBANK")).toContainText("Entered your ₹1,550 watch range");
  await expect(page.getByTestId("attention-TATAMOTORS")).toContainText("Your breakout condition changed");
  await expect(page.getByTestId("attention-INDIGO")).toContainText("fuel-cost driver");

  await expect(page.getByRole("heading", { name: "Worth knowing, without a matched reason" })).toBeVisible();
  await expect(page.getByTestId("attention-RELIANCE")).toContainText("unusually large move");
});

test("acknowledgement persists and Step 2 information does not return at Step 3", async ({ page, request }) => {
  expect((await request.post("/api/demo/reset")).ok()).toBeTruthy();
  expect((await request.post("/api/demo/advance")).ok()).toBeTruthy();
  expect((await request.post("/api/demo/advance")).ok()).toBeTruthy();

  await page.goto("/");
  await expect(page.getByTestId("attention-TCS")).toBeVisible();
  await page.getByRole("button", { name: "Mark all caught up" }).click();
  await expect(page.getByTestId("caught-up-state")).toBeVisible();
  await expect(page.locator("[data-testid^='attention-']")).toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId("caught-up-state")).toBeVisible();
  await expect(page.locator("[data-testid^='attention-']")).toHaveCount(0);

  await page.getByRole("button", { name: "Advance demo market" }).click();
  await expect(page.getByTestId("caught-up-state")).toContainText("Nothing new has crossed your attention threshold.");
  await expect(page.locator("[data-testid^='attention-']")).toHaveCount(0);
});

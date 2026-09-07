import { expect, test, type APIRequestContext } from "@playwright/test";

async function ensureWatched(request: APIRequestContext, instrumentId: string) {
  const response = await request.post("/api/watchlist/items", { data: { instrumentId } });
  expect([201, 409]).toContain(response.status());
}

test("watch reason versioning and deterministic replay smoke flow", async ({ page, request }) => {
  await page.request.post("/api/demo/reset");
  await ensureWatched(request, "NSE:TCS");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Catch Up" })).toBeVisible();

  await page.getByRole("link", { name: "Watchlist", exact: true }).click();
  const tcs = page.getByTestId("watchlist-TCS");
  await expect(tcs).toContainText("₹3,");
  await tcs.getByRole("link", { name: /Open Tata Consultancy Services/ }).click();

  await expect(page.getByRole("heading", { name: "TCS" })).toBeVisible();
  await page.getByRole("button", { name: "Edit" }).first().click();
  await page.getByLabel("Watch reason summary").fill("Watching Q2 margins — smoke verified");
  await page.getByRole("button", { name: "Save new version" }).click();
  await expect(page.getByRole("heading", { name: "Q2 margins — smoke verified", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Demo", exact: true }).click();
  const reset = page.getByRole("button", { name: "Reset scenario" });
  if (await reset.isEnabled()) await reset.click();
  await expect(page.getByTestId("demo-time")).toContainText("10:00");
  await expect(page.getByTestId("demo-price-TCS")).toContainText("3,200.00");

  await page.getByRole("button", { name: "Advance market 30 minutes" }).click();
  await expect(page.getByTestId("demo-time")).toContainText("10:30");
  await expect(page.getByTestId("demo-price-TCS")).toContainText("3,206.00");
});

test("duplicate rejection and watchlist archive/re-add survive refresh", async ({ page, request }) => {
  expect((await request.post("/api/demo/reset")).ok()).toBeTruthy();
  expect((await request.post("/api/demo/advance")).ok()).toBeTruthy();
  await ensureWatched(request, "NSE:RELIANCE");
  const duplicate = await request.post("/api/watchlist/items", { data: { instrumentId: "NSE:RELIANCE" } });
  expect(duplicate.status()).toBe(409);
  await expect(duplicate.json()).resolves.toMatchObject({ error: { code: "DUPLICATE_WATCHLIST_ITEM" } });

  await page.goto("/watchlist");
  const reliance = page.getByTestId("watchlist-RELIANCE");
  await expect(reliance).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await reliance.getByRole("button", { name: "Remove RELIANCE from watchlist" }).click();
  await expect(reliance).toHaveCount(0);

  await page.getByRole("button", { name: "Add stock" }).click();
  await page.getByRole("button", { name: /RELIANCE Reliance Industries/ }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByTestId("watchlist-RELIANCE")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("watchlist-RELIANCE")).toContainText("₹1,425.00");
});

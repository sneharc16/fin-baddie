import { expect, test } from "@playwright/test";

test("contextual graph relevance explains the Step 4 Crude-to-IndiGo path", async ({ page, request }) => {
  expect((await request.post("/api/demo/reset")).ok()).toBeTruthy();
  expect((await request.patch("/api/watch-intents/intent%3Aindigo%3Adriver/graph", { data: { templateKey: "AIRLINE_FUEL_COST", selectedNodeKeys: ["FUEL_COST", "CRUDE"] } })).ok()).toBeTruthy();
  expect((await request.post("/api/demo/advance")).ok()).toBeTruthy();
  expect((await request.post("/api/demo/advance")).ok()).toBeTruthy();
  expect((await request.post("/api/catch-up/acknowledge", { data: { scope: "ALL", throughSequence: 2 } })).ok()).toBeTruthy();
  expect((await request.post("/api/demo/advance")).ok()).toBeTruthy();

  await page.goto("/");
  await expect(page.getByTestId("caught-up-state")).toBeVisible();
  await page.getByRole("button", { name: "Advance demo market" }).click();

  const indigo = page.getByTestId("attention-INDIGO");
  await expect(indigo).toContainText("Related to a driver you're tracking");
  await expect(indigo).toContainText("Crude moved materially");
  await expect(indigo).toContainText("IndiGoFuel costCrude");
  await indigo.getByRole("link", { name: /View details/ }).click();
  await expect(page.getByTestId("stock-since-section")).toContainText("IndiGoFuel costCrude");
  await expect(page.getByTestId("related-drivers-section")).toContainText("Fuel cost");
  await expect(page.getByTestId("related-drivers-section")).toContainText("Crude");
});

test("removing Crude creates graph history and suppresses future Crude relevance", async ({ page, request }) => {
  expect((await request.post("/api/demo/reset")).ok()).toBeTruthy();
  await page.goto("/stock/INDIGO");
  const related = page.getByTestId("related-drivers-section");
  await related.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel(/Crude/).uncheck();
  await page.getByRole("button", { name: "Add selected drivers" }).click();
  await related.getByText("Relationship history").click();
  await expect(related).toContainText("active");
  await expect(related).toContainText("superseded");

  expect((await request.post("/api/demo/reset")).ok()).toBeTruthy();
  expect((await request.post("/api/demo/advance")).ok()).toBeTruthy();
  expect((await request.post("/api/demo/advance")).ok()).toBeTruthy();
  expect((await request.post("/api/catch-up/acknowledge", { data: { scope: "ALL", throughSequence: 2 } })).ok()).toBeTruthy();
  expect((await request.post("/api/demo/advance")).ok()).toBeTruthy();
  expect((await request.post("/api/demo/advance")).ok()).toBeTruthy();
  await page.goto("/");
  await expect(page.getByTestId("attention-INDIGO")).toHaveCount(0);

  expect((await request.post("/api/demo/reset")).ok()).toBeTruthy();
  await page.goto("/stock/INDIGO");
  await page.getByTestId("related-drivers-section").getByRole("button", { name: "Edit" }).click();
  await page.getByLabel(/Crude/).check();
  await page.getByRole("button", { name: "Add selected drivers" }).click();
  await expect(page.getByTestId("related-drivers-section")).toContainText("Crude");
});

test("acknowledged results can resolve and renew without removing TCS", async ({ page, request }) => {
  expect((await request.post("/api/demo/reset")).ok()).toBeTruthy();
  expect((await request.patch("/api/watch-intents/intent%3Atcs%3Aearnings", {
    data: {
      type: "EARNINGS",
      originalText: "Watching Q2 margins",
      structuredPayload: { focus: ["MARGINS"], quarterLabel: "Q2" },
      provenanceSource: "RESULTS_CALENDAR",
    },
  })).ok()).toBeTruthy();
  expect((await request.post("/api/demo/advance")).ok()).toBeTruthy();
  expect((await request.post("/api/demo/advance")).ok()).toBeTruthy();

  await page.goto("/");
  await page.getByTestId("attention-TCS").getByRole("button", { name: "Mark seen" }).click();
  await page.goto("/stock/TCS");
  const lifecycle = page.getByTestId("lifecycle-review");
  await expect(lifecycle).toContainText("Your watch question has an update");
  await lifecycle.getByRole("button", { name: "Mark resolved" }).click();
  await expect(page.getByText("No active watch reason")).toBeVisible();
  await expect(page.getByTestId("resolved-watch-reason")).toBeVisible();

  await page.getByRole("link", { name: "Watchlist", exact: true }).click();
  await expect(page.getByTestId("watchlist-TCS")).toBeVisible();
  await page.getByTestId("watchlist-TCS").getByRole("link", { name: /Open Tata Consultancy Services/ }).click();
  await page.getByTestId("resolved-watch-reason").getByRole("button", { name: "Watch next results" }).click();
  await expect(page.getByRole("heading", { name: /Q3 margins/i })).toBeVisible();
  await expect(page.getByTestId("watch-history")).toContainText("Watch reason resolved");

  const restore = await request.patch("/api/watch-intents/intent%3Atcs%3Aearnings", {
    data: {
      type: "EARNINGS",
      originalText: "Watching Q2 margins",
      structuredPayload: { focus: ["MARGINS"], quarterLabel: "Q2" },
      provenanceSource: "RESULTS_CALENDAR",
    },
  });
  expect(restore.ok()).toBeTruthy();
});

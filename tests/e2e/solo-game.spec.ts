import { test, expect } from "@playwright/test";

/**
 * End-to-end: complete solo game against computer opponents.
 * Uses a 5-question match with the 10s timer; bots answer on their own.
 */
test("complete a solo game against bots", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Bible Battle Live/i })).toBeVisible();
  await page.getByRole("link", { name: /Play Against Computer/i }).click();

  // name entry
  await page.getByPlaceholder("e.g. Grace").fill("Tester");

  // shrink the match: 5 questions, 10s timer
  await page.getByRole("radio", { name: "5", exact: true }).click();
  await page.getByRole("radio", { name: "10s" }).click();

  await page.getByRole("button", { name: /Start Game/i }).click();

  // countdown appears
  await expect(page.getByText("Get Ready!")).toBeVisible();

  for (let i = 0; i < 5; i++) {
    // wait for the question screen and answer the first option
    const answer = page.getByRole("button", { name: /^Answer A:/ }).first();
    await answer.waitFor({ state: "visible", timeout: 30_000 });
    await answer.click();
    // reveal shows the Bible reference
    await expect(page.getByText(/📖/)).toBeVisible({ timeout: 30_000 });
    // continue (skips the auto-advance wait); round summary may appear instead
    const continueBtn = page.getByRole("button", { name: /Continue/ });
    await continueBtn.click();
    const summary = page.getByText(/Round \d+ Complete!/);
    if (await summary.isVisible().catch(() => false)) {
      await page.getByRole("button", { name: /Continue/ }).click();
    }
  }

  // final results
  await expect(page.getByText(/wins!|It's a tie/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: /Rematch/i })).toBeVisible();
});

test("invalid room code shows a friendly error", async ({ page }) => {
  await page.goto("/online");
  await page.getByPlaceholder("e.g. Grace").fill("Tester");
  await page.getByLabel("Room code").fill("XX");
  await page.getByRole("button", { name: /Join room/i }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Room codes" })).toContainText(
    /Room codes are 5/,
  );
});

test("local multiplayer two-player shared-screen game starts", async ({ page }) => {
  await page.goto("/play/local");
  const nameInputs = page.getByPlaceholder("e.g. Grace");
  await nameInputs.nth(0).fill("Anna");
  await nameInputs.nth(1).fill("Ben");
  await page.getByRole("radio", { name: "5", exact: true }).click();
  await page.getByRole("button", { name: /Start Game/i }).click();
  await expect(page.getByText("Get Ready!")).toBeVisible();
  // both players get labeled answer rows
  await expect(page.getByLabel("Anna answers A")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel("Ben answers A")).toBeVisible();
});

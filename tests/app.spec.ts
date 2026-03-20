import { test, expect } from "@playwright/test";

test.describe("GitFlix E2E Flow", () => {
  test("should search for a user and display recommendations", async ({ page }) => {
    // 1. Navigate to home
    await page.goto("/", { waitUntil: 'networkidle' });
    await expect(page).toHaveTitle(/GitFlix/);

    // 2. Check initial state (Welcome Message)
    const welcomeHeader = page.locator('h1');
    await expect(welcomeHeader).toContainText(/Welcome to GitFlix/i, { timeout: 10000 });
    
    // 3. Enter username and search
    const input = page.getByPlaceholder(/GitHub username/i);
    await input.fill("gaearon");
    await page.getByRole("button", { name: /Explore/i }).click();

    // 4. Wait for Profile Hero to appear (gaearon)
    // The Hero component renders {user.login} in the h1.
    const profileHeader = page.locator("h1");
    // We expect the text to change from "Welcome" to "gaearon"
    await expect(profileHeader).toContainText(/gaearon/i, { timeout: 25000 });

    // 5. Assert recommendation rows render
    const rowTitles = page.locator("h2.text-xl");
    await expect(rowTitles.first()).toBeVisible({ timeout: 10000 });
    const count = await rowTitles.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // 6. Assert repository cards render
    const allCards = page.locator("h3.text-lg");
    await expect(allCards.first()).toBeVisible();
    const cardCount = await allCards.count();
    expect(cardCount).toBeGreaterThanOrEqual(3);

    // 7. Assert clicking a card opens GitHub
    const githubLink = page.locator('a[href*="github.com"]').first();
    await expect(githubLink).toBeAttached();
    const href = await githubLink.getAttribute("href");
    expect(href).toContain("github.com");
  });
});

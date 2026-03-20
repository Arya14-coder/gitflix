import { test, expect } from "@playwright/test";

test.describe("GitFlix E2E Flow", () => {
  test("should search for a user and display recommendations", async ({ page }) => {
    // 1. Navigate to home
    await page.goto("/");
    await expect(page).toHaveTitle(/GitFlix/);

    // 2. Enter username and search
    const input = page.getByPlaceholder(/GitHub username/i);
    await input.fill("gaearon");
    await page.getByRole("button", { name: /Explore/i }).click();

    // 3. Wait for loading to finish and Hero to appear
    await expect(page.getByText(/Analyzing your GitHub activity/i)).toBeHidden({ timeout: 15000 });
    await expect(page.locator("h1")).toContainText(/Dan Abramov/i);

    // 4. Assert 3 section rows render
    const rows = page.locator("section, div.mb-12"); // Adjust based on final DOM structure
    // Our RecommendationRow uses a div with title. Let's look for h2 titles.
    const rowTitles = page.locator("h2.text-xl");
    await expect(rowTitles).toHaveCount(3);

    // 5. Assert at least 3 cards per row
    const firstRowCards = page.locator(".group.bg-\\[\\#1a1a1a\\]").first(); 
    // Actually, let's target the RepoCard structure
    const allCards = page.locator("h3.text-lg");
    await expect(allCards.count()).toBeGreaterThanOrEqual(9); // 3 rows * 3 cards

    // 6. Assert card details
    const firstCard = allCards.first();
    await expect(firstCard).toBeVisible();
    
    // Check stars and language
    const stars = page.locator("text=/\\d+(\\.\\d+)?k?/").first();
    await expect(stars).toBeVisible();

    // 7. Assert clicking a card opens GitHub
    // We expect an <a> tag with 'View on GitHub' on hover
    const githubLink = page.getByRole("link", { name: /View on GitHub/i }).first();
    const href = await githubLink.getAttribute("href");
    expect(href).toContain("github.com");
  });
});

import { expect, test, type Page } from "@playwright/test";

const login = async (page: Page) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("demo@carecircle.ai");
  await page.getByLabel("Password").fill("Demo1234");
  await page.getByRole("button", { name: /open carecircle/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
};

test("dashboard loads with core caregiver value", async ({ page }) => {
  await login(page);
  await expect(page.getByText("AI Briefing")).toBeVisible();
  await expect(page.getByText("Quick actions")).toBeVisible();
  await expect(page.getByText("Today's med schedule")).toBeVisible();
});

test.describe("mobile UX safeguards", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("keeps briefing text contained and bottom actions reachable", async ({ page }) => {
    await login(page);

    const briefingText = page.getByText(/You are doing a thoughtful job keeping everything steady\./);
    await expect(briefingText).toBeVisible();

    const briefingMetrics = await briefingText.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      overflowWrap: getComputedStyle(element).overflowWrap,
    }));

    expect(briefingMetrics.scrollWidth).toBeLessThanOrEqual(briefingMetrics.clientWidth + 1);
    expect(["anywhere", "break-word"]).toContain(briefingMetrics.overflowWrap);

    await page.goto("/settings");
    const exportButton = page.getByRole("button", { name: "Export My Data" });
    await exportButton.scrollIntoViewIfNeeded();
    await expect(exportButton).toBeVisible();
  });

  test("keeps vitals tabs swipable and emergency actions ordered for mobile", async ({ page }) => {
    await login(page);
    await page.goto("/vitals");

    const tabStrip = page.locator("div.mb-4.flex.snap-x").first();
    const firstTab = page.getByRole("button", { name: "Blood Pressure" });
    const lastTab = page.getByRole("button", { name: "Temperature" });
    const stripMetrics = await tabStrip.evaluate((element) => ({
      overflowX: getComputedStyle(element).overflowX,
    }));
    const firstTabBox = await firstTab.boundingBox();
    const lastTabBox = await lastTab.boundingBox();

    expect(stripMetrics.overflowX).toMatch(/auto|scroll/);
    expect(firstTabBox).not.toBeNull();
    expect(lastTabBox).not.toBeNull();
    expect(Math.abs(firstTabBox!.y - lastTabBox!.y)).toBeLessThanOrEqual(2);

    await page.goto("/emergency");

    const firstCallNow = page.getByRole("button", { name: "Call now" }).first();
    const firstDownload = page.getByRole("button", { name: "Download PDF" }).first();

    await expect(firstCallNow).toBeVisible();
    await expect(firstDownload).toBeVisible();

    const callBox = await firstCallNow.boundingBox();
    const downloadBox = await firstDownload.boundingBox();

    expect(callBox).not.toBeNull();
    expect(downloadBox).not.toBeNull();
    expect(callBox!.y).toBeLessThanOrEqual(downloadBox!.y + 1);
    if (Math.abs(callBox!.y - downloadBox!.y) <= 2) {
      expect(callBox!.x).toBeLessThan(downloadBox!.x);
    }
  });
});

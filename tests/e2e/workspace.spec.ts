import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const evidence = resolve(
  process.env.PROMISORY_EVIDENCE_DIRECTORY ??
    "docs/evidence/2026-11-10-local-p0",
);
async function captureTop(page: Page, name: string) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: resolve(evidence, name), fullPage: true });
}
test.beforeAll(async () => {
  await mkdir(evidence, { recursive: true });
});
test("example mode is explicit and role and search filters keep empty states truthful", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Keep every commitment connected." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Explore example data" }).click();
  await expect(
    page.getByText("Example data", { exact: false }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Launch merchant onboarding",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Publish reconciliation export",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Engineer", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No commitments in this view" }),
  ).toBeVisible();
  await page.getByLabel("Example actor").selectOption("owen");
  await expect(
    page.getByRole("button", {
      name: "Launch merchant onboarding",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Search commitments").fill("unmatched search text");
  await expect(
    page.getByRole("heading", { name: "No matching commitments" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("invalid input preserves the draft, error focus is visible, and only owner acceptance activates it", async ({
  page,
}) => {
  await page.goto("/?mode=example");
  await page
    .getByRole("button", { name: "+ New commitment", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Commitment title").fill("Verify the pilot outcome");
  await dialog
    .getByRole("button", { name: "Save draft for owner acceptance" })
    .click();
  await expect(dialog.getByRole("alert")).toBeFocused();
  await expect(dialog.getByLabel("Commitment title")).toHaveValue(
    "Verify the pilot outcome",
  );
  await dialog
    .getByLabel("What must be true?")
    .fill("The pilot operator can validate the agreed release.");
  await dialog.getByLabel("Beneficiary", { exact: true }).fill("Pilot team");
  await dialog.getByLabel("Deadline date").fill("2026-11-30");
  await dialog.getByLabel("Local cutoff time").fill("17:00");
  await dialog
    .getByLabel("Acceptance condition", { exact: true })
    .fill("The operator reviews the acceptance evidence and signs off.");
  await dialog
    .getByRole("button", { name: "Save draft for owner acceptance" })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText("Draft agreement", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Accept as accountable owner" })
    .click();
  await expect(page.getByText("Draft agreement", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("heading", {
      name: "Verify the pilot outcome",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "+ New commitment", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "+ New commitment", exact: true }),
  ).toBeFocused();
});
test("review is independent and example execution stays held without an external request", async ({
  page,
}) => {
  const external: string[] = [];
  page.on("request", (request) => {
    if (!new URL(request.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/))
      external.push(request.url());
  });
  await page.goto("/?mode=example");
  await page
    .getByRole("button", { name: "Launch merchant onboarding", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Compare recovery options", exact: true })
    .click();
  await page.getByLabel("Proposed Jira due date").fill("2026-11-23");
  await page.getByRole("button", { name: "Prepare exact proposal" }).click();
  await expect(
    page.getByRole("button", { name: "Approve review" }),
  ).toBeDisabled();
  await page.getByLabel("Example actor").selectOption("jon");
  await page.getByRole("button", { name: "Approve review" }).click();
  await page.getByLabel("Example actor").selectOption("maya");
  await page.getByRole("button", { name: "Apply reviewed change" }).click();
  await expect(
    page.getByText("Authorization unavailable.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Attempt recorded" }),
  ).toBeDisabled();
  await expect(page.getByText("Change verified", { exact: true })).toHaveCount(
    0,
  );
  await captureTop(page, "held-review.png");
  expect(external).toEqual([]);
});
test("PRD drift invalidates the accepted gate while retaining the recorded review", async ({
  page,
}) => {
  await page.goto("/?mode=example");
  await page
    .getByRole("button", { name: "Product lifecycle", exact: true })
    .click();
  await page.getByLabel("Example actor").selectOption("jon");
  await page.getByRole("button", { name: "Accept gate review" }).click();
  await expect(page.getByText("Gate accepted", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Simulate PRD revision" }).click();
  await expect(
    page.getByText("Gate version 1 · Applicability: stale", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Accept gate review" }),
  ).toBeDisabled();
  await expect(page.getByText("Gate accepted", { exact: true })).toHaveCount(0);
  await page
    .getByText("Gate versions & reviews · 1 versions", { exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Gate version 1", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/^Jon Bell · accept ·/)).toBeVisible();
  await captureTop(page, "requirement-drift.png");
});
test("native story, task and bug remain peers and a bug traces its explicit blocking path", async ({
  page,
}) => {
  await page.goto("/?mode=example");
  await page.getByRole("button", { name: "Work map", exact: true }).click();
  for (const key of ["MX-110", "MX-121", "MX-137"]) {
    const row = page.getByRole("row").filter({
      has: page.getByRole("button", { name: new RegExp(`^${key} ·`) }),
    });
    await expect(row.getByRole("cell").nth(1)).toHaveText("MX-100");
  }
  await page
    .getByRole("button", {
      name: "MX-137 · Duplicate onboarding events",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Launch merchant onboarding",
      exact: true,
    }),
  ).toBeVisible();
  await captureTop(page, "work-map.png");
});
test("issue panel and Confluence macro render only the selected source context", async ({
  page,
}) => {
  await page.goto("/?mode=example&surface=issue");
  await expect(
    page.getByRole("heading", { name: "Commitment impact", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Launch merchant onboarding",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Publish reconciliation export",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.goto("/?mode=example&surface=page");
  await expect(
    page.getByRole("heading", { name: "Commitments & lifecycle", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "REQ-07", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Merchant launch readiness",
      exact: true,
    }),
  ).toBeVisible();
  await captureTop(page, "confluence-macro-example.png");
});
test("desktop and narrow layouts have no serious accessibility failures or page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/?mode=example");
  await expect(
    page.getByRole("heading", { name: "Every promise, connected." }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: resolve(evidence, "desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator(".commitments .table-scroll")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: resolve(evidence, "mobile.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "+ New commitment", exact: true })
    .click();
  const modal = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(modal.violations).toEqual([]);
  await page.screenshot({ path: resolve(evidence, "mobile-form.png") });
  const save = page
    .getByRole("dialog")
    .getByRole("button", { name: "Save draft for owner acceptance" });
  await save.scrollIntoViewIfNeeded();
  await expect(save).toBeInViewport();
  await page.screenshot({ path: resolve(evidence, "mobile-form-bottom.png") });
  await save.focus();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Close dialog" }),
  ).toBeFocused();
});
test("200 percent equivalent viewport keeps the form and its submit control reachable", async ({
  browser,
}) => {
  // 1440×1000 physical pixels at 2× scale gives the 720×500 CSS viewport
  // used by browser zoom. This is a reflow emulation, not a native zoom test.
  const context = await browser.newContext({
    viewport: { width: 720, height: 500 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173/?mode=example");
  await expect(
    page.getByRole("heading", { name: "Every promise, connected." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "+ New commitment", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "+ New commitment", exact: true })
    .click();
  const save = page.getByRole("button", {
    name: "Save draft for owner acceptance",
  });
  await save.scrollIntoViewIfNeeded();
  await expect(save).toBeInViewport();
  await page.screenshot({ path: resolve(evidence, "zoom-200-form.png") });
  await context.close();
});

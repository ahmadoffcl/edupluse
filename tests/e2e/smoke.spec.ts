import { expect, test } from "@playwright/test";

test("public landing page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "EduPulse" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /open workspace/i }),
  ).toBeVisible();
});

test("login page exposes production auth controls", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: /welcome back to edupulse/i }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "student" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "teacher" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "admin" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: /demo access/i })).toHaveCount(
    0,
  );
});

test("admin email login reaches admin dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill("edupluse@admin.com");
  await page.getByPlaceholder("Password").fill("123098xyy");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("heading", {
      name: /enterprise-grade control over every institute workflow/i,
    }),
  ).toBeVisible();
});

test("student dashboard is protected without a signed session", async ({
  page,
}) => {
  await page.goto("/student");
  await expect(page).toHaveURL(/\/login\?next=%2Fstudent$/);
});

import { expect, test } from "@playwright/test"

test("register, create company, create event, and see dashboard data", async ({ page }) => {
  const stamp = Date.now()
  const email = `e2e-${stamp}@example.com`
  const password = "password123"
  const companyName = `E2E Company ${stamp}`
  const eventTitle = `E2E Briefing ${stamp}`

  await page.goto("/auth/sign-up")

  await page.locator('input[name="name"]').fill("E2E User")
  await page.locator('input[name="email"]').fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole("button", { name: /Create account/i }).click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible()

  await page.getByRole("button", { name: /Companies/i }).click()
  await expect(page.getByRole("heading", { name: "Companies", exact: true })).toBeVisible()

  await page.getByPlaceholder("Company").fill(companyName)
  await page.getByRole("button", { name: /^Add$/i }).click()
  await expect(page.getByText(companyName)).toBeVisible()

  await page.getByRole("button", { name: /Events/i }).click()
  await expect(page.getByRole("heading", { name: "Events", exact: true })).toBeVisible()

  await page.getByPlaceholder("Event").fill(eventTitle)
  await page.locator("select").first().selectOption({ label: companyName })
  await page.locator('[aria-label="Start date"] input').nth(0).fill("2026")
  await page.locator('[aria-label="Start date"] input').nth(1).fill("08")
  await page.locator('[aria-label="Start date"] input').nth(2).fill("24")
  await page.locator('[aria-label="End date"] input').nth(0).fill("2026")
  await page.locator('[aria-label="End date"] input').nth(1).fill("08")
  await page.locator('[aria-label="End date"] input').nth(2).fill("24")
  await page.getByRole("button", { name: /^Add$/i }).click()
  await expect(page.getByText(eventTitle)).toBeVisible()

  await page.getByRole("button", { name: /Dashboard/i }).click()
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible()
  await expect(page.getByText(eventTitle, { exact: true })).toBeVisible()

  await page.getByRole("button", { name: /Settings/i }).click()
  const logout = page.getByRole("button", { name: /Logout|Sign out/i })
  if (await logout.isVisible()) {
    await logout.click()
    await expect(page).toHaveURL(/\/auth\/sign-in/)
  }
})

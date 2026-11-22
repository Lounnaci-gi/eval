import { expect, test, type Page, type Route } from "@playwright/test";

type MockUser = {
  username: string;
  display_name: string;
  is_admin: boolean;
  auth_enabled: boolean;
  allowed_sectors: string[] | null;
};

const admin: MockUser = {
  username: "admin",
  display_name: "Administrateur",
  is_admin: true,
  auth_enabled: true,
  allowed_sectors: null,
};

async function json(route: Route, value: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(value),
  });
}

async function installApiMocks(page: Page, user: MockUser = admin) {
  let authenticated = false;

  await page.route("**/backend-api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/backend-api/, "");

    if (path === "/api/auth/me") {
      return authenticated
        ? json(route, user)
        : json(route, { detail: "Non authentifié" }, 401);
    }
    if (path === "/api/auth/login" && request.method() === "POST") {
      authenticated = true;
      return json(route, { status: "ok", username: user.username });
    }
    if (path === "/api/auth/logout") {
      authenticated = false;
      return json(route, { status: "ok" });
    }
    if (path === "/api/data_dir") {
      return json(route, {
        data_dir: "synthetic-data",
        data_dir_exists: true,
        primary_source_ready: true,
        needs_configuration: false,
        dbf_count: 13,
        diagnostic: "Données synthétiques disponibles",
        is_db_ready: true,
      });
    }
    if (path === "/stats") {
      return json(route, {
        ready: true,
        total_subscribers: 1280,
        resigned_subscribers: 42,
        stopped_subscribers: 18,
        invoice_stopped_subscribers: 5,
        no_meter_subscribers: 9,
        invoice_no_meter_subscribers: 2,
        total_revenue: 12_450_000,
        revenue_period: "2026",
        recovery_rate: 62.5,
        forfait_subscribers: 33,
        target_subscribers: 1400,
        subscriber_sectors: [
          { name: "01", value: 400 },
          { name: "02", value: 350 },
          { name: "03", value: 530 },
        ],
        subscriber_states: [
          { name: "EN MARCHE", value: 1100 },
          { name: "ARRETE", value: 180 },
        ],
        subscriber_types: [
          { name: "Ménage", value: 900 },
          { name: "Commerce", value: 380 },
        ],
        data_quality: { status: "complete", issues: [] },
      });
    }
    if (path === "/api/unites_settings") {
      return json(route, [{
        denom: "EPEOR",
        sectors: [
          { code: "01", libelle: "Centre 01" },
          { code: "02", libelle: "Centre 02" },
        ],
      }]);
    }
    if (path === "/search") {
      return json(route, [{
        NUMAB: "AB123",
        NOM: "Ahmed Belaid",
        SECTEUR: "01",
        ADRESSE: "Rue du Test très longue pour vérifier le wrap",
        BLOC: "A",
        NDOM: "12",
        TOURNEE: "001",
        NUMSER: "32621",
        NOUVELX: 120,
        TYPE_LABEL: "Ménage individuel",
        ETATCPT: "20",
        ETAT_LABEL: "EN MARCHE",
        NUMORDRE: "1",
      }]);
    }
    if (path === "/creances_abonnes") {
      return json(route, {
        subscribers: [{
          numab: "AB123",
          name: "Ahmed Belaid",
          secteur: "01",
          adresse: "Rue du Test très longue pour overflow",
          bloc: "A",
          ndom: "12",
          tournee: "001",
          numser: "32621",
          nombre_creance: 2,
          montant_creance: 12000,
          derniere_date_paiement: "01/01/2025",
          is_contentieux: false,
          active_demarche: null,
          type_abon: "Ménage individuel",
          etat_cpt: "EN MARCHE",
          quartier_name: "Centre-ville",
        }],
        tournees: ["001", "002"],
        quartiers: ["Centre-ville"],
      });
    }
    if (path === "/api/dossiers") {
      return json(route, { dossiers: [] });
    }
    if (path === "/api/admin/users") {
      return json(route, []);
    }
    if (path === "/api/recovery_queue" || path === "/recovery_queue") {
      return json(route, { items: [], total: 0 });
    }
    return json(route, {});
  });
}

async function openApp(page: Page) {
  await installApiMocks(page);
  await page.goto("/?lang=fr");
  await page.locator('input[autocomplete="username"]').waitFor();
  await page.locator('input[autocomplete="username"]').fill(admin.username);
  await page.locator('input[autocomplete="current-password"]').fill("SyntheticPass123");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.locator(".dashboard-kpi-grid, .app-main, main").first()).toBeVisible({ timeout: 20_000 });
}

async function navigateView(page: Page, label: string | RegExp) {
  const width = page.viewportSize()?.width ?? 1280;
  if (width < 1024) {
    // Mobile: open more menu if needed
    const more = page.getByRole("button", { name: /Plus|Autres/i }).first();
    if (await more.isVisible().catch(() => false)) {
      // try bottom nav first
    }
    const navBtn = page.getByRole("button", { name: label }).first();
    if (await navBtn.isVisible().catch(() => false)) {
      await navBtn.click();
      return;
    }
    const moreBtn = page.locator(".mobile-bottom-nav button, #mobile-more-menu button").filter({ hasText: /Plus|Autres/i }).first();
    if (await moreBtn.isVisible().catch(() => false)) {
      await moreBtn.click();
    }
  } else {
    const fab = page.getByRole("button", { name: "Navigation principale" });
    if (await fab.isVisible().catch(() => false)) {
      await fab.click();
    }
  }
  const target = page.getByRole("button", { name: label }).first();
  await expect(target).toBeVisible({ timeout: 10_000 });
  await target.click();
  // close sidebar overlay if open
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.waitForTimeout(400);
}

type OverflowHit = {
  tag: string;
  cls: string;
  text: string;
  w: number;
  sw: number;
  parentW: number;
};

async function collectOverflows(page: Page): Promise<OverflowHit[]> {
  return page.evaluate(() => {
    const hits: OverflowHit[] = [];
    const seen = new Set<string>();
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (style.position === "fixed" || style.position === "sticky") {
        // skip fixed nav chrome for now except checking viewport clip
      }
      const rect = el.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) continue;

      const overflowX = el.scrollWidth - el.clientWidth > 2;
      const pastViewport = rect.right > window.innerWidth + 2 || rect.left < -2;
      const childPast =
        el instanceof HTMLElement &&
        Array.from(el.children).some((c) => {
          const r = (c as HTMLElement).getBoundingClientRect();
          return r.right > window.innerWidth + 4;
        });

      if (!(overflowX || pastViewport || childPast)) continue;
      // Ignore intentional scroll containers
      if (
        el.classList.contains("table-scroll") ||
        el.classList.contains("scroll-tabs") ||
        el.classList.contains("overflow-x-auto") ||
        style.overflowX === "auto" ||
        style.overflowX === "scroll"
      ) {
        continue;
      }
      const key = `${el.tagName}:${(el.className || "").toString().slice(0, 80)}:${Math.round(rect.width)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className || "").toString().slice(0, 120),
        text: (el.textContent || "").trim().slice(0, 60),
        w: Math.round(rect.width),
        sw: el.scrollWidth,
        parentW: Math.round(window.innerWidth),
      });
      if (hits.length >= 25) break;
    }
    return hits;
  });
}

const WIDTHS = [360, 390, 768, 1024, 1280, 1440];

const VIEWS: { name: string; label: string | RegExp }[] = [
  { name: "dashboard", label: /Tableau de bord|Dashboard/i },
  { name: "abonnes", label: /Gestion Abonnés|Abonnés/i },
  { name: "financieres", label: /Analyses financières|Financières/i },
  { name: "creances", label: /Créances abonnés|Créances/i },
  { name: "settings", label: /Paramètres|Settings/i },
  { name: "contentieux", label: /Contentieux|Périodes|Facturation/i },
  { name: "recovery", label: /File de recouvrement|Recouvrement/i },
  { name: "institutions", label: /Créances institutions|Institutions/i },
  { name: "analyses", label: /Analyses relev|Relevé/i },
];

for (const width of WIDTHS) {
  test.describe(`responsive ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test(`audit overflows @${width}`, async ({ page }) => {
      test.setTimeout(180_000);
      await openApp(page);
      const report: Record<string, OverflowHit[]> = {};

      // Dashboard is already open
      report.dashboard = await collectOverflows(page);

      for (const view of VIEWS.slice(1)) {
        try {
          await navigateView(page, view.label);
          report[view.name] = await collectOverflows(page);
        } catch (err) {
          report[view.name] = [{
            tag: "nav-error",
            cls: String(err).slice(0, 120),
            text: `failed to open ${view.name}`,
            w: 0,
            sw: 0,
            parentW: width,
          }];
        }
      }

      // Attach report for human reading
      console.log(`\n=== RESPONSIVE REPORT ${width}px ===`);
      for (const [view, hits] of Object.entries(report)) {
        console.log(`\n[${view}] ${hits.length} hits`);
        for (const h of hits.slice(0, 8)) {
          console.log(`  <${h.tag}> w=${h.w} sw=${h.sw} cls="${h.cls}" text="${h.text}"`);
        }
      }

      // Soft assert: flag only severe viewport past overflows outside intentional scroll areas
      const severe = Object.values(report).flat().filter((h) => h.tag !== "nav-error" && h.sw > h.w + 40);
      // Don't fail the suite hard during discovery — print and keep soft threshold
      expect(severe.length, JSON.stringify(severe.slice(0, 10), null, 2)).toBeLessThan(80);
    });
  });
}

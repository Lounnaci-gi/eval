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

const subscriber = {
  NUMAB: "AB123",
  NOM: "Ahmed Belaid",
  SECTEUR: "01",
  ADRESSE: "Rue du Test",
  BLOC: "A",
  NDOM: "12",
  TOURNEE: "001",
  NUMSER: "32621",
  NOUVELX: 120,
  TYPE_LABEL: "Ménage individuel",
  ETATCPT: "20",
  ETAT_LABEL: "EN MARCHE",
  NUMORDRE: "1",
};

const debtRow = {
  numab: "AB123",
  name: "Ahmed Belaid",
  secteur: "01",
  adresse: "Rue du Test",
  bloc: "A",
  ndom: "12",
  tournee: "001",
  numser: "32621",
  nombre_creance: 2,
  montant_creance: 12000,
  derniere_date_paiement: "01/01/2025",
  is_contentieux: false,
  active_demarche: null,
};

const dossier = {
  statut_abonne: "Actif",
  etape_recouvrement: "Amiable",
  has_mise_en_demeure: false,
  has_echeancier: false,
  transmis_huissier: false,
  transmis_cours: false,
  execution_jugement: false,
  reglement_conciliation: false,
  appel: false,
  dossier_en_delibere: false,
  prononce_jugement: false,
  notification_jugement: false,
  dossier_en_delibere_appel: false,
  rendu_arret: false,
  notification_arret: false,
  heritiers: [],
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
        total_subscribers: 1,
        resigned_subscribers: 0,
        stopped_subscribers: 0,
        invoice_stopped_subscribers: 0,
        no_meter_subscribers: 0,
        invoice_no_meter_subscribers: 0,
        total_revenue: 12000,
        revenue_period: "2026",
        recovery_rate: 50,
        forfait_subscribers: 0,
        target_subscribers: 0,
        subscriber_sectors: [],
        subscriber_states: [],
        subscriber_types: [],
        data_quality: { status: "complete", issues: [] },
        ...(user.is_admin ? {} : { allowed_sectors: user.allowed_sectors }),
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
      return json(route, [subscriber]);
    }
    if (path === "/abonne_factures") {
      return json(route, [{
        NUMFACT: "F-001",
        TYPE: "Facture",
        PERIODE: "2026-01",
        DATFACT: "20260101",
        DATSAISIE: "20260101",
        DATREG: "",
        MONTTC: 12000,
        VOLUME: 42,
      }]);
    }
    if (path === "/creances_abonnes") {
      return json(route, { subscribers: [debtRow], tournees: ["001"], quartiers: [] });
    }
    if (path === "/api/dossiers") {
      return json(route, {
        dossiers: [{
          ...debtRow,
          has_dossier: true,
          secteur: "01",
          statut_abonne: "Actif",
          etape_recouvrement: "Amiable",
          updated_at: "2026-01-01",
        }],
      });
    }
    if (path === "/api/abonne/AB123/dossier" && request.method() === "POST") {
      return json(route, { status: "ok" });
    }
    if (path === "/api/abonne/AB123/dossier") {
      return json(route, dossier);
    }
    if (path === "/api/abonne/AB123") {
      return json(route, { numab: "AB123", name: "Ahmed Belaid", statut_abonne: "Actif" });
    }
    if (path === "/api/admin/users") {
      return json(route, []);
    }
    return json(route, {});
  });
}

async function openApp(page: Page, user: MockUser = admin) {
  await installApiMocks(page, user);
  await page.goto("/?lang=fr");
  await page.locator('input[autocomplete="username"]').waitFor();
  await page.locator('input[autocomplete="username"]').fill(user.username);
  await page.locator('input[autocomplete="current-password"]').fill("SyntheticPass123");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByTestId("desktop-navigation")).toHaveCount(0);
}

async function openSidebar(page: Page) {
  await page.getByRole("button", { name: "Navigation principale" }).click();
  await expect(page.getByTestId("desktop-navigation")).toBeVisible();
}

test("authenticates with the mocked session and loads the dashboard", async ({ page }) => {
  await openApp(page);
  await expect(page.getByText("Ahmed Belaid", { exact: true })).toHaveCount(0);
  await expect(page.getByText("1", { exact: true }).first()).toBeVisible();
});

test("opens the command palette with Ctrl+K and searches for subscribers", async ({ page }) => {
  await openApp(page);
  await expect(page.locator(".dashboard-kpi-grid")).toBeVisible();
  await page.keyboard.press("Control+k");

  const palette = page.getByRole("dialog", { name: "Recherche rapide" });
  await expect(palette).toBeVisible();
  await palette.getByRole("searchbox").fill("AB123");
  await expect(palette.getByRole("option").first()).toContainText("Rechercher « AB123 » parmi les abonnés");

  await page.keyboard.press("Escape");
  await expect(palette).toHaveCount(0);
});

test("restricts sector choices for a non-admin user", async ({ page }) => {
  await openApp(page, {
    username: "agent01",
    display_name: "Agent secteur 01",
    is_admin: false,
    auth_enabled: true,
    allowed_sectors: ["01"],
  });
  await openSidebar(page);
  await page.getByRole("button", { name: "Gestion Abonnés" }).click();

  const sectorButton = page.getByRole("button", { name: /Centre 01/ }).first();
  await expect(sectorButton).toBeVisible();
  await sectorButton.click();
  await expect(page.getByRole("button", { name: /Centre 02/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Tous les centres/ })).toHaveCount(0);
});

test("searches a subscriber and opens their invoice history", async ({ page }) => {
  await openApp(page);
  await openSidebar(page);
  await page.getByRole("button", { name: "Gestion Abonnés" }).click();

  const search = page.getByPlaceholder("Nom, adresse, N° chèque/versement, NUMAB, compteur ou état...");
  await search.fill("AB123");
  await expect(page.getByText("AB123", { exact: true }).last()).toBeVisible();
  await page.getByText("AB123", { exact: true }).last().click();
  await expect(page.getByText("Délai moyen", { exact: true })).toBeVisible();
  await expect(page.getByText("Factures analysées", { exact: true })).toBeVisible();
});

test("shows high-debt accounts first in the recovery worklist", async ({ page }) => {
  await openApp(page);
  await openSidebar(page);
  await page.getByRole("button", { name: "Priorités de recouvrement" }).click();

  await expect(page.getByRole("heading", { name: "Priorités de recouvrement" })).toBeVisible();
  await expect(page.getByText(/12[\s\u00a0\u202f]000,00 DA/).first()).toBeVisible();
  await page.getByRole("button", { name: "Factures" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByText("F-001")).toBeVisible();
});

test("opens and saves a legal dossier", async ({ page }) => {
  await openApp(page);
  await openSidebar(page);
  await page.getByRole("button", { name: "Service contentieux" }).click();
  await page.getByRole("button", { name: "Dossiers Contentieux" }).click();
  await page.getByText("AB123", { exact: true }).last().click();

  await expect(page.getByRole("heading", { name: "Dossier Contentieux" })).toBeVisible();
  await page.getByRole("button", { name: "Sauvegarder le dossier" }).click();
  await expect(page.getByText("Dossier mis à jour avec succès")).toBeVisible();
});

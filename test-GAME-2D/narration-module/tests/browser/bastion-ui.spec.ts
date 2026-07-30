import { expect, test } from "@playwright/test";

test("un bastion établi est restauré sans contenu de gestion inventé", async ({ page }) => {
  await page.goto("/narration-module/tests/browser/bastion-ui.html");

  const narration = page.getByText(
    /L’Auberge du Vieux Pont appartient désormais à Aryn.*aucun aménagement ni occupant supplémentaire/iu
  );
  await expect(narration).toHaveCount(1);
  const completedWork = page.getByText(
    /Après une demi-heure à dégager les planches brisées.*l’espace peut désormais être aménagé/iu
  );
  await expect(completedWork).toHaveCount(1);
  const assignment = page.getByText(
    /Mira exerce désormais le rôle « intendante ».*ses initiatives restent les siennes/iu
  );
  const autonomousActivity = page.getByText(
    /Sans attendre Aryn, Mira fait le tour de l’auberge.*volets exposés au vent du pont/iu
  );
  const opportunity = page.getByText(
    /Un marchand de passage s’arrête à l’auberge.*L’offre reste ouverte/iu
  );
  const defense = page.getByText(
    /Des silhouettes armées franchissent la cour.*issue reste indécise/iu
  );
  await expect(assignment).toHaveCount(1);
  await expect(autonomousActivity).toHaveCount(1);
  await expect(opportunity).toHaveCount(1);
  await expect(defense).toHaveCount(1);
  await expect(page.getByRole("region", {
    name: "Défense tactique en attente"
  })).toContainText("Raid nocturne");
  await expect(page.getByRole("button", {
    name: "Ouvrir le plateau tactique"
  })).toBeDisabled();
  await expect(page.getByRole("log")).not.toContainText("private-red-ledger");
  await expect(page.getByRole("log")).not.toContainText("850");
  await expect(page.getByRole("log")).not.toContainText("Grande salle");
  await expect(page.getByRole("log")).not.toContainText("Conserver son indépendance");
  await expect(page.getByRole("log")).not.toContainText("privateSupplierMargin");
  await expect(page.getByRole("log")).not.toContainText("42");
  await expect(narration).not.toContainText("garde");
  await expect(page.getByLabel("Entrée libre du joueur")).toBeEnabled();
  await expect(page.getByRole("alert")).toHaveCount(0);

  await page.reload();

  await expect(narration).toHaveCount(1);
  await expect(completedWork).toHaveCount(1);
  await expect(assignment).toHaveCount(1);
  await expect(autonomousActivity).toHaveCount(1);
  await expect(opportunity).toHaveCount(1);
  await expect(defense).toHaveCount(1);
  await expect(page.getByRole("log")).not.toContainText("private-red-ledger");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

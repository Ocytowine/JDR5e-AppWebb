# Governance And Geographic Zones Schema

This file defines the target split for the current `Zones` tool.

## Problem

The current model mixes two different concepts:

- political control: `territories` and `regions`
- geographic or cultural zones: also forced into `territories` and `regions`

That becomes too flat for lore such as:

- a governance model like `primauté`
- a political territory like `astryade`
- administrative regions inside that territory
- geographic zones that may exist outside any governance

## Target Split

### 1. Governance

Governance defines the political model.

Example:

- `primacy`
- `kingdom`
- `duchy`
- `republic`

Type:

```ts
type WorldMapGovernance = {
  id: string;
  wikiEntityId: string;
  label: string;
  model: GovernanceModelId;
  territoryId: string;
  capitalCityId?: string;
  color: string;
};
```

### 2. Governance Territory

This is the broad political territory governed by a governance.

Example:

- `Astryade`

Type:

```ts
type WorldMapGovernanceTerritory = {
  id: string;
  wikiEntityId: string;
  governanceId?: string;
  labelCell: MapCell;
  color: string;
};
```

### 3. Governance Region

This is an administrative subdivision of a governance territory.

Type:

```ts
type WorldMapGovernanceRegion = {
  id: string;
  wikiEntityId: string;
  governanceId?: string;
  territoryId?: string;
  principalCityId?: string;
  labelCell: MapCell;
  color: string;
};
```

### 4. Geographic Zone

This is non-political.

It can represent:

- a natural area
- a cultural area
- a historical area
- a religious area
- a strategic area

Type:

```ts
type WorldMapGeographicZone = {
  id: string;
  wikiEntityId?: string;
  label: string;
  kind: GeographicZoneKind;
  labelCell: MapCell;
  color: string;
};
```

## Cell Ownership Rules

Each cell should evolve toward this structure:

```ts
type MapCellData = {
  governanceTerritoryId?: string;
  governanceRegionId?: string;
  geographicZoneIds?: string[];
};
```

Rules:

- one cell = zero or one governance territory
- one cell = zero or one governance region
- one cell = zero to many geographic zones

## City Links

Cities can support governance directly.

```ts
type GovernanceCityRole = "capital" | "primary" | "secondary";
```

And on a city:

```ts
type WorldMapCity = {
  governanceId?: string;
  governanceRole?: GovernanceCityRole;
};
```

This allows:

- a capital city for a governance
- a principal city for a region
- secondary cities without forcing a political role everywhere

## Compatibility Strategy

The current layout still contains:

- `territories`
- `regions`
- `territoryWikiId`
- `regionWikiId`

The new fields are added as optional fields first.

Migration path:

1. Keep current rendering alive.
2. Add `governances`, `governanceTerritories`, `governanceRegions`, `geographicZones`.
3. Add new cell fields.
4. Move the `Zones` UI into:
   - `Gouvernance`
   - `Zones geo`
5. Migrate viewers and overlays.
6. Remove the old flat political model only after the UI is stable.

## UI Target

The current `Zones` tab should split into two panels:

### Gouvernance

- governance selection
- political territory selection / creation
- administrative region selection / creation
- capital and principal city linkage
- apply to current multi-cell selection

### Zones geo

- zone selection / creation
- zone kind selection
- apply or remove on multi-cell selection
- support multiple zones on the same cell

## Example Mapping

For the lore you cited:

- governance wiki entry: `gouvernances/primauté`
- political territory wiki entry: `territoire/astryade`

Suggested mapping:

```ts
governance = {
  id: "gov-astryade",
  wikiEntityId: "primaute",
  label: "Primauté",
  model: "primacy",
  territoryId: "territory-astryade",
  capitalCityId: "city-..."
}

governanceTerritory = {
  id: "territory-astryade",
  wikiEntityId: "astryade",
  governanceId: "gov-astryade",
  labelCell: { x: 0, y: 0 },
  color: "#d9b25f"
}
```

## Why This Split Is Better

- governance rules become explicit
- political regions stop competing with natural zones
- the wiki link is clearer
- map logic becomes easier to evolve
- route, travel, faction, and event systems can later query political and geographic layers separately

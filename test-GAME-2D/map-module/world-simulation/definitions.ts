import type { PressureDefinition, WorldActionDefinition } from "./types";

export const PRESSURE_DEFINITIONS: PressureDefinition[] = [
  {
    id: "district-criminal-pressure",
    pressureType: "criminal",
    entityKind: "district",
    terms: [
      { source: { kind: "state", key: "danger" }, weight: 0.4 },
      { source: { kind: "state", key: "surveillance" }, weight: 0.25, invert: true },
      { source: { kind: "factionInfluence", factionTag: "criminal" }, weight: 0.35 }
    ],
    clamp: [0, 100]
  },
  {
    id: "district-social-pressure",
    pressureType: "social",
    entityKind: "district",
    terms: [
      { source: { kind: "state", key: "fear" }, weight: 0.35 },
      { source: { kind: "state", key: "agitation" }, weight: 0.35 },
      { source: { kind: "state", key: "commerce" }, weight: 0.3, invert: true }
    ],
    clamp: [0, 100]
  },
  {
    id: "district-religious-pressure",
    pressureType: "religious",
    entityKind: "district",
    terms: [
      { source: { kind: "factionInfluence", factionTag: "religious" }, weight: 0.45 },
      { source: { kind: "state", key: "fear" }, weight: 0.25 },
      { source: { kind: "state", key: "agitation" }, weight: 0.2 },
      { source: { kind: "state", key: "surveillance" }, weight: 0.1, invert: true }
    ],
    clamp: [0, 100]
  },
  {
    id: "city-commercial-pressure",
    pressureType: "commercial",
    entityKind: "city",
    terms: [
      { source: { kind: "state", key: "supply" }, weight: 0.35, invert: true },
      { source: { kind: "state", key: "commerce" }, weight: 0.25, invert: true },
      { source: { kind: "routeLoad" }, weight: 0.4, invert: true }
    ],
    clamp: [0, 100]
  },
  {
    id: "route-military-pressure",
    pressureType: "military",
    entityKind: "route",
    terms: [
      { source: { kind: "state", key: "ambushRisk" }, weight: 0.45 },
      { source: { kind: "state", key: "security" }, weight: 0.35, invert: true },
      { source: { kind: "mobilePresence" }, weight: 0.2 }
    ],
    clamp: [0, 100]
  },
  {
    id: "region-political-pressure",
    pressureType: "political",
    entityKind: "region",
    terms: [
      { source: { kind: "state", key: "stability" }, weight: 0.4, invert: true },
      { source: { kind: "state", key: "politicalControl" }, weight: 0.35, invert: true },
      { source: { kind: "state", key: "externalThreat" }, weight: 0.25 }
    ],
    clamp: [0, 100]
  }
];

export const WORLD_ACTION_DEFINITIONS: WorldActionDefinition[] = [
  {
    id: "patrol",
    label: "Patrol",
    actorKinds: ["faction"],
    targetKinds: ["district"],
    compatibleObjectives: ["take_control_place", "eliminate_threat", "protect_secret", "restore_order", "contain_unrest"],
    cooldown: 1,
    basePriority: 48,
    preconditions: [{ type: "target_pressure", pressure: "criminal", op: "gte", value: 45 }],
    costs: [{ selector: "actor", type: "state", key: "resources", amount: -4 }],
    successEffects: [
      { selector: "target", type: "state", key: "danger", amount: -12 },
      { selector: "target", type: "state", key: "surveillance", amount: 8 },
      { selector: "actor", type: "cooldown", actionId: "patrol", ticks: 1 }
    ],
    failureEffects: [
      { selector: "target", type: "state", key: "fear", amount: 6 },
      { selector: "actor", type: "state", key: "resources", amount: -3 }
    ],
    risks: [{ kind: "exposure", threshold: 60, severity: 10 }],
    eventType: "action_resolved",
    diffusion: {
      signalKind: "military",
      rumorTags: ["patrol", "security"],
      signalIntensity: 42
    }
  },
  {
    id: "extort",
    label: "Extort",
    actorKinds: ["faction"],
    targetKinds: ["district"],
    compatibleObjectives: ["acquire_resource", "extend_influence", "weaken_rival"],
    cooldown: 1,
    basePriority: 56,
    preconditions: [
      { type: "objective_category", category: "acquire_resource" },
      { type: "target_pressure", pressure: "criminal", op: "gte", value: 40 }
    ],
    costs: [],
    successEffects: [
      { selector: "actor", type: "state", key: "resources", amount: 10 },
      { selector: "actor", type: "state", key: "influence", amount: 4 },
      { selector: "target", type: "state", key: "fear", amount: 12 },
      { selector: "target", type: "state", key: "commerce", amount: -8 },
      { selector: "actor", type: "cooldown", actionId: "extort", ticks: 1 }
    ],
    failureEffects: [
      { selector: "target", type: "state", key: "surveillance", amount: 8 },
      { selector: "actor", type: "state", key: "discretion", amount: -6 }
    ],
    risks: [{ kind: "exposure", threshold: 55, severity: 12 }],
    eventType: "criminal_pressure_spike",
    diffusion: {
      signalKind: "market",
      rumorTags: ["racketeering", "fear"],
      signalIntensity: 55
    }
  },
  {
    id: "recruit",
    label: "Recruit",
    actorKinds: ["faction"],
    targetKinds: ["district"],
    compatibleObjectives: ["recruit_agents", "extend_influence"],
    cooldown: 2,
    basePriority: 44,
    preconditions: [{ type: "objective_category", category: "recruit_agents" }],
    costs: [{ selector: "actor", type: "state", key: "resources", amount: -6 }],
    successEffects: [
      { selector: "actor", type: "state", key: "power", amount: 6 },
      { selector: "actor", type: "state", key: "influence", amount: 5 },
      { selector: "target", type: "state", key: "agitation", amount: 4 },
      { selector: "actor", type: "objective_progress", amount: 22 },
      { selector: "actor", type: "cooldown", actionId: "recruit", ticks: 2 }
    ],
    failureEffects: [{ selector: "actor", type: "state", key: "resources", amount: -2 }],
    risks: [{ kind: "exposure", threshold: 65, severity: 8 }],
    eventType: "faction_recruited",
    diffusion: {
      signalKind: "institutional",
      rumorTags: ["recruitment", "new_faces"],
      signalIntensity: 34
    }
  },
  {
    id: "investigate",
    label: "Investigate",
    actorKinds: ["faction"],
    targetKinds: ["district"],
    compatibleObjectives: ["search_object", "recover_person", "eliminate_threat"],
    cooldown: 1,
    basePriority: 40,
    preconditions: [{ type: "objective_category", category: "search_object" }],
    costs: [{ selector: "actor", type: "state", key: "resources", amount: -3 }],
    successEffects: [
      { selector: "actor", type: "objective_progress", amount: 28 },
      { selector: "target", type: "state", key: "surveillance", amount: 5 },
      { selector: "actor", type: "cooldown", actionId: "investigate", ticks: 1 }
    ],
    failureEffects: [{ selector: "target", type: "state", key: "danger", amount: 4 }],
    risks: [{ kind: "delay", threshold: 60, severity: 10 }],
    eventType: "special_objective_progressed",
    diffusion: {
      signalKind: "institutional",
      rumorTags: ["search", "questions"],
      signalIntensity: 28
    }
  },
  {
    id: "sanctify_site",
    label: "Sanctify Site",
    actorKinds: ["faction"],
    targetKinds: ["district"],
    compatibleObjectives: ["protect_secret", "search_object", "extend_influence", "reduce_fear", "contain_unrest"],
    cooldown: 2,
    basePriority: 46,
    preconditions: [{ type: "target_pressure", pressure: "religious", op: "gte", value: 40 }],
    costs: [{ selector: "actor", type: "state", key: "resources", amount: -3 }],
    successEffects: [
      { selector: "target", type: "state", key: "fear", amount: -8 },
      { selector: "target", type: "state", key: "agitation", amount: -10 },
      { selector: "target", type: "state", key: "surveillance", amount: 6 },
      { selector: "actor", type: "state", key: "influence", amount: 4 },
      { selector: "actor", type: "objective_progress", amount: 20 },
      { selector: "actor", type: "cooldown", actionId: "sanctify_site", ticks: 2 }
    ],
    failureEffects: [
      { selector: "target", type: "state", key: "fear", amount: 6 },
      { selector: "actor", type: "state", key: "discretion", amount: -4 }
    ],
    risks: [{ kind: "exposure", threshold: 62, severity: 9 }],
    eventType: "action_resolved",
    diffusion: {
      signalKind: "religious",
      rumorTags: ["ritual", "sanctuary"],
      signalIntensity: 46
    }
  },
  {
    id: "escort_convoy",
    label: "Escort Convoy",
    actorKinds: ["mobileActor"],
    targetKinds: ["route"],
    compatibleObjectives: ["open_route", "acquire_resource", "recover_person"],
    cooldown: 1,
    basePriority: 47,
    preconditions: [{ type: "self_state", key: "security", op: "gte", value: 35 }],
    costs: [{ selector: "actor", type: "state", key: "fatigue", amount: 8 }],
    successEffects: [
      { selector: "target", type: "state", key: "traffic", amount: 8 },
      { selector: "target", type: "state", key: "security", amount: 6 },
      { selector: "actor", type: "cooldown", actionId: "escort_convoy", ticks: 1 }
    ],
    failureEffects: [
      { selector: "target", type: "state", key: "ambushRisk", amount: 6 },
      { selector: "actor", type: "state", key: "cargo", amount: -4 }
    ],
    risks: [{ kind: "attrition", threshold: 58, severity: 9 }],
    eventType: "action_resolved",
    diffusion: {
      signalKind: "market",
      rumorTags: ["convoy", "road"],
      signalIntensity: 24
    }
  },
  {
    id: "secure_route",
    label: "Secure Route",
    actorKinds: ["faction", "mobileActor"],
    targetKinds: ["route"],
    compatibleObjectives: ["open_route", "eliminate_threat", "extend_influence", "secure_corridor", "stabilize_supply"],
    cooldown: 2,
    basePriority: 52,
    preconditions: [{ type: "target_pressure", pressure: "military", op: "gte", value: 45 }],
    costs: [{ selector: "actor", type: "state", key: "resources", amount: -5 }],
    successEffects: [
      { selector: "target", type: "state", key: "security", amount: 14 },
      { selector: "target", type: "state", key: "ambushRisk", amount: -14 },
      { selector: "actor", type: "objective_progress", amount: 18 },
      { selector: "actor", type: "cooldown", actionId: "secure_route", ticks: 2 }
    ],
    failureEffects: [{ selector: "actor", type: "state", key: "fatigue", amount: 6 }],
    risks: [{ kind: "delay", threshold: 64, severity: 12 }],
    eventType: "route_secured",
    diffusion: {
      signalKind: "military",
      rumorTags: ["route", "security"],
      signalIntensity: 38
    }
  },
  {
    id: "repair_route",
    label: "Repair Route",
    actorKinds: ["faction"],
    targetKinds: ["route"],
    compatibleObjectives: ["stabilize_supply", "secure_corridor", "open_route"],
    cooldown: 2,
    basePriority: 43,
    preconditions: [{ type: "self_state", key: "resources", op: "gte", value: 20 }],
    costs: [{ selector: "actor", type: "state", key: "resources", amount: -6 }],
    successEffects: [
      { selector: "target", type: "state", key: "materialState", amount: 16 },
      { selector: "target", type: "state", key: "traffic", amount: 6 },
      { selector: "target", type: "state", key: "ambushRisk", amount: -6 },
      { selector: "actor", type: "objective_progress", amount: 22 },
      { selector: "actor", type: "cooldown", actionId: "repair_route", ticks: 2 }
    ],
    failureEffects: [
      { selector: "target", type: "state", key: "materialState", amount: -4 },
      { selector: "actor", type: "state", key: "resources", amount: -3 }
    ],
    risks: [{ kind: "delay", threshold: 54, severity: 8 }],
    eventType: "action_resolved",
    diffusion: {
      signalKind: "institutional",
      rumorTags: ["works", "route"],
      signalIntensity: 24
    }
  },
  {
    id: "public_reassurance",
    label: "Public Reassurance",
    actorKinds: ["faction"],
    targetKinds: ["district"],
    compatibleObjectives: ["reduce_fear", "contain_unrest"],
    cooldown: 1,
    basePriority: 45,
    preconditions: [{ type: "target_pressure", pressure: "social", op: "gte", value: 45 }],
    costs: [{ selector: "actor", type: "state", key: "resources", amount: -2 }],
    successEffects: [
      { selector: "target", type: "state", key: "fear", amount: -14 },
      { selector: "target", type: "state", key: "agitation", amount: -12 },
      { selector: "target", type: "state", key: "surveillance", amount: 4 },
      { selector: "actor", type: "objective_progress", amount: 20 },
      { selector: "actor", type: "cooldown", actionId: "public_reassurance", ticks: 1 }
    ],
    failureEffects: [
      { selector: "target", type: "state", key: "agitation", amount: 6 },
      { selector: "actor", type: "state", key: "resources", amount: -2 }
    ],
    risks: [{ kind: "exposure", threshold: 58, severity: 8 }],
    eventType: "action_resolved",
    diffusion: {
      signalKind: "institutional",
      rumorTags: ["public_order", "reassurance"],
      signalIntensity: 30
    }
  },
  {
    id: "relief_distribution",
    label: "Relief Distribution",
    actorKinds: ["faction"],
    targetKinds: ["district"],
    compatibleObjectives: ["reduce_fear", "stabilize_supply", "contain_unrest"],
    cooldown: 2,
    basePriority: 44,
    preconditions: [{ type: "self_state", key: "resources", op: "gte", value: 20 }],
    costs: [{ selector: "actor", type: "state", key: "resources", amount: -5 }],
    successEffects: [
      { selector: "target", type: "state", key: "fear", amount: -10 },
      { selector: "target", type: "state", key: "agitation", amount: -8 },
      { selector: "target", type: "state", key: "commerce", amount: 6 },
      { selector: "actor", type: "objective_progress", amount: 22 },
      { selector: "actor", type: "cooldown", actionId: "relief_distribution", ticks: 2 }
    ],
    failureEffects: [
      { selector: "target", type: "state", key: "agitation", amount: 5 },
      { selector: "target", type: "state", key: "fear", amount: 3 }
    ],
    risks: [{ kind: "delay", threshold: 55, severity: 7 }],
    eventType: "action_resolved",
    diffusion: {
      signalKind: "market",
      rumorTags: ["aid", "distribution"],
      signalIntensity: 26
    }
  },
  {
    id: "reopen_market",
    label: "Reopen Market",
    actorKinds: ["faction"],
    targetKinds: ["district"],
    compatibleObjectives: ["reopen_market", "stabilize_supply"],
    cooldown: 2,
    basePriority: 46,
    preconditions: [{ type: "self_state", key: "resources", op: "gte", value: 18 }],
    costs: [{ selector: "actor", type: "state", key: "resources", amount: -5 }],
    successEffects: [
      { selector: "target", type: "state", key: "commerce", amount: 14 },
      { selector: "target", type: "state", key: "fear", amount: -6 },
      { selector: "target", type: "state", key: "agitation", amount: -4 },
      { selector: "actor", type: "objective_progress", amount: 24 },
      { selector: "actor", type: "cooldown", actionId: "reopen_market", ticks: 2 }
    ],
    failureEffects: [
      { selector: "target", type: "state", key: "fear", amount: 4 },
      { selector: "target", type: "state", key: "commerce", amount: -4 }
    ],
    risks: [{ kind: "delay", threshold: 56, severity: 7 }],
    eventType: "action_resolved",
    diffusion: {
      signalKind: "market",
      rumorTags: ["market", "reopening"],
      signalIntensity: 34
    }
  },
  {
    id: "inspect_customs",
    label: "Inspect Customs",
    actorKinds: ["faction"],
    targetKinds: ["district"],
    compatibleObjectives: ["restore_order", "reopen_market", "contain_unrest"],
    cooldown: 1,
    basePriority: 42,
    preconditions: [{ type: "target_tag", tag: "commerce" }],
    costs: [{ selector: "actor", type: "state", key: "resources", amount: -3 }],
    successEffects: [
      { selector: "target", type: "state", key: "surveillance", amount: 10 },
      { selector: "target", type: "state", key: "commerce", amount: 6 },
      { selector: "target", type: "state", key: "danger", amount: -6 },
      { selector: "actor", type: "objective_progress", amount: 18 },
      { selector: "actor", type: "cooldown", actionId: "inspect_customs", ticks: 1 }
    ],
    failureEffects: [
      { selector: "target", type: "state", key: "agitation", amount: 7 },
      { selector: "target", type: "state", key: "fear", amount: 4 }
    ],
    risks: [{ kind: "exposure", threshold: 57, severity: 9 }],
    eventType: "action_resolved",
    diffusion: {
      signalKind: "institutional",
      rumorTags: ["customs", "inspection"],
      signalIntensity: 32
    }
  }
];

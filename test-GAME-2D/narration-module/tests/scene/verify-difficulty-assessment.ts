import assert from "node:assert/strict";
import { assessDifficultyBandV1 } from "../../src/application";

const easier = assessDifficultyBandV1({
  baseBand: "MEDIUM",
  factors: [{
    factorId: "known-route",
    shift: -1,
    publicReason: "Le personnage dispose d'un repère fiable.",
    sourceRef: "fact:known-route",
    visibility: "PLAYER_VISIBLE"
  }]
});
assert.equal(easier.selectedBand, "EASY");
assert.deepEqual(easier.publicReasons, ["Le personnage dispose d'un repère fiable."]);

const harderPrivate = assessDifficultyBandV1({
  baseBand: "MEDIUM",
  factors: [{
    factorId: "secret-countermeasure",
    shift: 2,
    publicReason: "Ne doit jamais être affiché.",
    sourceRef: "hidden:countermeasure",
    visibility: "SYSTEM_ONLY"
  }]
});
assert.equal(harderPrivate.selectedBand, "VERY_HARD");
assert.equal(harderPrivate.privateFactorCount, 1);
assert.deepEqual(harderPrivate.publicReasons, []);
assert.deepEqual(harderPrivate.publicSourceRefs, []);
assert.equal(JSON.stringify(harderPrivate).includes("countermeasure"), false);

const lowerClamp = assessDifficultyBandV1({
  baseBand: "VERY_EASY",
  factors: [{ factorId: "easy", shift: -2, publicReason: "Aide décisive.", sourceRef: "fact:help", visibility: "PLAYER_VISIBLE" }]
});
assert.equal(lowerClamp.selectedBand, "VERY_EASY");

const upperClamp = assessDifficultyBandV1({
  baseBand: "NEARLY_IMPOSSIBLE",
  factors: [{ factorId: "hard", shift: 2, publicReason: "Pression extrême.", sourceRef: "fact:pressure", visibility: "PLAYER_VISIBLE" }]
});
assert.equal(upperClamp.selectedBand, "NEARLY_IMPOSSIBLE");

console.log("difficulty-assessment/1: public, private and clamped factors passed");

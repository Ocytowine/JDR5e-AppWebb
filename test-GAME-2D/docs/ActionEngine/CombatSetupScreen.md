# CombatSetupScreen ÔÇö Recap

This document summarizes what the CombatSetupScreen does and what it needs (data, props, state, and side effects).

## Purpose
- Character creation and pre-combat setup UI (player + map)
- Handles species, background, profile, stats, classes, skills, masteries, equipment, and map prompt
- Enforces lock/unlock flow with choice modals and cascade resets

## Required Props
- configEnemyCount, enemyTypeCount, gridCols, gridRows, mapPrompt
- character (Personnage)
- weaponTypes, raceTypes, classTypes, subclassTypes
- backgroundTypes, languageTypes, toolItems, objectItems, armorItems
- onChangeCharacter, onChangeMapPrompt, onChangeEnemyCount, onStartCombat, onNoEnemyTypes

## Core Character Data Used
- raceId, backgroundId, classe, niveauGlobal, caracs
- combatStats.mods, competences, expertises
- proficiencies (weapons/armors/tools)
- creationLocks, classLock, choiceSelections
- equipmentAuto, equipmentManual, inventoryItems, materielSlots

## Main Tabs
- Map: map prompt and enemy count
- Player: species, background, profile, stats, classes, skills, masteries, equipment

## Locking Logic
- Each section can be locked; locked sections prevent edits
- Locking may require completing choice modals (species/background/class)
- Lock state stored in character.creationLocks (and character.classLock for classes)
- Unlocking can cascade resets depending on the section

## Choice Modals
- Species (human adaptable skill)
- Background (tool choices, language choices)
- Classes (subclass selection)

## Stats System
- Maintains base stats vs bonus stats
- base stats stored in choiceSelections.statsBase
- bonus sources (e.g. background +1 FOR)
- UI shows base, bonus, total and source dots
- setScore updates base; total recomputed and applied to caracs + combatStats.mods

## Skills & Masteries
- Skills (competences) can be toggled and expertised
- Masteries for weapons, armor, tools
- Source dots show where each skill/mastery comes from
- Reset buttons restore to background/class defaults

## Classes
- Global level + class level split
- Primary and optional secondary class
- Subclass selection required when level threshold met
- Locking requires completing subclass choice if needed
- Class lock stored in character.classLock

## Equipment
- Equipment slots grouped: body/clothing, weapons (belt/back), jewelry, bag
- Slot compatibility based on item category
- Inventory items can be equipped to valid slots or stored in bag (if bag equipped)
- Bag enforces capacityWeight
- Primary weapon (Ôÿà) selects default combat weapon
- Lootbox subtab adds items from catalogs

## Data Dependencies / Assumptions
- Weapons: weaponTypes[] with id, name, properties, category
- Armors: armorItems[] with category (armor_body/shield)
- Objects: objectItems[] with category (clothing_*, pack, jewel, weapon_short, etc.)
- Tools: toolItems[]
- Backgrounds: skillProficiencies, toolProficiencies, toolChoices, languageChoices, equipment
- Races: traits for display
- Classes: subclass IDs and proficiencies
- inventoryItems entries contain: id, type, qty, source, equippedSlot, storedIn, isPrimaryWeapon
- materielSlots includes corps, tete, gants, bottes, ceinture_*, dos_*, anneau_*, collier, bijou_*, paquetage
- choiceSelections stores pendingLocks, background choices, statsBase, background.statBonusApplied

## Side Effects
- Updates character state frequently via onChangeCharacter
- Rebuilds inventory when auto/manual equipment changes
- Applies/removes stat bonuses on lock/unlock
- Resets material when changing species/background/class

## UI Notes
- Equipment shows labels; IDs are humanized if no label found
- Background equipment list uses labels (not IDs)
- Locked tabs show lock icon color-coded by source

## Known Extension Points
- Add more stat bonus sources (race/class/equipment) in getStatBonuses
- Add more equipment categories or slot rules in EQUIPMENT_SLOTS
- Expand bag types and capacity logic

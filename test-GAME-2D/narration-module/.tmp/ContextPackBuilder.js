"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextPackBuilder = void 0;
const DEFAULT_MIN_ANCHORS = 2;
const DEFAULT_MAX_RECORDS = 6;
const typeWeight = {
    lieu: 4,
    faction: 3,
    histoire: 2,
    acteur: 2
};
function tokenize(value) {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((token) => token.length > 2);
}
function unique(list) {
    return [...new Set(list)];
}
class ContextPackBuilder {
    build(input) {
        const minAnchors = input.minAnchors ?? DEFAULT_MIN_ANCHORS;
        const maxRecords = input.maxRecords ?? DEFAULT_MAX_RECORDS;
        const scored = this.scoreRecords(input)
            .sort((a, b) => b.score - a.score)
            .slice(0, maxRecords);
        const anchors = this.pickAnchors(scored.map((entry) => entry.record), minAnchors);
        const facts = scored.map((entry) => {
            const record = entry.record;
            return `${record.title}${record.summary ? ` — ${record.summary}` : ''}`;
        });
        return {
            query: input.query,
            anchors,
            selectedRecords: scored,
            facts
        };
    }
    scoreRecords(input) {
        const queryTokens = unique(tokenize(input.query));
        const profileTokens = unique(tokenize([
            ...(input.playerProfile?.tags ?? []),
            ...(input.playerProfile?.backgroundTags ?? []),
            ...(input.playerProfile?.currentGoals ?? [])
        ].join(' ')));
        return input.records.map((record) => {
            let score = typeWeight[record.type] ?? 1;
            const reasons = [`type:${record.type}`];
            if (record.zoneId && input.activeZoneId && record.zoneId === input.activeZoneId) {
                score += 6;
                reasons.push('active-zone-match');
            }
            if (record.parentZoneIds?.length &&
                input.parentZoneIds?.length &&
                record.parentZoneIds.some((zoneId) => input.parentZoneIds?.includes(zoneId))) {
                score += 3;
                reasons.push('parent-zone-match');
            }
            const searchable = tokenize([record.title, record.summary ?? '', record.body ?? '', ...(record.tags ?? [])].join(' '));
            const queryOverlap = queryTokens.filter((token) => searchable.includes(token)).length;
            if (queryOverlap > 0) {
                score += queryOverlap * 2;
                reasons.push(`query-overlap:${queryOverlap}`);
            }
            const profileOverlap = profileTokens.filter((token) => searchable.includes(token)).length;
            if (profileOverlap > 0) {
                score += profileOverlap;
                reasons.push(`profile-overlap:${profileOverlap}`);
            }
            return { record, score, reasons };
        });
    }
    pickAnchors(records, minAnchors = DEFAULT_MIN_ANCHORS) {
        const anchors = [];
        const ids = new Set();
        for (const record of records) {
            if (ids.has(record.id))
                continue;
            anchors.push({ type: record.type, id: record.id, label: record.title });
            ids.add(record.id);
            if (anchors.length >= minAnchors)
                break;
        }
        if (anchors.length < minAnchors) {
            throw new Error(`ContextPack invalide: ${anchors.length} ancre(s), minimum attendu ${minAnchors}`);
        }
        return anchors;
    }
}
exports.ContextPackBuilder = ContextPackBuilder;

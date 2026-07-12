/**
 * hud/threat-overlay.js (ADR-0004, extracted from hud/actor-hud.js)
 *
 * The canvas threat/range overlay: facing-cone threat tiles, range bands,
 * rear-vulnerability cone, at-risk cover rings, and the ranged-shot lane
 * with cover-odds badges (PIXI). Interface: renderThreatOverlay(token,
 * selectors) / clearThreatOverlay(). Weapon SELECTION stays with the item
 * logic in actor-hud - the selectors ({ getThreatSource, getRangedSource,
 * getPrimaryTargetToken }) are injected per call.
 */
import { laneObstacles } from "../combat/ranged-cover.js";
import {
    getWeaponReach,
    getWeaponRangeBands,
    getChebyshevDistanceSquares,
} from "../combat/weapon-state.mjs";

const THREAT_OVERLAY_LAYER_NAME = "1547core-threat-overlay";
const THREAT_FILL_COLOR = 0x6FAF72;
const THREAT_FILL_ALPHA = 0.14;
const THREAT_STROKE_ALPHA = 0.22;
const VULNERABILITY_FILL_COLOR = 0xB85A5A;
const VULNERABILITY_FILL_ALPHA = 0.14;
const VULNERABILITY_STROKE_ALPHA = 0.22;
const RANGE_SHORT_FILL_COLOR = 0x4B86C5;
const RANGE_SHORT_FILL_ALPHA = 0.16;
const RANGE_SHORT_STROKE_ALPHA = 0.28;
const RANGE_LONG_FILL_COLOR = 0xC9A14A;
const RANGE_LONG_FILL_ALPHA = 0.13;
const RANGE_LONG_STROKE_ALPHA = 0.24;
const RANGE_MAX_FILL_COLOR = 0x7C8894;
const RANGE_MAX_FILL_ALPHA = 0.1;
const RANGE_MAX_STROKE_ALPHA = 0.2;

function getFacingDirection(token) {
    const rotation = ((Number(token?.document?.rotation) || 0) % 360 + 360) % 360;
    const snapped = Math.round(rotation / 45) * 45 % 360;
    switch (snapped) {
        case 45:
            return "SW";
        case 90:
            return "W";
        case 135:
            return "NW";
        case 180:
            return "N";
        case 225:
            return "NE";
        case 270:
            return "E";
        case 315:
            return "SE";
        case 0:
        default:
            return "S";
    }
}

function getOppositeFacingDirection(facing) {
    switch (facing) {
        case "N":
            return "S";
        case "NE":
            return "SW";
        case "E":
            return "W";
        case "SE":
            return "NW";
        case "S":
            return "N";
        case "SW":
            return "NE";
        case "W":
            return "E";
        case "NW":
            return "SE";
        default:
            return "S";
    }
}

function getThreatTiles(token, minReach, maxReach) {
    const gridSize = Number(canvas?.grid?.size) || Number(canvas?.dimensions?.size) || 100;
    const sceneWidth = Number(canvas?.dimensions?.width) || 0;
    const sceneHeight = Number(canvas?.dimensions?.height) || 0;
    const startCol = Math.round((Number(token?.document?.x) || 0) / gridSize);
    const startRow = Math.round((Number(token?.document?.y) || 0) / gridSize);
    const facing = getFacingDirection(token);
    const tiles = [];
    const inFacingMask = (dx, dy, distance) => {
        switch (facing) {
            case "N":
                return dy === -distance && Math.abs(dx) <= distance;
            case "S":
                return dy === distance && Math.abs(dx) <= distance;
            case "E":
                return dx === distance && Math.abs(dy) <= distance;
            case "W":
                return dx === -distance && Math.abs(dy) <= distance;
            case "NE":
                return dx >= 0 && dy <= 0 && Math.max(dx, -dy) === distance;
            case "NW":
                return dx <= 0 && dy <= 0 && Math.max(-dx, -dy) === distance;
            case "SE":
                return dx >= 0 && dy >= 0 && Math.max(dx, dy) === distance;
            case "SW":
                return dx <= 0 && dy >= 0 && Math.max(-dx, dy) === distance;
            default:
                return false;
        }
    };

    for (let distance = minReach; distance <= maxReach; distance += 1) {
        for (let dy = -distance; dy <= distance; dy += 1) {
            for (let dx = -distance; dx <= distance; dx += 1) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== distance) continue;
                if (!inFacingMask(dx, dy, distance)) continue;
                tiles.push({ col: startCol + dx, row: startRow + dy });
            }
        }
    }

    const seen = new Set();
    return tiles.filter(({ col, row }) => {
        const x = col * gridSize;
        const y = row * gridSize;
        if (col < 0 || row < 0 || x >= sceneWidth || y >= sceneHeight) return false;
        const key = `${col}:${row}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).map(({ col, row }) => ({
        x: col * gridSize,
        y: row * gridSize,
        size: gridSize
    }));
}

function getDistanceTiles(token, minDistance, maxDistance) {
    const gridSize = Number(canvas?.grid?.size) || Number(canvas?.dimensions?.size) || 100;
    const sceneWidth = Number(canvas?.dimensions?.width) || 0;
    const sceneHeight = Number(canvas?.dimensions?.height) || 0;
    const startCol = Math.round((Number(token?.document?.x) || 0) / gridSize);
    const startRow = Math.round((Number(token?.document?.y) || 0) / gridSize);
    const tiles = [];

    for (let dy = -maxDistance; dy <= maxDistance; dy += 1) {
        for (let dx = -maxDistance; dx <= maxDistance; dx += 1) {
            const distance = Math.max(Math.abs(dx), Math.abs(dy));
            if (distance < minDistance || distance > maxDistance || distance === 0) continue;
            tiles.push({ col: startCol + dx, row: startRow + dy });
        }
    }

    const seen = new Set();
    return tiles.filter(({ col, row }) => {
        const x = col * gridSize;
        const y = row * gridSize;
        if (col < 0 || row < 0 || x >= sceneWidth || y >= sceneHeight) return false;
        const key = `${col}:${row}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).map(({ col, row }) => ({
        x: col * gridSize,
        y: row * gridSize,
        size: gridSize
    }));
}

function getRangeBandTiles(token, shortRange, longRange, maxRange) {
    return {
        shortTiles: getDistanceTiles(token, 1, shortRange),
        longTiles: longRange > shortRange ? getDistanceTiles(token, shortRange + 1, longRange) : [],
        maxTiles: maxRange > longRange ? getDistanceTiles(token, longRange + 1, maxRange) : []
    };
}

function getVulnerabilityTiles(token) {
    const facing = getFacingDirection(token);
    const oppositeFacing = getOppositeFacingDirection(facing);
    const originalRotation = token?.document?.rotation;
    const fakeToken = {
        ...token,
        document: {
            ...token.document,
            rotation: (() => {
                switch (oppositeFacing) {
                    case "N": return 180;
                    case "NE": return 225;
                    case "E": return 270;
                    case "SE": return 315;
                    case "S": return 0;
                    case "SW": return 45;
                    case "W": return 90;
                    case "NW": return 135;
                    default: return originalRotation ?? 0;
                }
            })()
        }
    };
    return getThreatTiles(fakeToken, 1, 1);
}

function drawOverlayTiles(graphics, tiles, color, fillAlpha, strokeAlpha) {
    for (const tile of tiles) {
        graphics
            .beginFill(color, fillAlpha)
            .lineStyle(1, color, strokeAlpha)
            .drawRect(tile.x, tile.y, tile.size, tile.size)
            .endFill();
    }
}

function ensureThreatOverlayLayer() {
    if (!canvas?.tokens) return null;
    let layer = canvas.tokens.getChildByName(THREAT_OVERLAY_LAYER_NAME);
    if (!layer) {
        layer = new PIXI.Container();
        layer.name = THREAT_OVERLAY_LAYER_NAME;
        layer.eventMode = "none";
        canvas.tokens.addChild(layer);
    }
    return layer;
}

export function clearThreatOverlay() {
    const layer = canvas?.tokens?.getChildByName?.(THREAT_OVERLAY_LAYER_NAME);
    if (layer) {
        layer.removeChildren();
        layer.visible = false;
    }
}

export function renderThreatOverlay(token, { getThreatSource, getRangedSource, getPrimaryTargetToken } = {}) {
    const layer = ensureThreatOverlayLayer();
    if (!layer || !token?.actor) return;

    layer.removeChildren();

    const graphics = new PIXI.Graphics();
    let hasOverlay = false;
    // PIXI.Text badges live as direct children of the layer (Text can't go in a
    // Graphics); collected here and added ON TOP of the graphics at the end.
    const laneBadges = [];

    const rangedSource = typeof getRangedSource === "function" ? getRangedSource(token.actor) : null;
    const { shortRange, longRange, maxRange } = getWeaponRangeBands(rangedSource);
    if (Number.isFinite(shortRange) && Number.isFinite(longRange) && Number.isFinite(maxRange)) {
        const { shortTiles, longTiles, maxTiles } = getRangeBandTiles(token, shortRange, longRange, maxRange);
        if (maxTiles.length) {
            drawOverlayTiles(graphics, maxTiles, RANGE_MAX_FILL_COLOR, RANGE_MAX_FILL_ALPHA, RANGE_MAX_STROKE_ALPHA);
            hasOverlay = true;
        }
        if (longTiles.length) {
            drawOverlayTiles(graphics, longTiles, RANGE_LONG_FILL_COLOR, RANGE_LONG_FILL_ALPHA, RANGE_LONG_STROKE_ALPHA);
            hasOverlay = true;
        }
        if (shortTiles.length) {
            drawOverlayTiles(graphics, shortTiles, RANGE_SHORT_FILL_COLOR, RANGE_SHORT_FILL_ALPHA, RANGE_SHORT_STROKE_ALPHA);
            hasOverlay = true;
        }
    }

    // At-risk cover markers: ring other tokens within the weapon's max range —
    // "things you might hit by shooting this way" (cover-spec interception risk).
    if (Number.isFinite(maxRange) && maxRange > 0) {
        const grid = Number(canvas?.grid?.size) || Number(canvas?.dimensions?.size) || 100;
        const sc = token.center;
        if (sc) {
            for (const other of (canvas?.tokens?.placeables ?? [])) {
                if (!other || other === token || other.id === token.id || other.document?.hidden) continue;
                const oc = other.center;
                if (!oc) continue;
                const dist = Math.round(Math.max(Math.abs(oc.x - sc.x), Math.abs(oc.y - sc.y)) / grid);
                if (dist < 1 || dist > maxRange) continue;
                const radius = (Math.max(other.w || grid, other.h || grid) / 2) + 4;
                graphics.lineStyle(3, 0xff5555, 0.9).drawCircle(oc.x, oc.y, radius);
                hasOverlay = true;
            }
        }
    }

    // Ranged-shot lane (ranged-shot-visualization-spec Phase 1): when this token is a
    // ranged shooter with a current target, draw the shot lane tinted by range band, a
    // "n/6" cover-odds badge over each obstacle in the lane (ally badges red), and the
    // target's rear cone (where the +1 lands). Pure presentation; reuses laneObstacles.
    if (rangedSource && Number.isFinite(maxRange) && maxRange > 0) {
        const target = typeof getPrimaryTargetToken === "function" ? getPrimaryTargetToken() : null;
        const sc = token.center;
        const tc = target?.center;
        if (target && target !== token && target.id !== token.id && sc && tc) {
            const dist = getChebyshevDistanceSquares(token, target);
            const laneColor = !Number.isFinite(dist) || dist <= shortRange
                ? RANGE_SHORT_FILL_COLOR
                : dist <= longRange ? RANGE_LONG_FILL_COLOR : RANGE_MAX_FILL_COLOR;
            graphics.lineStyle(3, laneColor, 0.85).moveTo(sc.x, sc.y).lineTo(tc.x, tc.y);
            hasOverlay = true;

            const grid = Number(canvas?.grid?.size) || Number(canvas?.dimensions?.size) || 100;
            for (const obstacle of laneObstacles(token, target)) {
                const obstacleToken = canvas?.tokens?.get?.(obstacle.id);
                const oc = obstacleToken?.center;
                if (!oc) continue;
                const ally = obstacleToken.document?.disposition === token.document?.disposition;
                const badge = new PIXI.Text(`${obstacle.blockValue}/6`, {
                    fontFamily: "sans-serif",
                    fontSize: Math.round(grid * 0.28),
                    fill: ally ? 0xff5555 : 0xffffff,
                    stroke: 0x000000,
                    strokeThickness: 3,
                });
                badge.anchor.set(0.5, 0.5);
                badge.position.set(oc.x, oc.y);
                laneBadges.push(badge);
            }

            // Target's rear cone — reuse the vulnerability colour to show the +1 is available.
            const rearTiles = getVulnerabilityTiles(target);
            if (rearTiles.length) {
                drawOverlayTiles(graphics, rearTiles, VULNERABILITY_FILL_COLOR, VULNERABILITY_FILL_ALPHA, VULNERABILITY_STROKE_ALPHA);
            }
        }
    }

    const threatSource = typeof getThreatSource === "function" ? getThreatSource(token.actor) : null;
    const { minReach, maxReach } = getWeaponReach(threatSource);
    if (Number.isFinite(minReach) && Number.isFinite(maxReach) && maxReach >= minReach && maxReach >= 1) {
        const tiles = getThreatTiles(token, minReach, maxReach);
        if (tiles.length) {
            drawOverlayTiles(graphics, tiles, THREAT_FILL_COLOR, THREAT_FILL_ALPHA, THREAT_STROKE_ALPHA);
            hasOverlay = true;
        }

        const vulnerabilityTiles = getVulnerabilityTiles(token);
        if (vulnerabilityTiles.length) {
            drawOverlayTiles(graphics, vulnerabilityTiles, VULNERABILITY_FILL_COLOR, VULNERABILITY_FILL_ALPHA, VULNERABILITY_STROKE_ALPHA);
            hasOverlay = true;
        }
    }

    if (!hasOverlay) {
        layer.visible = false;
        return;
    }

    layer.addChild(graphics);
    for (const badge of laneBadges) layer.addChild(badge); // on top of the graphics
    layer.visible = true;
}

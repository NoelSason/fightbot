# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

FightBot Arena — a browser-based real-time fighting game. Players pick a class (Assassin, Warrior, Mage, Healer), choose a weapon/subclass, then battle an AI opponent using abilities with cooldowns, energy costs, and status effects. Includes progression (ranking points, XP, levels), a chest system, a shop with combat items, and monetization design (gems/coins).

## Running Locally

```
cd /Users/noelsason/Desktop/fightbot
python3 -m http.server 8080
# Open http://localhost:8080
```

No build step, no dependencies. Pure HTML/CSS/JS served statically.

## Architecture

Four files, loaded in order by `index.html`:

- **gamedata.js** — All game constants: class definitions (`CLASSES`), weapon/ability trees (`WEAPONS`), super abilities (`SUPERS`), status effect definitions (`STATUS_EFFECTS`), chest drop table (`CHEST_TABLE`), rank tiers (`RANKS`), shop items (`SHOP_ITEMS`), arena visual themes (`ARENA_THEMES`).
- **game.js** — All runtime logic:
  - **VFX system** (`projectiles[]`, `particles[]`, `screenEffects[]`) — projectile spawning, particle trails, screen shake, per-ability visual mappings in `ABILITY_VISUALS` and `PROJ_VISUALS`.
  - **Combat engine** — `performAttack()` handles confusion/blinding checks, damage buffs, crits (25% chance +100), multi-hit, then delegates to `dealDamage()` for shield/invincibility math. `handleSpecial()` is a big switch for non-damage ability effects.
  - **Fighter state** — normalized x position (0–1), converted to screen coords via `fighterScreenX()`/`fighterScreenY()`. All timers use `setInterval` (energy regen, cooldowns, AI, effects tick). Rendering uses `requestAnimationFrame`.
  - **Player data** — persisted in `localStorage` under key `fightbot_save`. Includes coins, gems, XP, RP, chest slots, owned items.
- **style.css** — All styling. Combat screen uses flex layout with HUD on top, fullscreen canvas in middle, ability bar docked at bottom.
- **index.html** — Screen structure (title, class select, weapon select, combat, results, shop, chests, profile). Screens toggled via `.active` class.

## Key Patterns

- Abilities are data-driven: add to `WEAPONS` in gamedata.js, then optionally add a visual mapping in `ABILITY_VISUALS` in game.js.
- Status effects are defined once in `STATUS_EFFECTS` (gamedata.js) with dot/hot intervals, block flags, miss/self-hit chances. Applied via `applyEffect()`, ticked each second in `tickEffects()`.
- Fighter positions are normalized 0–1 so the canvas can resize. Screen coords computed at render time.
- AI runs on a `setInterval` (1.5–3.5s), picks random available ability 40% of the time, otherwise uses base attack.

// ============ GAME DATA ============

const CLASSES = {
    assassin: {
        name: 'Assassin', icon: '🗡️', hp: 2000, energy: 500,
        weapons: ['dagger', 'dual_swords', 'bow']
    },
    warrior: {
        name: 'Warrior', icon: '⚔️', hp: 2000, energy: 500,
        weapons: ['broadsword', 'axe', 'spear']
    },
    mage: {
        name: 'Mage', icon: '🔮', hp: 2000, energy: 500,
        weapons: ['fire', 'earth', 'ice']
    },
    healer: {
        name: 'Healer', icon: '✨', hp: 2200, energy: 500,
        weapons: ['offense', 'defense', 'stamina']
    }
};

const WEAPONS = {
    // ASSASSIN
    dagger: {
        name: 'Dagger', icon: '🗡️',
        desc: 'Fast melee strikes with teleportation',
        baseAbility: { name: 'Slice', damage: 20, icon: '🗡️', desc: 'Slice with dagger' },
        abilities: [
            { name: 'Teleport', icon: '💨', damage: 0, energy: 50, cooldown: 10, desc: 'Teleport 5 blocks ahead', special: 'teleport' },
            { name: 'Wolverine Daggers', icon: '🔪', damage: 60, energy: 70, cooldown: 15, desc: 'Throw 6 daggers (10 dmg each)', hits: 6, hitDmg: 10 },
            { name: 'Floating Daggers', icon: '⚔️', damage: 160, energy: 130, cooldown: 20, desc: '8 daggers, 20 dmg each. Throw one or all.', hits: 8, hitDmg: 20 }
        ]
    },
    dual_swords: {
        name: 'Dual Swords', icon: '⚔️',
        desc: 'Twin blades with shockwave power',
        baseAbility: { name: 'Swing Sword', damage: 20, icon: '⚔️', desc: 'Swing dual swords' },
        abilities: [
            { name: 'Sword Spin', icon: '🌀', damage: 60, energy: 80, cooldown: 5, desc: 'Spin 3x, 20 dmg per turn', hits: 3, hitDmg: 20 },
            { name: 'Shuriken Throw', icon: '✦', damage: 40, energy: 80, cooldown: 10, desc: 'Throw 2 shurikens, 20 dmg each', hits: 2, hitDmg: 20 },
            { name: 'Shockwave', icon: '💥', damage: 100, energy: 100, cooldown: 30, desc: '100 dmg + stun 3s', effects: [{ type: 'stun', duration: 3 }] }
        ]
    },
    bow: {
        name: 'Bow & Arrow', icon: '🏹',
        desc: 'Ranged attacks with burning arrows',
        baseAbility: { name: 'Fire Arrow', damage: 5, icon: '🏹', desc: 'Fire arrow, burn 20s', effects: [{ type: 'burning', duration: 20 }] },
        abilities: [
            { name: 'Shadow Travel', icon: '🌑', damage: 0, energy: 30, cooldown: 5, desc: 'Sink into shadow for 5s, invincible', special: 'invincible', duration: 5 },
            { name: 'Bow of Heavens', icon: '🌟', damage: 100, energy: 70, cooldown: 10, desc: 'Arrow breaks through obstacles, 100 dmg' },
            { name: 'Arrow Storm', icon: '🌧️', damage: 170, energy: 110, cooldown: 15, desc: '30 arrows rain down, 170 total dmg' }
        ]
    },
    // WARRIOR
    broadsword: {
        name: 'Broadsword', icon: '🗡️',
        desc: 'Heavy strikes with shields and lava',
        baseAbility: { name: 'Sword Slash', damage: 25, icon: '🗡️', desc: 'Slash with broadsword' },
        abilities: [
            { name: 'Shield of Shielding', icon: '🛡️', damage: 0, energy: 50, cooldown: 5, desc: 'Shield absorbs 90 damage', special: 'shield', shieldAmount: 90 },
            { name: 'Lava Strike', icon: '🌋', damage: 110, energy: 85, cooldown: 35, desc: 'Stab ground, lava area 110 dmg' },
            { name: 'Death Stab', icon: '💀', damage: 55, energy: 68, cooldown: 10, desc: 'Deadly stab, 55 dmg' }
        ]
    },
    axe: {
        name: 'Axe', icon: '🪓',
        desc: 'Spinning axes with bloodthirst',
        baseAbility: { name: 'Axe Swing', damage: 22, icon: '🪓', desc: 'Swing axe' },
        abilities: [
            { name: 'Axe Spin', icon: '🌀', damage: 50, energy: 60, cooldown: 6, desc: 'Spin 4 times, 50 total dmg' },
            { name: 'Axe Throw', icon: '🪃', damage: 30, energy: 20, cooldown: 5, desc: 'Boomerang axe, 30 dmg' },
            { name: 'Bloodthirst', icon: '🩸', damage: 0, energy: 150, cooldown: 50, desc: '+25% dmg, heal 10/hit for 15s. Confusion after.', special: 'bloodthirst', duration: 15 }
        ]
    },
    spear: {
        name: 'Spear', icon: '🔱',
        desc: 'Long range thrusts with Valkyrie mount',
        baseAbility: { name: 'Throw Spear', damage: 25, icon: '🔱', desc: 'Throw spear' },
        abilities: [
            { name: 'Spear YEET', icon: '💫', damage: 100, energy: 70, cooldown: 4, desc: 'Throw spear, 100 dmg + 1s stun', effects: [{ type: 'stun', duration: 1 }] },
            { name: 'Valkyrie', icon: '🐴', damage: 0, energy: 20, cooldown: 10, desc: 'Summon flying horse for 10s', special: 'valkyrie', duration: 10 },
            { name: 'Spear Vault', icon: '🦅', damage: 35, energy: 40, cooldown: 10, desc: 'Vault and throw spear, 35 dmg' }
        ]
    },
    // MAGE
    fire: {
        name: 'Fire', icon: '🔥',
        desc: 'Burn everything with flames and dragons',
        baseAbility: { name: 'Shoot Fire', damage: 10, icon: '🔥', desc: 'Shoot fire' },
        abilities: [
            { name: 'Fireball', icon: '☄️', damage: 85, energy: 70, cooldown: 15, desc: '85 dmg + 50s burn', effects: [{ type: 'burning', duration: 50 }] },
            { name: 'Wall of Fire', icon: '🧱', damage: 0, energy: 100, cooldown: 35, desc: '30% dmg shield for 20s, touch=20 dmg', special: 'firewall', duration: 20, shieldPercent: 30 },
            { name: "Dragon's Breath", icon: '🐉', damage: 0, energy: 120, cooldown: 50, desc: 'Burn + confusion 20s', effects: [{ type: 'burning', duration: 30 }, { type: 'confusion', duration: 20 }] }
        ]
    },
    earth: {
        name: 'Earth', icon: '🪨',
        desc: 'Rock walls and mountain power',
        baseAbility: { name: 'Rock Shot', damage: 25, icon: '🪨', desc: 'Shoot 5 rocks, 5 dmg each', hits: 5, hitDmg: 5 },
        abilities: [
            { name: 'Stone Wall', icon: '🧱', damage: 0, energy: 65, cooldown: 30, desc: '50% dmg shield 30s, cant attack', special: 'stonewall', duration: 30, shieldPercent: 50 },
            { name: 'Rock Throw', icon: '🪨', damage: 60, energy: 80, cooldown: 45, desc: '2 big rocks, 30 dmg each + earth', hits: 2, hitDmg: 30, effects: [{ type: 'earth', duration: 15 }] },
            { name: "Mountain's Peak", icon: '⛰️', damage: 0, energy: 135, cooldown: 70, desc: '+30% dmg, 50% shield. Every 2 hits = earth', special: 'mountain', duration: 25 }
        ]
    },
    ice: {
        name: 'Ice', icon: '❄️',
        desc: 'Freeze and control with blizzards',
        baseAbility: { name: 'Ice Shard', damage: 25, icon: '❄️', desc: 'Throw ice shard' },
        abilities: [
            { name: 'Icy Wind', icon: '🌬️', damage: 30, energy: 50, cooldown: 15, desc: '30 dmg + freeze', effects: [{ type: 'freeze', duration: 15 }] },
            { name: 'Ice Wall', icon: '🧊', damage: 0, energy: 90, cooldown: 30, desc: '80% shield but frozen, no energy regen 15s', special: 'icewall', duration: 15, shieldPercent: 80 },
            { name: 'Blizzard', icon: '🌨️', damage: 0, energy: 100, cooldown: 45, desc: 'Enemy cant gain energy + 20% shield for you', special: 'blizzard', duration: 20 }
        ]
    },
    // HEALER
    offense: {
        name: 'Offense', icon: '💡',
        desc: 'Holy light as a weapon',
        baseAbility: { name: 'Light Beam', damage: 25, icon: '💡', desc: 'Beam of light' },
        abilities: [
            { name: 'Immensity', icon: '🦍', damage: 0, energy: 70, cooldown: 40, desc: 'Grow huge, +10% dmg for 20s', special: 'dmgbuff', duration: 20, buffPercent: 10 },
            { name: 'Godly Strike', icon: '⚡', damage: 100, energy: 150, cooldown: 45, desc: 'Freeze 3s then 100 dmg burst', selfEffects: [{ type: 'freeze', duration: 3 }] },
            { name: 'Hallelujah', icon: '🎵', damage: 0, energy: 200, cooldown: 65, desc: 'Blind + confusion + burn 10s', effects: [{ type: 'blinding', duration: 10 }, { type: 'confusion', duration: 10 }, { type: 'burning', duration: 10 }] }
        ]
    },
    defense: {
        name: 'Defense', icon: '🛡️',
        desc: 'Divine shields and heavenly walls',
        baseAbility: { name: 'Mini Shield', damage: 0, icon: '🛡️', desc: 'Block 5% dmg for 2s', special: 'minishield', shieldPercent: 5, duration: 2 },
        abilities: [
            { name: 'Wall of Heavens', icon: '🌥️', damage: 0, energy: 70, cooldown: 40, desc: '100 HP shield, blinding 10s on self', special: 'shield', shieldAmount: 100, selfEffects: [{ type: 'blinding', duration: 10 }] },
            { name: 'YEET', icon: '💥', damage: 100, energy: 100, cooldown: 30, desc: '100 dmg, burn+confuse+poison 20s on enemy. Confusion 10s self', effects: [{ type: 'burning', duration: 20 }, { type: 'confusion', duration: 20 }, { type: 'poison', duration: 20 }], selfEffects: [{ type: 'confusion', duration: 10 }] },
            { name: 'Invincible', icon: '🌟', damage: 0, energy: 120, cooldown: 60, desc: 'Invincible + heal, cant move. Stun 30s after.', special: 'invincible_heal', duration: 10 }
        ]
    },
    stamina: {
        name: 'Stamina', icon: '💪',
        desc: 'Sustain and outlast your opponent',
        baseAbility: { name: 'Quick Heal', damage: 0, icon: '💪', desc: 'Heal 15 HP', special: 'heal', healAmount: 15 },
        abilities: [
            { name: 'Rejuvenate', icon: '💚', damage: 0, energy: 50, cooldown: 15, desc: 'Heal 150 HP', special: 'heal', healAmount: 150 },
            { name: 'Energize', icon: '⚡', damage: 0, energy: 0, cooldown: 20, desc: 'Restore 200 energy', special: 'energize', energyAmount: 200 },
            { name: 'Endurance', icon: '🏃', damage: 0, energy: 80, cooldown: 40, desc: 'Heal 20 HP/s for 15s + 20% shield', special: 'endurance', duration: 15 }
        ]
    }
};

const SUPERS = {
    assassin: { name: '3 Ozs to the Vagus Nerve', icon: '💀', energy: 200, cooldown: 90, desc: 'Freeze 15s + 20% speed/dmg buff', damage: 50, effects: [{ type: 'freeze', duration: 15 }] },
    warrior: { name: 'All Out War', icon: '⚔️', energy: 200, cooldown: 120, desc: '5 swords, 30 dmg each + 170 shield', damage: 150, shieldAmount: 170 },
    mage: { name: 'Time Stop', icon: '⏱️', energy: 170, cooldown: 90, desc: 'Freeze opponent 30s', damage: 0, effects: [{ type: 'freeze', duration: 30 }] },
    healer: { name: 'Divine Restoration', icon: '🌟', energy: 150, cooldown: 90, desc: 'Full heal or 150 shield + blind 25s', damage: 0, special: 'healer_super' }
};

const STATUS_EFFECTS = {
    stun: { name: 'Stun', color: '#f39c12', desc: "Can't move for 5s", blockMove: true, blockAttack: true, defaultDuration: 5 },
    confusion: { name: 'Confusion', color: '#9b59b6', desc: '50% chance of hitting self', selfHitChance: 0.5 },
    burning: { name: 'Burning', color: '#e74c3c', desc: '10 dmg every 10s', dot: 10, dotInterval: 10 },
    blinding: { name: 'Blinding', color: '#95a5a6', desc: '50% chance of missing', missChance: 0.5 },
    poison: { name: 'Poison', color: '#27ae60', desc: '15 dmg every 15s', dot: 15, dotInterval: 15 },
    freeze: { name: 'Freeze', color: '#3498db', desc: "Can't move or attack 15s", blockMove: true, blockAttack: true, defaultDuration: 15 },
    earth: { name: 'Earth', color: '#8B4513', desc: "Can't move 15s", blockMove: true, defaultDuration: 15 },
    healing: { name: 'Healing', color: '#2ecc71', desc: 'Heal 10 HP every 2s', hot: 10, hotInterval: 2 },
    bleeding: { name: 'Bleeding', color: '#c0392b', desc: '5 dmg/s', dot: 5, dotInterval: 1 },
    ringing: { name: 'Ringing', color: '#e67e22', desc: 'Deaf for 30s', defaultDuration: 30 }
};

const CHEST_TABLE = [
    { name: 'Regular Chest', icon: '📦', chance: 50, coins: [300, 1000], xp: [30, 100], gems: 10, time: 5 * 60 },
    { name: 'Rare Chest', icon: '🎁', chance: 20, coins: [500, 1000], xp: [50, 200], gems: 50, time: 10 * 60 },
    { name: 'Double Chest', icon: '📦📦', chance: 10, coins: [2000, 3000], xp: [200, 350], gems: 100, time: 20 * 60 },
    { name: 'Epic Chest', icon: '💜', chance: 10, coins: [5000, 5000], xp: [500, 500], gems: 150, time: 30 * 60 },
    { name: 'Legendary Chest', icon: '🏆', chance: 5, coins: [10000, 10000], xp: [1000, 1000], gems: 200, time: 40 * 60 },
    { name: 'CRATE', icon: '📫', chance: 5, coins: [15000, 15000], xp: [1000, 1000], gems: 250, time: 50 * 60 },
    { name: 'RARE CRATE', icon: '🎪', chance: 4, coins: [17000, 17000], xp: [2000, 2000], gems: 300, time: 60 * 60 },
    { name: 'MEGA CHEST', icon: '💎', chance: 2, coins: [20000, 20000], xp: [5000, 5000], gems: 400, time: 90 * 60 },
    { name: 'VAULT', icon: '🏦', chance: 1, coins: [25000, 25000], xp: [7000, 7000], gems: 500, time: 120 * 60 },
    { name: 'DIAMOND CHEST', icon: '💠', chance: 1, coins: [35000, 35000], xp: [10000, 10000], gems: 500, time: 150 * 60 },
    { name: 'ULTIMATE CHEST', icon: '👑', chance: 1, coins: [40000, 40000], xp: [25000, 25000], gems: 500, time: 180 * 60 },
    { name: 'MEGA VAULT', icon: '🏛️', chance: 0.5, coins: [50000, 50000], xp: [100000, 100000], gems: 1000, time: 210 * 60 },
    { name: 'MEGA CRATE', icon: '🎆', chance: 0.5, coins: [50000, 50000], xp: [100000, 100000], gems: 1000, time: 210 * 60 }
];

const RANKS = [
    { name: 'Noob', rp: 0, arena: "Trainer's Arena", color: '#95a5a6' },
    { name: 'Beginner', rp: 100, arena: 'Grassy Plains', color: '#2ecc71' },
    { name: 'Novice', rp: 500, arena: 'Bushy Plains', color: '#27ae60' },
    { name: 'Apprentice', rp: 1000, arena: 'Forest', color: '#3498db' },
    { name: 'Amateur', rp: 5000, arena: 'Desert', color: '#f39c12' },
    { name: 'Intermediate', rp: 10000, arena: 'Lava Arena', color: '#e74c3c' },
    { name: 'Expert', rp: 15000, arena: 'Ice Arena', color: '#00bcd4' },
    { name: 'Challenger I', rp: 20000, arena: 'Ice/Lava', color: '#9b59b6' },
    { name: 'Challenger II', rp: 25000, arena: 'Workshop', color: '#8e44ad' },
    { name: 'Challenger III', rp: 30000, arena: 'Space', color: '#6c3483' },
    { name: 'Master I', rp: 35000, arena: 'Beach', color: '#f7c948' },
    { name: 'Master II', rp: 40000, arena: 'Wildfire', color: '#ff6b35' },
    { name: 'ULTIMATE CHAMPION', rp: 100000, arena: "Champ's Arena", color: '#ffd700' }
];

const SHOP_ITEMS = [
    { id: 'radiation_can', name: 'Radiation Can', icon: '☢️', desc: '+20% attack dmg', cost: 1000, currency: 'coins', effect: 'dmgBuff', value: 20, duration: 30 },
    { id: 'emp', name: 'E.M.P', icon: '⚡', desc: 'Delete enemy energy 10s', cost: 1500, currency: 'coins', effect: 'empEnergy', duration: 10 },
    { id: 'ability_destroyer', name: 'Ability Destroyer', icon: '🚫', desc: 'Remove enemy ability 30s', cost: 2000, currency: 'coins', effect: 'abilityBlock', duration: 30 },
    { id: 'enchanted_feather', name: 'Enchanted Feather', icon: '🪶', desc: 'Heal 100 HP', cost: 1200, currency: 'coins', effect: 'heal', value: 100 },
    { id: 'rusty_nail', name: 'Rusty Nail', icon: '🔩', desc: 'Confusion 30s', cost: 3000, currency: 'coins', effect: 'status', status: 'confusion', duration: 30 },
    { id: 'paper_cut', name: 'Paper Cut', icon: '📄', desc: 'Bleeding 20s (5dps)', cost: 10000, currency: 'coins', effect: 'status', status: 'bleeding', duration: 20 },
    { id: 'electric_cable', name: 'Electric Cable', icon: '🔌', desc: '+2 energy/s for 30s', cost: 7000, currency: 'coins', effect: 'energyBoost', duration: 30 },
    { id: 'soap_eyes', name: 'Soap in Eyes', icon: '🧼', desc: 'Blind + confusion 30s', cost: 7000, currency: 'coins', effect: 'multiStatus', statuses: ['blinding', 'confusion'], duration: 30 },
    { id: 'mattress', name: 'Mattress', icon: '🛏️', desc: 'Invincible to next 3 attacks', cost: 7000, currency: 'coins', effect: 'invincibleHits', value: 3 },
    { id: 'controller', name: 'CONTROLLER PLAYER!!!', icon: '🎮', desc: 'Perfect crits for 30s', cost: 10000, currency: 'coins', effect: 'perfectCrit', duration: 30 },
    { id: 'boogers', name: 'Crusty Boogers', icon: '🤢', desc: 'Blinding 50s', cost: 4000, currency: 'coins', effect: 'status', status: 'blinding', duration: 50 },
    { id: 'flamethrower', name: 'FLAMETHROWER', icon: '🔥', desc: 'Burn 60s + bleed 5s', cost: 15000, currency: 'coins', effect: 'multiStatus', statuses: ['burning', 'bleeding'], durations: [60, 5] },
    { id: 'lightning_rod', name: 'Lightning Rod', icon: '🌩️', desc: '70 dmg + blind 30s + burn 20s', cost: 20000, currency: 'coins', effect: 'lightningRod' },
    { id: 'refrigerator', name: 'Refrigerator', icon: '🧊', desc: 'Freeze 20s', cost: 2000, currency: 'coins', effect: 'status', status: 'freeze', duration: 20 }
];

const ARENA_THEMES = {
    "Trainer's Arena": { bg1: '#1a1a2e', bg2: '#16213e', ground: '#2d3436', accent: '#636e72' },
    'Grassy Plains': { bg1: '#0d3b0d', bg2: '#1a5c1a', ground: '#2d5016', accent: '#4a7c23' },
    'Bushy Plains': { bg1: '#1a3a1a', bg2: '#2d5a2d', ground: '#3d6b3d', accent: '#5a8a5a' },
    'Forest': { bg1: '#0a2e0a', bg2: '#1a4a1a', ground: '#2a3a1a', accent: '#3a5a2a' },
    'Desert': { bg1: '#4a3520', bg2: '#6b4c2a', ground: '#c2956b', accent: '#daa06d' },
    'Lava Arena': { bg1: '#2a0a0a', bg2: '#4a1a0a', ground: '#1a1a1a', accent: '#e74c3c' },
    'Ice Arena': { bg1: '#0a2a3a', bg2: '#1a4a5a', ground: '#3a6a7a', accent: '#7acbf0' },
    'Ice/Lava': { bg1: '#1a1a2e', bg2: '#2a1a3e', ground: '#1a1a1a', accent: '#9b59b6' },
    'Workshop': { bg1: '#2a2a1a', bg2: '#3a3a2a', ground: '#4a4a3a', accent: '#f39c12' },
    'Space': { bg1: '#050510', bg2: '#0a0a20', ground: '#1a1a3a', accent: '#a55eea' },
    'Beach': { bg1: '#0a3a5a', bg2: '#1a5a7a', ground: '#deb887', accent: '#f7c948' },
    'Wildfire': { bg1: '#2a0a00', bg2: '#4a1a00', ground: '#1a1a0a', accent: '#ff6b35' },
    "Champ's Arena": { bg1: '#1a1a00', bg2: '#2a2a0a', ground: '#0a0a0a', accent: '#ffd700' }
};

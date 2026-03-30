// ============ GAME STATE ============
let playerData = JSON.parse(localStorage.getItem('fightbot_save')) || {
    coins: 5000, gems: 100, xp: 0, level: 1, rp: 0,
    wins: 0, losses: 0,
    chests: [],
    openingChest: null,
    items: {},
    unlockedClasses: ['assassin', 'warrior', 'mage', 'healer']
};

let gameState = null;
let combatInterval = null;
let energyInterval = null;
let timerInterval = null;
let aiInterval = null;
let effectsInterval = null;
let canvas, ctx;
let canvasW = 800, canvasH = 400;
let keysDown = {};
const CONTROL_BINDINGS = {
    player: {
        label: 'Player 1',
        moveLeft: 'a',
        moveRight: 'd',
        abilities: ['q', 'w', 'e', 'r', 't']
    },
    enemy: {
        label: 'Player 2',
        moveLeft: 'arrowleft',
        moveRight: 'arrowright',
        abilities: ['u', 'i', 'o', 'p', '[']
    }
};
let battleSetup = createInitialBattleSetup();

function save() { localStorage.setItem('fightbot_save', JSON.stringify(playerData)); }

function createInitialBattleSetup() {
    return {
        mode: 'ai',
        pvpTurn: 1,
        selections: {
            player: null,
            enemy: null
        }
    };
}

function keyLabel(key) {
    const labels = {
        arrowleft: '←',
        arrowright: '→',
        '[': '['
    };
    return labels[key] || key.toUpperCase();
}

function fighterLabel(fighter) {
    return fighter?.label || 'Fighter';
}

function fighterPossessive(fighter) {
    const label = fighterLabel(fighter);
    return label.endsWith('s') ? `${label}'` : `${label}'s`;
}

function formatSelection(selection) {
    if (!selection) return 'Waiting';
    return `${CLASSES[selection.class].name} / ${WEAPONS[selection.weapon].name}`;
}

function buildPvpControlsMarkup() {
    return ['player', 'enemy'].map((side) => {
        const binding = CONTROL_BINDINGS[side];
        const abilityKeys = binding.abilities.map(keyLabel).join(' / ');
        return `
            <div class="control-card">
                <div class="control-card-title">${binding.label}</div>
                <div class="control-card-line">Move: ${keyLabel(binding.moveLeft)} / ${keyLabel(binding.moveRight)}</div>
                <div class="control-card-line">Skills: ${abilityKeys}</div>
            </div>
        `;
    }).join('');
}

function setSetupPanel(prefix, { show, badge, status, summary, controls }) {
    const panel = document.getElementById(`${prefix}-setup`);
    if (!panel) return;
    panel.classList.toggle('hidden', !show);
    if (!show) return;
    document.getElementById(`${prefix}-mode-badge`).textContent = badge;
    document.getElementById(`${prefix}-status`).textContent = status;
    document.getElementById(`${prefix}-summary`).textContent = summary;
    document.getElementById(`${prefix}-controls`).innerHTML = controls;
}

function renderSetupPanels() {
    const classTitle = document.getElementById('class-select-title');
    const weaponTitle = document.getElementById('weapon-select-title');
    if (!classTitle || !weaponTitle) return;

    if (battleSetup.mode !== 'pvp') {
        classTitle.textContent = 'Choose Your Class';
        weaponTitle.textContent = 'Choose Your Weapon';
        setSetupPanel('class-select', { show: false });
        setSetupPanel('weapon-select', { show: false });
        return;
    }

    const activeSide = battleSetup.pvpTurn === 1 ? 'player' : 'enemy';
    const activeBinding = CONTROL_BINDINGS[activeSide];
    const controls = buildPvpControlsMarkup();
    const summary = `${CONTROL_BINDINGS.player.label}: ${formatSelection(battleSetup.selections.player)} • ${CONTROL_BINDINGS.enemy.label}: ${formatSelection(battleSetup.selections.enemy)}`;

    classTitle.textContent = `${activeBinding.label}: Choose Your Class`;
    weaponTitle.textContent = `${activeBinding.label}: Choose Your Weapon`;

    setSetupPanel('class-select', {
        show: true,
        badge: 'LOCAL PVP',
        status: battleSetup.pvpTurn === 1
            ? 'Player 1 picks a class first. Once locked in, pass the keyboard to Player 2.'
            : 'Player 2 is choosing now. Player 1 is already locked in.',
        summary,
        controls
    });

    setSetupPanel('weapon-select', {
        show: true,
        badge: 'LOCAL PVP',
        status: selectedClass
            ? `${activeBinding.label} is choosing a weapon for ${CLASSES[selectedClass].name}.`
            : `${activeBinding.label} needs a class before picking a weapon.`,
        summary,
        controls
    });
}

function resetBattleSetup() {
    battleSetup = createInitialBattleSetup();
    selectedClass = null;
    renderSetupPanels();
}

function startAIBattleSetup() {
    resetBattleSetup();
    showScreen('class-select');
}

function startPvpSetup() {
    resetBattleSetup();
    battleSetup.mode = 'pvp';
    renderSetupPanels();
    showScreen('class-select');
}

// ============ VFX SYSTEM ============
const projectiles = [];
const particles = [];
const screenEffects = [];
let screenShake = { x: 0, y: 0, intensity: 0, decay: 0.9 };

// ----- Projectile Types -----
const PROJ_VISUALS = {
    rock:     { emoji: '🪨', size: 22, trail: '#8B4513', trailSize: 4 },
    fireball: { emoji: '☄️', size: 26, trail: '#ff4500', trailSize: 6, glow: '#ff6b35' },
    fire:     { emoji: '🔥', size: 18, trail: '#e74c3c', trailSize: 3 },
    ice:      { emoji: '❄️', size: 20, trail: '#7ec8e3', trailSize: 4, glow: '#3498db' },
    arrow:    { emoji: '➵',  size: 18, trail: '#aaa',    trailSize: 2, rotate: true },
    dagger:   { emoji: '🗡️', size: 16, trail: '#ccc',    trailSize: 2, rotate: true },
    shuriken: { emoji: '✦',  size: 16, trail: '#aaa',    trailSize: 2, spin: true },
    sword:    { emoji: '⚔️', size: 20, trail: '#f7c948', trailSize: 3, spin: true },
    spear:    { emoji: '🔱', size: 22, trail: '#bbb',    trailSize: 3, rotate: true },
    axe:      { emoji: '🪓', size: 20, trail: '#c0392b', trailSize: 3, spin: true },
    bomb:     { emoji: '💣', size: 20, trail: '#555',    trailSize: 3 },
    light:    { emoji: '💡', size: 18, trail: '#f7c948', trailSize: 4, glow: '#f7c948' },
    lightning:{ emoji: '⚡', size: 24, trail: '#f7c948', trailSize: 5, glow: '#ffd700' },
    wind:     { emoji: '🌬️', size: 22, trail: '#7ec8e3', trailSize: 5 },
    lava:     { emoji: '🌋', size: 28, trail: '#e74c3c', trailSize: 6, glow: '#ff4500' },
    skull:    { emoji: '💀', size: 22, trail: '#555',    trailSize: 4 },
    heal:     { emoji: '💚', size: 20, trail: '#2ecc71', trailSize: 4, glow: '#2ecc71' },
    energy:   { emoji: '⚡', size: 18, trail: '#3498db', trailSize: 3, glow: '#5dade2' },
    star:     { emoji: '🌟', size: 22, trail: '#f7c948', trailSize: 5, glow: '#ffd700' },
    music:    { emoji: '🎵', size: 18, trail: '#af7ac5', trailSize: 3 },
    dragon:   { emoji: '🐉', size: 30, trail: '#e74c3c', trailSize: 6, glow: '#ff6b35' },
    horse:    { emoji: '🐴', size: 26, trail: '#f7c948', trailSize: 4 },
    shield:   { emoji: '🛡️', size: 20, trail: '#3498db', trailSize: 3 },
    snow:     { emoji: '🌨️', size: 24, trail: '#aed6f1', trailSize: 5, glow: '#3498db' },
    fist:     { emoji: '👊', size: 22, trail: '#f39c12', trailSize: 4 },
    wave:     { emoji: '💥', size: 26, trail: '#f7c948', trailSize: 5, glow: '#ff6b35' },
};

// Map abilities → visual
const ABILITY_VISUALS = {
    // Assassin - Bow
    'Fire Arrow': { proj: 'arrow', count: 1 },
    'Bow of Heavens': { proj: 'star', count: 1, shakeOnHit: 6 },
    'Arrow Storm': { proj: 'arrow', count: 12, spread: true, delay: 60, shakeOnHit: 8 },
    // Assassin - Dagger
    'Slice': { proj: null, melee: true, flash: '#ccc' },
    'Wolverine Daggers': { proj: 'dagger', count: 6, spread: true, delay: 80 },
    'Floating Daggers': { proj: 'dagger', count: 8, spread: true, delay: 100 },
    'Teleport': { proj: null, selfEffect: 'teleport' },
    // Assassin - Dual Swords
    'Swing Sword': { proj: null, melee: true, flash: '#4ecdc4' },
    'Sword Spin': { proj: null, melee: true, flash: '#4ecdc4', spin: true },
    'Shuriken Throw': { proj: 'shuriken', count: 2, spread: true, delay: 150 },
    'Shockwave': { proj: 'wave', count: 1, shakeOnHit: 12, groundWave: true },
    // Warrior - Broadsword
    'Sword Slash': { proj: null, melee: true, flash: '#f39c12' },
    'Shield of Shielding': { proj: null, selfEffect: 'shield_up' },
    'Lava Strike': { proj: 'lava', count: 1, shakeOnHit: 10, groundWave: true },
    'Death Stab': { proj: null, melee: true, flash: '#e74c3c', shakeOnHit: 5 },
    // Warrior - Axe
    'Axe Swing': { proj: null, melee: true, flash: '#c0392b' },
    'Axe Spin': { proj: null, melee: true, flash: '#c0392b', spin: true },
    'Axe Throw': { proj: 'axe', count: 1 },
    'Bloodthirst': { proj: null, selfEffect: 'rage' },
    // Warrior - Spear
    'Throw Spear': { proj: 'spear', count: 1 },
    'Spear YEET': { proj: 'spear', count: 1, shakeOnHit: 8 },
    'Valkyrie': { proj: null, selfEffect: 'valkyrie_mount' },
    'Spear Vault': { proj: 'spear', count: 1 },
    // Mage - Fire
    'Shoot Fire': { proj: 'fire', count: 1 },
    'Fireball': { proj: 'fireball', count: 1, shakeOnHit: 8 },
    'Wall of Fire': { proj: null, selfEffect: 'firewall_up' },
    "Dragon's Breath": { proj: 'dragon', count: 1, shakeOnHit: 6 },
    // Mage - Earth
    'Rock Shot': { proj: 'rock', count: 5, spread: true, delay: 100 },
    'Stone Wall': { proj: null, selfEffect: 'shield_up' },
    'Rock Throw': { proj: 'rock', count: 2, spread: true, delay: 200, shakeOnHit: 6 },
    "Mountain's Peak": { proj: null, selfEffect: 'mountain_up' },
    // Mage - Ice
    'Ice Shard': { proj: 'ice', count: 1 },
    'Icy Wind': { proj: 'wind', count: 1 },
    'Ice Wall': { proj: null, selfEffect: 'ice_wall_up' },
    'Blizzard': { proj: 'snow', count: 1, shakeOnHit: 5 },
    // Healer - Offense
    'Light Beam': { proj: 'light', count: 1 },
    'Immensity': { proj: null, selfEffect: 'grow' },
    'Godly Strike': { proj: 'lightning', count: 1, shakeOnHit: 12 },
    'Hallelujah': { proj: 'music', count: 3, spread: true, delay: 150 },
    // Healer - Defense
    'Mini Shield': { proj: null, selfEffect: 'shield_up' },
    'Wall of Heavens': { proj: null, selfEffect: 'shield_up' },
    'YEET': { proj: 'fist', count: 1, shakeOnHit: 10 },
    'Invincible': { proj: null, selfEffect: 'invincible_glow' },
    // Healer - Stamina
    'Quick Heal': { proj: null, selfEffect: 'heal_glow' },
    'Rejuvenate': { proj: null, selfEffect: 'heal_glow' },
    'Energize': { proj: null, selfEffect: 'energy_glow' },
    'Endurance': { proj: null, selfEffect: 'heal_glow' },
    // Supers
    '3 Ozs to the Vagus Nerve': { proj: 'skull', count: 3, spread: true, delay: 100, shakeOnHit: 15 },
    'All Out War': { proj: 'sword', count: 5, spread: true, delay: 120, shakeOnHit: 15 },
    'Time Stop': { proj: 'snow', count: 1, shakeOnHit: 20, screenFlash: '#3498db' },
    'Divine Restoration': { proj: null, selfEffect: 'heal_glow', screenFlash: '#2ecc71' },
};

function spawnProjectile(fromX, fromY, toX, toY, type, onHit) {
    const vis = PROJ_VISUALS[type] || PROJ_VISUALS.rock;
    const dx = toX - fromX;
    const dy = toY - fromY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const speed = 8;
    projectiles.push({
        x: fromX, y: fromY,
        vx: (dx / dist) * speed,
        vy: (dy / dist) * speed,
        targetX: toX, targetY: toY,
        vis: vis,
        type: type,
        age: 0,
        onHit: onHit,
        rotation: 0
    });
}

function spawnParticles(x, y, color, count, speed, life, size) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = (Math.random() * 0.7 + 0.3) * (speed || 3);
        particles.push({
            x, y,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd - 1,
            life: life || 30,
            maxLife: life || 30,
            color: color,
            size: size || (3 + Math.random() * 3)
        });
    }
}

function triggerScreenShake(intensity) {
    screenShake.intensity = Math.max(screenShake.intensity, intensity);
}

function spawnScreenFlash(color) {
    screenEffects.push({ type: 'flash', color, alpha: 0.6, decay: 0.04 });
}

function spawnAbilityVFX(attacker, defender, abilityName) {
    const vis = ABILITY_VISUALS[abilityName];
    if (!vis) return;

    const fromX = attacker.x;
    const fromY = attacker.y - 15;
    const toX = defender.x;
    const toY = defender.y - 15;

    // Melee flash
    if (vis.melee) {
        if (vis.spin) {
            spawnParticles(attacker.x, attacker.y - 10, vis.flash || '#fff', 12, 4, 20, 4);
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                particles.push({
                    x: attacker.x, y: attacker.y - 10,
                    vx: Math.cos(angle) * 5,
                    vy: Math.sin(angle) * 5,
                    life: 15, maxLife: 15,
                    color: vis.flash || '#fff', size: 3
                });
            }
        } else {
            // Slash arc particles toward enemy
            const dir = attacker.facing;
            for (let i = 0; i < 6; i++) {
                particles.push({
                    x: attacker.x + dir * 20, y: attacker.y - 20 + i * 5,
                    vx: dir * (4 + Math.random() * 3),
                    vy: (Math.random() - 0.5) * 2,
                    life: 12, maxLife: 12,
                    color: vis.flash || '#fff', size: 3 + Math.random() * 2
                });
            }
        }
        if (vis.shakeOnHit) triggerScreenShake(vis.shakeOnHit);
        return;
    }

    // Self effects
    if (vis.selfEffect) {
        const colors = {
            'teleport': '#8e44ad', 'shield_up': '#3498db', 'rage': '#e74c3c',
            'firewall_up': '#ff6b35', 'mountain_up': '#8B4513', 'ice_wall_up': '#7ec8e3',
            'heal_glow': '#2ecc71', 'energy_glow': '#5dade2', 'grow': '#f7c948',
            'invincible_glow': '#ffd700', 'valkyrie_mount': '#f7c948'
        };
        const c = colors[vis.selfEffect] || '#fff';
        spawnParticles(attacker.x, attacker.y - 10, c, 20, 3, 30, 5);
        // Rising ring effect
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            particles.push({
                x: attacker.x + Math.cos(angle) * 30,
                y: attacker.y,
                vx: 0, vy: -2,
                life: 25, maxLife: 25,
                color: c, size: 4
            });
        }
        return;
    }

    if (vis.screenFlash) spawnScreenFlash(vis.screenFlash);

    // Ground wave
    if (vis.groundWave) {
        for (let i = 0; i < 20; i++) {
            const dir = attacker.facing;
            particles.push({
                x: attacker.x + dir * i * 8,
                y: 310 - Math.random() * 10,
                vx: dir * (2 + Math.random() * 2),
                vy: -(Math.random() * 4),
                life: 25, maxLife: 25,
                color: PROJ_VISUALS[vis.proj]?.trail || '#e74c3c',
                size: 4 + Math.random() * 4
            });
        }
    }

    // Projectiles
    if (vis.proj) {
        const count = vis.count || 1;
        for (let i = 0; i < count; i++) {
            const delay = (vis.delay || 0) * i;
            setTimeout(() => {
                if (!gameState || gameState.over) return;
                const spreadY = vis.spread ? (Math.random() - 0.5) * 60 : 0;
                const spreadX = vis.spread ? (Math.random() - 0.5) * 30 : 0;
                spawnProjectile(
                    fromX, fromY,
                    toX + spreadX, toY + spreadY,
                    vis.proj,
                    () => {
                        spawnParticles(toX + spreadX, toY + spreadY,
                            PROJ_VISUALS[vis.proj]?.trail || '#fff', 8, 3, 15, 3);
                        if (vis.shakeOnHit && i === count - 1) triggerScreenShake(vis.shakeOnHit);
                    }
                );
            }, delay);
        }
    }
}

// ============ SCREENS ============
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id === 'shop-screen') renderShop();
    if (id === 'chest-screen') renderChests();
    if (id === 'profile-screen') renderProfile();
    if (id === 'title-screen') { stopCombat(); resetBattleSetup(); }
    if (id === 'combat-screen') resizeCanvas();
    if (id === 'class-select' || id === 'weapon-select') renderSetupPanels();
}

// ============ CLASS & WEAPON SELECT ============
let selectedClass = null;

function selectClass(cls) {
    selectedClass = cls;
    const weapons = CLASSES[cls].weapons;
    const grid = document.getElementById('weapon-grid');
    grid.innerHTML = '';
    weapons.forEach(w => {
        const wp = WEAPONS[w];
        const card = document.createElement('div');
        card.className = 'class-card';
        card.onclick = () => selectWeapon(cls, w);
        card.innerHTML = `
            <div class="class-icon">${wp.icon}</div>
            <h3>${wp.name}</h3>
            <p class="class-desc">${wp.desc}</p>
            <div style="margin-top:10px;text-align:left;font-size:0.85rem;">
                <div>Base: ${wp.baseAbility.name} (${wp.baseAbility.damage} dmg)</div>
                ${wp.abilities.map(a => `<div style="color:#4ecdc4">• ${a.name} - ${a.desc}</div>`).join('')}
            </div>
        `;
        grid.appendChild(card);
    });
    renderSetupPanels();
    showScreen('weapon-select');
}

function selectWeapon(cls, weapon) {
    if (battleSetup.mode === 'pvp') {
        const side = battleSetup.pvpTurn === 1 ? 'player' : 'enemy';
        battleSetup.selections[side] = { class: cls, weapon };

        if (battleSetup.pvpTurn === 1) {
            battleSetup.pvpTurn = 2;
            selectedClass = null;
            renderSetupPanels();
            showScreen('class-select');
            return;
        }

        startPvpBattle(
            battleSetup.selections.player.class,
            battleSetup.selections.player.weapon,
            battleSetup.selections.enemy.class,
            battleSetup.selections.enemy.weapon
        );
        return;
    }

    startBattle(cls, weapon);
}

// ============ COMBAT ============
function createFighter(cls, weapon, options) {
    const c = CLASSES[cls];
    const w = WEAPONS[weapon];
    const isLeft = options.side === 'left';
    return {
        class: cls, weapon, weaponData: w,
        label: options.label,
        name: `${options.label} ${c.icon} ${c.name}`,
        isAI: !!options.isAI,
        hp: c.hp, maxHp: c.hp,
        energy: c.energy, maxEnergy: c.energy,
        shield: 0, shieldPercent: 0,
        x: isLeft ? 0.2 : 0.8,
        y: 0,
        facing: isLeft ? 1 : -1,
        effects: {}, cooldowns: {},
        dmgBuff: 0, invincible: false, invincibleHits: 0,
        perfectCrit: false, energyBlocked: false, abilityBlocked: false,
        cantAttack: false, bloodthirst: false,
        // Animation state
        animTimer: 0, hitFlash: 0, scale: 1
    };
}

function fighterScreenX(f) { return f.x * canvasW; }
function fighterScreenY(f) { return canvasH * 0.72 + f.y; }

function resizeCanvas() {
    const arena = document.getElementById('arena');
    canvas = document.getElementById('game-canvas');
    canvas.width = arena.clientWidth;
    canvas.height = arena.clientHeight;
    canvasW = canvas.width;
    canvasH = canvas.height;
    ctx = canvas.getContext('2d');
}

function syncFighterFacing() {
    if (!gameState) return;
    gameState.player.facing = gameState.player.x <= gameState.enemy.x ? 1 : -1;
    gameState.enemy.facing = gameState.enemy.x >= gameState.player.x ? -1 : 1;
}

function updateCombatControlLabels() {
    if (!gameState) return;
    document.getElementById('player-ability-name').textContent = fighterLabel(gameState.player);
    document.getElementById('player-ability-controls').textContent = `Move ${keyLabel(CONTROL_BINDINGS.player.moveLeft)} / ${keyLabel(CONTROL_BINDINGS.player.moveRight)} • Skills ${CONTROL_BINDINGS.player.abilities.map(keyLabel).join(' / ')}`;
    document.getElementById('enemy-ability-name').textContent = fighterLabel(gameState.enemy);
    document.getElementById('enemy-ability-controls').textContent = `Move ${keyLabel(CONTROL_BINDINGS.enemy.moveLeft)} / ${keyLabel(CONTROL_BINDINGS.enemy.moveRight)} • Skills ${CONTROL_BINDINGS.enemy.abilities.map(keyLabel).join(' / ')}`;
}

function initBattle(mode, playerConfig, enemyConfig, introMsg) {
    const rank = getRank(playerData.rp);
    const arenaName = rank.arena;
    const theme = ARENA_THEMES[arenaName] || ARENA_THEMES["Trainer's Arena"];

    projectiles.length = 0;
    particles.length = 0;
    screenEffects.length = 0;
    screenShake = { x: 0, y: 0, intensity: 0, decay: 0.88 };

    gameState = {
        mode,
        player: createFighter(playerConfig.class, playerConfig.weapon, { side: 'left', label: playerConfig.label }),
        enemy: createFighter(enemyConfig.class, enemyConfig.weapon, { side: 'right', label: enemyConfig.label, isAI: !!enemyConfig.isAI }),
        time: 120, arena: arenaName, theme, over: false, log: []
    };
    syncFighterFacing();

    showScreen('combat-screen');
    resizeCanvas();
    document.getElementById('combat-log').innerHTML = '';
    document.getElementById('damage-numbers').innerHTML = '';
    document.getElementById('battle-timer').textContent = '2:00';

    updateCombatControlLabels();
    updateHUD();
    renderAbilityBar();
    renderItemBar();
    startCombatLoop();
    logMsg(`Battle in ${arenaName}!`, 'info');
    logMsg(introMsg, 'info');
}

function startBattle(playerClass, playerWeapon) {
    const classes = Object.keys(CLASSES);
    const aiClass = classes[Math.floor(Math.random() * classes.length)];
    const aiWeapons = CLASSES[aiClass].weapons;
    const aiWeapon = aiWeapons[Math.floor(Math.random() * aiWeapons.length)];
    initBattle(
        'ai',
        { class: playerClass, weapon: playerWeapon, label: 'Player 1' },
        { class: aiClass, weapon: aiWeapon, label: 'AI', isAI: true },
        `Player 1: ${CLASSES[playerClass].name} (${WEAPONS[playerWeapon].name}) vs AI: ${CLASSES[aiClass].name} (${WEAPONS[aiWeapon].name})`
    );
}

function startPvpBattle(playerClass, playerWeapon, enemyClass, enemyWeapon) {
    initBattle(
        'pvp',
        { class: playerClass, weapon: playerWeapon, label: CONTROL_BINDINGS.player.label },
        { class: enemyClass, weapon: enemyWeapon, label: CONTROL_BINDINGS.enemy.label },
        `${CONTROL_BINDINGS.player.label}: ${CLASSES[playerClass].name} (${WEAPONS[playerWeapon].name}) vs ${CONTROL_BINDINGS.enemy.label}: ${CLASSES[enemyClass].name} (${WEAPONS[enemyWeapon].name})`
    );
}

function startCombatLoop() {
    energyInterval = setInterval(() => {
        if (gameState.over) return;
        const p = gameState.player, e = gameState.enemy;
        if (!p.energyBlocked) p.energy = Math.min(p.maxEnergy, p.energy + 5);
        if (!e.energyBlocked) e.energy = Math.min(e.maxEnergy, e.energy + 5);
        updateHUD();
        updateAbilityBar();
    }, 1000);

    timerInterval = setInterval(() => {
        if (gameState.over) return;
        gameState.time--;
        document.getElementById('battle-timer').textContent =
            `${Math.floor(gameState.time / 60)}:${(gameState.time % 60).toString().padStart(2, '0')}`;
        if (gameState.time <= 0) endBattle(gameState.player.hp > gameState.enemy.hp);
    }, 1000);

    effectsInterval = setInterval(() => {
        if (gameState.over) return;
        tickEffects(gameState.player);
        tickEffects(gameState.enemy);
        updateHUD();
    }, 1000);

    if (gameState.mode === 'ai') {
        aiInterval = setInterval(() => {
            if (gameState.over) return;
            aiTurn();
        }, 1500 + Math.random() * 2000);
    }

    // Use requestAnimationFrame for smooth rendering
    function gameLoop() {
        if (!gameState) return;
        renderArena();
        if (!gameState.over) requestAnimationFrame(gameLoop);
        else renderArena(); // one final frame
    }
    requestAnimationFrame(gameLoop);

    // Movement via held keys
    combatInterval = setInterval(() => {
        if (!gameState || gameState.over) return;
        const moveSpeed = 0.012;
        moveFighter(gameState.player, CONTROL_BINDINGS.player.moveLeft, CONTROL_BINDINGS.player.moveRight, moveSpeed);
        if (gameState.mode === 'pvp') {
            moveFighter(gameState.enemy, CONTROL_BINDINGS.enemy.moveLeft, CONTROL_BINDINGS.enemy.moveRight, moveSpeed);
        }
        syncFighterFacing();
    }, 1000 / 60);
}

function stopCombat() {
    clearInterval(combatInterval);
    clearInterval(energyInterval);
    clearInterval(timerInterval);
    clearInterval(aiInterval);
    clearInterval(effectsInterval);
    combatInterval = energyInterval = timerInterval = aiInterval = effectsInterval = null;
}

function moveFighter(fighter, leftKey, rightKey, moveSpeed) {
    if (hasEffect(fighter, 'stun') || hasEffect(fighter, 'freeze') || hasEffect(fighter, 'earth')) return;
    if (keysDown[leftKey]) fighter.x = Math.max(0.05, fighter.x - moveSpeed);
    if (keysDown[rightKey]) fighter.x = Math.min(0.95, fighter.x + moveSpeed);
}

// ============ STATUS EFFECTS ============
function applyEffect(target, type, duration) {
    const def = STATUS_EFFECTS[type];
    if (!def) return;
    const dur = duration || def.defaultDuration || 10;
    target.effects[type] = { remaining: dur, def };
    if (def.blockAttack) target.cantAttack = true;
    const who = fighterLabel(target);
    logMsg(`${who}: ${def.name} ${dur}s!`, 'effect');
}

function tickEffects(fighter) {
    for (const [type, eff] of Object.entries(fighter.effects)) {
        eff.remaining--;
        if (eff.def.dot && eff.remaining % eff.def.dotInterval === 0) {
            dealDamage(fighter, eff.def.dot, false, eff.def.name);
            // DOT particles
            const color = eff.def.color || '#e74c3c';
            spawnParticles(fighterScreenX(fighter), fighterScreenY(fighter) - 20, color, 4, 2, 15, 3);
        }
        if (eff.def.hot && eff.remaining % eff.def.hotInterval === 0) {
            fighter.hp = Math.min(fighter.maxHp, fighter.hp + eff.def.hot);
            showDamageNumber(fighter, eff.def.hot, 'heal');
            spawnParticles(fighterScreenX(fighter), fighterScreenY(fighter) - 20, '#2ecc71', 5, 2, 20, 3);
        }
        if (eff.remaining <= 0) {
            delete fighter.effects[type];
            if (type === 'stun' || type === 'freeze' || type === 'earth') fighter.cantAttack = false;
        }
    }
}

function hasEffect(fighter, type) {
    return fighter.effects[type] && fighter.effects[type].remaining > 0;
}

// ============ DAMAGE ============
function dealDamage(target, amount, isCrit, source) {
    if (target.invincible) {
        showDamageNumber(target, 0, 'shield');
        return 0;
    }
    if (target.invincibleHits > 0) {
        target.invincibleHits--;
        showDamageNumber(target, 0, 'shield');
        spawnParticles(fighterScreenX(target), fighterScreenY(target) - 20, '#3498db', 8, 3, 15, 4);
        return 0;
    }

    let dmg = amount;
    if (target.shieldPercent > 0) dmg = Math.floor(dmg * (1 - target.shieldPercent / 100));
    if (target.shield > 0) {
        const absorbed = Math.min(target.shield, dmg);
        target.shield -= absorbed;
        dmg -= absorbed;
        if (absorbed > 0) showDamageNumber(target, absorbed, 'shield');
    }

    if (dmg > 0) {
        target.hp = Math.max(0, target.hp - dmg);
        showDamageNumber(target, dmg, isCrit ? 'crit' : 'normal');
        target.hitFlash = 8;

        // Impact particles
        const color = isCrit ? '#ffd700' : '#ff4757';
        spawnParticles(fighterScreenX(target), fighterScreenY(target) - 20, color, isCrit ? 15 : 8, isCrit ? 5 : 3, 20, isCrit ? 5 : 3);
        if (isCrit) triggerScreenShake(8);
    }

    const who = fighterLabel(target);
    logMsg(`${who}: ${amount}${isCrit ? ' CRIT!' : ''} (${source || 'attack'})`, 'damage');
    updateHUD();

    if (target.hp <= 0) endBattle(target !== gameState.player);
    return dmg;
}

function showDamageNumber(fighter, amount, type) {
    const container = document.getElementById('damage-numbers');
    const el = document.createElement('div');
    el.className = `damage-number dmg-${type}`;
    const sx = fighterScreenX(fighter);
    const sy = fighterScreenY(fighter);
    const xOff = sx + (Math.random() - 0.5) * 50;
    el.style.left = `${xOff}px`;
    el.style.top = `${sy - 50}px`;
    if (type === 'heal') el.textContent = `+${amount}`;
    else if (type === 'shield') el.textContent = amount === 0 ? 'BLOCKED' : `🛡️${amount}`;
    else el.textContent = `-${amount}`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

// ============ ATTACK LOGIC ============
function performAttack(attacker, defender, ability) {
    if (gameState.over) return;
    if (attacker.cantAttack) {
        logMsg(`${fighterLabel(attacker)} can't attack!`, 'info');
        return;
    }

    if (hasEffect(attacker, 'confusion') && Math.random() < 0.5) {
        const selfDmg = ability.damage || 10;
        dealDamage(attacker, selfDmg, false, 'confusion');
        logMsg(`${fighterLabel(attacker)} hit themselves!`, 'effect');
        return;
    }

    if (hasEffect(attacker, 'blinding') && Math.random() < 0.5) {
        logMsg(`${fighterPossessive(attacker)} attack missed!`, 'info');
        spawnParticles(fighterScreenX(attacker), fighterScreenY(attacker) - 30, '#95a5a6', 5, 2, 15, 3);
        return;
    }

    // Spawn VFX
    spawnAbilityVFX(attacker, defender, ability.name);

    let dmg = ability.damage || 0;
    if (attacker.dmgBuff > 0) dmg = Math.floor(dmg * (1 + attacker.dmgBuff / 100));
    if (attacker.bloodthirst && dmg > 0) {
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + 10);
        showDamageNumber(attacker, 10, 'heal');
    }

    let isCrit = false;
    if (attacker.perfectCrit || Math.random() < 0.25) {
        if (dmg > 0) { dmg += 100; isCrit = true; }
    }

    // Delay damage to match projectile travel
    const vis = ABILITY_VISUALS[ability.name];
    const hasProj = vis && vis.proj;
    const travelDelay = hasProj ? 400 : 100;

    if (ability.hits && ability.hitDmg) {
        for (let i = 0; i < ability.hits; i++) {
            let hitDmg = ability.hitDmg;
            if (attacker.dmgBuff > 0) hitDmg = Math.floor(hitDmg * (1 + attacker.dmgBuff / 100));
            let hitCrit = attacker.perfectCrit || Math.random() < 0.25;
            if (hitCrit) hitDmg += 100;
            const d = travelDelay + (vis && vis.delay ? vis.delay * i : i * 200);
            setTimeout(() => {
                if (gameState && !gameState.over) dealDamage(defender, hitDmg, hitCrit, ability.name);
            }, d);
        }
    } else if (dmg > 0) {
        setTimeout(() => {
            if (gameState && !gameState.over) dealDamage(defender, dmg, isCrit, ability.name);
        }, travelDelay);
    }

    if (ability.effects) {
        setTimeout(() => {
            if (!gameState || gameState.over) return;
            ability.effects.forEach(eff => applyEffect(defender, eff.type, eff.duration));
        }, travelDelay);
    }
    if (ability.selfEffects) {
        ability.selfEffects.forEach(eff => applyEffect(attacker, eff.type, eff.duration));
    }
    handleSpecial(attacker, defender, ability);
}

function handleSpecial(attacker, defender, ability) {
    if (!ability.special) return;
    switch (ability.special) {
        case 'shield':
            attacker.shield += ability.shieldAmount || 0;
            logMsg(`${fighterLabel(attacker)}: +${ability.shieldAmount} shield!`, 'info');
            break;
        case 'firewall':
            attacker.shieldPercent = ability.shieldPercent;
            setTimeout(() => { if (attacker) attacker.shieldPercent = 0; }, (ability.duration || 20) * 1000);
            break;
        case 'stonewall':
            attacker.shieldPercent = ability.shieldPercent;
            attacker.cantAttack = true;
            setTimeout(() => { attacker.shieldPercent = 0; attacker.cantAttack = false; }, (ability.duration || 30) * 1000);
            break;
        case 'icewall':
            attacker.shieldPercent = ability.shieldPercent;
            attacker.energyBlocked = true;
            applyEffect(attacker, 'freeze', ability.duration);
            setTimeout(() => { attacker.shieldPercent = 0; attacker.energyBlocked = false; }, (ability.duration || 15) * 1000);
            break;
        case 'blizzard':
            defender.energyBlocked = true;
            attacker.shieldPercent = 20;
            setTimeout(() => { defender.energyBlocked = false; attacker.shieldPercent = 0; }, (ability.duration || 20) * 1000);
            break;
        case 'mountain':
            attacker.dmgBuff += 30; attacker.shieldPercent = 50;
            setTimeout(() => { attacker.dmgBuff -= 30; attacker.shieldPercent = 0; }, (ability.duration || 25) * 1000);
            break;
        case 'bloodthirst':
            attacker.dmgBuff += 25; attacker.bloodthirst = true;
            setTimeout(() => { attacker.dmgBuff -= 25; attacker.bloodthirst = false; applyEffect(attacker, 'confusion', 15); }, (ability.duration || 15) * 1000);
            break;
        case 'teleport':
            attacker.x += attacker.facing * 0.15;
            attacker.x = Math.max(0.05, Math.min(0.95, attacker.x));
            spawnParticles(fighterScreenX(attacker), fighterScreenY(attacker), '#8e44ad', 15, 4, 20, 4);
            break;
        case 'invincible':
            attacker.invincible = true;
            setTimeout(() => { attacker.invincible = false; }, (ability.duration || 5) * 1000);
            break;
        case 'dmgbuff':
            attacker.dmgBuff += (ability.buffPercent || 10);
            setTimeout(() => { attacker.dmgBuff -= (ability.buffPercent || 10); }, (ability.duration || 20) * 1000);
            break;
        case 'heal':
            attacker.hp = Math.min(attacker.maxHp, attacker.hp + (ability.healAmount || 0));
            showDamageNumber(attacker, ability.healAmount, 'heal');
            break;
        case 'energize':
            attacker.energy = Math.min(attacker.maxEnergy, attacker.energy + (ability.energyAmount || 0));
            break;
        case 'endurance':
            attacker.shieldPercent = 20;
            applyEffect(attacker, 'healing', ability.duration || 15);
            setTimeout(() => { attacker.shieldPercent = 0; }, (ability.duration || 15) * 1000);
            break;
        case 'invincible_heal':
            attacker.invincible = true; attacker.cantAttack = true;
            applyEffect(attacker, 'healing', ability.duration || 10);
            setTimeout(() => { attacker.invincible = false; attacker.cantAttack = false; applyEffect(attacker, 'stun', 30); }, (ability.duration || 10) * 1000);
            break;
        case 'minishield':
            attacker.shieldPercent = ability.shieldPercent || 5;
            setTimeout(() => { attacker.shieldPercent = 0; }, (ability.duration || 2) * 1000);
            break;
        case 'valkyrie':
            attacker.y = -80;
            setTimeout(() => { attacker.y = 0; }, (ability.duration || 10) * 1000);
            break;
        case 'healer_super':
            if (attacker.hp < attacker.maxHp) {
                attacker.hp = attacker.maxHp;
                showDamageNumber(attacker, attacker.maxHp, 'heal');
            } else attacker.shield += 150;
            applyEffect(defender, 'blinding', 25);
            break;
    }
}

// ============ PLAYER ABILITIES ============
function useAbility(index) {
    useAbilityForFighter('player', index);
}

function useAbilityForFighter(fighterKey, index) {
    if (!gameState || gameState.over) return;
    const attacker = gameState[fighterKey];
    const defender = fighterKey === 'player' ? gameState.enemy : gameState.player;

    if (attacker.cantAttack) { logMsg(`${fighterLabel(attacker)} can't attack!`, 'info'); return; }

    if (index === 0) {
        performAttack(attacker, defender, attacker.weaponData.baseAbility);
        return;
    }

    if (index === 4) {
        const s = SUPERS[attacker.class];
        if (attacker.cooldowns['super'] > 0) { logMsg(`${fighterLabel(attacker)} super: ${attacker.cooldowns['super']}s cooldown`, 'info'); return; }
        if (attacker.energy < s.energy) { logMsg(`${fighterLabel(attacker)} needs ${s.energy} energy!`, 'info'); return; }
        if (attacker.abilityBlocked) { logMsg(`${fighterLabel(attacker)} abilities are blocked!`, 'info'); return; }
        attacker.energy -= s.energy;
        attacker.cooldowns['super'] = s.cooldown;
        startCooldown(attacker, 'super', s.cooldown);

        spawnAbilityVFX(attacker, defender, s.name);
        const delay = ABILITY_VISUALS[s.name]?.proj ? 400 : 100;

        setTimeout(() => {
            if (!gameState || gameState.over) return;
            if (s.damage > 0) dealDamage(defender, s.damage, false, s.name);
            if (s.effects) s.effects.forEach(eff => applyEffect(defender, eff.type, eff.duration));
            if (s.shieldAmount) attacker.shield += s.shieldAmount;
            if (s.special) handleSpecial(attacker, defender, s);
            if (attacker.class === 'assassin') {
                attacker.dmgBuff += 20;
                setTimeout(() => { attacker.dmgBuff -= 20; }, 15000);
            }
        }, delay);

        logMsg(`${fighterLabel(attacker)} SUPER: ${s.name}!`, 'info');
        updateAbilityBar();
        return;
    }

    const abilityIdx = index - 1;
    const ability = attacker.weaponData.abilities[abilityIdx];
    if (!ability) return;
    const cdKey = `ability_${abilityIdx}`;
    if (attacker.cooldowns[cdKey] > 0) { logMsg(`${fighterLabel(attacker)} ${ability.name}: ${attacker.cooldowns[cdKey]}s cooldown`, 'info'); return; }
    if (attacker.energy < ability.energy) { logMsg(`${fighterLabel(attacker)} needs ${ability.energy} energy!`, 'info'); return; }
    if (attacker.abilityBlocked) { logMsg(`${fighterLabel(attacker)} abilities are blocked!`, 'info'); return; }

    attacker.energy -= ability.energy;
    attacker.cooldowns[cdKey] = ability.cooldown;
    startCooldown(attacker, cdKey, ability.cooldown);
    performAttack(attacker, defender, ability);
    logMsg(`${fighterLabel(attacker)} used ${ability.name}!`, 'info');
    updateAbilityBar();
}

function startCooldown(fighter, key, duration) {
    const interval = setInterval(() => {
        if (!gameState || gameState.over) { clearInterval(interval); return; }
        fighter.cooldowns[key]--;
        if (fighter.cooldowns[key] <= 0) { fighter.cooldowns[key] = 0; clearInterval(interval); }
        updateAbilityBar();
    }, 1000);
}

// ============ AI ============
function aiTurn() {
    if (!gameState || gameState.over) return;
    const ai = gameState.enemy, player = gameState.player;
    if (ai.cantAttack) return;

    const available = [];
    ai.weaponData.abilities.forEach((a, i) => {
        const cdKey = `ability_${i}`;
        if ((!ai.cooldowns[cdKey] || ai.cooldowns[cdKey] <= 0) && ai.energy >= a.energy && !ai.abilityBlocked)
            available.push({ ability: a, index: i });
    });
    const superA = SUPERS[ai.class];
    if ((!ai.cooldowns['super'] || ai.cooldowns['super'] <= 0) && ai.energy >= superA.energy && !ai.abilityBlocked)
        available.push({ ability: superA, index: 'super' });

    if (available.length > 0 && Math.random() < 0.4) {
        const chosen = available[Math.floor(Math.random() * available.length)];
        ai.energy -= chosen.ability.energy;

        if (chosen.index === 'super') {
            ai.cooldowns['super'] = chosen.ability.cooldown;
            startCooldown(ai, 'super', chosen.ability.cooldown);
            spawnAbilityVFX(ai, player, chosen.ability.name);
            const delay = ABILITY_VISUALS[chosen.ability.name]?.proj ? 400 : 100;
            setTimeout(() => {
                if (!gameState || gameState.over) return;
                if (chosen.ability.damage > 0) dealDamage(player, chosen.ability.damage, false, chosen.ability.name);
                if (chosen.ability.effects) chosen.ability.effects.forEach(eff => applyEffect(player, eff.type, eff.duration));
                if (chosen.ability.shieldAmount) ai.shield += chosen.ability.shieldAmount;
                if (chosen.ability.special) handleSpecial(ai, player, chosen.ability);
                if (ai.class === 'assassin') { ai.dmgBuff += 20; setTimeout(() => { ai.dmgBuff -= 20; }, 15000); }
            }, delay);
            logMsg(`${fighterLabel(ai)} SUPER: ${chosen.ability.name}!`, 'info');
        } else {
            const cdKey = `ability_${chosen.index}`;
            ai.cooldowns[cdKey] = chosen.ability.cooldown;
            startCooldown(ai, cdKey, chosen.ability.cooldown);
            performAttack(ai, player, chosen.ability);
        }
    } else {
        performAttack(ai, player, ai.weaponData.baseAbility);
    }

    // AI movement toward player
    const dx = player.x - ai.x;
    ai.x += Math.sign(dx) * (0.005 + Math.random() * 0.01);
    ai.x = Math.max(0.05, Math.min(0.95, ai.x));
    syncFighterFacing();
    updateHUD();
}

// ============ ITEMS IN COMBAT ============
function useItem(itemId) {
    if (!gameState || gameState.over) return;
    if (gameState.mode === 'pvp') return;
    if (!playerData.items[itemId] || playerData.items[itemId] <= 0) return;
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return;
    playerData.items[itemId]--;
    save();
    const p = gameState.player, e = gameState.enemy;

    switch (item.effect) {
        case 'dmgBuff':
            p.dmgBuff += item.value;
            setTimeout(() => { p.dmgBuff -= item.value; }, (item.duration || 30) * 1000);
            break;
        case 'empEnergy':
            e.energyBlocked = true;
            setTimeout(() => { e.energyBlocked = false; }, (item.duration || 10) * 1000);
            break;
        case 'abilityBlock':
            e.abilityBlocked = true;
            setTimeout(() => { e.abilityBlocked = false; }, (item.duration || 30) * 1000);
            break;
        case 'heal':
            p.hp = Math.min(p.maxHp, p.hp + item.value);
            showDamageNumber(p, item.value, 'heal');
            spawnParticles(fighterScreenX(p), fighterScreenY(p) - 20, '#2ecc71', 12, 3, 25, 4);
            break;
        case 'status':
            applyEffect(e, item.status, item.duration);
            break;
        case 'multiStatus':
            if (item.durations) item.statuses.forEach((s, i) => applyEffect(e, s, item.durations[i]));
            else item.statuses.forEach(s => applyEffect(e, s, item.duration));
            break;
        case 'energyBoost':
            const eboost = setInterval(() => {
                if (gameState && !gameState.over) p.energy = Math.min(p.maxEnergy, p.energy + 2);
            }, 1000);
            setTimeout(() => clearInterval(eboost), (item.duration || 30) * 1000);
            break;
        case 'invincibleHits':
            p.invincibleHits += item.value;
            break;
        case 'perfectCrit':
            p.perfectCrit = true;
            setTimeout(() => { p.perfectCrit = false; }, (item.duration || 30) * 1000);
            break;
        case 'lightningRod':
            spawnProjectile(fighterScreenX(p), fighterScreenY(p) - 20, fighterScreenX(e), fighterScreenY(e) - 20, 'lightning', () => {
                triggerScreenShake(10);
            });
            setTimeout(() => {
                dealDamage(e, 70, false, 'Lightning Rod');
                applyEffect(e, 'blinding', 30);
                applyEffect(e, 'burning', 20);
            }, 400);
            break;
    }
    logMsg(`Item: ${item.name}!`, 'info');
    renderItemBar();
    updateHUD();
}

// ============ END BATTLE ============
function endBattle(playerWon) {
    if (gameState.over) return;
    gameState.over = true;
    stopCombat();

    const panel = document.getElementById('results-content');
    let html = '';
    if (gameState.mode === 'pvp') {
        const winner = playerWon ? gameState.player : gameState.enemy;
        html = `<h2 class="win-text">${fighterLabel(winner).toUpperCase()} WINS!</h2>
            <div class="reward-line">Local PvP match complete.</div>
            <div class="reward-line">RP, XP, coins, chests, and items were unchanged.</div>`;
    } else if (playerWon) {
        const coins = 30 + Math.floor(Math.random() * 71);
        const rpGain = 20 + Math.floor(Math.random() * 11);
        playerData.coins += coins; playerData.xp += 30; playerData.rp += rpGain; playerData.wins++;
        let chestDrop = null;
        if (playerData.chests.length < 5) {
            chestDrop = rollChest();
            playerData.chests.push({ ...chestDrop, startTime: null, endTime: null });
        }
        html = `<h2 class="win-text">VICTORY!</h2>
            <div class="reward-line">🪙 +${coins} Coins</div>
            <div class="reward-line">⭐ +30 XP</div>
            <div class="reward-line">🏅 +${rpGain} RP</div>
            ${chestDrop ? `<div class="reward-line">📦 ${chestDrop.name}!</div>` : ''}`;
    } else {
        const rpLoss = 5 + Math.floor(Math.random() * 5);
        playerData.rp = Math.max(0, playerData.rp - rpLoss); playerData.xp += 10; playerData.losses++;
        html = `<h2 class="lose-text">DEFEAT</h2>
            <div class="reward-line">⭐ +10 XP</div>
            <div class="reward-line">🏅 -${rpLoss} RP</div>`;
    }
    const newLevel = Math.floor(playerData.xp / 100) + 1;
    if (gameState.mode !== 'pvp' && newLevel > playerData.level) {
        playerData.level = newLevel;
        html += `<div class="reward-line" style="color:#f7c948">LEVEL UP! Level ${newLevel}!</div>`;
    }
    html += `<br><button class="btn btn-primary" onclick="showScreen('title-screen')">Continue</button>`;
    panel.innerHTML = html;
    save();
    showScreen('results-screen');
}

function rollChest() {
    const roll = Math.random() * 100;
    let cum = 0;
    for (const c of CHEST_TABLE) { cum += c.chance; if (roll < cum) return { ...c }; }
    return { ...CHEST_TABLE[0] };
}

// ============ HUD ============
function updateHUD() {
    if (!gameState) return;
    const p = gameState.player, e = gameState.enemy;

    document.getElementById('player-name').textContent = p.name;
    document.getElementById('enemy-name').textContent = e.name;

    document.getElementById('player-health-bar').style.width = `${(p.hp / p.maxHp) * 100}%`;
    document.getElementById('player-health-text').textContent = `${Math.max(0, Math.round(p.hp))}/${p.maxHp}`;
    document.getElementById('player-energy-bar').style.width = `${(p.energy / p.maxEnergy) * 100}%`;
    document.getElementById('player-energy-text').textContent = `${Math.round(p.energy)}/${p.maxEnergy}`;

    document.getElementById('enemy-health-bar').style.width = `${(e.hp / e.maxHp) * 100}%`;
    document.getElementById('enemy-health-text').textContent = `${Math.max(0, Math.round(e.hp))}/${e.maxHp}`;
    document.getElementById('enemy-energy-bar').style.width = `${(e.energy / e.maxEnergy) * 100}%`;
    document.getElementById('enemy-energy-text').textContent = `${Math.round(e.energy)}/${e.maxEnergy}`;

    document.getElementById('player-shield-display').textContent = buildDefenseText(p);
    document.getElementById('enemy-shield-display').textContent = buildDefenseText(e);

    renderEffects('player-effects', p);
    renderEffects('enemy-effects', e);
}

function buildDefenseText(fighter) {
    return (fighter.shield > 0 ? `🛡️${fighter.shield}` : '') +
        (fighter.shieldPercent > 0 ? ` ${fighter.shieldPercent}% shield` : '') +
        (fighter.invincible ? ' ✨INVINCIBLE' : '') +
        (fighter.invincibleHits > 0 ? ` 🛏️${fighter.invincibleHits}` : '') +
        (fighter.dmgBuff > 0 ? ` ⚔️+${fighter.dmgBuff}%` : '');
}

function renderEffects(elementId, fighter) {
    const el = document.getElementById(elementId);
    el.innerHTML = '';
    for (const [type, eff] of Object.entries(fighter.effects)) {
        if (eff.remaining > 0) {
            const span = document.createElement('span');
            span.className = `status-effect effect-${type}`;
            span.textContent = `${STATUS_EFFECTS[type].name} ${eff.remaining}s`;
            el.appendChild(span);
        }
    }
}

// ============ ABILITY BAR ============
function renderAbilityBar() {
    if (!gameState) return;
    updateCombatControlLabels();
    renderAbilityButtons('player-ability-list', gameState.player, 'player');

    const enemyGroup = document.getElementById('enemy-ability-group');
    const itemBar = document.getElementById('item-bar');
    if (gameState.mode === 'pvp') {
        enemyGroup.classList.remove('hidden');
        itemBar.classList.add('hidden');
        renderAbilityButtons('enemy-ability-list', gameState.enemy, 'enemy');
        itemBar.innerHTML = '';
        return;
    }

    enemyGroup.classList.add('hidden');
    document.getElementById('enemy-ability-list').innerHTML = '';
    itemBar.classList.remove('hidden');
}

function renderAbilityButtons(containerId, fighter, fighterKey) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    const binding = CONTROL_BINDINGS[fighterKey];
    const abilities = [fighter.weaponData.baseAbility, ...fighter.weaponData.abilities, SUPERS[fighter.class]];
    const keys = binding.abilities.map(keyLabel);

    abilities.forEach((a, i) => {
        const btn = document.createElement('div');
        btn.className = 'ability-btn';
        if (i === 4) btn.classList.add('super-btn');
        const cdKey = i === 0 ? null : i === 4 ? 'super' : `ability_${i - 1}`;
        const cd = cdKey ? (fighter.cooldowns[cdKey] || 0) : 0;
        const cost = i === 0 ? 0 : (a.energy || 0);

        if (cd > 0) btn.classList.add('on-cooldown');
        if (cost > fighter.energy && i > 0) btn.classList.add('disabled');

        btn.onclick = () => useAbilityForFighter(fighterKey, i);
        btn.innerHTML = `
            <span class="ability-key">${keys[i]}</span>
            <span class="ability-icon">${a.icon || '⚡'}</span>
            <span class="ability-name">${a.name}</span>
            ${cost > 0 ? `<span class="ability-cost">⚡${cost}</span>` : '<span class="ability-cost">FREE</span>'}
            ${cd > 0 ? `<div class="cooldown-overlay">${cd}s</div>` : ''}
            <div class="ability-tooltip">
                <div class="tooltip-title">${a.name}</div>
                <div class="tooltip-desc">${a.desc || ''}</div>
                <div class="tooltip-stats">
                    ${a.damage ? `Damage: ${a.damage}` : ''}
                    ${cost ? ` | Energy: ${cost}` : ''}
                    ${a.cooldown ? ` | CD: ${a.cooldown}s` : ''}
                </div>
            </div>
        `;
        container.appendChild(btn);
    });
}

function updateAbilityBar() { if (gameState && !gameState.over) renderAbilityBar(); }

// ============ ITEM BAR ============
function renderItemBar() {
    const bar = document.getElementById('item-bar');
    bar.innerHTML = '';
    if (!gameState || gameState.mode === 'pvp') return;
    for (const [itemId, count] of Object.entries(playerData.items)) {
        if (count <= 0) continue;
        const item = SHOP_ITEMS.find(i => i.id === itemId);
        if (!item) continue;
        const btn = document.createElement('div');
        btn.className = 'item-btn';
        btn.onclick = () => useItem(itemId);
        btn.title = item.desc;
        btn.innerHTML = `${item.icon}<span class="item-count">x${count}</span>`;
        bar.appendChild(btn);
    }
}

// ============ ARENA RENDER ============
function renderArena() {
    if (!ctx || !gameState) return;
    const t = gameState.theme;
    const p = gameState.player, e = gameState.enemy;

    // Screen shake
    screenShake.x = (Math.random() - 0.5) * screenShake.intensity * 2;
    screenShake.y = (Math.random() - 0.5) * screenShake.intensity * 2;
    screenShake.intensity *= screenShake.decay;
    if (screenShake.intensity < 0.5) screenShake.intensity = 0;

    ctx.save();
    ctx.translate(screenShake.x, screenShake.y);

    // Background
    const grad = ctx.createLinearGradient(0, 0, 0, canvasH);
    grad.addColorStop(0, t.bg1);
    grad.addColorStop(0.7, t.bg2);
    grad.addColorStop(1, t.ground);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Ground
    const groundY = canvasH * 0.78;
    ctx.fillStyle = t.ground;
    ctx.fillRect(0, groundY, canvasW, canvasH - groundY);

    // Ground detail line
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(canvasW, groundY);
    ctx.stroke();

    // Arena decorations
    drawArenaDecor(t, groundY);

    // Draw fighters
    drawFighter(p, '#4ecdc4');
    drawFighter(e, '#e74c3c');

    // Draw projectiles
    updateAndDrawProjectiles();

    // Draw particles
    updateAndDrawParticles();

    // Screen effects (flash)
    for (let i = screenEffects.length - 1; i >= 0; i--) {
        const se = screenEffects[i];
        if (se.type === 'flash') {
            ctx.fillStyle = se.color;
            ctx.globalAlpha = se.alpha;
            ctx.fillRect(0, 0, canvasW, canvasH);
            ctx.globalAlpha = 1;
            se.alpha -= se.decay;
            if (se.alpha <= 0) screenEffects.splice(i, 1);
        }
    }

    ctx.restore();
}

function drawFighter(fighter, color) {
    const x = fighterScreenX(fighter);
    const y = fighterScreenY(fighter);
    const icon = CLASSES[fighter.class].icon;
    const weaponIcon = fighter.weaponData.icon;
    const dir = fighter.facing;

    ctx.save();
    ctx.translate(x, y);

    // Hit flash
    if (fighter.hitFlash > 0) {
        fighter.hitFlash--;
        if (fighter.hitFlash % 2 === 0) { ctx.restore(); return; } // blink
    }

    const s = fighter.scale || 1;
    ctx.scale(dir * s, s);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 38, 28 * s, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Invincible aura
    if (fighter.invincible) {
        const pulse = Math.sin(Date.now() / 150) * 5;
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 15 + pulse;
        ctx.beginPath();
        ctx.arc(0, -5, 42 + pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    // Shield aura
    if (fighter.shield > 0 || fighter.shieldPercent > 0) {
        const pulse = Math.sin(Date.now() / 200) * 3;
        ctx.strokeStyle = 'rgba(52, 152, 219, 0.5)';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#3498db';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, -5, 38 + pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    // Body
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    // Legs
    const walk = Math.sin(Date.now() / 200) * 4;
    ctx.beginPath();
    ctx.moveTo(-4, 12);
    ctx.lineTo(-12, 36 + walk);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(4, 12);
    ctx.lineTo(12, 36 - walk);
    ctx.stroke();

    // Torso
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(0, 14);
    ctx.stroke();

    // Arms
    ctx.lineWidth = 4;
    const armSwing = Math.sin(Date.now() / 300) * 8;
    // Back arm
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(-18, -2 + armSwing);
    ctx.stroke();
    // Front arm (holding weapon)
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(20, -8 - armSwing);
    ctx.stroke();

    // Head
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, -28, 14, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#0a0a1a';
    ctx.beginPath();
    ctx.arc(4, -30, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(10, -30, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Weapon in hand
    ctx.font = '16px serif';
    ctx.textAlign = 'center';
    ctx.fillText(weaponIcon, 26, -4 - armSwing);

    // Class icon above head
    ctx.font = '22px serif';
    ctx.scale(dir, 1); // flip text back
    ctx.fillText(icon, 0, -50);

    // Burning effect
    if (fighter.effects.burning) {
        ctx.font = '14px serif';
        const flicker = Math.sin(Date.now() / 100) * 3;
        ctx.fillText('🔥', -10 + flicker, -42);
        ctx.fillText('🔥', 8 - flicker, -38);
    }
    // Frozen effect
    if (fighter.effects.freeze) {
        ctx.font = '14px serif';
        ctx.fillText('❄️', -8, -42);
        ctx.fillText('❄️', 10, -36);
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#7ec8e3';
        ctx.fillRect(-20, -45, 40, 80);
        ctx.globalAlpha = 1;
    }
    // Poison effect
    if (fighter.effects.poison) {
        ctx.font = '12px serif';
        ctx.fillText('☠️', 14, -42);
    }
    // Confusion effect
    if (fighter.effects.confusion) {
        ctx.font = '14px serif';
        const spin = Date.now() / 300;
        ctx.fillText('💫', Math.cos(spin) * 15, -52 + Math.sin(spin) * 5);
    }
    // Stun effect
    if (fighter.effects.stun) {
        ctx.font = '14px serif';
        const spin = Date.now() / 400;
        ctx.fillText('⭐', Math.cos(spin) * 12, -55);
        ctx.fillText('⭐', Math.cos(spin + 2) * 12, -50);
    }

    ctx.restore();

    // HP bar above fighter (in un-flipped coords)
    const barW = 60;
    const hpPct = fighter.hp / fighter.maxHp;
    const barX = x - barW / 2;
    const barY = y - 72;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, 9);
    ctx.fillStyle = hpPct > 0.5 ? '#2ecc71' : hpPct > 0.25 ? '#f39c12' : '#e74c3c';
    ctx.fillRect(barX, barY, barW * hpPct, 7);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX - 1, barY - 1, barW + 2, 9);
}

function updateAndDrawProjectiles() {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.age++;
        p.rotation += 0.15;

        // Trail particles
        if (p.age % 2 === 0) {
            particles.push({
                x: p.x + (Math.random() - 0.5) * 6,
                y: p.y + (Math.random() - 0.5) * 6,
                vx: -p.vx * 0.1 + (Math.random() - 0.5),
                vy: -p.vy * 0.1 + (Math.random() - 0.5),
                life: 12, maxLife: 12,
                color: p.vis.trail, size: p.vis.trailSize
            });
        }

        // Glow
        if (p.vis.glow) {
            ctx.shadowColor = p.vis.glow;
            ctx.shadowBlur = 15;
        }

        // Draw projectile
        ctx.save();
        ctx.translate(p.x, p.y);
        if (p.vis.spin) ctx.rotate(p.rotation);
        else if (p.vis.rotate) ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.font = `${p.vis.size}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.vis.emoji, 0, 0);
        ctx.restore();
        ctx.shadowBlur = 0;

        // Hit detection
        const dx = p.x - p.targetX;
        const dy = p.y - p.targetY;
        if (Math.sqrt(dx * dx + dy * dy) < 30 || p.age > 120) {
            if (p.onHit && p.age <= 120) p.onHit();
            projectiles.splice(i, 1);
        }
    }
}

function updateAndDrawParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08; // gravity
        p.life--;

        const alpha = p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();

        if (p.life <= 0) particles.splice(i, 1);
    }
    ctx.globalAlpha = 1;
}

function drawArenaDecor(theme, groundY) {
    ctx.fillStyle = theme.accent + '22';
    // pillars
    for (let i = 0; i < 5; i++) {
        const ax = canvasW * 0.1 + i * canvasW * 0.2;
        ctx.fillRect(ax, groundY, 15, canvasH - groundY);
    }
    // subtle glow at ground
    const glowGrad = ctx.createRadialGradient(canvasW / 2, groundY, 0, canvasW / 2, groundY, canvasW * 0.4);
    glowGrad.addColorStop(0, theme.accent + '15');
    glowGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, groundY - 20, canvasW, 40);
}

// ============ KEYBOARD CONTROLS ============
document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    keysDown[key] = true;

    const shouldPrevent = [
        CONTROL_BINDINGS.player.moveLeft,
        CONTROL_BINDINGS.player.moveRight,
        CONTROL_BINDINGS.enemy.moveLeft,
        CONTROL_BINDINGS.enemy.moveRight,
        ...CONTROL_BINDINGS.player.abilities,
        ...CONTROL_BINDINGS.enemy.abilities
    ].includes(key);
    if (shouldPrevent) e.preventDefault();

    if (!gameState || gameState.over) return;
    const playerAbility = CONTROL_BINDINGS.player.abilities.indexOf(key);
    if (playerAbility !== -1) {
        useAbilityForFighter('player', playerAbility);
        return;
    }

    if (gameState.mode === 'pvp') {
        const enemyAbility = CONTROL_BINDINGS.enemy.abilities.indexOf(key);
        if (enemyAbility !== -1) {
            useAbilityForFighter('enemy', enemyAbility);
        }
    }
});

document.addEventListener('keyup', (e) => {
    keysDown[e.key.toLowerCase()] = false;
});

window.addEventListener('resize', () => {
    if (document.getElementById('combat-screen').classList.contains('active')) resizeCanvas();
});

// ============ COMBAT LOG ============
function logMsg(msg, type) {
    if (!gameState) return;
    const log = document.getElementById('combat-log');
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.textContent = msg;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
    while (log.children.length > 30) log.removeChild(log.firstChild);
}

// ============ SHOP ============
function renderShop() {
    document.getElementById('shop-coins').textContent = `🪙 ${playerData.coins.toLocaleString()}`;
    document.getElementById('shop-gems').textContent = `💎 ${playerData.gems.toLocaleString()}`;
    const grid = document.getElementById('shop-items');
    grid.innerHTML = '';
    SHOP_ITEMS.forEach(item => {
        const div = document.createElement('div');
        div.className = 'shop-item';
        div.onclick = () => buyItem(item);
        const owned = playerData.items[item.id] || 0;
        div.innerHTML = `
            <div class="shop-item-icon">${item.icon}</div>
            <div class="shop-item-name">${item.name}</div>
            <div class="shop-item-desc">${item.desc}</div>
            <div class="shop-item-cost">${item.currency === 'gems' ? '💎' : '🪙'} ${item.cost.toLocaleString()}</div>
            ${owned > 0 ? `<div style="color:#4ecdc4;font-size:0.8rem">Owned: ${owned}</div>` : ''}
        `;
        grid.appendChild(div);
    });
}

function buyItem(item) {
    const currency = item.currency === 'gems' ? 'gems' : 'coins';
    if (playerData[currency] < item.cost) { alert(`Not enough ${currency}!`); return; }
    playerData[currency] -= item.cost;
    playerData.items[item.id] = (playerData.items[item.id] || 0) + 1;
    save();
    renderShop();
}

// ============ CHESTS ============
function renderChests() {
    const container = document.getElementById('chest-slots');
    container.innerHTML = '';
    for (let i = 0; i < 5; i++) {
        const slot = document.createElement('div');
        slot.className = 'chest-slot';
        if (playerData.chests[i]) {
            const chest = playerData.chests[i];
            slot.classList.add('has-chest');
            if (chest.startTime) {
                const remaining = Math.max(0, chest.endTime - Date.now());
                if (remaining <= 0) {
                    slot.innerHTML = `<div class="chest-icon">${chest.icon}</div><div>${chest.name}</div><div style="color:#2ecc71;font-weight:700">READY!</div>`;
                    slot.onclick = () => openChest(i);
                } else {
                    slot.classList.add('opening');
                    const mins = Math.ceil(remaining / 60000);
                    slot.innerHTML = `<div class="chest-icon">${chest.icon}</div><div>${chest.name}</div><div class="chest-timer">${mins}m</div>`;
                }
            } else {
                slot.innerHTML = `<div class="chest-icon">${chest.icon}</div><div>${chest.name}</div><div style="font-size:0.8rem;color:#aaa">Tap to start</div>`;
                slot.onclick = () => startOpeningChest(i);
            }
        } else {
            slot.innerHTML = `<div style="color:#555">Empty</div>`;
        }
        container.appendChild(slot);
    }
}

function startOpeningChest(index) {
    const alreadyOpening = playerData.chests.some(c => c && c.startTime && (c.endTime - Date.now()) > 0);
    if (alreadyOpening) { alert('A chest is already opening!'); return; }
    const chest = playerData.chests[index];
    chest.startTime = Date.now();
    chest.endTime = Date.now() + chest.time * 1000;
    save();
    renderChests();
    const refreshInterval = setInterval(() => {
        if (document.getElementById('chest-screen').classList.contains('active')) renderChests();
        else clearInterval(refreshInterval);
    }, 1000);
}

function openChest(index) {
    const chest = playerData.chests[index];
    const coins = chest.coins[0] + Math.floor(Math.random() * (chest.coins[1] - chest.coins[0] + 1));
    const xp = chest.xp[0] + Math.floor(Math.random() * (chest.xp[1] - chest.xp[0] + 1));
    const gems = chest.gems;
    playerData.coins += coins; playerData.xp += xp; playerData.gems += gems;
    playerData.chests.splice(index, 1);
    save();
    const overlay = document.getElementById('chest-opening');
    overlay.classList.remove('hidden');
    overlay.innerHTML = `
        <h2 style="font-family:'Orbitron';color:#f7c948;font-size:2rem">${chest.name}</h2>
        <div style="font-size:5rem;margin:20px">${chest.icon}</div>
        <div class="chest-reward" style="animation-delay:0.2s">🪙 ${coins.toLocaleString()} Coins</div>
        <div class="chest-reward" style="animation-delay:0.4s">⭐ ${xp.toLocaleString()} XP</div>
        <div class="chest-reward" style="animation-delay:0.6s">💎 ${gems} Gems</div>
        <br><button class="btn btn-primary" onclick="document.getElementById('chest-opening').classList.add('hidden'); renderChests();">Collect!</button>
    `;
}

// ============ PROFILE ============
function renderProfile() {
    const rank = getRank(playerData.rp);
    document.getElementById('profile-content').innerHTML = `
        <h3>Fighter Stats</h3>
        <div class="stat-line">Level: ${playerData.level}</div>
        <div class="stat-line">XP: ${playerData.xp.toLocaleString()}</div>
        <div class="stat-line">Coins: ${playerData.coins.toLocaleString()}</div>
        <div class="stat-line">Gems: ${playerData.gems.toLocaleString()}</div>
        <div class="stat-line">RP: ${playerData.rp.toLocaleString()}</div>
        <div class="stat-line">Wins: ${playerData.wins} | Losses: ${playerData.losses}</div>
        <div class="rank-badge" style="background:${rank.color};color:#000">${rank.name} League</div>
        <div style="margin-top:10px;color:#aaa">Arena: ${rank.arena}</div>
        <br><button class="btn btn-danger btn-small" onclick="if(confirm('Reset all progress?')){localStorage.removeItem('fightbot_save');location.reload();}">Reset Progress</button>
    `;
}

function getRank(rp) {
    let rank = RANKS[0];
    for (const r of RANKS) { if (rp >= r.rp) rank = r; }
    return rank;
}

// ============ INIT ============
save();

// ============ GAME STATE ============
let playerData = JSON.parse(localStorage.getItem('fightbot_save')) || {
    coins: 5000, gems: 100, xp: 0, level: 1, rp: 0,
    wins: 0, losses: 0,
    chests: [], // max 5
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

function save() {
    localStorage.setItem('fightbot_save', JSON.stringify(playerData));
}

// ============ SCREENS ============
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id === 'shop-screen') renderShop();
    if (id === 'chest-screen') renderChests();
    if (id === 'profile-screen') renderProfile();
    if (id === 'title-screen') stopCombat();
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
        card.onclick = () => startBattle(cls, w);
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
    showScreen('weapon-select');
}

// ============ COMBAT ============
function createFighter(cls, weapon, isPlayer) {
    const c = CLASSES[cls];
    const w = WEAPONS[weapon];
    return {
        class: cls,
        weapon: weapon,
        weaponData: w,
        name: isPlayer ? `${c.icon} ${c.name}` : `🤖 AI ${c.name}`,
        hp: c.hp,
        maxHp: c.hp,
        energy: c.energy,
        maxEnergy: c.energy,
        shield: 0,
        shieldPercent: 0,
        x: isPlayer ? 150 : 650,
        y: 280,
        facing: isPlayer ? 1 : -1,
        effects: {},
        cooldowns: {},
        dmgBuff: 0,
        invincible: false,
        invincibleHits: 0,
        perfectCrit: false,
        energyBlocked: false,
        abilityBlocked: false,
        cantAttack: false,
        bloodthirst: false,
        isPlayer: isPlayer
    };
}

function startBattle(playerClass, playerWeapon) {
    // Pick random AI
    const classes = Object.keys(CLASSES);
    const aiClass = classes[Math.floor(Math.random() * classes.length)];
    const aiWeapons = CLASSES[aiClass].weapons;
    const aiWeapon = aiWeapons[Math.floor(Math.random() * aiWeapons.length)];

    const rank = getRank(playerData.rp);
    const arenaName = rank.arena;
    const theme = ARENA_THEMES[arenaName] || ARENA_THEMES["Trainer's Arena"];

    gameState = {
        player: createFighter(playerClass, playerWeapon, true),
        enemy: createFighter(aiClass, aiWeapon, false),
        time: 120,
        arena: arenaName,
        theme: theme,
        over: false,
        log: []
    };

    showScreen('combat-screen');
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');

    updateHUD();
    renderAbilityBar();
    renderItemBar();
    startCombatLoop();
    logMsg(`Battle started in ${arenaName}!`, 'info');
    logMsg(`You: ${CLASSES[playerClass].name} (${WEAPONS[playerWeapon].name}) vs AI: ${CLASSES[aiClass].name} (${WEAPONS[aiWeapon].name})`, 'info');
}

function startCombatLoop() {
    // Energy regen: 5 energy/s
    energyInterval = setInterval(() => {
        if (gameState.over) return;
        const p = gameState.player;
        const e = gameState.enemy;
        if (!p.energyBlocked) p.energy = Math.min(p.maxEnergy, p.energy + 5);
        if (!e.energyBlocked) e.energy = Math.min(e.maxEnergy, e.energy + 5);
        updateHUD();
    }, 1000);

    // Timer
    timerInterval = setInterval(() => {
        if (gameState.over) return;
        gameState.time--;
        document.getElementById('battle-timer').textContent =
            `${Math.floor(gameState.time / 60)}:${(gameState.time % 60).toString().padStart(2, '0')}`;
        if (gameState.time <= 0) endBattle(gameState.player.hp > gameState.enemy.hp);
    }, 1000);

    // Status effects tick
    effectsInterval = setInterval(() => {
        if (gameState.over) return;
        tickEffects(gameState.player);
        tickEffects(gameState.enemy);
        updateHUD();
    }, 1000);

    // AI
    aiInterval = setInterval(() => {
        if (gameState.over) return;
        aiTurn();
    }, 1500 + Math.random() * 2000);

    // Render loop
    combatInterval = setInterval(() => {
        if (gameState) renderArena();
    }, 1000 / 30);
}

function stopCombat() {
    clearInterval(combatInterval);
    clearInterval(energyInterval);
    clearInterval(timerInterval);
    clearInterval(aiInterval);
    clearInterval(effectsInterval);
    combatInterval = energyInterval = timerInterval = aiInterval = effectsInterval = null;
}

// ============ STATUS EFFECTS ============
function applyEffect(target, type, duration) {
    const def = STATUS_EFFECTS[type];
    if (!def) return;
    const dur = duration || def.defaultDuration || 10;
    target.effects[type] = { remaining: dur, def: def };

    if (def.blockAttack) target.cantAttack = true;
    if (def.blockMove) { /* movement blocked */ }

    const who = target.isPlayer ? 'You' : 'Enemy';
    logMsg(`${who} affected by ${def.name} for ${dur}s!`, 'effect');
}

function tickEffects(fighter) {
    for (const [type, eff] of Object.entries(fighter.effects)) {
        eff.remaining--;
        // DOT
        if (eff.def.dot && eff.remaining % eff.def.dotInterval === 0) {
            dealDamage(fighter, eff.def.dot, false, `${eff.def.name}`);
        }
        // HOT
        if (eff.def.hot && eff.remaining % eff.def.hotInterval === 0) {
            fighter.hp = Math.min(fighter.maxHp, fighter.hp + eff.def.hot);
            showDamageNumber(fighter, eff.def.hot, 'heal');
        }
        if (eff.remaining <= 0) {
            delete fighter.effects[type];
            if (type === 'stun' || type === 'freeze' || type === 'earth') {
                fighter.cantAttack = false;
            }
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
        logMsg(`Attack blocked! ${target.invincibleHits} blocks left.`, 'info');
        return 0;
    }

    let dmg = amount;

    // Shield percent reduction
    if (target.shieldPercent > 0) {
        dmg = Math.floor(dmg * (1 - target.shieldPercent / 100));
    }

    // Flat shield
    if (target.shield > 0) {
        const absorbed = Math.min(target.shield, dmg);
        target.shield -= absorbed;
        dmg -= absorbed;
        if (absorbed > 0) showDamageNumber(target, absorbed, 'shield');
    }

    if (dmg > 0) {
        target.hp = Math.max(0, target.hp - dmg);
        showDamageNumber(target, dmg, isCrit ? 'crit' : 'normal');
    }

    const who = target.isPlayer ? 'You took' : 'Enemy took';
    logMsg(`${who} ${amount} dmg${isCrit ? ' (CRIT!)' : ''} from ${source || 'attack'}`, 'damage');

    updateHUD();

    if (target.hp <= 0) {
        endBattle(!target.isPlayer);
    }

    return dmg;
}

function showDamageNumber(fighter, amount, type) {
    const container = document.getElementById('damage-numbers');
    const el = document.createElement('div');
    el.className = `damage-number dmg-${type}`;
    const xOff = fighter.x + (Math.random() - 0.5) * 40;
    el.style.left = `${xOff}px`;
    el.style.top = `${fighter.y - 40}px`;
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
        logMsg(`${attacker.isPlayer ? 'You' : 'Enemy'} can't attack!`, 'info');
        return;
    }

    // Check confusion - 50% hit self
    if (hasEffect(attacker, 'confusion') && Math.random() < 0.5) {
        const selfDmg = ability.damage || 10;
        dealDamage(attacker, selfDmg, false, 'confusion self-hit');
        logMsg(`${attacker.isPlayer ? 'You' : 'Enemy'} hit themselves in confusion!`, 'effect');
        return;
    }

    // Check blinding - 50% miss
    if (hasEffect(attacker, 'blinding') && Math.random() < 0.5) {
        logMsg(`${attacker.isPlayer ? 'Your' : "Enemy's"} attack missed (blinded)!`, 'info');
        return;
    }

    let dmg = ability.damage || 0;

    // Damage buff
    if (attacker.dmgBuff > 0) {
        dmg = Math.floor(dmg * (1 + attacker.dmgBuff / 100));
    }

    // Bloodthirst heal
    if (attacker.bloodthirst && dmg > 0) {
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + 10);
        showDamageNumber(attacker, 10, 'heal');
    }

    // Critical hit: 25% chance for +100 dmg
    let isCrit = false;
    if (attacker.perfectCrit || Math.random() < 0.25) {
        if (dmg > 0) {
            dmg += 100;
            isCrit = true;
        }
    }

    // Multi-hit abilities
    if (ability.hits && ability.hitDmg) {
        for (let i = 0; i < ability.hits; i++) {
            let hitDmg = ability.hitDmg;
            if (attacker.dmgBuff > 0) hitDmg = Math.floor(hitDmg * (1 + attacker.dmgBuff / 100));
            let hitCrit = false;
            if (attacker.perfectCrit || Math.random() < 0.25) {
                hitDmg += 100;
                hitCrit = true;
            }
            setTimeout(() => dealDamage(defender, hitDmg, hitCrit, ability.name), i * 200);
        }
    } else if (dmg > 0) {
        dealDamage(defender, dmg, isCrit, ability.name);
    }

    // Apply effects on target
    if (ability.effects) {
        ability.effects.forEach(eff => applyEffect(defender, eff.type, eff.duration));
    }

    // Apply effects on self
    if (ability.selfEffects) {
        ability.selfEffects.forEach(eff => applyEffect(attacker, eff.type, eff.duration));
    }

    // Special abilities
    handleSpecial(attacker, defender, ability);
}

function handleSpecial(attacker, defender, ability) {
    if (!ability.special) return;

    switch (ability.special) {
        case 'shield':
            attacker.shield += ability.shieldAmount || 0;
            logMsg(`${attacker.isPlayer ? 'You' : 'Enemy'} gained ${ability.shieldAmount} shield!`, 'info');
            break;
        case 'firewall':
            attacker.shieldPercent = ability.shieldPercent;
            setTimeout(() => { attacker.shieldPercent = 0; }, (ability.duration || 20) * 1000);
            logMsg(`${attacker.isPlayer ? 'You' : 'Enemy'} created a fire wall!`, 'info');
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
            logMsg('Blizzard! Enemy energy blocked!', 'effect');
            break;
        case 'mountain':
            attacker.dmgBuff += 30;
            attacker.shieldPercent = 50;
            setTimeout(() => { attacker.dmgBuff -= 30; attacker.shieldPercent = 0; }, (ability.duration || 25) * 1000);
            break;
        case 'bloodthirst':
            attacker.dmgBuff += 25;
            attacker.bloodthirst = true;
            setTimeout(() => {
                attacker.dmgBuff -= 25;
                attacker.bloodthirst = false;
                applyEffect(attacker, 'confusion', 15);
            }, (ability.duration || 15) * 1000);
            break;
        case 'teleport':
            attacker.x += attacker.facing * 120;
            attacker.x = Math.max(30, Math.min(770, attacker.x));
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
            attacker.invincible = true;
            attacker.cantAttack = true;
            applyEffect(attacker, 'healing', ability.duration || 10);
            setTimeout(() => {
                attacker.invincible = false;
                attacker.cantAttack = false;
                applyEffect(attacker, 'stun', 30);
            }, (ability.duration || 10) * 1000);
            break;
        case 'minishield':
            attacker.shieldPercent = ability.shieldPercent || 5;
            setTimeout(() => { attacker.shieldPercent = 0; }, (ability.duration || 2) * 1000);
            break;
        case 'valkyrie':
            attacker.y = 200;
            setTimeout(() => { attacker.y = 280; }, (ability.duration || 10) * 1000);
            break;
        case 'healer_super':
            if (attacker.hp < attacker.maxHp) {
                attacker.hp = attacker.maxHp;
                showDamageNumber(attacker, attacker.maxHp, 'heal');
            } else {
                attacker.shield += 150;
            }
            applyEffect(defender, 'blinding', 25);
            break;
    }
}

// ============ PLAYER ABILITIES ============
function useAbility(index) {
    if (!gameState || gameState.over) return;
    const p = gameState.player;
    const e = gameState.enemy;

    if (p.cantAttack) {
        logMsg("You can't attack right now!", 'info');
        return;
    }

    if (index === 0) {
        // Base ability - no cost, no cooldown
        performAttack(p, e, p.weaponData.baseAbility);
        return;
    }

    if (index === 4) {
        // Super
        const superAbility = SUPERS[p.class];
        if (p.cooldowns['super'] > 0) {
            logMsg(`Super on cooldown! ${p.cooldowns['super']}s`, 'info');
            return;
        }
        if (p.energy < superAbility.energy) {
            logMsg(`Not enough energy! Need ${superAbility.energy}`, 'info');
            return;
        }
        if (p.abilityBlocked) {
            logMsg('Abilities blocked!', 'info');
            return;
        }
        p.energy -= superAbility.energy;
        p.cooldowns['super'] = superAbility.cooldown;
        startCooldown(p, 'super', superAbility.cooldown);

        if (superAbility.damage > 0) {
            dealDamage(e, superAbility.damage, false, superAbility.name);
        }
        if (superAbility.effects) {
            superAbility.effects.forEach(eff => applyEffect(e, eff.type, eff.duration));
        }
        if (superAbility.shieldAmount) {
            p.shield += superAbility.shieldAmount;
        }
        if (superAbility.special) {
            handleSpecial(p, e, superAbility);
        }
        // Assassin super buff
        if (p.class === 'assassin') {
            p.dmgBuff += 20;
            setTimeout(() => { p.dmgBuff -= 20; }, 15000);
        }
        logMsg(`SUPER: ${superAbility.name}!`, 'info');
        updateAbilityBar();
        return;
    }

    const abilityIdx = index - 1;
    const ability = p.weaponData.abilities[abilityIdx];
    if (!ability) return;

    const cdKey = `ability_${abilityIdx}`;
    if (p.cooldowns[cdKey] > 0) {
        logMsg(`${ability.name} on cooldown! ${p.cooldowns[cdKey]}s`, 'info');
        return;
    }
    if (p.energy < ability.energy) {
        logMsg(`Not enough energy! Need ${ability.energy}`, 'info');
        return;
    }
    if (p.abilityBlocked) {
        logMsg('Abilities blocked!', 'info');
        return;
    }

    p.energy -= ability.energy;
    p.cooldowns[cdKey] = ability.cooldown;
    startCooldown(p, cdKey, ability.cooldown);

    performAttack(p, e, ability);
    logMsg(`Used ${ability.name}!`, 'info');
    updateAbilityBar();
}

function startCooldown(fighter, key, duration) {
    const interval = setInterval(() => {
        if (!gameState || gameState.over) { clearInterval(interval); return; }
        fighter.cooldowns[key]--;
        if (fighter.cooldowns[key] <= 0) {
            fighter.cooldowns[key] = 0;
            clearInterval(interval);
        }
        if (fighter.isPlayer) updateAbilityBar();
    }, 1000);
}

// ============ AI ============
function aiTurn() {
    if (!gameState || gameState.over) return;
    const ai = gameState.enemy;
    const player = gameState.player;
    if (ai.cantAttack) return;

    // Try to use abilities
    const availableAbilities = [];
    ai.weaponData.abilities.forEach((a, i) => {
        const cdKey = `ability_${i}`;
        if ((!ai.cooldowns[cdKey] || ai.cooldowns[cdKey] <= 0) && ai.energy >= a.energy && !ai.abilityBlocked) {
            availableAbilities.push({ ability: a, index: i });
        }
    });

    // Try super
    const superAbility = SUPERS[ai.class];
    if ((!ai.cooldowns['super'] || ai.cooldowns['super'] <= 0) && ai.energy >= superAbility.energy && !ai.abilityBlocked) {
        availableAbilities.push({ ability: superAbility, index: 'super' });
    }

    // 40% chance to use ability if available, otherwise base attack
    if (availableAbilities.length > 0 && Math.random() < 0.4) {
        const chosen = availableAbilities[Math.floor(Math.random() * availableAbilities.length)];
        ai.energy -= chosen.ability.energy;

        if (chosen.index === 'super') {
            ai.cooldowns['super'] = chosen.ability.cooldown;
            startCooldown(ai, 'super', chosen.ability.cooldown);
            if (chosen.ability.damage > 0) dealDamage(player, chosen.ability.damage, false, chosen.ability.name);
            if (chosen.ability.effects) chosen.ability.effects.forEach(eff => applyEffect(player, eff.type, eff.duration));
            if (chosen.ability.shieldAmount) ai.shield += chosen.ability.shieldAmount;
            if (chosen.ability.special) handleSpecial(ai, player, chosen.ability);
            if (ai.class === 'assassin') {
                ai.dmgBuff += 20;
                setTimeout(() => { ai.dmgBuff -= 20; }, 15000);
            }
            logMsg(`AI SUPER: ${chosen.ability.name}!`, 'info');
        } else {
            const cdKey = `ability_${chosen.index}`;
            ai.cooldowns[cdKey] = chosen.ability.cooldown;
            startCooldown(ai, cdKey, chosen.ability.cooldown);
            performAttack(ai, player, chosen.ability);
            logMsg(`AI used ${chosen.ability.name}!`, 'info');
        }
    } else {
        performAttack(ai, player, ai.weaponData.baseAbility);
    }

    // AI movement
    const dx = player.x - ai.x;
    ai.x += Math.sign(dx) * (10 + Math.random() * 15);
    ai.x = Math.max(30, Math.min(770, ai.x));

    updateHUD();
}

// ============ ITEMS IN COMBAT ============
function useItem(itemId) {
    if (!gameState || gameState.over) return;
    if (!playerData.items[itemId] || playerData.items[itemId] <= 0) return;

    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return;

    playerData.items[itemId]--;
    save();

    const p = gameState.player;
    const e = gameState.enemy;

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
            break;
        case 'status':
            applyEffect(e, item.status, item.duration);
            break;
        case 'multiStatus':
            if (item.durations) {
                item.statuses.forEach((s, i) => applyEffect(e, s, item.durations[i]));
            } else {
                item.statuses.forEach(s => applyEffect(e, s, item.duration));
            }
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
            dealDamage(e, 70, false, 'Lightning Rod');
            applyEffect(e, 'blinding', 30);
            applyEffect(e, 'burning', 20);
            break;
    }

    logMsg(`Used item: ${item.name}!`, 'info');
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

    if (playerWon) {
        const coins = 30 + Math.floor(Math.random() * 71);
        const rpGain = 20 + Math.floor(Math.random() * 11);
        playerData.coins += coins;
        playerData.xp += 30;
        playerData.rp += rpGain;
        playerData.wins++;

        // Chest drop
        let chestDrop = null;
        if (playerData.chests.length < 5) {
            chestDrop = rollChest();
            playerData.chests.push({ ...chestDrop, startTime: null, endTime: null });
        }

        html = `
            <h2 class="win-text">🏆 VICTORY!</h2>
            <div class="reward-line">🪙 +${coins} Coins</div>
            <div class="reward-line">⭐ +30 XP</div>
            <div class="reward-line">🏅 +${rpGain} RP</div>
            ${chestDrop ? `<div class="reward-line">📦 ${chestDrop.name}!</div>` : ''}
        `;
    } else {
        const rpLoss = 5 + Math.floor(Math.random() * 5);
        playerData.rp = Math.max(0, playerData.rp - rpLoss);
        playerData.xp += 10;
        playerData.losses++;

        html = `
            <h2 class="lose-text">💀 DEFEAT</h2>
            <div class="reward-line">⭐ +10 XP</div>
            <div class="reward-line">🏅 -${rpLoss} RP</div>
        `;
    }

    // Level up check
    const newLevel = Math.floor(playerData.xp / 100) + 1;
    if (newLevel > playerData.level) {
        playerData.level = newLevel;
        html += `<div class="reward-line" style="color:#f7c948">🎉 LEVEL UP! Level ${newLevel}!</div>`;
    }

    html += `<br><button class="btn btn-primary" onclick="showScreen('title-screen')">Continue</button>`;
    panel.innerHTML = html;
    save();
    showScreen('results-screen');
}

function rollChest() {
    const roll = Math.random() * 100;
    let cumulative = 0;
    for (const chest of CHEST_TABLE) {
        cumulative += chest.chance;
        if (roll < cumulative) return { ...chest };
    }
    return { ...CHEST_TABLE[0] };
}

// ============ HUD ============
function updateHUD() {
    if (!gameState) return;
    const p = gameState.player;
    const e = gameState.enemy;

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

    // Shield display
    document.getElementById('player-shield-display').textContent =
        (p.shield > 0 ? `🛡️${p.shield}` : '') + (p.shieldPercent > 0 ? ` (${p.shieldPercent}% reduction)` : '') + (p.invincible ? ' ✨INVINCIBLE' : '') + (p.invincibleHits > 0 ? ` 🛏️${p.invincibleHits} blocks` : '');
    document.getElementById('enemy-shield-display').textContent =
        (e.shield > 0 ? `🛡️${e.shield}` : '') + (e.shieldPercent > 0 ? ` (${e.shieldPercent}% reduction)` : '') + (e.invincible ? ' ✨INVINCIBLE' : '');

    // Status effects
    renderEffects('player-effects', p);
    renderEffects('enemy-effects', e);
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
    const bar = document.getElementById('ability-bar');
    const p = gameState.player;
    const abilities = [p.weaponData.baseAbility, ...p.weaponData.abilities, SUPERS[p.class]];
    const keys = ['Q', 'W', 'E', 'R', 'T'];

    bar.innerHTML = '';
    abilities.forEach((a, i) => {
        const btn = document.createElement('div');
        btn.className = 'ability-btn';
        const cdKey = i === 0 ? null : i === 4 ? 'super' : `ability_${i - 1}`;
        const cd = cdKey ? (p.cooldowns[cdKey] || 0) : 0;
        const cost = i === 0 ? 0 : (a.energy || 0);

        if (cd > 0) btn.classList.add('on-cooldown');
        if (cost > p.energy && i > 0) btn.classList.add('disabled');

        btn.onclick = () => useAbility(i);
        btn.innerHTML = `
            <span class="ability-key">${keys[i]}</span>
            <span class="ability-icon">${a.icon || '⚡'}</span>
            <span class="ability-name">${a.name}</span>
            ${cost > 0 ? `<span class="ability-cost">⚡${cost}</span>` : ''}
            ${cd > 0 ? `<div class="cooldown-overlay">${cd}s</div>` : ''}
        `;
        bar.appendChild(btn);
    });
}

function updateAbilityBar() {
    if (gameState && !gameState.over) renderAbilityBar();
}

// ============ ITEM BAR ============
function renderItemBar() {
    const bar = document.getElementById('item-bar');
    bar.innerHTML = '';
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
    const p = gameState.player;
    const e = gameState.enemy;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 400);
    grad.addColorStop(0, t.bg1);
    grad.addColorStop(1, t.bg2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 400);

    // Ground
    ctx.fillStyle = t.ground;
    ctx.fillRect(0, 320, 800, 80);

    // Ground line
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 320);
    ctx.lineTo(800, 320);
    ctx.stroke();

    // Arena decorations
    drawArenaDecor(t);

    // Draw fighters
    drawFighter(p, '#4ecdc4', CLASSES[p.class].icon);
    drawFighter(e, '#e74c3c', CLASSES[e.class].icon);
}

function drawFighter(fighter, color, icon) {
    const x = fighter.x;
    const y = fighter.y;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, 318, 25, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;

    // Head
    ctx.beginPath();
    ctx.arc(x, y - 35, 15, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.beginPath();
    ctx.moveTo(x, y - 20);
    ctx.lineTo(x, y + 10);
    ctx.stroke();

    // Arms
    ctx.beginPath();
    ctx.moveTo(x - 20, y - 10);
    ctx.lineTo(x, y - 15);
    ctx.lineTo(x + 20, y - 10);
    ctx.stroke();

    // Legs
    ctx.beginPath();
    ctx.moveTo(x, y + 10);
    ctx.lineTo(x - 15, y + 35);
    ctx.moveTo(x, y + 10);
    ctx.lineTo(x + 15, y + 35);
    ctx.stroke();

    // Icon above head
    ctx.font = '20px serif';
    ctx.textAlign = 'center';
    ctx.fillText(icon, x, y - 55);

    // HP bar above fighter
    const barW = 50;
    const hpPct = fighter.hp / fighter.maxHp;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - barW / 2, y - 75, barW, 6);
    ctx.fillStyle = hpPct > 0.5 ? '#2ecc71' : hpPct > 0.25 ? '#f39c12' : '#e74c3c';
    ctx.fillRect(x - barW / 2, y - 75, barW * hpPct, 6);

    // Invincible glow
    if (fighter.invincible) {
        ctx.strokeStyle = '#f7c948';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y - 10, 40, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Shield visual
    if (fighter.shield > 0 || fighter.shieldPercent > 0) {
        ctx.strokeStyle = 'rgba(52, 152, 219, 0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y - 10, 35, 0, Math.PI * 2);
        ctx.stroke();
    }
}

function drawArenaDecor(theme) {
    // Simple arena-specific decoration
    ctx.fillStyle = theme.accent + '33';
    for (let i = 0; i < 5; i++) {
        const ax = 100 + i * 160;
        ctx.fillRect(ax, 330, 20, 60);
    }
}

// ============ KEYBOARD CONTROLS ============
document.addEventListener('keydown', (e) => {
    if (!gameState || gameState.over) return;

    const keyMap = { 'q': 0, 'w': 1, 'e': 2, 'r': 3, 't': 4 };
    const key = e.key.toLowerCase();

    if (keyMap[key] !== undefined) {
        useAbility(keyMap[key]);
    }

    // Movement
    const p = gameState.player;
    if (hasEffect(p, 'stun') || hasEffect(p, 'freeze') || hasEffect(p, 'earth')) return;

    if (key === 'a' || key === 'arrowleft') {
        p.x = Math.max(30, p.x - 20);
        p.facing = -1;
    }
    if (key === 'd' || key === 'arrowright') {
        p.x = Math.min(770, p.x + 20);
        p.facing = 1;
    }
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

    // Keep log short
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
    if (playerData[currency] < item.cost) {
        alert(`Not enough ${currency}! Need ${item.cost.toLocaleString()}`);
        return;
    }
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
                    slot.innerHTML = `
                        <div class="chest-icon">${chest.icon}</div>
                        <div>${chest.name}</div>
                        <div style="color:#2ecc71;font-weight:700">READY!</div>
                    `;
                    slot.onclick = () => openChest(i);
                } else {
                    slot.classList.add('opening');
                    const mins = Math.ceil(remaining / 60000);
                    slot.innerHTML = `
                        <div class="chest-icon">${chest.icon}</div>
                        <div>${chest.name}</div>
                        <div class="chest-timer">${mins}m left</div>
                    `;
                    slot.onclick = () => {};
                }
            } else {
                slot.innerHTML = `
                    <div class="chest-icon">${chest.icon}</div>
                    <div>${chest.name}</div>
                    <div style="font-size:0.8rem;color:#aaa">Tap to start</div>
                `;
                slot.onclick = () => startOpeningChest(i);
            }
        } else {
            slot.innerHTML = `<div style="color:#555">Empty Slot</div>`;
        }
        container.appendChild(slot);
    }
}

function startOpeningChest(index) {
    // Check if another chest is already opening
    const alreadyOpening = playerData.chests.some(c => c && c.startTime && (c.endTime - Date.now()) > 0);
    if (alreadyOpening) {
        alert('A chest is already being opened! Wait for it to finish.');
        return;
    }

    const chest = playerData.chests[index];
    chest.startTime = Date.now();
    chest.endTime = Date.now() + chest.time * 1000;
    save();
    renderChests();

    // Auto-refresh
    const refreshInterval = setInterval(() => {
        if (document.getElementById('chest-screen').classList.contains('active')) {
            renderChests();
        } else {
            clearInterval(refreshInterval);
        }
    }, 1000);
}

function openChest(index) {
    const chest = playerData.chests[index];
    const coins = chest.coins[0] + Math.floor(Math.random() * (chest.coins[1] - chest.coins[0] + 1));
    const xp = chest.xp[0] + Math.floor(Math.random() * (chest.xp[1] - chest.xp[0] + 1));
    const gems = chest.gems;

    playerData.coins += coins;
    playerData.xp += xp;
    playerData.gems += gems;
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
        <br>
        <button class="btn btn-primary" onclick="document.getElementById('chest-opening').classList.add('hidden'); renderChests();">Collect!</button>
    `;
}

// ============ PROFILE ============
function renderProfile() {
    const rank = getRank(playerData.rp);
    const panel = document.getElementById('profile-content');
    panel.innerHTML = `
        <h3>⚔️ Fighter Stats</h3>
        <div class="stat-line">📊 Level: ${playerData.level}</div>
        <div class="stat-line">⭐ XP: ${playerData.xp.toLocaleString()}</div>
        <div class="stat-line">🪙 Coins: ${playerData.coins.toLocaleString()}</div>
        <div class="stat-line">💎 Gems: ${playerData.gems.toLocaleString()}</div>
        <div class="stat-line">🏅 Ranking Points: ${playerData.rp.toLocaleString()}</div>
        <div class="stat-line">🏆 Wins: ${playerData.wins}</div>
        <div class="stat-line">💀 Losses: ${playerData.losses}</div>
        <div class="rank-badge" style="background:${rank.color};color:#000">
            ${rank.name} League
        </div>
        <div style="margin-top:10px;color:#aaa">Arena: ${rank.arena}</div>
        <br>
        <button class="btn btn-danger btn-small" onclick="if(confirm('Reset all progress?')){localStorage.removeItem('fightbot_save');location.reload();}">Reset Progress</button>
    `;
}

function getRank(rp) {
    let rank = RANKS[0];
    for (const r of RANKS) {
        if (rp >= r.rp) rank = r;
    }
    return rank;
}

// ============ INIT ============
save();

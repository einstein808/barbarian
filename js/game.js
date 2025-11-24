const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;

PIXI.settings.ALPHA_MODE = PIXI.ALPHA_MODES.UNPACK;

const app = new PIXI.Application({
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: 0x000000,
});
document.body.appendChild(app.view);

const bgSound = new Audio("audio/background.mp3");
bgSound.loop = true;
bgSound.volume = 0.4;

const hitSound = new Audio("audio/hit.mp3");
hitSound.volume = 0.8;

const deathSound = new Audio("audio/death.mp3");
deathSound.volume = 0.8;

function setAllVolumes(vol) {
    bgSound.volume = vol;
    hitSound.volume = vol;
    deathSound.volume = vol;
}

function tryPlayBackground() {
    bgSound.play().catch(() => {
        window.addEventListener("click", () => {
            bgSound.play();
        }, { once: true });
    });
}

const STATE = {
    MENU: "menu",
    VOLUME: "volume",
    PLAYING: "playing",
    GAMEOVER: "gameover",
};
let currentState = STATE.MENU;

let player, enemies = [], obstacles = [], projectiles = [];
let kills = 0, difficulty = 0, spawnDelay = 100, nextSpawn = 0;
let elapsedTime = 0, score = 0;
let camX = 0, camY = 0;

// --- New gameplay systems: powerups and levels ---
let powerups = [];
let currentLevel = 1;
const MAX_LEVEL = 13;

// projectile firing control (so powerups can change rate)
let projectileRate = 300; // ms
let projectileTimer = null;
// projectiles enabled toggle — set to false to remove flying arrows
let projectilesEnabled = false;
let powerupTimer = null;

// powerup effect state
const activePowerups = {
    speed: { active: false, expiresAt: 0, factor: 1.6 },
    rapid: { active: false, expiresAt: 0, factor: 0.5 },
    damage: { active: false, expiresAt: 0, extra: 5 },
    shield: { active: false, expiresAt: 0 },
};

function killsToLevel(k) {
    // progressive threshold: higher levels need more kills
    // e.g., level 1 starts at 0, level 2 at 8, level 3 at 18, ... cumulative
    let threshold = 0;
    for (let L = 1; L < MAX_LEVEL; L++) {
        threshold += L * 6; // increasing cost
        if (k < threshold) return L;
    }
    return MAX_LEVEL;
}

function updateLevelByKills() {
    const newLevel = Math.min(MAX_LEVEL, killsToLevel(kills));
    if (newLevel > currentLevel) {
        currentLevel = newLevel;
        difficulty = Math.floor(kills / 15); // keep difficulty in sync
        spawnDelay = Math.max(10, 100 - difficulty * 6 - currentLevel);
        // show a small visual feedback (console for now)
        console.log(`LEVEL UP! Agora: ${currentLevel}`);
        if (typeof levelText !== 'undefined') levelText.text = `Nível: ${currentLevel}`;
    }
}

const menuContainer = new PIXI.Container();
const volumeContainer = new PIXI.Container();
const gameContainer = new PIXI.Container();
const hudContainer = new PIXI.Container();
const gameOverContainer = new PIXI.Container();

app.stage.addChild(menuContainer);
app.stage.addChild(volumeContainer);
app.stage.addChild(gameContainer);
app.stage.addChild(hudContainer);
app.stage.addChild(gameOverContainer);

menuContainer.visible = true;
volumeContainer.visible = false;
gameContainer.visible = false;
hudContainer.visible = false;
gameOverContainer.visible = false;

const style = new PIXI.TextStyle({
    fill: "#ffffff",
    fontSize: 24,
    fontWeight: "bold",
    stroke: '#000000',
    strokeThickness: 3,
});

const menuTitle = new PIXI.Text("🧛 Vampire Survivors PIXI 🧛", {
    fill: "#ff4444",
    fontSize: 48,
    fontWeight: "bold",
    stroke: '#000000',
    strokeThickness: 5,
});
menuTitle.anchor.set(0.5);
menuTitle.x = GAME_WIDTH / 2;
menuTitle.y = GAME_HEIGHT / 3;
menuContainer.addChild(menuTitle);

function createButton(text, y, onClick) {
    const btn = new PIXI.Container();
    const bg = new PIXI.Graphics();
    bg.beginFill(0x880000);
    bg.drawRoundedRect(0, 0, 300, 60, 15);
    bg.endFill();

    const label = new PIXI.Text(text, {
        fill: "#fff",
        fontSize: 28,
        fontWeight: "bold",
    });
    label.anchor.set(0.5);
    label.x = 150;
    label.y = 30;

    btn.addChild(bg);
    btn.addChild(label);

    btn.x = (GAME_WIDTH - 300) / 2;
    btn.y = y;

    btn.interactive = true;
    btn.buttonMode = true;
    btn.on('pointerdown', onClick);

    return btn;
}

const playBtn = createButton("▶ Jogar", GAME_HEIGHT / 2, () => {
    if (!assetsLoaded) {
        // assets still loading
        menuTitle.text = "Carregando assets... aguarde";
        return;
    }

    resetGame();
    switchToState(STATE.PLAYING);
    // request fullscreen on user gesture (click)
    try {
        if (document.fullscreenEnabled) {
            if (app.view.requestFullscreen) app.view.requestFullscreen();
            else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
        }
    } catch (e) { }
});
menuContainer.addChild(playBtn);
// disable until assets loaded
playBtn.interactive = false;
playBtn.buttonMode = false;

const volumeBtn = createButton("🔊 Volumes", GAME_HEIGHT / 2 + 80, () => {
    switchToState(STATE.VOLUME);
});
menuContainer.addChild(volumeBtn);


const volumeTitle = new PIXI.Text("Controle de Volume", {
    fill: "#44aa44",
    fontSize: 40,
    fontWeight: "bold",
    stroke: '#000000',
    strokeThickness: 4,
});
volumeTitle.anchor.set(0.5);
volumeTitle.x = GAME_WIDTH / 2;
volumeTitle.y = 100;
volumeContainer.addChild(volumeTitle);

const volumeDisplay = new PIXI.Text("", style);
volumeDisplay.anchor.set(0.5);
volumeDisplay.x = GAME_WIDTH / 2;
volumeDisplay.y = 180;
volumeContainer.addChild(volumeDisplay);

let volumeLevel = 0.4;

function updateVolumeText() {
    volumeDisplay.text = `Volume: ${Math.round(volumeLevel * 100)}%`;
}
updateVolumeText();

const volDownBtn = createButton("🔉 Diminuir", GAME_HEIGHT / 2 - 30, () => {
    volumeLevel = Math.max(0, volumeLevel - 0.1);
    setAllVolumes(volumeLevel);
    updateVolumeText();
});
volumeContainer.addChild(volDownBtn);

const volUpBtn = createButton("🔊 Aumentar", GAME_HEIGHT / 2 + 50, () => {
    volumeLevel = Math.min(1, volumeLevel + 0.1);
    setAllVolumes(volumeLevel);
    updateVolumeText();
});
volumeContainer.addChild(volUpBtn);

const volBackBtn = createButton("⬅ Voltar", GAME_HEIGHT / 2 + 130, () => {
    switchToState(STATE.MENU);
});
volumeContainer.addChild(volBackBtn);


const hpText = new PIXI.Text("HP: 100", style);
hpText.position.set(20, 20);
hudContainer.addChild(hpText);

const timeText = new PIXI.Text("Tempo: 0s", style);
timeText.position.set(GAME_WIDTH / 2 - 50, 20);
hudContainer.addChild(timeText);

const scoreText = new PIXI.Text("Score: 0", style);
scoreText.position.set(GAME_WIDTH - 180, 20);
hudContainer.addChild(scoreText);

const levelText = new PIXI.Text("Nível: 1", style);
levelText.position.set(GAME_WIDTH/2 + 120, 20);
hudContainer.addChild(levelText);

const powerupText = new PIXI.Text("", style);
powerupText.position.set(GAME_WIDTH/2 - 220, 20);
hudContainer.addChild(powerupText);


const gameOverBg = new PIXI.Graphics();
gameOverBg.beginFill(0x550000, 0.85);
gameOverBg.drawRoundedRect(0, 0, GAME_WIDTH, GAME_HEIGHT, 20);
gameOverBg.endFill();
gameOverContainer.addChild(gameOverBg);

const gameOverText = new PIXI.Text("💀 GAME OVER 💀", {
    fill: "#ff5555",
    fontSize: 72,
    fontWeight: "bold",
    stroke: "#000000",
    strokeThickness: 8,
});
gameOverText.anchor.set(0.5);
gameOverText.x = GAME_WIDTH / 2;
gameOverText.y = GAME_HEIGHT / 3;
gameOverContainer.addChild(gameOverText);

const finalScoreText = new PIXI.Text("", {
    fill: "#ffffff",
    fontSize: 32,
    fontWeight: "bold",
    stroke: "#000000",
    strokeThickness: 5,
});
finalScoreText.anchor.set(0.5);
finalScoreText.x = GAME_WIDTH / 2;
finalScoreText.y = GAME_HEIGHT / 2.2;
gameOverContainer.addChild(finalScoreText);

const replayBtn = createButton("🔄 Jogar Novamente", GAME_HEIGHT / 2 + 100, () => {
    resetGame();
    switchToState(STATE.PLAYING);
    try {
        if (document.fullscreenEnabled) {
            if (app.view.requestFullscreen) app.view.requestFullscreen();
            else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
        }
    } catch (e) { }
});
gameOverContainer.addChild(replayBtn);


// Build load list including elf frames (7 actions x 10 frames)
const baseAssets = [
    "sprites/background.png",
    "sprites/inimigos.png",
    "sprites/obstaculo.png",
    "sprites/projetil.png",
    "sprites/protag.png",
    "sprites/powerups.png",
];

// list elf frames programmatically
const elfActions = ['ATTACK','DIE','HURT','IDLE','JUMP','RUN','WALK'];
for (const a of elfActions) {
    for (let i = 0; i < 10; i++) {
        const f = String(i).padStart(3,'0');
        baseAssets.push(`sprites/elf/Elf_01__${a}_${f}.png`);
    }
}

PIXI.Assets.load(baseAssets).then(initGame);

let assetsLoaded = false;

let gameData = null;


function switchToState(newState) {
    currentState = newState;

    menuContainer.visible = false;
    volumeContainer.visible = false;
    gameContainer.visible = false;
    hudContainer.visible = false;
    gameOverContainer.visible = false;

    if (newState === STATE.MENU) {
        menuContainer.visible = true;
        stopGameSounds();
    } else if (newState === STATE.VOLUME) {
        volumeContainer.visible = true;
    } else if (newState === STATE.PLAYING) {
        gameContainer.visible = true;
        hudContainer.visible = true;
        tryPlayBackground();
    } else if (newState === STATE.GAMEOVER) {
        gameOverContainer.visible = true;
        finalScoreText.text = `Sua pontuação final foi:\n${Math.floor(score)}`;
        stopGameSounds();
        deathSound.currentTime = 0;
        deathSound.play();
    }
}

function stopGameSounds() {
    bgSound.pause();
    bgSound.currentTime = 0;
    hitSound.pause();
    hitSound.currentTime = 0;
    deathSound.pause();
    deathSound.currentTime = 0;
}

function initGame() {
    const texBackground = PIXI.Texture.from("sprites/background.png");
    const bg = new PIXI.TilingSprite(texBackground, GAME_WIDTH, GAME_HEIGHT);
    bg.scale.set(1.0);
    gameContainer.addChild(bg);

    // Create animated player (elf) using the preloaded frames
    const playerAnims = {};
    for (const act of elfActions) {
        const arr = [];
        for (let i = 0; i < 10; i++) {
            const f = String(i).padStart(3, '0');
            arr.push(PIXI.Texture.from(`sprites/elf/Elf_01__${act}_${f}.png`));
        }
        playerAnims[act] = arr;
    }

    // default to IDLE animation frames
    player = new PIXI.AnimatedSprite(playerAnims['IDLE']);
    player.animationSpeed = 0.12;
    player.anchor.set(0.5);
    player.scale.set(0.35);
    player.baseSpeed = 4;
    player.speed = player.baseSpeed;
    player.worldX = 0;
    player.worldY = 0;
    player.hp = 100;
    player.shield = false;
    player.currentAnim = 'IDLE';
    player.play();
    // approx player collision radius
    try { player.radius = Math.max(14, (player.textures[0].width || 80) * player.scale.x * 0.42); } catch (e) { player.radius = 20; }
    gameContainer.addChild(player);

    // helper to switch animations cleanly
    function playPlayerAnim(name, loop = true) {
        if (!player || player.currentAnim === name) return;
        const tex = playerAnims[name];
        if (!tex) return;
        player.textures = tex;
        player.loop = !!loop;
        // tweak speed for run/attack
        if (name === 'RUN' || name === 'WALK') player.animationSpeed = 0.18;
        else if (name === 'ATTACK') player.animationSpeed = 0.28;
        else player.animationSpeed = 0.12;
        player.play();
        player.currentAnim = name;
    }

    // expose to outer scope for other game logic
    player.playAnim = playPlayerAnim;

    const texEnemies = PIXI.Texture.from("sprites/inimigos.png");
    const texObstacle = PIXI.Texture.from("sprites/obstaculo.png");
    const texProjectile = PIXI.Texture.from("sprites/projetil.png");
    // powerups spritesheet (support multiple rows, e.g. 5 icons per row, icon size 170x170)
    const texPowerupsSheet = PIXI.Texture.from("sprites/powerups.png");
    const POWERUP_ICON_SIZE = 170;
    const powerupTypes = ['hp','speed','damage','rapid','shield'];
    const powerupTextures = {};
    // determine number of rows present in the sheet
    const rows = Math.max(1, Math.floor(texPowerupsSheet.height / POWERUP_ICON_SIZE));
    const cols = Math.max(1, Math.floor(texPowerupsSheet.width / POWERUP_ICON_SIZE));
    // create textures per type; allow multiple textures per type if there are multiple rows
    for (let t = 0; t < powerupTypes.length; t++) {
        powerupTextures[powerupTypes[t]] = [];
    }
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const index = r * cols + c;
            const type = powerupTypes[index % powerupTypes.length];
            const rect = new PIXI.Rectangle(c * POWERUP_ICON_SIZE, r * POWERUP_ICON_SIZE, POWERUP_ICON_SIZE, POWERUP_ICON_SIZE);
            const tex = new PIXI.Texture(texPowerupsSheet.baseTexture, rect);
            powerupTextures[type].push(tex);
        }
    }

    enemies = [];
    obstacles = [];
    projectiles = [];

    function createEnemy() {
        const type = Math.floor(Math.random() * 4);
        const ENEMY_FRAME_W = texEnemies.width / 4;
        const t = new PIXI.Texture(
            texEnemies.baseTexture,
            new PIXI.Rectangle(type * ENEMY_FRAME_W, 0, ENEMY_FRAME_W, texEnemies.height)
        );
        const e = new PIXI.Sprite(t);
        e.anchor.set(0.5);
        e.scale.set(0.55);

        // spawn around player but with increased density at higher levels
        const spread = 600 - Math.min(400, currentLevel * 20);
        e.worldX = player.worldX + (spread + Math.random() * 300) * (Math.random() < 0.5 ? -1 : 1);
        e.worldY = player.worldY + (spread + Math.random() * 300) * (Math.random() < 0.5 ? -1 : 1);

        // AI parameters
        e.aiState = 'idle'; // 'idle'|'pursue'|'circling'
        e.wanderAngle = Math.random() * Math.PI * 2;
        e.detectionRadius = 220 + currentLevel * 8; // detect player earlier as level grows
        e.baseSpeed = 1.0 + currentLevel * 0.08 + type * 0.12;
        e.speed = e.baseSpeed;
        e.hp = 10 + difficulty * 4 + currentLevel * 2 + type * 2;
        e.damage = 1 + Math.floor(currentLevel / 3) + type;

        // compute approximate collision radius for the enemy using frame width and scale
        try {
            e.radius = Math.max(14, (ENEMY_FRAME_W * e.scale.x) * 0.45);
        } catch (err) {
            e.radius = 18;
        }

        enemies.push(e);
        gameContainer.addChild(e);
    }

    function spawnObstacle() {
        const o = new PIXI.Sprite(texObstacle);
        o.anchor.set(0.5);
        o.scale.set(0.7);
        o.size = 64;

        o.worldX = player.worldX + (300 + Math.random() * 700) * (Math.random() < 0.5 ? -1 : 1);
        o.worldY = player.worldY + (300 + Math.random() * 700) * (Math.random() < 0.5 ? -1 : 1);

        obstacles.push(o);
        gameContainer.addChild(o);
    }

    for (let i = 0; i < 8; i++) spawnObstacle();

    function getClosestEnemy() {
        let best = null;
        let bd = Infinity;
        for (const e of enemies) {
            const d = Math.hypot(e.worldX - player.worldX, e.worldY - player.worldY);
            if (d < bd) { best = e; bd = d; }
        }
        return best;
    }

    function fireProjectile() {
        if (!projectilesEnabled) return; // disabled by user request
        if (currentState !== STATE.PLAYING) return;

        const target = getClosestEnemy();

        let ang, vx, vy;

        if (!target) {
            ang = Math.random() * Math.PI * 2;
            vx = Math.cos(ang) * 8;
            vy = Math.sin(ang) * 8;
        } else {
            const dx = target.worldX - player.worldX;
            const dy = target.worldY - player.worldY;
            ang = Math.atan2(dy, dx);

            const d = Math.hypot(dx, dy) || 1;
            vx = dx / d * 8;
            vy = dy / d * 8;
        }

        const p = new PIXI.Sprite(texProjectile);
        p.anchor.set(0.5);
        p.scale.set(0.28);
        p.rotation = ang;

        p.worldX = player.worldX;
        p.worldY = player.worldY;

        p.vx = vx;
        p.vy = vy;
        p.life = 90;
        p.damage = 5 + (activePowerups.damage.active ? activePowerups.damage.extra : 0);
        // approximate collision radius based on texture size and scale
        try { p.radius = Math.max(6, (texProjectile.width || 32) * p.scale.x * 0.45); } catch (err) { p.radius = 8; }

        projectiles.push(p);
        gameContainer.addChild(p);

        // trigger attack animation on player (one-shot) then resume movement anim
        try {
            if (player && player.playAnim) {
                player.playAnim('ATTACK', false);
                player.onComplete = () => {
                    // resume appropriate animation
                    const movingNow = keys["w"] || keys["a"] || keys["s"] || keys["d"] || keys["arrowup"] || keys["arrowleft"] || keys["arrowdown"] || keys["arrowright"];
                    if (movingNow) player.playAnim('RUN', true);
                    else player.playAnim('IDLE', true);
                    player.onComplete = null;
                };
            }
        } catch (e) { }
    }

    // manual fire used by player (space key) - always allowed
    function playerManualFire() {
        if (!player) return;

        // find target (closest enemy) or shoot forward random direction
        const target = getClosestEnemy();

        let ang, vx, vy;
        if (!target) {
            ang = Math.random() * Math.PI * 2;
            vx = Math.cos(ang) * 10;
            vy = Math.sin(ang) * 10;
        } else {
            const dx = target.worldX - player.worldX;
            const dy = target.worldY - player.worldY;
            ang = Math.atan2(dy, dx);
            const d = Math.hypot(dx, dy) || 1;
            vx = dx / d * 10;
            vy = dy / d * 10;
        }

        const p = new PIXI.Sprite(texProjectile);
        p.anchor.set(0.5);
        // spawn scale animation
        p.scale.set(0);
        p.targetScale = 0.28;
        p.spawnTime = performance.now();
        p.spawnDuration = 220;
        p.rotation = ang;

        p.worldX = player.worldX;
        p.worldY = player.worldY;

        p.vx = vx;
        p.vy = vy;
        p.life = 180;
        p.damage = 8 + (activePowerups.damage.active ? activePowerups.damage.extra : 0);
        try { p.radius = Math.max(6, (texProjectile.width || 32) * 0.28 * 0.45); } catch (err) { p.radius = 8; }

        projectiles.push(p);
        gameContainer.addChild(p);

        // short shoot feedback — player attack anim
        try {
            if (player && player.playAnim) {
                player.playAnim('ATTACK', false);
                player.onComplete = () => {
                    const movingNow = keys["w"] || keys["a"] || keys["s"] || keys["d"];
                    if (movingNow) player.playAnim('RUN', true);
                    else player.playAnim('IDLE', true);
                    player.onComplete = null;
                };
            }
        } catch (e) {}
    }

    gameData = {
        createEnemy,
        spawnObstacle,
        fireProjectile,
        updateProjectileInterval,
        spawnPowerup,
    };

    function updateProjectileInterval() {
        if (projectileTimer) {
            clearInterval(projectileTimer);
            projectileTimer = null;
        }
        if (!projectilesEnabled) return; // do not start interval if projectiles are disabled
        projectileTimer = setInterval(() => {
            if (currentState === STATE.PLAYING) gameData.fireProjectile();
        }, Math.max(50, projectileRate * (activePowerups.rapid.active ? activePowerups.rapid.factor : 1)));
    }

    // initial projectile loop
    updateProjectileInterval();

    // spawn powerups periodically
    function spawnPowerup() {
        // small chance based spawn more often at higher levels
        const types = ['hp','speed','damage','rapid','shield'];
        const type = types[Math.floor(Math.random()*types.length)];
        // choose a random variation texture for this type (if multiple rows exist)
        const texturesList = powerupTextures[type] && powerupTextures[type].length ? powerupTextures[type] : null;
        const chosenTex = texturesList ? texturesList[Math.floor(Math.random() * texturesList.length)] : null;
        const sprite = chosenTex ? new PIXI.Sprite(chosenTex) : new PIXI.Sprite(app.renderer.generateTexture(new PIXI.Graphics().beginFill(0xffffff).drawCircle(0,0,18).endFill()));
        sprite.anchor.set(0.5);
        // target scale for 170px -> ~37px visual
        const TARGET_SCALE = 0.22;
        // start at zero for spawn animation
        sprite.scale.set(0);
        sprite.targetScale = TARGET_SCALE;
        sprite.spawnTime = performance.now();
        sprite.spawnDuration = 500; // ms for spawn animation
        sprite.type = type;
        sprite.worldX = player.worldX + (200 + Math.random()*800)*(Math.random()<0.5?-1:1);
        sprite.worldY = player.worldY + (200 + Math.random()*800)*(Math.random()<0.5?-1:1);
        sprite.collected = false;
        powerups.push(sprite);
        gameContainer.addChild(sprite);
    }

    // powerup spawn timer (more frequent as level increases)
    powerupTimer = setInterval(() => {
        if (currentState !== STATE.PLAYING) return;
        // chance scales with level
        if (Math.random() < 0.35 + currentLevel*0.02) spawnPowerup();
    }, 8000);

    // assets are ready; enable play button
    assetsLoaded = true;
    try { playBtn.interactive = true; playBtn.buttonMode = true; } catch (e) {}
    try { replayBtn.interactive = true; replayBtn.buttonMode = true; } catch (e) {}
}

function resetGame() {
    kills = 0;
    difficulty = 0;
    spawnDelay = 100;
    nextSpawn = 0;
    elapsedTime = 0;
    score = 0;
    camX = 0;
    camY = 0;
    player.hp = 100;
    player.worldX = 0;
    player.worldY = 0;
    player.speed = player.baseSpeed;
    player.shield = false;
    // reset player animation
    try { if (player && player.playAnim) { player.playAnim('IDLE', true); player.onComplete = null; } } catch(e) {}

    // remove all entities from stage
    for (const e of enemies) gameContainer.removeChild(e);
    for (const o of obstacles) gameContainer.removeChild(o);
    for (const p of projectiles) gameContainer.removeChild(p);
    for (const pu of powerups) gameContainer.removeChild(pu);

    enemies.length = 0;
    obstacles.length = 0;
    projectiles.length = 0;
    powerups.length = 0;

    // reset powerups state
    for (const k of Object.keys(activePowerups)) {
        activePowerups[k].active = false;
        activePowerups[k].expiresAt = 0;
    }

    currentLevel = 1;
    levelText.text = `Nível: ${currentLevel}`;

    // restart obstacles
    if (gameData && gameData.spawnObstacle) {
        for (let i = 0; i < 8; i++) gameData.spawnObstacle();
    }

    // reset timers
    if (projectileTimer) clearInterval(projectileTimer);
    if (powerupTimer) clearInterval(powerupTimer);
    projectileRate = 300;
    // restart projectile and powerup timers via gameData helper
    if (gameData && gameData.updateProjectileInterval) gameData.updateProjectileInterval();
    powerupTimer = setInterval(() => {
        if (currentState !== STATE.PLAYING) return;
        if (Math.random() < 0.35 + currentLevel*0.02) {
            // spawn safely
            if (gameData && gameData.spawnPowerup) gameData.spawnPowerup();
        }
    }, 8000);
}

function updateCamera() {
    camX = player.worldX - GAME_WIDTH / 2;
    camY = player.worldY - GAME_HEIGHT / 2;

    if(gameContainer.children.length > 0 && gameContainer.children[0] instanceof PIXI.TilingSprite){
        gameContainer.children[0].tilePosition.x = -camX * 0.25;
        gameContainer.children[0].tilePosition.y = -camY * 0.25;
    }
}

const keys = {};
window.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
window.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

// player manual fire cooldown
let lastShotTime = 0;
const shotCooldown = 220; // ms

// space -> fire once (manual fire) regardless of projectilesEnabled
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        // prevent repeat rapid-fire on holding space (cooldown)
        const now = performance.now();
        if (now - lastShotTime < shotCooldown) return;
        lastShotTime = now;
        // call custom player fire which always creates a projectile
        playerManualFire();
    }
});

app.ticker.add(() => {
    if (currentState !== STATE.PLAYING) return;

    elapsedTime += app.ticker.elapsedMS / 1000;

    let dx = 0, dy = 0;
    if (keys["w"] || keys["arrowup"]) dy -= 1;
    if (keys["s"] || keys["arrowdown"]) dy += 1;
    if (keys["a"] || keys["arrowleft"]) dx -= 1;
    if (keys["d"] || keys["arrowright"]) dx += 1;

    const moving = dx !== 0 || dy !== 0;

    if (moving) {
        const l = Math.hypot(dx, dy);
        dx /= l; dy /= l;
        player.worldX += dx * player.speed;
        player.worldY += dy * player.speed;
    }

    // player animation based on movement, but don't interrupt ATTACK or DIE
    try {
        if (player && player.playAnim && player.currentAnim !== 'ATTACK' && player.currentAnim !== 'DIE') {
            if (moving && player.currentAnim !== 'RUN') player.playAnim('RUN', true);
            if (!moving && player.currentAnim !== 'IDLE') player.playAnim('IDLE', true);
        }
    } catch(e) {}

    for (const o of obstacles) {
        const hw = o.size / 2;
        if (Math.abs(player.worldX - o.worldX) < hw + 20 &&
            Math.abs(player.worldY - o.worldY) < hw + 20) {
            player.worldX -= dx * player.speed;
            player.worldY -= dy * player.speed;
        }
    }

    nextSpawn--;
    if (nextSpawn <= 0) {
        nextSpawn = spawnDelay;
        gameData.createEnemy();
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];

        // Vector to player
        const ax = player.worldX - e.worldX;
        const ay = player.worldY - e.worldY;
        const d = Math.hypot(ax, ay) || 1;

        // Simple AI states
        if (d < e.detectionRadius) {
            e.aiState = 'pursue';
        } else {
            // wander with occasional circling
            if (Math.random() < 0.002 * Math.max(1, currentLevel)) e.aiState = 'circling';
            else e.aiState = 'idle';
        }

        // base steering vector
        let steerX = 0, steerY = 0;

        if (e.aiState === 'pursue') {
            steerX += (ax / d) * (e.baseSpeed * 1.1 + currentLevel * 0.05);
            steerY += (ay / d) * (e.baseSpeed * 1.1 + currentLevel * 0.05);
        } else if (e.aiState === 'circling') {
            // circle around player
            const angle = Math.atan2(ay, ax) + Math.PI/2;
            steerX += Math.cos(angle) * (e.baseSpeed * 0.9);
            steerY += Math.sin(angle) * (e.baseSpeed * 0.9);
        } else {
            // idle wander
            e.wanderAngle += (Math.random() - 0.5) * 0.2;
            steerX += Math.cos(e.wanderAngle) * e.baseSpeed * 0.6;
            steerY += Math.sin(e.wanderAngle) * e.baseSpeed * 0.6;
        }

        // obstacle avoidance: simple repulsion
        for (const o of obstacles) {
            const dxo = e.worldX - o.worldX;
            const dyo = e.worldY - o.worldY;
            const disto = Math.hypot(dxo, dyo) || 1;
            const minDist = (o.size/2) + 30;
            if (disto < minDist) {
                const repulse = (minDist - disto) / minDist;
                steerX += (dxo / disto) * repulse * 2.2;
                steerY += (dyo / disto) * repulse * 2.2;
            }
        }

        // normalize steer and apply
        const slen = Math.hypot(steerX, steerY) || 1;
        e.worldX += (steerX / slen) * e.baseSpeed;
        e.worldY += (steerY / slen) * e.baseSpeed;

        // contact with player (use radii)
        const playerR = player && player.radius ? player.radius : 20;
        if (d < ((e.radius || 18) + playerR)) {
            // apply damage once per tick while in range
            if (!player.shield) player.hp -= 0.08 * e.damage;
        }

        // dead?
        if (e.hp <= 0) {
            gameContainer.removeChild(e);
            enemies.splice(i, 1);
            kills++;

            score += 100 + elapsedTime * 10 + currentLevel * 10;

            hitSound.currentTime = 0;
            hitSound.play();

            updateLevelByKills();

            const dif = Math.floor(kills / 15);
            if (dif > difficulty) {
                difficulty = dif;
                spawnDelay = Math.max(10, 100 - difficulty * 8 - currentLevel);
            }
        }
    }

    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];

        // animate spawn scale if present
        if (p.spawnTime) {
            const t = Math.min(1, (performance.now() - p.spawnTime) / (p.spawnDuration || 220));
            const eased = 1 - Math.pow(1 - t, 3);
            const s = (p.targetScale || 0.28) * eased;
            p.scale.set(s);
            if (t >= 1) delete p.spawnTime;
        }

        p.worldX += p.vx;
        p.worldY += p.vy;
        p.life--;

        let destroy = false;

        for (const o of obstacles) {
            const hw = o.size / 2;
            const cx = Math.max(o.worldX - hw, Math.min(p.worldX, o.worldX + hw));
            const cy = Math.max(o.worldY - hw, Math.min(p.worldY, o.worldY + hw));
            // use projectile radius for obstacle collision
            const ddx = p.worldX - cx;
            const ddy = p.worldY - cy;
            if ((ddx * ddx + ddy * ddy) < (p.radius || 10) * (p.radius || 10)) {
                destroy = true;
                break;
            }
        }

        if (!destroy) {
            for (const e of enemies) {
                const dist = Math.hypot(p.worldX - e.worldX, p.worldY - e.worldY);
                const er = e.radius || 18;
                if (dist < ((p.radius || 8) + er)) {
                    e.hp -= (p.damage || 5);
                    destroy = true;
                    break;
                }
            }
        }

        if (destroy || p.life <= 0) {
            gameContainer.removeChild(p);
            projectiles.splice(i, 1);
        }
    }

    // powerup pickup and HUD update
    const now = performance.now();
    for (let i = powerups.length - 1; i >= 0; i--) {
        const pu = powerups[i];
        // spawn animation progress
        if (pu.spawnTime) {
            const t = Math.min(1, (now - pu.spawnTime) / pu.spawnDuration);
            // easeOutCubic
            const eased = 1 - Math.pow(1 - t, 3);
            const s = (pu.targetScale || 0.22) * eased;
            pu.scale.set(s);
            // bob/floating effect (amplitude scales with eased)
            const bob = Math.sin((now + (pu.spawnTime || 0)) / 300) * 6 * eased;
            pu.x = pu.worldX - camX;
            pu.y = pu.worldY - camY + bob;
            if (t >= 1) delete pu.spawnTime; // animation finished
        } else {
            // regular position and small bob
            pu.x = pu.worldX - camX;
            pu.y = pu.worldY - camY + Math.sin(now / 600 + i) * 3;
            if (!pu.targetScale) pu.scale.set(0.22);
        }

        const pd = Math.hypot(pu.worldX - player.worldX, pu.worldY - player.worldY);
        if (pd < 30 && !pu.collected) {
            pu.collected = true;
            // apply effect
            const type = pu.type;
            const DURATION = 10000; // ms
            if (type === 'hp') {
                player.hp = Math.min(100, player.hp + 35);
            } else if (type === 'speed') {
                activePowerups.speed.active = true;
                activePowerups.speed.expiresAt = now + DURATION;
                player.speed = player.baseSpeed * activePowerups.speed.factor;
            } else if (type === 'damage') {
                activePowerups.damage.active = true;
                activePowerups.damage.expiresAt = now + DURATION;
            } else if (type === 'rapid') {
                activePowerups.rapid.active = true;
                activePowerups.rapid.expiresAt = now + DURATION;
                if (gameData && gameData.updateProjectileInterval) gameData.updateProjectileInterval();
            } else if (type === 'shield') {
                activePowerups.shield.active = true;
                activePowerups.shield.expiresAt = now + DURATION;
                player.shield = true;
            }

            // visual/audio feedback
            hitSound.currentTime = 0;
            hitSound.play();

            // remove pickup visual immediately
            try { gameContainer.removeChild(pu); } catch(e) {}
            powerups.splice(i,1);
        }
    }

    // expire active powerups
    if (activePowerups.speed.active && now > activePowerups.speed.expiresAt) {
        activePowerups.speed.active = false;
        player.speed = player.baseSpeed;
    }
    if (activePowerups.rapid.active && now > activePowerups.rapid.expiresAt) {
        activePowerups.rapid.active = false;
        projectileRate = 300;
        if (gameData && gameData.updateProjectileInterval) gameData.updateProjectileInterval();
    }
    if (activePowerups.damage.active && now > activePowerups.damage.expiresAt) {
        activePowerups.damage.active = false;
    }
    if (activePowerups.shield.active && now > activePowerups.shield.expiresAt) {
        activePowerups.shield.active = false;
        player.shield = false;
    }

    // update powerup HUD text
    const activeNames = [];
    if (activePowerups.speed.active) activeNames.push('Speed');
    if (activePowerups.rapid.active) activeNames.push('Rapid');
    if (activePowerups.damage.active) activeNames.push('Damage');
    if (activePowerups.shield.active) activeNames.push('Shield');
    powerupText.text = activeNames.length ? `Powerups: ${activeNames.join(', ')}` : '';

    updateCamera();

    player.x = player.worldX - camX;
    player.y = player.worldY - camY;

    for (const e of enemies) {
        e.x = e.worldX - camX;
        e.y = e.worldY - camY;
    }

    for (const o of obstacles) {
        o.x = o.worldX - camX;
        o.y = o.worldY - camY;
    }

    for (const p of projectiles) {
        p.x = p.worldX - camX;
        p.y = p.worldY - camY;
    }

    hpText.text = `HP: ${Math.max(0, Math.floor(player.hp))}`;
    timeText.text = `Tempo: ${Math.floor(elapsedTime)}s`;
    scoreText.text = `Score: ${Math.floor(score)}`;

    if (player.hp <= 0) {
        // play DIE animation then go to gameover
        try {
            if (player && player.playAnim && player.currentAnim !== 'DIE') {
                player.playAnim('DIE', false);
                player.onComplete = () => {
                    player.onComplete = null;
                    switchToState(STATE.GAMEOVER);
                };
            } else if (player && player.currentAnim === 'DIE' && !player.playing) {
                // guarantee fallback
                switchToState(STATE.GAMEOVER);
            }
        } catch (e) {
            switchToState(STATE.GAMEOVER);
        }
    }
});

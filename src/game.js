// main orchestrator
// new: this file is intentionally small — classes and helpers live in their own files in src/
const app = new PIXI.Application({
    width: 800,
    height: 600,
    backgroundColor: 0x5dade2,
    antialias: true
});

document.getElementById('gameContainer').appendChild(app.view);

// Physics & constants
const gravity = 0.5;
const jumpForce = -12;
const moveSpeed = 4;
const keys = {};

// Game state
let score = 0;
let lives = 3;
let gameOver = false;
let fruits = [];
let enemies = [];
let player = null;

// Pause state
let paused = false;
let pauseOverlay = null;
// audio
let bgMusic = null;
let musicEnabled = true;
let musicStarted = false;

let fruitsCollected = 0;
let currentPhase = 1;
const phaseFruitTarget = 4;

// ground & platforms
let ground = new PIXI.Graphics();
ground.beginFill(0x228B22);
ground.drawRect(0, app.screen.height - 100, app.screen.width, 100);
ground.endFill();
ground.beginFill(0x1B5E20);
for (let i = 0; i < app.screen.width; i += 40) ground.drawRect(i, app.screen.height - 100, 30, 10);
ground.endFill();
app.stage.addChild(ground);

const platforms = [];
const platformGraphics = [];

function createPlatform(x, y, width = 150, height = 20) {
    const data = { x, y, width, height };

    // build a container for the platform so we can place and remove it easily
    const container = new PIXI.Container();
    container.x = x; container.y = y;

    try {
        const tex = PIXI.Texture.from('parallax/ground.png');
        // create a tiling sprite sized to platform width/height
        const ts = new PIXI.TilingSprite(tex, width, height);
        // scale tile to match tile image height if necessary
        const texH = tex.baseTexture?.realHeight || (tex.frame && tex.frame.height) || height;
        const texW = tex.baseTexture?.realWidth || (tex.frame && tex.frame.width) || width;
        if (texH > 0) ts.tileScale.y = height / texH;
        if (texW > 0) ts.tileScale.x = 1; // leave horizontal tiles natural
        ts.x = 0; ts.y = 0;
        container.addChild(ts);

        // add a subtle top edge overlay to mimic platform depth
        const edge = new PIXI.Graphics();
        edge.beginFill(0x5D4037);
        edge.drawRect(0, 0, width, Math.max(3, Math.floor(height * 0.2)));
        edge.endFill();
        edge.y = 0; edge.x = 0;
        container.addChild(edge);
    } catch (e) {
        // fallback to solid rectangle if texture missing
        const g = new PIXI.Graphics();
        g.beginFill(0x795548);
        g.drawRect(0, 0, width, height);
        g.endFill();
        const edge = new PIXI.Graphics();
        edge.beginFill(0x5D4037);
        edge.drawRect(0, 0, width, 5);
        edge.endFill();
        container.addChild(g); container.addChild(edge);
    }

    app.stage.addChild(container);
    platforms.push(data);
    platformGraphics.push(container);
}

// default starter platforms
createPlatform(150, 350, 150, 20);
createPlatform(400, 280, 150, 20);
createPlatform(600, 200, 150, 20);

function clearPlatforms() {
    while (platformGraphics.length) {
        const g = platformGraphics.pop();
        if (g && g.parent) g.parent.removeChild(g);
    }
    platforms.length = 0;
}

function generateRandomPlatforms(count = 3) {
    clearPlatforms();
    const minW = 80, maxW = 220;

    // Prevent impossible heights: compute a reasonable vertical step so platforms are reachable
    const groundTop = (typeof ground !== 'undefined' && ground && typeof ground.y === 'number') ? ground.y : (app.screen.height - 100); // y coordinate of the top of the ground
    const minY = 120; // top limit
    const maxAllowedJump = 140; // approx max player jump height (tuned)

    // We'll place platforms in tiers from low to high, ensuring vertical separation and reachability
    const verticalSpace = Math.max(40, Math.floor((groundTop - minY) / (count + 1)));
    const verticalStep = Math.min(verticalSpace, maxAllowedJump - 20);

    const placed = [];
    const minGap = 40;

    for (let i = 0; i < count; i++) {
        let w = Math.floor(Math.random() * (maxW - minW)) + minW;
        let tries = 0;
        let placedThis = false;
        // Target y based on tier - low tier first so there's a path upwards
        const tierY = groundTop - Math.max(40, verticalStep * (i + 1));

        while (!placedThis && tries < 20) {
            tries++;
            const x = Math.floor(Math.random() * (app.screen.width - w - 20)) + 10;
            // small jitter on tier position
            const jitter = Math.floor(Math.random() * 41) - 20; // -20..20
            let y = Math.max(minY, Math.min(groundTop - 40, tierY + jitter));

            // enforce non-overlap horizontally with a small gap
            let ok = true;
            for (const p of placed) {
                const gap = Math.max(minGap, Math.round(p.width * 0.15));
                if (!(x + w + gap < p.x || x > p.x + p.width + gap)) { ok = false; break; }
            }

            if (!ok) {
                // try changing position or width
                if (tries % 3 === 0) w = Math.floor(Math.random() * (maxW - minW)) + minW;
                continue;
            }

            // ensure reachable: the platform must be within maxAllowedJump of ground or at least one lower placed platform
            const topY = y;
            let reachable = (groundTop - topY) <= maxAllowedJump;
            if (!reachable) {
                for (const lp of placed) {
                    if (lp.y > topY && (lp.y - topY) <= maxAllowedJump) { reachable = true; break; }
                }
            }

            if (!reachable) continue;

            createPlatform(x, y, w, 20);
            placed.push({ x, y, width: w, height: 20 });
            placedThis = true;
        }

        // if couldn't place after tries, we still fall back to simple placement
        if (!placedThis) {
            const w2 = Math.floor(Math.random() * (maxW - minW)) + minW;
            const x2 = Math.floor(Math.random() * (app.screen.width - w2 - 20)) + 10;
            const y2 = Math.floor(Math.random() * (app.screen.height - 200)) + 120;
            createPlatform(x2, y2, w2, 20);
            placed.push({ x: x2, y: y2, width: w2, height: 20 });
        }
    }

    // after placement, keep `platforms` as the authoritative list for runtime
}

const statsText = new PIXI.Text('', { fontFamily:'Arial', fontSize:24, fill:0xFFFFFF, stroke:0x000000, strokeThickness:4 });
statsText.x = 10; statsText.y = 10; app.stage.addChild(statsText);

// pause overlay (on top)
pauseOverlay = new PIXI.Container();
const overlay = new PIXI.Graphics();
overlay.beginFill(0x000000, 0.6);
overlay.drawRect(0, 0, app.screen.width, app.screen.height);
overlay.endFill();
pauseOverlay.addChild(overlay);
const pauseText = new PIXI.Text('PAUSADO', { fontFamily:'Arial', fontSize:64, fill:0xFFFFFF, stroke:0x000000, strokeThickness:6 });
pauseText.anchor.set(0.5, 0.5);
pauseText.x = app.screen.width / 2; pauseText.y = app.screen.height / 2;
pauseOverlay.addChild(pauseText);
pauseOverlay.visible = false;
app.stage.addChild(pauseOverlay);

function pauseGame() {
    if (paused) return;
    paused = true;
    try { app.ticker.stop(); } catch(e) { /* ignore */ }
    if (pauseOverlay) pauseOverlay.visible = true;
    const b = document.getElementById('pauseBtn'); if (b) b.textContent = 'Continuar';
    // pause music too (preserve position)
    try { if (bgMusic && !bgMusic.paused) bgMusic.pause(); } catch(e) { /* ignore */ }
}

function resumeGame() {
    if (!paused) return;
    paused = false;
    try { app.ticker.start(); } catch(e) { /* ignore */ }
    if (pauseOverlay) pauseOverlay.visible = false;
    const b = document.getElementById('pauseBtn'); if (b) b.textContent = 'Pausar';
    // resume music if enabled
    try { if (bgMusic && musicEnabled) { bgMusic.play().catch(()=>{}); } } catch(e) { /* ignore */ }
}

function togglePause() { if (paused) resumeGame(); else pauseGame(); }

window.pauseGame = pauseGame; window.resumeGame = resumeGame; window.togglePause = togglePause;

// attach keyboard shortcut (P) to toggle pause
window.addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'p') togglePause(); });

// Assets
const knightAssets = {
    idle:  { path: 'knight/idle.png', frameWidth: 32, totalFrames: 8, frameDuration: 150 },
    run:   { path: 'knight/run.png', frameWidth: 32, totalFrames: 8, frameDuration: 75 },
    hit:   { path: 'knight/hit.png', frameWidth: 32, totalFrames: 4, frameDuration: 100 },
    death: { path: 'knight/death.png', frameWidth: 32, totalFrames: 6, frameDuration: 120 }
};

// all fruits use 3 frames (10x10) in the provided assets
const fruitAssets = {
    // use configured frameWidth=20 and frameHeight=20 (user requested wider frames)
    green:  { path: 'fruts/green/fruit_green.png', frameWidth: 20, frameHeight: 20, totalFrames: 3, frameDuration: 400 },
    red:    { path: 'fruts/red/fruit_red.png', frameWidth: 20, frameHeight: 20, totalFrames: 3, frameDuration: 400 },
    purple: { path: 'fruts/purple/fruit_purple.png', frameWidth: 20, frameHeight: 20, totalFrames: 3, frameDuration: 400 },
    yellon: { path: 'fruts/yellon/fruit_yellon.png', frameWidth: 20, frameHeight: 20, totalFrames: 3, frameDuration: 400 }
};

const toLoad = [
    ...Object.values(knightAssets).map(a => a.path),
    ...Object.values(fruitAssets).map(a => a.path),
    'slimes/slime_green.png', 'slimes/slime_purple.png',
    // parallax backgrounds
    // NOTE: removed parallax/mountain_full_background1.png (combined image) — don't use that for parallax
    'parallax/sky_Background.png', 'parallax/LargeMountain.png', 'parallax/smallMountain.png', 'parallax/clouds.png', 'parallax/ground.png', 'parallax/sun.png'
];

PIXI.Assets.load(toLoad).then(() => {
    console.log('assets loaded', toLoad);
    // setup parallax background behind everything else
    if (window.Parallax) {
        const layers = [
            { path: 'parallax/sky_Background.png', speed: 0.02, y: 0, scale: 1 },
            // move mountains down so they sit closer to the ground (less floating)
            // NOTE: mountain_full_background1.png is intentionally excluded — we use separate mountain layers
            // make large mountains wider (less repetition)
            { path: 'parallax/LargeMountain.png', speed: 0.06, y: 200, scale: 1.1, tileScaleX: 2.4, tileScaleY: 1.1 },
            // make small mountains visually wider so less of them appear
            { path: 'parallax/smallMountain.png', speed: 0.12, y: 300, scale: 1.2, tileScaleX: 1.8, tileScaleY: 1.2 },
            { path: 'parallax/clouds.png', speed: 0.2, y: 20, scale: 1.1, alpha: 0.9 },
            // removed parallax ground to avoid duplicate ground layer (foreground ground handled separately)
        ];
        window.parallax = new Parallax(app, layers);
        // add a static sun sprite
        window.parallax.addStatic('parallax/sun.png', app.screen.width - 220, 40, 0.8, 1);
    }

    // replace the simple green ground with a tiled ground image (keep original index to preserve draw order)
    try {
        const groundIndex = app.stage.getChildIndex(ground);
        if (groundIndex >= 0) {
            // create tiling sprite but choose a sensible visual ground height based on the texture
            const groundTex = PIXI.Texture.from('parallax/ground.png');
            const texH = groundTex.baseTexture?.realHeight || (groundTex.frame && groundTex.frame.height) || 100;
            // try to compute visible non-transparent height from the image content
            let visibleH = null;
            try { visibleH = window.getVisibleImageHeight('parallax/ground.png'); } catch (e) { visibleH = null; }
            // choose desired ground height: prefer visibleH (if available), otherwise fallback to texH * 0.5
            let desiredGroundH = texH;
            if (visibleH && visibleH > 8) {
                // take most of visible area but leave a small brown base portion
                desiredGroundH = Math.max(40, Math.min(120, Math.round(visibleH * 0.8)));
            } else {
                desiredGroundH = Math.max(40, Math.min(120, Math.round(texH * 0.5)));
            }
            // create a ground container with a brown base under the image so the ground looks thicker
            // reduce the brown base so it is less tall than before (use ~35% of visible height, min 8)
            const brownExtra = Math.max(8, Math.round(desiredGroundH * 0.35));
            const containerHeight = desiredGroundH + brownExtra;
            const groundContainer = new PIXI.Container();
            groundContainer.width = app.screen.width;
            groundContainer.height = containerHeight;

            // brown base (under image) to give visual thickness
            const brown = new PIXI.Graphics();
            brown.beginFill(0x8B5A2B); // brown
            brown.drawRect(0, desiredGroundH, app.screen.width, brownExtra);
            brown.endFill();
            groundContainer.addChild(brown);

            // tiling image sits on top of brown base
            const newGround = new PIXI.TilingSprite(groundTex, app.screen.width, desiredGroundH);
            const tileScaleY = desiredGroundH / texH || 1;
            newGround.tileScale.y = tileScaleY;
            newGround.tileScale.x = 1;
            newGround.x = 0; newGround.y = 0;
            groundContainer.addChild(newGround);

            // position the container so its bottom aligns with the stage bottom
            groundContainer.y = app.screen.height - containerHeight;
            // insert at same index and remove old ground
            app.stage.addChildAt(groundContainer, groundIndex);
            if (ground && ground.parent) ground.parent.removeChild(ground);
            // keep reference to container representing ground
            ground = groundContainer;
            // after replacing the ground, ensure the player and enemies are aligned to the new ground top
            const currentGroundTop = ground.y;
            if (player && typeof player.height === 'number') player.container.y = currentGroundTop - player.height;
            for (const e of enemies) {
                if (e && e.container) e.container.y = Math.max(e.container.y, currentGroundTop - e.height);
            }

            // also lower mountain layers to visually touch the ground top
            if (window.parallax && Array.isArray(window.parallax.layers)) {
                // small overlap so mountains look connected. Use different overlap per layer for depth
                for (const l of window.parallax.layers) {
                    const name = (l.name || '').toLowerCase();
                    if (name.includes('mountain')) {
                        // ensure l.height is known; fallback to 120
                        const lh = l.height || (l.texture && (l.texture.frame && l.texture.frame.height)) || 120;
                        // small overlap amount (positive number moves mountain down toward ground)
                        const overlap = name.includes('small') ? 6 : (name.includes('large') ? 10 : 12);
                        l.y = currentGroundTop - lh + overlap;
                    }
                }
            }
        }
    } catch (e) { console.warn('Failed to replace ground with image', e); }
    player = new Knight(100, app.screen.height - 130, knightAssets);
    // ensure player lands exactly on the actual ground top
    const actualGroundTop = (typeof ground !== 'undefined' && ground && typeof ground.y === 'number') ? ground.y : (app.screen.height - 100);
    if (player && typeof player.height === 'number') {
        player.container.y = actualGroundTop - player.height;
    }
    app.stage.addChild(player.container);
    spawnInitialEntities();

    // setup background music (trilha.mp3) and connect pause/music buttons
    try {
        // create audio element but do not force-play (browsers may block autoplay)
        bgMusic = new Audio('trilha.mp3');
        bgMusic.loop = true;
        bgMusic.volume = 0.45;
        // try to play right away; if browser blocks, we'll start on user interaction
        bgMusic.play().then(() => { musicStarted = true; }).catch(() => { musicStarted = false; });

        // connect music toggle button
        const mb = document.getElementById('musicBtn');
        if (mb) {
            mb.addEventListener('click', (ev) => {
                ev.preventDefault();
                musicEnabled = !musicEnabled;
                if (!musicEnabled && bgMusic) bgMusic.pause();
                if (musicEnabled && bgMusic) bgMusic.play().catch(()=>{});
                mb.textContent = musicEnabled ? 'Som: ON' : 'Som: OFF';
            });
        }

        // if audio blocked, start on first user gesture inside the page
        document.addEventListener('pointerdown', function tryStartAudioOnce() {
            if (!musicStarted && musicEnabled && bgMusic) {
                bgMusic.play().then(()=>{ musicStarted = true; }).catch(()=>{});
            }
            if (musicStarted) document.removeEventListener('pointerdown', tryStartAudioOnce);
        });
    } catch(e) { console.warn('audio init failed', e); }

    // connect the pause button in the DOM (if present)
    try {
        const b = document.getElementById('pauseBtn');
        if (b) b.addEventListener('click', (ev) => { ev.preventDefault(); togglePause(); });
    } catch (e) { /* no DOM available */ }
});

function spawnInitialEntities() {
    // compute real ground top and create a few random platforms for initial play
    const groundTop = (typeof ground !== 'undefined' && ground && typeof ground.y === 'number') ? ground.y : (app.screen.height - 100);
    // create a few random platforms for initial play
    generateRandomPlatforms(3);

    const fruitTypes = Object.keys(fruitAssets);
    // reduce initial fruit count so the level begins less cluttered
    for (let i = 0; i < 6; i++) {
        const x = Math.random() * (app.screen.width - 50) + 25;
        const y = Math.random() * 300 + 100;
        const type = fruitTypes[Math.floor(Math.random() * fruitTypes.length)];
        const f = new Fruit(x, y, fruitAssets[type]);
        fruits.push(f);
        app.stage.addChild(f.container);
    }

    const slimeTypes = ['green','purple'];
    for (let i = 0; i < 5; i++) {
        const type = slimeTypes[Math.floor(Math.random()*slimeTypes.length)];
        const s = new Slime(0, 0, type);
        // 50% chance to spawn on a random platform when available
        if (platforms.length > 0 && Math.random() < 0.5) {
            const p = platforms[Math.floor(Math.random() * platforms.length)];
            const px = p.x + 10 + Math.random() * Math.max(0, p.width - s.width - 20);
            const py = p.y - s.height;
            s.container.x = Math.max(0, Math.min(px, app.screen.width - s.width));
            s.container.y = Math.max(0, py);
        } else {
            s.container.x = Math.random() * (app.screen.width - 100) + 50;
            s.container.y = groundTop - s.height;
        }
        enemies.push(s);
        app.stage.addChild(s.container);
    }
}

function nextPhase() {
    currentPhase++;
    fruitsCollected = 0;
    fruits.forEach(f => { if (f.container.parent) f.container.parent.removeChild(f.container); }); fruits = [];
    enemies.forEach(e => { if (e.container.parent) e.container.parent.removeChild(e.container); }); enemies = [];

    const enemyCount = 5;
    // reduce growth rate of spawned fruits each phase (less spam)
    const newFruitCount = Math.max(4, 4 + (currentPhase - 1));

    const fruitTypes = Object.keys(fruitAssets);
    for (let i = 0; i < newFruitCount; i++) {
        const x = Math.random() * (app.screen.width - 50) + 25;
        const y = Math.random() * 200 + 100;
        const type = fruitTypes[Math.floor(Math.random() * fruitTypes.length)];
        const f = new Fruit(x, y, fruitAssets[type]); fruits.push(f); app.stage.addChild(f.container);
    }

    // reset + briefly invulnerable player so they don't immediately get killed
    if (player) {
        const groundTop = (typeof ground !== 'undefined' && ground && typeof ground.y === 'number') ? ground.y : (app.screen.height - 100);
        player.container.x = 100;
        player.container.y = groundTop - player.height;
        player.velocityX = 0; player.velocityY = 0; player.onGround = true;
        player.invulnerable = true; player.invulnerableTimer = 2 * 60;
        player.setState('idle');
    }

    // regenerate platforms each phase and spawn enemies (some on platforms)
    const platformCount = Math.max(2, Math.min(5, 2 + Math.floor(currentPhase / 2)));
    generateRandomPlatforms(platformCount);

    const slimeTypes = ['green','purple'];
    for (let i = 0; i < enemyCount; i++) {
        const type = slimeTypes[Math.floor(Math.random()*slimeTypes.length)];
        const s = new Slime(0,0,type);
        if (platforms.length > 0 && Math.random() < 0.5) {
            const p = platforms[Math.floor(Math.random() * platforms.length)];
            const px = p.x + 10 + Math.random() * Math.max(0, p.width - s.width - 20);
            const py = p.y - s.height;
            s.container.x = Math.max(0, Math.min(px, app.screen.width - s.width));
            s.container.y = Math.max(0, py);
        } else {
            const groundTop2 = (typeof ground !== 'undefined' && ground && typeof ground.y === 'number') ? ground.y : (app.screen.height - 100);
            s.container.x = Math.random() * (app.screen.width - 100) + 50;
            s.container.y = groundTop2 - s.height;
        }
        enemies.push(s); app.stage.addChild(s.container);
    }

    const phaseText = new PIXI.Text(`Fase ${currentPhase}`, { fontFamily:'Arial', fontSize:36, fill:0xFFFFFF, stroke:0x000000, strokeThickness:4 });
    phaseText.x = app.screen.width/2 - 80; phaseText.y = 100; app.stage.addChild(phaseText);
    setTimeout(()=> { if (phaseText.parent) phaseText.parent.removeChild(phaseText); }, 1500);
}

app.ticker.add(delta => {
    if (window.parallax) window.parallax.update(delta);
    if (gameOver) {
        statsText.text = `GAME OVER!\nScore: ${score}\nPressione F5 para reiniciar`;
        statsText.style.fill = 0xFF0000; return;
    }
    if (player) player.update(delta);
    fruits.forEach(f => { if (!f.collected) { f.update(delta); const pb = player.getBounds(); const fb = f.getBounds(); if (pb.x < fb.x + fb.width && pb.x + pb.width > fb.x && pb.y < fb.y + fb.height && pb.y + pb.height > fb.y) f.collect(); } });
    enemies.forEach(e => { if (e.alive) e.update(delta); });
    statsText.text = `❤️ Vidas: ${lives}  |  🍎 Score: ${score}`;
});

window.addEventListener('keydown', (e) => { keys[e.key] = true; });
window.addEventListener('keyup', (e) => { keys[e.key] = false; });
// (old Slime class code removed - Slime now in src/slime.js)

// Removed duplicated content - keep the single orchestrator above and class definitions in src/

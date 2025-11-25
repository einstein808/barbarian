// Mini platformer simples usando PixiJS
// Estrutura: aplicativo Pixi, jogador (retângulo), plataformas (retângulos), física básica

const app = new PIXI.Application({
  width: 800,
  height: 600,
  backgroundColor: 0x1b1b1b,
  antialias: true,
});

document.getElementById('game-root').appendChild(app.view);

// Root container que podemos mover para simular câmera
const world = new PIXI.Container();
app.stage.addChild(world);

// Config física
const GRAVITY = 1200; // px/s^2
const MOVE_SPEED = 220; // px/s
const JUMP_SPEED = 520; // px/s

// Jogador (será substituído por AnimatedSprite carregado abaixo)
let player = null;
let PLAYER_SCALE = 2;
let PLAYER_FRAME_W = 32;
let PLAYER_FRAME_H = 30; // altura do sprite sheet

// Criar jogador placeholder (invisível) até carregar sprite
const placeholder = new PIXI.Graphics();
placeholder.beginFill(0x4CAF50, 0.0);
placeholder.drawRect(0, 0, 32, 48);
placeholder.endFill();
placeholder.x = 100;
placeholder.y = 300;
placeholder.vx = 0;
placeholder.vy = 0;
placeholder.onGround = false;
world.addChild(placeholder);

// Plataformas (x, y, w, h)
const platforms = [];
function addPlatform(x, y, w, h) {
  const g = new PIXI.Graphics();
  g.beginFill(0x8e44ad);
  g.drawRect(0, 0, w, h);
  g.endFill();
  g.x = x;
  g.y = y;
  world.addChild(g);
  platforms.push({x, y, w, h, g});
}

// Nível simples
addPlatform(0, 560, 1600, 40); // chão longo
addPlatform(300, 460, 120, 24);
addPlatform(480, 380, 120, 24);
addPlatform(700, 320, 160, 24);
addPlatform(980, 420, 120, 24);
addPlatform(1200, 360, 120, 24);

// Input
const keys = {};
window.addEventListener('keydown', e => { keys[e.code] = true; });
window.addEventListener('keyup', e => { keys[e.code] = false; });

// AABB collision helper
function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// Função principal do jogo (loop) - roda sempre, mas só usa `player` quando disponível
let lastTime = performance.now();
app.ticker.add(() => {
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 1/30); // em segundos, com cap
  lastTime = now;

  // Entrada horizontal
  let move = 0;
  if (keys['KeyA'] || keys['ArrowLeft']) move -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) move += 1;

  // selecionar objeto a usar: player (sprite) quando pronto, senão placeholder
  const actor = player || placeholder;
  actor.vx = move * MOVE_SPEED;

  // Pular
  if ((keys['Space'] || keys['KeyW'] || keys['ArrowUp']) && actor.onGround) {
    actor.vy = -JUMP_SPEED;
    actor.onGround = false;
  }

  // Gravidade
  actor.vy += GRAVITY * dt;

  // Aplicar movimento X e resolver colisões X
  actor.x += actor.vx * dt;
  const aw = (player ? player.width : 32);
  const ah = (player ? player.height : 48);
  for (let p of platforms) {
    if (rectsOverlap(actor.x, actor.y, aw, ah, p.x, p.y, p.w, p.h)) {
      if (actor.vx > 0) {
        actor.x = p.x - aw;
      } else if (actor.vx < 0) {
        actor.x = p.x + p.w;
      }
      actor.vx = 0;
    }
  }

  // Aplicar movimento Y e resolver colisões Y
  actor.y += actor.vy * dt;
  actor.onGround = false;
  for (let p of platforms) {
    if (rectsOverlap(actor.x, actor.y, aw, ah, p.x, p.y, p.w, p.h)) {
      if (actor.vy > 0) {
        // caiu sobre a plataforma
        actor.y = p.y - ah;
        actor.vy = 0;
        actor.onGround = true;
      } else if (actor.vy < 0) {
        // bateu na parte de baixo
        actor.y = p.y + p.h;
        actor.vy = 0;
      }
    }
  }

  // Simples 'camera' - centraliza player (limites)
  const viewCenterX = app.renderer.width / 2;
  const actorX = (player ? player.x : placeholder.x);
  const actorW = (player ? player.width : 32);
  let targetX = -actorX + viewCenterX - actorW/2; // -player.x para mover world
  // limitar deslocamento para não mostrar além do chão
  targetX = Math.min(0, Math.max(-1400, targetX));
  world.x += (targetX - world.x) * 0.15; // suaviza movimento da câmera

  // opcional: suavizar Y se quiser
  // world.y = -player.y + app.renderer.height/2;

});

  // Carregar spritesheet do knight e criar AnimatedSprite
  const loader = new PIXI.Loader();
  loader.add('knight_idle', '../knight/idle.png');
  loader.load((ldr, resources) => {
    const baseTex = resources.knight_idle.texture.baseTexture;
    const frames = [];
    const cols = 8; // assumindo 8 frames na linha
    for (let i = 0; i < cols; i++) {
      const rect = new PIXI.Rectangle(i * PLAYER_FRAME_W, 0, PLAYER_FRAME_W, PLAYER_FRAME_H);
      frames.push(new PIXI.Texture(baseTex, rect));
    }

    const anim = new PIXI.AnimatedSprite(frames);
    anim.x = placeholder.x;
    anim.y = placeholder.y;
    anim.vx = 0;
    anim.vy = 0;
    anim.onGround = false;
    anim.animationSpeed = 0.12; // velocidade da animação (ajustável)
    anim.loop = true;
    anim.scale.set(PLAYER_SCALE);
    // manter anchor em 0,0 para colisões simples

    // substituir placeholder
    world.removeChild(placeholder);
    player = anim;
    world.addChild(player);
    player.play();

    console.log('Knight sprite carregado e jogador substituído.');
  });

  console.log('Mini platformer inicializado.');

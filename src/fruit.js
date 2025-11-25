// src/fruit.js
class Fruit {
    constructor(x, y, cfg) {
        this.container = new PIXI.Container();
        this.container.x = x;
        this.container.y = y;
        this.collected = false;
        // initial hitbox uses frame size, will be updated after textures/scale
        this.width = cfg.frameWidth;
        this.height = cfg.frameHeight;

        const textures = createFramesFromSheet(cfg.path, cfg.frameWidth, cfg.totalFrames, cfg.frameHeight);
        this.sprite = new PIXI.AnimatedSprite(textures);
        // set animation speed from frameDuration (ms per frame): desiredFPS = 1000/frameDuration
        const frameMs = cfg.frameDuration || 400;
        const desiredFps = 1000 / frameMs; // frames per second
        // PIXI.AnimationSprite animationSpeed is relative to 60fps: animationSpeed = desiredFps / 60
        this.sprite.animationSpeed = Math.max(0.02, desiredFps / 60);
        this.sprite.loop = true;
        // use centered anchor visually but keep container as top-left for collisions
        this.sprite.anchor.set(0.5);
        // scale the sprite so the visual frame appears ~32x32 on screen
        const desiredDisplaySize = 32; // user requested 32px frames
        let scaleValue = (cfg.frameWidth > 0) ? (desiredDisplaySize / cfg.frameWidth) : 2;
        // user requested 2x visual scale increase
        scaleValue = scaleValue * 2;
        this.sprite.scale.set(scaleValue);
        this.sprite.play();
        this.container.addChild(this.sprite);

        this.frameCounter = 0;
        this.bobOffset = Math.random() * Math.PI * 2;

        // recompute width/height from actual frame & scale
        try {
            const first = textures && textures[0];
            if (first && first.frame) {
                this.width = Math.round(first.frame.width * this.sprite.scale.x);
                this.height = Math.round(first.frame.height * this.sprite.scale.y);
                // position the sprite so the container still represents the top-left
                this.sprite.x = Math.round(this.width / 2);
                this.sprite.y = Math.round(this.height / 2);
            }
        } catch (e) { /* ignore */ }
    }

    update(delta) {
        this.frameCounter += 0.1;
        this.sprite.y = Math.sin(this.frameCounter + this.bobOffset) * 5;
        this.sprite.rotation = Math.sin(this.frameCounter * 0.5) * 0.1;
    }

    collect() {
        this.collected = true;
        score += 10;
        fruitsCollected++;
        if (fruitsCollected >= phaseFruitTarget) nextPhase();
        const tween = setInterval(() => {
            this.sprite.alpha -= 0.1;
            this.sprite.scale.x += 0.1;
            this.sprite.scale.y += 0.1;
            if (this.sprite.alpha <= 0) {
                clearInterval(tween);
                if (this.container.parent) this.container.parent.removeChild(this.container);
            }
        }, 30);
    }

    getBounds() { return { x: this.container.x, y: this.container.y, width: this.width, height: this.height }; }
}

window.Fruit = Fruit;

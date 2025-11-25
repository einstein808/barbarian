// src/slime.js
class Slime {
    constructor(x, y, type = 'green') {
        this.container = new PIXI.Container();
        this.container.x = x;
        this.container.y = y;
        this.alive = true;
        // patrol base speed a bit slower
        this.velocityX = Math.random() > 0.5 ? 0.8 : -0.8;
        this.velocityY = 0;
        this.direction = this.velocityX > 0 ? 1 : -1;
        this.width = 32; this.height = 28;

        this.type = type;
        this.frameCounter = 0;
        this.health = 2;

        const slimePath = `slimes/slime_${this.type}.png`;
        try {
            const spawnFrames = createFramesFromGridRow(slimePath, 4, 3, 0);
            const moveFrames  = createFramesFromGridRow(slimePath, 4, 3, 1);
            const damageFrames = createFramesFromGridRow(slimePath, 4, 3, 2);

            this.animations = {
                spawn: new PIXI.AnimatedSprite(spawnFrames),
                move:  new PIXI.AnimatedSprite(moveFrames),
                damage: new PIXI.AnimatedSprite(damageFrames)
            };

            const slimeSpriteScale = 4; // fixed larger than player
            for (const k in this.animations) {
                const s = this.animations[k];
                s.anchor.set(0);
                s.loop = k !== 'spawn' && k !== 'damage' ? true : false;
                s.animationSpeed = k === 'move' ? 0.12 : 0.14; // a bit slower
                s.visible = false;
                s.scale.set(slimeSpriteScale);
                this.container.addChild(s);
            }

            this.setState('spawn');
            this.animations.spawn.onComplete = () => { this.setState('move'); };
            this.animations.damage.onComplete = () => { if (this.alive) this.setState('move'); };

            try {
                const firstMove = (moveFrames && moveFrames[0]);
                if (firstMove && firstMove.frame) {
                    this.width = Math.round(firstMove.frame.width * slimeSpriteScale);
                    this.height = Math.round(firstMove.frame.height * slimeSpriteScale);
                }
            } catch (e) { /* ignore */ }

        } catch (err) {
            this.sprite = new PIXI.Graphics();
            this.sprite.beginFill(0x8BC34A);
            this.sprite.drawEllipse(24, 30, 22, 16);
            this.sprite.endFill();
            this.container.addChild(this.sprite);
        }
    }

    setState(name) {
        if (this.state === name) return;
        if (this.animations && this.animations[this.state]) {
            const prev = this.animations[this.state];
            if (prev instanceof PIXI.AnimatedSprite) prev.stop();
            prev.visible = false;
        }
        this.state = name;
        if (this.animations && this.animations[name]) {
            const a = this.animations[name];
            a.visible = true;
            if (a instanceof PIXI.AnimatedSprite) a.gotoAndPlay(0);
        }
    }

    update(delta) {
        if (!this.alive) return;

        const prevY = this.container.y;

        // Simple chase: only if player is in range and on ground
        if (player && player.container && this.alive && !gameOver) {
            const dx = player.container.x - this.container.x;
            const dy = player.container.y - this.container.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const chaseRange = 180; // shorter detection gives player breathing room
            if (dist < chaseRange && player.onGround) {
                // make slimes slower, scale with phase gently
                const chaseSpeed = Math.min(1.2, 0.45 + (currentPhase * 0.05));
                this.velocityX = dx > 0 ? chaseSpeed : -chaseSpeed;
            }
        }

        this.container.x += this.velocityX;
        this.velocityY += gravity * 0.5;
        this.container.y += this.velocityY;

        // ground check
        if (this.container.y >= app.screen.height - 100 - this.height) {
            this.container.y = app.screen.height - 100 - this.height;
            this.velocityY = 0;
        }

        // landing on platforms (snap when descending)
        if (this.velocityY >= 0 && Array.isArray(platforms)) {
            for (const p of platforms) {
                const prevBottom = prevY + this.height;
                const newBottom = this.container.y + this.height;
                const platformTop = p.y;
                const overlapsHoriz = this.container.x + this.width > p.x && this.container.x < p.x + p.width;
                if (prevBottom <= platformTop && newBottom >= platformTop && overlapsHoriz) {
                    this.container.y = platformTop - this.height;
                    this.velocityY = 0;
                    break;
                }
            }
        }

        // bounds and bounce/patrol
        if (this.container.x < 0 || this.container.x > app.screen.width - this.width) {
            this.velocityX *= -1; this.direction *= -1;
        }

        // occasional small hop, rarer than before
        if (Math.random() < 0.004) this.velocityY = -6;

        this.frameCounter++;
        // bob only (no squeeze)
        const bob = Math.sin(this.frameCounter * 0.1) * 2;
        if (this.animations && this.animations.move) {
            this.animations.move.y = bob;
            this.animations.move.x = 0;
        }

        // avoid spamming damage every frame
        if (!this.hitCooldown) this.hitCooldown = 0;
        if (this.hitCooldown > 0) this.hitCooldown--;
        if (this.checkCollisionWithPlayer(player) && this.hitCooldown <= 0) {
            player.takeDamage();
            this.hitCooldown = 40; // small cooldown between hits
        }
    }

    checkCollisionWithPlayer(player) {
        const pb = player.getBounds();
        const sb = this.getBounds();
        return (pb.x < sb.x + sb.width && pb.x + pb.width > sb.x && pb.y < sb.y + sb.height && pb.y + pb.height > sb.y);
    }

    takeDamage() {
        this.health--;
        if (this.animations && this.animations.damage) {
            this.setState('damage');
            this.animations.damage.tint = 0xFF0000;
            setTimeout(() => { if (this.animations.damage) this.animations.damage.tint = 0xFFFFFF; }, 150);
        } else if (this.sprite) {
            this.sprite.tint = 0xFF0000;
            setTimeout(() => { if (this.alive) this.sprite.tint = 0xFFFFFF; }, 100);
        }
        if (this.health <= 0) this.die();
    }

    die() {
        this.alive = false; score += 25;
        const active = (this.animations && this.animations[this.state]) ? this.animations[this.state] : this.sprite;
        const tween = setInterval(() => {
            if (active) {
                active.alpha -= 0.1; active.rotation += 0.2; active.scale.x += 0.05; active.scale.y -= 0.05;
            }
            if (active && active.alpha <= 0) { clearInterval(tween); if (this.container.parent) this.container.parent.removeChild(this.container); }
        }, 30);
    }

    getBounds() { return { x: this.container.x, y: this.container.y, width: this.width, height: this.height }; }
}

window.Slime = Slime;

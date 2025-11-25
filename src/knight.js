// src/knight.js
class Knight {
    constructor(x, y, assets) {
        this.container = new PIXI.Container();
        this.container.x = x;
        this.container.y = y;

        this.width = 32;
        this.height = 20;
        this.scaleFactor = 3;

        this.animations = {};

        // ============================
        //   CRIAÇÃO DAS ANIMAÇÕES
        // ============================
        for (const name in assets) {
            const cfg = assets[name];
            if (!cfg) continue;

            let fw = cfg.frameWidth;
            let fh = cfg.frameHeight;

            // Idle define o tamanho base do personagem (hitbox)
            if (name === "idle") {
                this.baseWidth  = fw * this.scaleFactor;
                this.baseHeight = fh * this.scaleFactor;
            }

            try {
                // =====================================================
                // TRATAMENTO ESPECIAL PARA A ANIMAÇÃO DEATH (220×220)
                // =====================================================
                if (name === "death") {
                    const textures = createFramesFromSheet(cfg.path, 30, cfg.totalFrames, 30);

                    const sprite = new PIXI.AnimatedSprite(textures);
                    sprite.animationSpeed = 0.12;     // ~8 fps → fica lindo com 6 frames
                    sprite.loop = false;
                    sprite.visible = false;

                    // CENTRALIZA O SPRITE (a mágica acontece aqui)
                    sprite.anchor.set(0.5, 0.5);
                    sprite.scale.set(this.scaleFactor);

                    // Posiciona no centro do container (igual às outras animações)
                    sprite.x = this.baseWidth  / 2 || this.width  / 2;
                    sprite.y = this.baseHeight / 2 || this.height / 2;

                    // AJUSTE FINO VERTICAL (testado com a maioria dos sprites de death)
                    // Mude esse valor (0 a ±10) se ainda precisar alinhar perfeitamente
                    sprite.y += 4;

                    this.animations[name] = sprite;
                    this.container.addChild(sprite);
                    continue; // pula o tratamento padrão abaixo
                }

                // =====================================================
                // ANIMAÇÕES NORMAIS (idle, run, hit, etc.)
                // =====================================================
                const textures = createFramesFromSheet(cfg.path, fw, cfg.totalFrames, fh);

                const sprite = new PIXI.AnimatedSprite(textures);
                sprite.animationSpeed = Math.max(
                    0.1,
                    60 / 1000 / (cfg.frameDuration / cfg.totalFrames)
                );
                sprite.loop = name !== "death"; // death já foi tratado acima
                sprite.visible = false;
                sprite.anchor.set(0, 0);            // canto superior esquerdo (padrão das outras)
                sprite.scale.set(this.scaleFactor);

                this.animations[name] = sprite;
                this.container.addChild(sprite);

            } catch (err) {
                console.error("Erro ao criar animação:", name, err);
                const g = new PIXI.Graphics();
                g.beginFill(0x4CAF50);
                g.drawRect(0, 0, this.width, this.height);
                g.endFill();
                this.container.addChild(g);
                this.animations[name] = g;
            }
        }

        // Define hitbox correta baseada no idle (ou primeira animação válida)
        const idleSprite = this.animations["idle"];
        if (idleSprite && idleSprite instanceof PIXI.AnimatedSprite && idleSprite.texture) {
            this.width  = Math.round(idleSprite.texture.frame.width  * this.scaleFactor);
            this.height = Math.round(idleSprite.texture.frame.height * this.scaleFactor);
        }

        this.setState("idle");

        // Estado inicial
        this.velocityX = 0;
        this.velocityY = 0;
        this.onGround = false;
        this.facingRight = true;

        this.attacking = false;
        this.attackTimer = 0;
        this.invulnerable = false;
        this.invulnerableTimer = 0;
    }

    // =============================
    //      TROCA DE ESTADO
    // =============================
    setState(name) {
        if (this.state === name) return;

        // Para a animação anterior
        if (this.animations[this.state] instanceof PIXI.AnimatedSprite) {
            this.animations[this.state].stop();
            this.animations[this.state].visible = false;
        }

        this.state = name;
        const anim = this.animations[name];
        if (!anim) return;

        if (anim instanceof PIXI.AnimatedSprite) {
            anim.visible = true;
            anim.gotoAndPlay(0);
        } else {
            anim.visible = true;
        }
    }

    // =============================
    //            UPDATE
    // =============================
    update(delta) {
        // ... [todo o seu código de movimento, colisão, ataque etc. permanece 100% igual] ...

        if (!this.onGround) this.velocityY += gravity;

        if (keys['ArrowLeft'] && !this.attacking) {
            this.velocityX = -moveSpeed;
            this.facingRight = false;
            this.setState("run");
        } else if (keys['ArrowRight'] && !this.attacking) {
            this.velocityX = moveSpeed;
            this.facingRight = true;
            this.setState("run");
        } else {
            this.velocityX = 0;
            if (this.onGround && !this.attacking) this.setState("idle");
        }

        if (keys[' '] && this.onGround && !this.attacking) {
            this.velocityY = jumpForce;
            this.onGround = false;
            this.setState("idle");
        }

        if (keys['z'] && !this.attacking && this.onGround) {
            this.attack();
        }

        // Movimento e colisão (corrigido: gravidade + checagem de plataformas e chão)
        const prevX = this.container.x;
        const prevY = this.container.y;

        this.container.x += this.velocityX;
        this.container.y += this.velocityY;

        // --- Verifica colisões com plataformas e chão ---
        // topo do chão: tenta usar objeto ground (substituído por container em game.js) ou fallback
        let groundTop = app && app.screen ? app.screen.height - 100 : 500;
        if (typeof ground !== 'undefined' && ground && typeof ground.y === 'number') {
            groundTop = ground.y;
        }

        // pés do jogador
        const feetY = this.container.y + this.height;

        // reinicia estado de chão e checa plataformas primeiro
        this.onGround = false;
        if (Array.isArray(platforms)) {
            for (const p of platforms) {
                // p { x,y,width,height }
                const overlapsHoriz = (this.container.x + this.width) > p.x && this.container.x < (p.x + p.width);
                const prevBottom = prevY + this.height;
                const newBottom = this.container.y + this.height;
                // estava acima e agora atravessou para baixo -> land
                if (overlapsHoriz && prevBottom <= p.y && newBottom >= p.y && this.velocityY >= 0) {
                    this.container.y = p.y - this.height;
                    this.velocityY = 0;
                    this.onGround = true;
                    break;
                }
            }
        }

        // se não pousou em plataforma, verifica chão do mundo
        if (!this.onGround) {
            if (feetY >= groundTop) {
                this.container.y = groundTop - this.height;
                this.velocityY = 0;
                this.onGround = true;
            }
        }

        // Limites da tela
        if (this.container.x < 0) this.container.x = 0;
        if (this.container.x > app.screen.width - this.width) {
            this.container.x = app.screen.width - this.width;
        }

        // ... [todo o resto do seu código de plataforma e chão permanece exatamente igual] ...

        // FLIP HORIZONTAL (agora funciona perfeitamente com death centralizado)
        for (const k in this.animations) {
            const a = this.animations[k];
            if (a instanceof PIXI.Sprite || a instanceof PIXI.AnimatedSprite) {
                // Para animações com anchor 0,0
                if (a.anchor.x === 0) {
                    a.scale.x = this.facingRight ? this.scaleFactor : -this.scaleFactor;
                    a.x = this.facingRight ? 0 : this.width;
                }
                // Para death (anchor 0.5,0.5) o flip já funciona automaticamente
                else {
                    a.scale.x = this.facingRight ? this.scaleFactor : -this.scaleFactor;
                }
            }
        }

        // Timer de ataque e invulnerabilidade (sem alterações)
        if (this.attacking) {
            this.attackTimer--;
            if (this.attackTimer <= 0) this.attacking = false;
        }

        if (this.invulnerable) {
            this.invulnerableTimer--;
            const alpha = Math.sin(this.invulnerableTimer * 0.5) * 0.5 + 0.5;
            for (const k in this.animations) {
                const a = this.animations[k];
                if (a instanceof PIXI.DisplayObject) a.alpha = alpha;
            }
            if (this.invulnerableTimer <= 0) {
                this.invulnerable = false;
                for (const k in this.animations) {
                    const a = this.animations[k];
                    if (a instanceof PIXI.DisplayObject) a.alpha = 1;
                }
            }
        }
    }

    attack() {
        this.attacking = true;
        this.attackTimer = 20;
        this.setState("hit");

        enemies.forEach(enemy => {
            if (this.isAttackingEnemy(enemy)) enemy.takeDamage();
        });
    }

    isAttackingEnemy(enemy) {
        const range = 50;
        const dx = enemy.container.x - this.container.x;
        const dy = enemy.container.y - this.container.y;

        if (this.facingRight && dx > 0 && dx < range && Math.abs(dy) < 30) return true;
        if (!this.facingRight && dx < 0 && Math.abs(dx) < range && Math.abs(dy) < 30) return true;
        return false;
    }

    takeDamage() {
        if (!this.invulnerable) {
            lives--;
            this.invulnerable = true;
            this.invulnerableTimer = 2 * 60;
            this.setState("hit");

            if (lives <= 0) this.die();
        }
    }

    die() {
        this.setState("death");
        gameOver = true;
    }

    getBounds() {
        return {
            x: this.container.x,
            y: this.container.y,
            width: this.width,
            height: this.height
        };
    }
}

window.Knight = Knight;
// src/parallax.js
// Simple parallax manager using PIXI.TilingSprite for layered background.
class Parallax {
    constructor(app, layers = []) {
        this.app = app;
        this.layers = [];
        this.container = new PIXI.Container();
        this.container.zIndex = 0;
        this.app.stage.addChildAt(this.container, 0);

        // create layers from config objects: { key, path, speed, y, scale }
        for (const cfg of layers) {
            try {
                const tex = PIXI.Texture.from(cfg.path);
                // TilingSprite covers the app width and extends vertically as needed
                const ts = new PIXI.TilingSprite(tex, app.screen.width, tex.baseTexture.realHeight || tex.frame?.height || app.screen.height);
                    // support independent tileScaleX / tileScaleY values (cfg.tileScaleX, cfg.tileScaleY)
                    if (typeof cfg.tileScaleX === 'number' || typeof cfg.tileScaleY === 'number') {
                        ts.tileScale.x = typeof cfg.tileScaleX === 'number' ? cfg.tileScaleX : (cfg.scale || 1);
                        ts.tileScale.y = typeof cfg.tileScaleY === 'number' ? cfg.tileScaleY : (cfg.scale || 1);
                    } else {
                        ts.tileScale.set(cfg.scale || 1);
                    }
                ts.y = cfg.y || 0;
                ts.speed = cfg.speed || 0.2;
                ts.alpha = (typeof cfg.alpha === 'number') ? cfg.alpha : 1;
                ts.name = cfg.key || cfg.path;
                this.container.addChild(ts);
                this.layers.push(ts);
            } catch (e) {
                console.warn('Parallax: failed to load', cfg.path, e);
            }
        }

        // optional static sprites (sun etc)
        this.statics = [];
    }

    addStatic(path, x, y, scale = 1, alpha = 1) {
        const sprite = new PIXI.Sprite(PIXI.Texture.from(path));
        sprite.x = x; sprite.y = y; sprite.scale.set(scale); sprite.alpha = alpha;
        this.container.addChild(sprite);
        this.statics.push(sprite);
        return sprite;
    }

    update(delta) {
        // move tiles horizontally to simulate parallax
        for (const l of this.layers) {
            // small horizontal movement; speed is in pixels per tick
            l.tilePosition.x -= (l.speed || 0) * delta;
        }
    }
}

window.Parallax = Parallax;

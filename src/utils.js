// src/utils.js
// Utilities for sprite frame extraction
function createFramesFromSheet(path, frameWidth, frameCount, frameHeight) {
    const base = PIXI.BaseTexture.from(path);
    const src = base.resource && base.resource.source ? base.resource.source : (base.source || {});
    const imgWidth = Math.round(base.realWidth || src.width || base.width || 0);
    const imgHeight = Math.round(base.realHeight || src.height || base.height || 0);
    const frames = [];
    // if the configured frame size doesn't fit exactly, compute sensible defaults
    const fh = Math.max(0, Math.floor(frameHeight || imgHeight || base.height || 0));

    // if frameWidth * frameCount does not fit, try to compute a safe frameWidth
    let fw = frameWidth;
    if (!fw || fw * frameCount > imgWidth) {
        const computed = Math.floor(imgWidth / frameCount) || 0;
        if (computed > 0) {
            console.warn(`createFramesFromSheet: requested frameWidth=${frameWidth} doesn't fit image ${path} (imgWidth=${imgWidth}). Using auto-computed frameWidth=${computed}.`);
            fw = computed;
        } else {
            // fallback: use entire image as single frame
            console.warn(`createFramesFromSheet: can't compute frames for ${path}, falling back to single-frame.`);
            frames.push(new PIXI.Texture(base, new PIXI.Rectangle(0, 0, imgWidth || base.width, imgHeight || base.height)));
            return frames;
        }
    }

    // ensure frame height fits; if not, compute reasonable height from rows (assume single row)
    let fhUsed = fh;
    if (!fhUsed || fhUsed > imgHeight) {
        fhUsed = imgHeight;
        console.warn(`createFramesFromSheet: requested frameHeight=${frameHeight} exceeds image ${path} height; using ${fhUsed}.`);
    }

    for (let i = 0; i < frameCount; i++) {
        const sx = i * fw;
        // avoid adding frames that would overflow the image
        if (sx + fw <= imgWidth && fhUsed <= imgHeight) {
            const rect = new PIXI.Rectangle(sx, 0, fw, fhUsed);
            frames.push(new PIXI.Texture(base, rect));
        }
    }
    // if nothing was generated, fallback to single-frame texture
    if (frames.length === 0) {
        frames.push(new PIXI.Texture(base, new PIXI.Rectangle(0, 0, imgWidth || base.width, imgHeight || base.height)));
    }
    return frames;
}

function createFramesFromGridRow(path, cols, rows, rowIndex) {
    const base = PIXI.BaseTexture.from(path);
    const src = base.resource && base.resource.source ? base.resource.source : (base.source || {});
    const imgWidth = Math.round(base.realWidth || src.width || base.width || 0);
    const imgHeight = Math.round(base.realHeight || src.height || base.height || 0);
    // compute ideal per-cell sizes, but allow caller-provided frameWidth/frameHeight via args
    const frameWidth = imgWidth && cols ? Math.floor(imgWidth / cols) : 0;
    const frameHeight = imgHeight && rows ? Math.floor(imgHeight / rows) : 0;
    const frames = [];
    // adjust if computed sizes don't perfectly divide texture
    let fw = frameWidth; let fh = frameHeight;
    if (!fw || fw * cols > imgWidth) {
        fw = Math.floor(imgWidth / cols);
        console.warn(`createFramesFromGridRow: adjusted frame width to ${fw} for ${path}`);
    }
    if (!fh || fh * rows > imgHeight) {
        fh = Math.floor(imgHeight / rows);
        console.warn(`createFramesFromGridRow: adjusted frame height to ${fh} for ${path}`);
    }
    if (!fw || !fh || fw <= 0 || fh <= 0) {
        // fallback to single frame from specified row (clamped)
        const top = Math.max(0, Math.min(rowIndex * frameHeight || 0, imgHeight - 1));
        frames.push(new PIXI.Texture(base, new PIXI.Rectangle(0, top, imgWidth || base.width, imgHeight || base.height)));
        return frames;
    }
    // Small top-overlap to avoid chopping sprites that have a little visual padding above the nominal cell.
    // This helps with sprite sheets where the visual content bleeds slightly across grid boundaries.
    const overlapTop = -1; // 12% of frame height, clamped 2..16px

    for (let i = 0; i < cols; i++) {
        // use the actual computed cell sizes (fw, fh) to calculate offsets
        const sx = i * fw;
        // move the region a little higher so we include a small top margin
        let sy = Math.max(0, (rowIndex * fh) - overlapTop);
        // the actual height of the rect should include overlapTop (but not overflow image bounds)
        let usedH = Math.min(imgHeight - sy, fh + overlapTop);

        if (sx + fw <= imgWidth && sy + usedH <= imgHeight && fw > 0 && usedH > 0) {
            const rect = new PIXI.Rectangle(sx, sy, fw, usedH);
            frames.push(new PIXI.Texture(base, rect));
        }
    }
    return frames;
}

// expose for non-module usage (keeps compatibility)
window.createFramesFromSheet = createFramesFromSheet;
window.createFramesFromGridRow = createFramesFromGridRow;

// Returns the visible non-transparent height of an image (path) in pixels.
// If the image is not accessible or detection fails, returns null.
function getVisibleImageHeight(path) {
    try {
        const base = PIXI.BaseTexture.from(path);
        const src = base.resource && base.resource.source ? base.resource.source : (base.source || {});
        const img = src;
        let width = img.width || img.naturalWidth || base.realWidth || 0;
        let height = img.height || img.naturalHeight || base.realHeight || 0;
        if (!width || !height) return null;

        // create offscreen canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const pixels = ctx.getImageData(0, 0, width, height).data;

        // scan rows from top down to find first row that contains any non-transparent pixel
        let topNonEmpty = null;
        for (let y = 0; y < height; y++) {
            let rowEmpty = true;
            const rowStart = y * width * 4;
            for (let x = 0; x < width; x++) {
                const alpha = pixels[rowStart + x * 4 + 3];
                if (alpha > 8) { rowEmpty = false; break; }
            }
            if (!rowEmpty) { topNonEmpty = y; break; }
        }
        if (topNonEmpty === null) return 0;

        // scan bottom up to find last non-empty row
        let bottomNonEmpty = null;
        for (let y = height - 1; y >= 0; y--) {
            let rowEmpty = true;
            const rowStart = y * width * 4;
            for (let x = 0; x < width; x++) {
                const alpha = pixels[rowStart + x * 4 + 3];
                if (alpha > 8) { rowEmpty = false; break; }
            }
            if (!rowEmpty) { bottomNonEmpty = y; break; }
        }
        if (bottomNonEmpty === null) return 0;

        return Math.max(0, bottomNonEmpty - topNonEmpty + 1);
    } catch (e) {
        // cross-origin or resource not ready
        return null;
    }
}

window.getVisibleImageHeight = getVisibleImageHeight;

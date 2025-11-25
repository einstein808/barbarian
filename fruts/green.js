const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Carregar o sprite sheet da fruta verde
const sprite = new Image();
sprite.src = "../fruts/green/fruit_green.png";

const frameWidth = 100;
const frameHeight = 100;
const totalFrames = 3;
const scale = 2;

let currentFrame = 0;
let lastFrameTime = 0;
const frameDuration = 400;

// Redimensionar canvas
canvas.width = frameWidth * scale;
canvas.height = frameHeight * scale;

function animate(timestamp) {
    if (timestamp - lastFrameTime >= frameDuration) {
        currentFrame = (currentFrame + 1) % totalFrames;
        lastFrameTime = timestamp;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(
        sprite,
        currentFrame * frameWidth,
        0,
        frameWidth,
        frameHeight,
        0,
        0,
        frameWidth * scale,
        frameHeight * scale
    );

    requestAnimationFrame(animate);
}

sprite.onload = () => {
    console.log("Fruta verde carregada com sucesso!");
    requestAnimationFrame(animate);
};

sprite.onerror = () => {
    console.error("Erro ao carregar a fruta verde");
};

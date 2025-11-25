const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Carregar o sprite sheet contendo 4 frames de idle
const sprite = new Image();
sprite.src = "idle.png";

const frameWidth =32;
const frameHeight = 30;
const totalFrames = 8;
const scale = 3; // Escala para aumentar o tamanho do personagem

let currentFrame = 0;
let lastFrameTime = 0;
const frameDuration = 10000; // Velocidade da animação em ms (150ms por frame)

// Redimensionar canvas para mostrar o personagem ampliado
canvas.width = frameWidth * scale;
canvas.height = frameHeight * scale;

function animate(timestamp) {
    // Atualizar frame baseado no tempo decorrido
    if (timestamp - lastFrameTime >= frameDuration) {
        currentFrame = (currentFrame + 1) % totalFrames;
        lastFrameTime = timestamp;
    }

    // Limpar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Desenhar o frame atual do sprite sheet ampliado
    ctx.drawImage(
        sprite,
        currentFrame * frameWidth,  // sx: posição x no sprite sheet
        0,                          // sy: posição y (sempre 0)
        frameWidth,                 // sWidth: largura do frame
        frameHeight,                // sHeight: altura do frame
        0,                          // dx: posição x no canvas
        0,                          // dy: posição y no canvas
        frameWidth * scale,         // dWidth: largura ampliada
        frameHeight * scale         // dHeight: altura ampliada
    );

    requestAnimationFrame(animate);
}

// Iniciar animação quando a imagem for carregada
sprite.onload = () => {
    console.log("Sprite carregado com sucesso!");
    requestAnimationFrame(animate);
};

// Tratamento de erro caso a imagem não carregue
sprite.onerror = () => {
    console.error("Erro ao carregar o sprite: idle.png");
};

# Knight Platform Game — Project workspace

O projeto foi reorganizado: o código do jogo foi movido para `src/game.js` e a página HTML principal está em `2.html`.

O que eu fiz:
- Separei o JavaScript do HTML: o arquivo `2.html` agora carrega `src/game.js` (PIXI).
- Integrei sprites e animações existentes (pastas `knight/` e `fruts/`) usando PIXI.AnimatedSprite.

Como testar localmente
1. Abra um servidor estático na pasta do projeto (recomendado — alguns navegadores bloqueiam carregar imagens via file://):

   - Com Python (se instalado):

     ```powershell
     python -m http.server 8000
     ```

   - Ou com Node (http-server):

     ```powershell
     npx http-server -p 8000
     ```

2. Abra no navegador: http://localhost:8000/2.html

Nota
- Arquivos originais com animações baseadas em Canvas (em `knight/*.js` e `fruts/*.js`) foram mantidos. O novo `src/game.js` usa PIXI para facilitar animações e manipulação de sprites.

Se quiser, eu posso:
- Ajustar tamanhos/frames das sprites caso encontre diferenças visuais
- Consolidar os scripts antigos (canvas) para uso em páginas de demonstração separadas
- Adicionar controles para alternar animações do cavaleiro manualmente (idle/run/hit/death)

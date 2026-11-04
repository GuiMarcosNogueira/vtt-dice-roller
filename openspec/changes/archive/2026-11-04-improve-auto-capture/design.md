# Design

## Context

A motivação está em `proposal.md` e os requisitos em `specs/roll-capture/spec.md`. Estado anterior relevante, em `web/app/hooks/useMotionDetector.ts`:

- A cada ~60 ms o quadro era reduzido para 160x120 em cinza e comparado com o anterior, pixel a pixel, e a **média** da diferença era comparada com a sensibilidade (padrão 15).
- Um dado pequeno ocupa poucos pixels, então a média quase não muda e ele raramente passava do limite. Balançar a câmera muda todos os pixels e passava. Esse era o gatilho real das capturas.
- O envio (`onFrameCaptured`) era chamado **dentro** de `setDetectionState(prev => …)`. O React pode executar essa função mais de uma vez (sempre, em modo estrito de desenvolvimento), e cada execução enviava a imagem.
- `useCamera` iniciava a câmera sem controlar tentativas sobrepostas.

## Goals / Non-Goals

**Goals:**
- Capturar quando um dado de fato assenta na cena, e não quando a câmera ou a luz mudam.
- Um único envio por rolagem.
- Dar ao usuário uma saída total do envio automático.
- Manter a sensibilidade ajustável pelo controle que já existe.

**Non-Goals:**
- Reconhecer se há um dado na imagem (isso é trabalho do modelo de visão, e o app não roda modelo local).
- Rastrear o dado entre quadros, estimar posição ou contar dados.
- Estabilização de imagem ou compensação de movimento da câmera.
- Persistir a cena de referência entre sessões.

## Decisions

### D1: Grade de blocos 8x8 em vez de pixels
`lib/motion.ts` reduz o quadro de 160x120 a 20x15 blocos com a média de cinza de cada um. Comparar médias de bloco torna a análise imune a ruído do sensor e a deslocamentos de poucos pixels, e a pergunta passa a ser "que fração da cena mudou" (`changedRatio`), que separa um objeto pequeno de uma mudança geral.
- *Alternativa*: manter diferença por pixel e só trocar a média pela contagem de pixels. Descartada: muito sensível a ruído e a vibração pequena.
- *Alternativa*: fluxo óptico ou modelo de detecção de objetos. Descartada: custo e complexidade desproporcionais para um filtro que só precisa evitar envios inúteis.

### D2: Classificação por fração de blocos alterados
Um bloco conta como alterado quando sua média muda mais que a **sensibilidade** (o controle existente, 5 a 40, padrão 15). Com `r` a fração de blocos alterados entre quadros seguidos:
- `r < 1%` (menos de 3 blocos): cena parada;
- `1% ≤ r < 50%`: movimento localizado, ou seja, um dado;
- `r ≥ 50%`: mudança global (câmera ou luz).

Os limites ficam como constantes em `lib/motion.ts`. 1% cobre um d4 pequeno e 50% é folgado para um dado que cruza a cena sem ser confundido com a câmera.

### D3: Cena de referência
Uma cena parada, sem dado novo, é guardada como referência. Quando a cena assenta (parada por `stabilizeMs`), o detector a compara com a referência:
- diferença global → a câmera se mexeu: refaz a referência, **não captura**;
- diferença localizada (≥ 1%) → há algo novo: **captura**;
- sem diferença → voltou ao que era (dado recolhido, mão que saiu): **não captura**.

Em repouso, a referência acompanha variações lentas de luz (só é atualizada quando a cena continua igual a ela) e nunca absorve um dado que apareceu. O `resetDetector` **mantém** a referência de propósito, pois é ela que permite perceber que o dado foi recolhido.
- *Alternativa*: comparar apenas com o quadro anterior (como antes). Descartada: não distingue "chegou um dado" de "a câmera mudou de lugar e parou".

### D4: Filtros de ruído temporal
O movimento precisa se repetir por 2 quadros seguidos para virar `ROLLING` (descarta um quadro isolado, como um salto de exposição). Depois de `resetDetector`, o movimento é ignorado por 1,5 s.

### D5: Estado fora da função de atualização do React
A máquina de estados lê um `stateRef` espelhado, e o envio acontece fora de qualquer função de atualização de estado. O estado passa a `CAPTURING` **antes** do envio, de modo que nenhum quadro seguinte repita. Isso garante um envio por rolagem também em modo estrito.

### D6: Interruptor na tela principal
`autoCapture` (padrão `true`) entra em `AppSettings`, salvo com as demais configurações. Na tela principal, um botão `role="switch"` alterna o valor, passa `enabled: !showReview && autoCapture` ao detector e chama `resetDetector()` para não carregar estado de um modo para o outro. A captura manual não depende de `enabled`, então continua funcionando. O selo do vídeo mostra "Captura manual" e a dica muda de texto.
- *Alternativa*: colocar a opção no modal de configurações. Descartada: é a opção mais usada durante o jogo e esconder atrás de um modal a torna pouco prática.

### D7: Tentativas sobrepostas da câmera
Cada início ou parada de `useCamera` incrementa um contador de tentativas. Resultados de tentativas superadas (inclusive o `AbortError` do `play()`) são ignorados, e um stream que chega depois de superado é parado na hora.

## Risks / Trade-offs

- **[Os limites foram validados só com quadros sintéticos]** → Os 19 cenários do detector usam quadros gerados; ainda falta ajuste com uma câmera real (celular e webcam). A tarefa 4.2 fica aberta e os limites são constantes isoladas e o controle de sensibilidade segue disponível.
- **[Dado pequeno ou distante pode ficar abaixo de 1% dos blocos]** → Reduzir a sensibilidade (valor menor) ou aproximar a câmera; se não bastar, baixar a fração mínima.
- **[Uma mão que fica parada na cena depois da rolagem ainda é uma "mudança nova"]** → Pode gerar uma captura de uma mesa com mão. O interruptor de envio automático e a pausa de 1,5 s mitigam, mas não eliminam.
- **[Variação de luz abaixo de 50% dos blocos pode parecer movimento]** → A referência acompanha derivas lentas; mudanças bruscas parciais (sombra grande) ainda podem disparar.
- **[Câmera balançada exatamente quando um dado assenta]** → A referência é refeita e aquela rolagem não é capturada automaticamente; o botão manual cobre.

## Migration Plan

Sem migração. Configurações antigas do navegador não têm `autoCapture` e assumem `true`. Para reverter, basta voltar o `useMotionDetector` anterior e ocultar o interruptor.

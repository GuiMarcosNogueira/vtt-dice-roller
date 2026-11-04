# Proposal

## Why

A captura automática enviava imagens à IA (cada uma cobrada na conta de quem usa) em situações sem dado nenhum: qualquer balançada da câmera disparava um envio. O detector comparava a **média da imagem inteira** entre quadros, então um dado pequeno quase não alterava a média, enquanto balançar a câmera, que muda tudo, passava do limite e, ao parar, virava "rolagem". Além disso, em desenvolvimento cada captura era enviada duas vezes, e não havia como desligar o envio automático e usar só o botão.

## What Changes

- **Detecção por região, não pela média**: cada quadro vira uma grade de blocos de 8x8 pixels e o detector olha **quantos blocos mudaram**. Mudança em parte da cena é um objeto se movendo (um dado); mudança em mais da metade da cena é a câmera ou a luz, e é descartada.
- **Cena de referência**: a captura só ocorre se, depois de assentar, a cena for diferente da última cena parada. Balançar a câmera, ou recolher o dado depois da leitura, devolve a cena à referência e não dispara nada. A referência acompanha variações lentas de luz e se refaz quando a câmera muda de posição.
- **Menos disparos falsos**: o movimento precisa durar 2 quadros seguidos, e o detector ignora movimento por 1,5 s depois que o usuário confirma ou descarta uma leitura (a mão saindo da cena).
- **Um envio por rolagem**: a decisão de capturar deixa de rodar dentro da função de atualização de estado do React, que no modo de desenvolvimento executa duas vezes e duplicava o envio.
- **Interruptor "Envio automático à IA"** na tela principal, salvo no navegador. Desligado, nada é enviado sozinho e o botão **Capturar Dado Agora** continua enviando. O selo do vídeo passa a mostrar "Captura manual".
- **Correção relacionada**: a câmera mostrava um erro falso em desenvolvimento (a segunda execução do efeito interrompia o `play()` da primeira) e deixava o stream da primeira tentativa aberto.

## Capabilities

### New Capabilities

<!-- Nenhuma -->

### Modified Capabilities

- `roll-capture`: o requisito de detecção de movimento e estabilização passa a distinguir movimento local de mudança global e a usar a cena de referência, e um novo requisito permite desligar o envio automático.

## Impact

- **`web/`**: novo `app/lib/motion.ts` (análise por blocos), `app/hooks/useMotionDetector.ts` reescrito, `app/hooks/useCamera.ts` (tentativas sobrepostas), `app/page.tsx` e `app/types.ts` (configuração `autoCapture` e o interruptor), testes em `__tests__/` mantendo cobertura ≥ 95%.
- **`api/`, Foundry VTT**: sem mudanças.
- **Dados salvos**: configurações antigas do navegador não têm `autoCapture` e assumem o envio automático ligado, como antes.
- **Ordem**: altera um requisito que nenhuma outra change pendente altera (`align-specs-with-implementation` mexe em outros requisitos de `roll-capture`), então não conflita no arquivamento.

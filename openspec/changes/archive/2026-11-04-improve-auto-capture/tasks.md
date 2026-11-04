# Tasks

## 1. Detecção de movimento por região

- [x] 1.1 Criar `web/app/lib/motion.ts` com a grade de blocos 8x8 (`blockMeans`), `changedRatio`, `meanDifference` e as constantes de fração mínima e global, verificando em `__tests__/motion.test.ts` a média por bloco, a diferença entre cenas iguais, um objeto pequeno, câmera deslocada, salto de luz e o efeito do limite de sensibilidade
- [x] 1.2 Reescrever `useMotionDetector` com cena de referência, separação entre movimento local e mudança global, 2 quadros seguidos para `ROLLING` e pausa de 1,5 s depois do `resetDetector`, verificando em `__tests__/useMotionDetector.scenarios.test.tsx` os cenários: dado novo capturado, câmera balançada, balanços repetidos, salto de luz, balanço no meio da rolagem, dado que cai depois de a câmera assentar, deriva lenta de luz, dado recolhido sem captura, nova rolagem capturada, movimento durante a pausa, quadro isolado ignorado, dado já na mesa na partida, e a sensibilidade
- [x] 1.3 Mover a decisão de capturar para fora da função de atualização de estado, usando um `stateRef` e marcando `CAPTURING` antes do envio, verificando nos cenários, em modo estrito do React, que há exatamente um envio por rolagem e nenhum durante a revisão
- [x] 1.4 Remover dois testes de `__tests__/useMotionDetector.test.ts` que simulavam o dado mudando a imagem toda de uma vez (agora tratado como balanço da câmera), verificando que `npm run test:coverage` continua acima de 95%

## 2. Interruptor do envio automático

- [x] 2.1 Adicionar `autoCapture` (padrão `true`) a `AppSettings`, o interruptor `role="switch"` na tela principal, o repasse de `enabled` ao detector, o `resetDetector()` ao alternar, o selo "Captura manual" e o texto da dica, verificando em `__tests__/page-auto-capture.test.tsx`: padrão ligado, desligar e religar, persistência, configuração antiga sem o campo, e o botão manual enviando com o automático desligado
- [x] 2.2 Verificar no detector desabilitado que nenhum quadro é enviado sozinho e que o disparo manual continua enviando, em `useMotionDetector.scenarios.test.tsx`

## 3. Correção relacionada da câmera

- [x] 3.1 Controlar tentativas sobrepostas em `useCamera` (ignorar o resultado de tentativas superadas, parar streams atrasados, não marcar "transmitindo" depois de parar), verificando em `__tests__/useCamera.test.ts` cinco testes novos que falham no hook antigo e passam no corrigido

## 4. Documentação e ajuste fino

- [x] 4.1 Documentar no `README.md` o interruptor de envio automático e como a detecção funciona (movimento local, câmera balançada, referência, pausa), verificando que o texto descreve o comportamento coberto pelos cenários de teste
- [ ] 4.2 Ajustar fração mínima, fração global, quadros mínimos e pausa com uma câmera real (celular e webcam), registrando os valores finais em `lib/motion.ts`, verificando visualmente: balançar a câmera não captura, rolar um dado captura uma vez, recolher o dado não captura

## Workflow follow-up

- Arquivar esta change com `/opsx:archive` depois de concluir a tarefa 4.2.

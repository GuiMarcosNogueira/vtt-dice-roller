# Design

## Context

O monorepo possui duas aplicações principais:
- `api/`: backend em Python (FastAPI). Atualmente com 87% de cobertura combinada (linhas e branches medidos via `pytest-cov`).
- `web/`: frontend em Next.js (React 19, TypeScript). Atualmente sem infraestrutura de testes unitários configurada (0% de cobertura).

Consulte `proposal.md` para a motivação.

## Goals / Non-Goals

**Goals:**
- Elevar a cobertura combinada de linhas, branches e funções no backend (`api/`) para **pelo menos 95%** utilizando `pytest` e `pytest-cov`.
- Configurar **Vitest** no frontend (`web/`) com `@testing-library/react` e ambiente `jsdom`.
- Cobrir 100% dos hooks customizados (`useCamera`, `useMotionDetector`) e componentes (`ReviewModal`, `SettingsModal`, `RecentRolls`, `page.tsx`) com testes unitários e de integração.
- Definir thresholds estritos de cobertura nas ferramentas de execução de testes:
  - `api/`: `pytest --cov=app --cov-branch --cov-fail-under=95`
  - `web/`: `vitest --coverage` com threshold mínimo de 95% em lines, branches, functions e statements.

**Non-Goals:**
- Testes E2E complexos de interface com navegadores reais (Playwright/Cypress) em pipelines de nuvem.
- Testes de hardware físico de câmera real (utilizaremos mocks determinísticos de `MediaStream` e `CanvasRenderingContext2D`).

## Architecture & Decisions

### Decisão 1: Vitest no Frontend (em vez de Jest)
- **Rationale**: O Vitest oferece suporte nativo e ultrarrápido para TypeScript e módulos ESM modernos sem a complexidade de configuração do Babel/Jest. É amplamente compatível com React 19 e ecossistema Next.js.
- **Alternativas consideradas**:
  - *Jest*: exigiria configurações pesadas de transformações Babel/SWC para compatibilidade com ESM e Next.js 16.
  - *Playwright apenas*: excessivamente lento para testes unitários focados em 95% de cobertura de branches.

### Decisão 2: Mock Determinístico de Câmera e Canvas no JSDOM
- **Rationale**: Em ambiente de teste JSDOM, o elemento `<video>` não possui decodificador de vídeo real e `<canvas>` não renderiza pixels reais. Criaremos um módulo de setup global que simula `navigator.mediaDevices.getUserMedia`, `HTMLCanvasElement.prototype.getContext('2d')` com retorno mockado de `getImageData`, e controle de timers via `vi.useFakeTimers()` para avançar o tempo e testar cada transição da máquina de estados (`IDLE -> ROLLING -> STABILIZING -> CAPTURING`).
- **Alternativas consideradas**:
  - *Dependência de servidor WebRTC mock*: muito complexo e sujeito a flakiness.

### Decisão 3: Cobertura Estrita de Branches no Backend
- **Rationale**: O backend atual tem 12 testes passando, mas deixa sem cobertura branches de erro e exceções em `app/routes/recognition.py` (erros 422 e 502), `app/schemas/dice.py` (validações do d100), `app/services/vision_service.py` (formatações e regex de markdown) e `app/services/websocket_manager.py` (remoção de conexões que falham no envio).
- Adicionaremos suites cobrindo cada um desses branches para atingir > 95% de cobertura total e habilitar `--cov-fail-under=95`.

## Risks / Trade-offs

- **[Risco: Compatibilidade do React 19 com Testing Library]** $\rightarrow$ *Mitigação*: Utilizaremos `@testing-library/react` versão 16+ com `@testing-library/dom` e configuração do ambiente `jsdom`.
- **[Risco: Flakiness em testes de temporizadores e animações]** $\rightarrow$ *Mitigação*: Utilizar `vi.useFakeTimers()` e `vi.advanceTimersByTime()` nos testes de detecção de movimento e contagem regressiva de auto-send.

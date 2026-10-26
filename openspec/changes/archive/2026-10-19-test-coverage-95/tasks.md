# Tasks

## 1. Backend: Cobertura > 95% em Linhas e Branches

- [x] 1.1 Expandir testes de schemas e modelos em `tests/test_schemas.py` cobrindo validações de limites de d100 e hints nulos/inválidos, verificando cobertura de 100% em `app/schemas/dice.py`
- [x] 1.2 Expandir testes de `VisionService` em `tests/test_vision_service.py` para cobrir branches de formatação de imagem sem prefixo, headers sem OpenRouter e parsing de JSON em blocos markdown, verificando cobertura de 100% em `app/services/vision_service.py`
- [x] 1.3 Implementar testes de branches de erro em `tests/test_recognition_endpoint.py` cobrindo respostas HTTP 422 e 502, verificando cobertura de 100% em `app/routes/recognition.py`
- [x] 1.4 Implementar testes de desconexão e falha de socket durante broadcast em `tests/test_rolls.py`, verificando cobertura > 95% em `app/routes/rolls.py` e `app/services/websocket_manager.py`
- [x] 1.5 Configurar threshold estrito `--cov-fail-under=95` no `pytest.ini`, verificando a aprovação do comando `pytest --cov=app --cov-branch`

## 2. Frontend: Infraestrutura de Testes com Vitest

- [x] 2.1 Instalar e configurar Vitest, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react` e `@testing-library/jest-dom` em `web/package.json` e criar `web/vitest.config.ts`, verificando execução de teste smoke
- [x] 2.2 Criar utilitários de setup global (`web/__tests__/setup.ts`) com mocks para `navigator.mediaDevices`, `HTMLMediaElement` e `HTMLCanvasElement`, verificando a inicialização do ambiente de teste

## 3. Frontend: Suites de Testes Unitários dos Componentes e Hooks

- [x] 3.1 Implementar testes unitários para o hook `useCamera` cobrindo permissão concedida, permissão negada e alternância de câmera em `web/__tests__/useCamera.test.ts`, verificando aprovação com 100% de cobertura
- [x] 3.2 Implementar testes unitários para o hook `useMotionDetector` cobrindo transições de estado (`IDLE -> ROLLING -> STABILIZING -> CAPTURING`) e disparo manual em `web/__tests__/useMotionDetector.test.ts`, verificando aprovação dos cenários temporais
- [x] 3.3 Implementar testes unitários para os componentes `ReviewModal`, `SettingsModal` e `RecentRolls` em `web/__tests__/components.test.tsx`, verificando interações de usuário e contagem regressiva de auto-send
- [x] 3.4 Implementar testes de integração da página principal `page.tsx` em `web/__tests__/page.test.tsx`, cobrindo fluxos de conexão de API e confirmação de rolagem
- [x] 3.5 Configurar threshold estrito de 95% em lines, branches, functions e statements no `web/vitest.config.ts`, verificando execução bem-sucedida de `npm run test:coverage` com mais de 95% de cobertura

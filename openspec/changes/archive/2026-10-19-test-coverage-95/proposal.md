# Proposal

## Why

Atualmente, o backend (`api/`) possui 87% de cobertura combinada (faltando cenários de erro e casos limites em branches), enquanto o frontend (`web/`) não possui suite de testes unitários automatizados (0% de cobertura). Para garantir alta confiabilidade e prevenir regressões durante a evolução do sistema, é necessário estabelecer uma meta estrita de cobertura superior a 95% de linhas, branches e funções em todo o monorepo.

## What Changes

- **Backend (`api/`)**:
  - Adição de testes unitários para cobrir todos os branches de erro e validações nos endpoints de reconhecimento (`POST /api/recognize`), WebSocket e schemas do Pydantic.
  - Configuração do `pytest-cov` com threshold estrito de falha (`--cov-fail-under=95`).
- **Frontend (`web/`)**:
  - Instalação e configuração do Vitest, `@testing-library/react`, `@testing-library/jest-dom` e ambiente `jsdom`.
  - Implementação de suites de testes unitários para os hooks (`useCamera`, `useMotionDetector`) e componentes (`ReviewModal`, `SettingsModal`, `RecentRolls`).
  - Configuração de threshold de 95% em linhas, branches e funções no `vitest.config.ts`.

## Capabilities

### New Capabilities

<!-- Nenhuma nova capacidade funcional de usuário (mudança focada em infraestrutura de testes e qualidade) -->

### Modified Capabilities

<!-- Nenhuma especificação de comportamento de negócio alterada -->

## Impact

- **`api/`**: Novos arquivos de teste em `tests/` e configuração de cobertura em `pytest.ini`.
- **`web/`**: Dependências de desenvolvimento adicionadas ao `package.json` (`vitest`, `@testing-library/*`), novo arquivo `vitest.config.ts` e suites em `web/__tests__/`.

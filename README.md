# VTT Dice Roller 🎲

Aplicação para leitura óptica de dados físicos de RPG (`d4`, `d6`, `d8`, `d10`, `d12`, `d20`, `d100`) via câmera (celular ou computador) utilizando modelos de visão multimodal (OpenRouter, MGC AI Hub, Google AI Studio) com transmissão em tempo real para mesas virtuais (Foundry VTT).

---

## 📂 Estrutura do Monorepo

* **`api/`**: Backend em Python (FastAPI, WebSockets, OpenAI-compatible Vision Service).
* **`web/`**: Frontend em Next.js (mobile-first, captura de câmera, detecção de movimento via canvas).
* **`foundry-module/`**: Módulo cliente para Foundry VTT para publicação automática no chat e dados 3D.

---

## 🚀 Como Executar

### 1. Backend (`api/`)

1. Acesse o diretório da API:
   ```bash
   cd api
   ```
2. Crie ou ative o ambiente virtual:
   ```bash
   # Windows (PowerShell)
   .\.venv\Scripts\Activate.ps1
   # Linux/macOS
   source .venv/bin/activate
   ```
3. Instale as dependências:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure as variáveis de ambiente no arquivo `.env`:
   ```env
   VISION_PROVIDER=openrouter  # ou "mgc", "openai"
   VISION_BASE_URL=https://openrouter.ai/api/v1
   VISION_API_KEY=sua_chave_aqui
   VISION_MODEL=google/gemini-2.0-flash-001
   HOST=0.0.0.0
   PORT=8000
   ```
5. Inicie o servidor FastAPI:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```
   > O servidor estará rodando em `http://localhost:8000` (e no seu IP local na rede).

---

### 2. Frontend (`web/`)

1. Acesse o diretório web:
   ```bash
   cd web
   ```
2. Instale as dependências (se necessário):
   ```bash
   npm install
   ```
3. Inicie o servidor de desenvolvimento do Next.js:
   ```bash
   npm run dev
   ```
4. Abra no navegador (no computador ou no smartphone na mesma rede Wi-Fi):
   * Desktop: `http://localhost:3000`
   * Celular: `http://<IP_DO_SEU_PC>:3000` (ex: `http://192.168.1.15:3000`)
5. No ícone de engrenagem ⚙️ da interface:
   * Ajuste o **Endereço da API Backend** para o IP da sua máquina (ex: `http://192.168.1.15:8000`).

---

### 3. Módulo Foundry VTT (`foundry-module/`)

1. Copie a pasta `foundry-module/` para a pasta de dados do seu Foundry VTT:
   * Windows: `%localappdata%/FoundryVTT/Data/modules/vtt-dice-roller`
   * Linux: `~/.local/share/FoundryVTT/Data/modules/vtt-dice-roller`
2. No Foundry VTT, acesse as **Configurações do Mundo** e habilite o módulo **"VTT Dice Roller - Leitor Óptico de Dados"**.
3. Em **Configurações de Módulos**, defina o endereço WebSocket:
   * `ws://localhost:8000/ws/rolls` (ou o IP local do backend).
4. Ao rolar um dado na câmera do celular e confirmar (ou auto-enviar), a rolagem aparecerá instantaneamente no chat do Foundry VTT!

---

## 🧪 Testes Automatizados

### Backend (`api/`):
```bash
cd api
pytest --cov=app --cov-branch
```
> Cobertura atual: **100%** (enforçado limite mínimo de 95% via `pytest.ini`).

### Frontend (`web/`):
```bash
cd web
npm test
# ou para relatório com verificação estrita de cobertura (>95%):
npm run test:coverage
```
> Cobertura atual: **100% Stmts / 96% Branches / 100% Funcs / 100% Lines**.

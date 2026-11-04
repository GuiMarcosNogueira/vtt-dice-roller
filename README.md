# VTT Dice Roller 🎲

[![Continuous Integration](https://github.com/GuiMarcosNogueira/vtt-dice-roller/actions/workflows/ci.yml/badge.svg)](https://github.com/GuiMarcosNogueira/vtt-dice-roller/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/Coverage-%3E95%25-brightgreen.svg)](https://github.com/GuiMarcosNogueira/vtt-dice-roller)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-green.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.11%20%7C%203.12-blue.svg)](https://www.python.org/)

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
   VISION_MODEL=google/gemini-2.5-flash
   VISION_TIMEOUT_SECONDS=30   # tempo máximo de espera pelo provedor de visão (padrão: 30)
   API_TOKEN=                  # opcional: veja "Token de acesso" abaixo
   HOST=0.0.0.0
   PORT=8000
   ```
5. Inicie o servidor FastAPI:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```
   > O servidor estará rodando em `http://localhost:8000` (e no seu IP local na rede).

#### Token de acesso (opcional)

Por padrão qualquer dispositivo na rede pode usar a API. Para exigir um token compartilhado, defina `API_TOKEN` no `.env` e reinicie o servidor. Com o token ativo:

* `POST /api/recognize`, `POST /api/rolls`, `GET /api/rolls` exigem o header `Authorization: Bearer <token>` (resposta `401` com `detail.code = "unauthorized"` caso contrário).
* `/ws/rolls` exige `?token=<token>` na URL; sem ele a conexão é encerrada com o código `1008`.
* `/health` continua público.

Informe o **mesmo valor** em **⚙️ Configurações → Token de Acesso** no frontend e em **Configurações do Módulo → Token de Acesso** no Foundry VTT. O token trafega sem criptografia (HTTP/WS), então ele protege contra acessos casuais na rede local, não contra quem consegue ler o tráfego.

#### Provedor de IA e chave própria (custo por conta do usuário)

Cada usuário pode escolher o provedor de IA e usar a **própria API key**, então as leituras são cobradas na conta dele e não na do servidor. Em **⚙️ Configurações → Provedor de IA**:

1. Escolha o provedor: **Padrão do servidor** (usa as variáveis `VISION_*` do `.env`, sem chave do usuário), **DeepSeek** ou **OpenRouter**.
2. Cole a sua **API key**.
3. Com provedor e chave preenchidos, a lista de modelos **com suporte a imagem** é carregada; escolha um (há busca por nome) e salve.

O catálogo é fixo no backend (o usuário escolhe o provedor, nunca a URL). Para `deepseek` e `openrouter` a chave é obrigatória e o servidor **nunca** usa a chave do `.env` no lugar dela.

Endpoints (todos exigem `Authorization: Bearer <API_TOKEN>` quando o token do servidor está ativo):

```bash
# Provedores disponíveis
curl http://localhost:8000/api/providers

# Modelos com suporte a imagem (a chave vai no header, nunca na URL)
curl "http://localhost:8000/api/models?provider=deepseek" -H "X-Vision-Api-Key: sua_chave"

# Reconhecimento com provedor, modelo (opcional) e chave do usuário
curl -X POST http://localhost:8000/api/recognize \
  -H "Content-Type: application/json" -H "X-Vision-Api-Key: sua_chave" \
  -d '{"image_base64": "<imagem em base64>", "provider": "deepseek", "model": "deepseek-flash"}'
```

Sem `provider` no corpo, o reconhecimento usa o padrão do servidor, como antes. Sem `model`, vale o modelo padrão do provedor.

**Segurança:** a chave fica salva em texto no `localStorage` do navegador e é enviada ao servidor a cada leitura, sem criptografia em HTTP comum na rede local. O servidor a usa só durante a requisição: não a guarda, não a registra em logs e a remove das mensagens de erro. Prefira uma chave com **limite de gasto** configurado no provedor. Observação: a listagem de modelos do OpenRouter é pública, então uma chave errada só é detectada na hora do reconhecimento (`provider_auth_error`).

#### Erros da API

`POST /api/recognize` e `GET /api/models` respondem erros com `detail` no formato `{ "code": "...", "message": "..." }`:

| Status | `code` | Quando |
|--------|--------|--------|
| 422 | `no_die_detected` | A imagem não contém um dado legível |
| 422 | `invalid_reading` | O modelo retornou um valor incompatível com o dado |
| 422 | `unknown_provider` | O `provider` não existe no catálogo (ou não permite listar modelos) |
| 422 | `missing_api_key` | Provedor que exige chave do usuário, mas o header `X-Vision-Api-Key` não veio |
| 400 | `provider_auth_error` | O provedor recusou a chave do usuário (se for a chave do `.env` do servidor, a resposta é `upstream_error`) |
| 502 | `upstream_error` | O provedor de visão falhou ou respondeu algo ilegível |
| 504 | `upstream_timeout` | O provedor não respondeu em `VISION_TIMEOUT_SECONDS` |
| 401 | `unauthorized` | Token ausente ou inválido (quando `API_TOKEN` está definido) |

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
   * Se o servidor usa `API_TOKEN`, preencha o **Token de Acesso**.
   * Para usar a sua própria chave de IA, escolha o **Provedor de IA** (DeepSeek ou OpenRouter), cole a **API key** e selecione o modelo (veja "Provedor de IA e chave própria" acima).

> **Câmera:** os navegadores só liberam a câmera em `http://localhost` ou em HTTPS. Abrindo o front pelo IP da rede (`http://192.168.x.x:3000`), a câmera é bloqueada. No celular é preciso HTTPS (por exemplo um túnel) ou, só para testar, o flag `chrome://flags` → "Insecure origins treated as secure". Em desenvolvimento, `allowedDevOrigins` em `web/next.config.ts` já libera o servidor para a rede `192.168.*.*`.

#### Captura automática e envio à IA

Cada imagem enviada à IA é cobrada pelo provedor. Por isso há um interruptor **Envio automático à IA** na tela principal (salvo no navegador):

* **Ligado:** o app detecta o dado rolando e parando e envia uma imagem sozinho.
* **Desligado:** nada é enviado sem você tocar em **Capturar Dado Agora**; a câmera segue ativa e o selo do vídeo mostra "Captura manual".

Como a detecção decide:

* Ela olha **que parte da cena mudou**. Mudança em uma região (um dado se movendo) conta como rolagem; mudança na imagem inteira (câmera balançando, variação de luz) é descartada e não envia nada.
* Só envia quando a cena, depois de parar por cerca de 0,8 s, fica **diferente da cena parada de antes**. Pegar o dado de volta devolve a cena ao que era e não dispara um novo envio.
* Depois de confirmar ou descartar uma leitura, o app ignora movimento por 1,5 s (a mão saindo da cena).
* O controle **Sensibilidade** (⚙️) define o quanto o brilho de uma região precisa mudar para contar como movimento: valores menores detectam dados menores ou mais distantes, valores maiores ignoram mais ruído.

> Os limites da detecção foram verificados com imagens sintéticas e ainda precisam de ajuste fino com uma câmera real (veja `openspec/changes/improve-auto-capture`).

---

### 3. Módulo Foundry VTT (`foundry-module/`)

1. Copie a pasta `foundry-module/` para a pasta de dados do seu Foundry VTT:
   * Windows: `%localappdata%/FoundryVTT/Data/modules/vtt-dice-roller`
   * Linux: `~/.local/share/FoundryVTT/Data/modules/vtt-dice-roller`
2. No Foundry VTT, acesse as **Configurações do Mundo** e habilite o módulo **"VTT Dice Roller - Leitor Óptico de Dados"**.
3. Em **Configurações de Módulos**, defina o endereço WebSocket:
   * `ws://localhost:8000/ws/rolls` (ou o IP local do backend).
   * Se o servidor usa `API_TOKEN`, preencha também o **Token de Acesso** (o módulo o envia como `?token=`). Com um token recusado, o módulo avisa e para de tentar reconectar até você corrigi-lo.
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

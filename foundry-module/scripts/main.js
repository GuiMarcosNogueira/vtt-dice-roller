/**
 * VTT Dice Roller - Foundry VTT Module
 * Conecta via WebSocket ao backend FastAPI e cria ChatMessages oficiais das rolagens físicas.
 */

const MODULE_ID = "vtt-dice-roller";

class VTTDiceRollerClient {
  constructor() {
    this.socket = null;
    this.reconnectTimeout = null;
    this.isConnected = false;
  }

  init() {
    // Registra configurações do módulo nas preferências do Foundry
    game.settings.register(MODULE_ID, "serverUrl", {
      name: "Endereço WebSocket do Servidor",
      hint: "URL WebSocket da API Python (ex: ws://localhost:8000/ws/rolls ou ws://192.168.1.X:8000/ws/rolls).",
      scope: "client",
      config: true,
      type: String,
      default: "ws://localhost:8000/ws/rolls",
      onChange: () => this.connect(),
    });

    game.settings.register(MODULE_ID, "serverToken", {
      name: "Token de Acesso (opcional)",
      hint: "Mesmo valor de API_TOKEN configurado no servidor. Deixe em branco se o servidor não exigir token.",
      scope: "client",
      config: true,
      type: String,
      default: "",
      onChange: () => this.connect(),
    });

    game.settings.register(MODULE_ID, "showNotifications", {
      name: "Exibir Notificações de Conexão",
      hint: "Exibe pop-up na tela ao conectar ou perder conexão com o servidor de rolagens.",
      scope: "client",
      config: true,
      type: Boolean,
      default: true,
    });

    console.log(`${MODULE_ID} | Configurações registradas.`);
    this.connect();
  }

  buildSocketUrl(url, token) {
    if (!token) return url;
    return `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
  }

  connect() {
    const url = game.settings.get(MODULE_ID, "serverUrl");
    const token = game.settings.get(MODULE_ID, "serverToken");
    if (this.socket) {
      try {
        // Evita que o onclose do socket antigo agende uma reconexão duplicada
        this.socket.onclose = null;
        this.socket.close();
      } catch (e) {
        console.warn(`${MODULE_ID} | Erro ao fechar socket anterior:`, e);
      }
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    console.log(`${MODULE_ID} | Conectando ao servidor: ${url}`);

    try {
      this.socket = new WebSocket(this.buildSocketUrl(url, token));

      this.socket.onopen = () => {
        this.isConnected = true;
        console.log(`${MODULE_ID} | Conectado com sucesso ao hub de rolagens!`);
        if (game.settings.get(MODULE_ID, "showNotifications")) {
          ui.notifications.info("VTT Dice Roller: Conectado ao leitor de dados.");
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.handleMessage(payload);
        } catch (err) {
          console.error(`${MODULE_ID} | Erro ao processar mensagem recebida:`, err);
        }
      };

      this.socket.onclose = (event) => {
        this.isConnected = false;
        if (event.code === 1008) {
          // O servidor recusou o token: reconectar sozinho só repetiria o erro
          console.warn(`${MODULE_ID} | Token de acesso recusado pelo servidor. Corrija-o nas configurações do módulo.`);
          if (game.settings.get(MODULE_ID, "showNotifications")) {
            ui.notifications.warn("VTT Dice Roller: token de acesso recusado pelo servidor.");
          }
          return;
        }
        console.warn(`${MODULE_ID} | Conexão perdida com o servidor. Tentando reconectar em 5 segundos...`);
        this.reconnectTimeout = setTimeout(() => this.connect(), 5000);
      };

      this.socket.onerror = (err) => {
        console.error(`${MODULE_ID} | Erro de conexão WebSocket:`, err);
      };
    } catch (err) {
      console.error(`${MODULE_ID} | Falha ao instanciar WebSocket:`, err);
      this.reconnectTimeout = setTimeout(() => this.connect(), 5000);
    }
  }

  async handleMessage(payload) {
    if (!payload || payload.event !== "dice_roll") return;

    const data = payload.data;
    console.log(`${MODULE_ID} | Nova rolagem recebida da câmera:`, data);

    const dieType = data.die_type; // "d20", "d6", etc.
    const rollValue = data.value;  // ex: 18
    const playerName = data.player_name || "Jogador";

    // Encontra o usuário do Foundry correspondente ou utiliza o atual
    const matchingUser = game.users.find(
      (u) => u.name.toLowerCase() === playerName.toLowerCase()
    ) || game.user;

    // Se o usuário atual não for o dono nem o GM, evita duplicar mensagem na mesa
    if (!game.user.isGM && game.user.id !== matchingUser.id) {
      return;
    }

    await this.postRollToChat(dieType, rollValue, matchingUser);
  }

  /**
   * Monta uma rolagem já avaliada com o valor lido pela câmera, a partir de dados
   * serializados (o mesmo formato que o Foundry usa para restaurar rolagens do chat).
   * Evita avaliar uma rolagem aleatória e sobrescrever campos internos.
   */
  buildEvaluatedRoll(dieType, rollValue) {
    const faces = parseInt(dieType.slice(1), 10);
    return Roll.fromData({
      class: "Roll",
      formula: `1d${faces}`,
      options: {},
      evaluated: true,
      total: rollValue,
      terms: [
        {
          class: "Die",
          number: 1,
          faces,
          modifiers: [],
          options: {},
          evaluated: true,
          results: [{ result: rollValue, active: true }],
        },
      ],
    });
  }

  async postRollToChat(dieType, rollValue, user) {
    const isCritical = (dieType === "d20" && rollValue === 20);
    const isFumble = (dieType === "d20" && rollValue === 1);

    const content = `
      <div class="vtt-dice-roller-card">
        <div class="dice-header">
          <span class="dice-icon">🎲</span>
          <span class="dice-tag">${dieType.toUpperCase()}</span>
          <span class="dice-source">Câmera Óptica</span>
        </div>
        <div class="dice-result ${isCritical ? 'critical' : ''} ${isFumble ? 'fumble' : ''}">
          ${rollValue}
        </div>
        <div class="dice-footer">
          Rolado fisicamente por <strong>${user.name}</strong>
        </div>
      </div>
    `;

    // Cria ChatMessage nativo no Foundry VTT
    await ChatMessage.create({
      user: user.id,
      speaker: ChatMessage.getSpeaker({ user: user }),
      content: content,
      flavor: `Rolagem de ${dieType.toUpperCase()} via câmera física`,
      sound: CONFIG.sounds.dice,
    });

    // Se o módulo "Dice So Nice!" estiver instalado e ativo, aciona animação 3D
    if (game.dice3d) {
      try {
        game.dice3d.showForRoll(this.buildEvaluatedRoll(dieType, rollValue), user, true);
      } catch (e) {
        console.warn(`${MODULE_ID} | Não foi possível disparar animação 3D:`, e);
      }
    }
  }
}

// Inicializa o cliente quando o Foundry estiver pronto
Hooks.once("ready", () => {
  window.vttDiceRoller = new VTTDiceRollerClient();
  window.vttDiceRoller.init();
});

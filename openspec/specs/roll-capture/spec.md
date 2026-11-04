# roll-capture Specification

## Purpose

Permite que o usuário capture imagens de dados rolados através da câmera do celular ou desktop com detecção automática de movimento e opção de revisão manual.

## Requirements

### Requirement: Acesso à câmera do dispositivo
O sistema SHALL solicitar acesso ao fluxo de vídeo da câmera do dispositivo utilizando as APIs do navegador, priorizando a câmera traseira (`environment`) em dispositivos móveis.

#### Scenario: Permissão de câmera concedida
- **WHEN** o usuário abre a aplicação no navegador e autoriza o uso da câmera
- **THEN** o sistema exibe o preview do fluxo de vídeo em tempo real na interface

#### Scenario: Câmera indisponível ou permissão negada
- **WHEN** o usuário nega a permissão de câmera ou nenhum dispositivo de captura é encontrado
- **THEN** o sistema SHALL exibir uma mensagem clara de erro informando a necessidade da câmera e oferecendo opção de tentar novamente

### Requirement: Detecção de movimento e estabilização
O sistema SHALL analisar quadros consecutivos em um canvas leve, distinguindo movimento localizado (um dado) de mudança global (câmera ou iluminação), e SHALL acionar a análise automática uma única vez, somente quando a cena assentar diferente da cena de referência.

#### Scenario: Ciclo de rolagem e estabilização
- **WHEN** uma rolagem de dados causa movimento localizado seguido de estabilidade por no mínimo 800ms, e a cena parada é diferente da cena de referência
- **THEN** o sistema SHALL congelar um quadro de alta resolução e acionar uma única vez a análise de reconhecimento

#### Scenario: Câmera balançada
- **WHEN** a maior parte da imagem muda de uma só vez porque a câmera se mexeu
- **THEN** o sistema SHALL descartar o movimento em andamento, refazer a cena de referência e SHALL NOT acionar a análise

#### Scenario: Variação de iluminação
- **WHEN** a imagem inteira clareia ou escurece de uma só vez
- **THEN** o sistema SHALL tratar a mudança como global e SHALL NOT acionar a análise

#### Scenario: Dado recolhido depois da leitura
- **WHEN** o usuário pega o dado de volta e a cena parada volta a ser igual à cena de referência
- **THEN** o sistema SHALL NOT acionar a análise

#### Scenario: Pausa depois da revisão
- **WHEN** o usuário confirma ou descarta uma leitura
- **THEN** o sistema SHALL ignorar movimento por 1,5 segundos, para que a mão saindo da cena não dispare uma nova análise

#### Scenario: Ajuste de sensibilidade
- **WHEN** o usuário aumenta a sensibilidade nas configurações
- **THEN** o sistema SHALL passar a considerar movimento mudanças de brilho menores na imagem

### Requirement: Disparo manual e fallback
O sistema SHALL disponibilizar um controle manual de captura que permite ao usuário forçar o registro do quadro a qualquer momento, independente da detecção automática.

#### Scenario: Captura manual pelo usuário
- **WHEN** o usuário aciona o botão de captura manual na interface
- **THEN** o sistema SHALL capturar imediatamente o quadro atual da câmera e encaminhá-lo para reconhecimento

### Requirement: Revisão e ajuste do resultado
O sistema SHALL exibir o resultado retornado pelo reconhecimento (tipo de dado e valor) junto ao quadro capturado, permitindo que o usuário altere o valor antes da confirmação final.

#### Scenario: Ajuste de valor pelo usuário
- **WHEN** o usuário toca no resultado exibido e seleciona um valor corrigido
- **THEN** o sistema SHALL atualizar o valor da rolagem com a entrada manual antes de transmiti-la para o VTT

#### Scenario: Nenhum dado detectado
- **WHEN** o reconhecimento retorna o código `no_die_detected`
- **THEN** o sistema SHALL exibir uma mensagem informando que nenhum dado foi identificado na imagem, sugerindo nova captura, e SHALL manter a seleção manual de tipo e valor disponível

#### Scenario: Falha ou timeout do reconhecimento
- **WHEN** o reconhecimento retorna `upstream_error`, `upstream_timeout` ou o backend está inacessível
- **THEN** o sistema SHALL exibir uma mensagem que distingue a falha do serviço de IA de um dado não detectado e SHALL manter a seleção manual disponível

### Requirement: Envio de credencial configurada
O sistema SHALL permitir que o usuário informe um token de acesso nas configurações da aplicação, persistido localmente, e SHALL enviá-lo em todas as requisições ao backend quando estiver preenchido.

#### Scenario: Token preenchido nas configurações
- **WHEN** o usuário salva um token no painel de configurações e realiza uma captura
- **THEN** o sistema SHALL enviar o header `Authorization: Bearer <token>` nas requisições de reconhecimento e de envio da rolagem

#### Scenario: Backend rejeita o token
- **WHEN** o backend responde HTTP 401 a uma requisição
- **THEN** o sistema SHALL informar ao usuário que o token é inválido ou está ausente e indicar o painel de configurações para corrigi-lo

### Requirement: Desligar o envio automático
O sistema SHALL oferecer na tela principal um controle para ligar e desligar o envio automático à IA, SHALL manter a escolha neste navegador e SHALL manter o botão de captura manual funcionando nos dois estados.

#### Scenario: Envio automático desligado
- **WHEN** o usuário desliga o envio automático e o dado rola e para na cena
- **THEN** o sistema SHALL NOT enviar nenhuma imagem para reconhecimento sem uma ação do usuário

#### Scenario: Captura manual com o envio automático desligado
- **WHEN** o envio automático está desligado e o usuário aciona o botão de captura manual
- **THEN** o sistema SHALL capturar o quadro atual e enviá-lo para reconhecimento

#### Scenario: Escolha preservada
- **WHEN** o usuário recarrega a aplicação depois de ligar ou desligar o envio automático
- **THEN** o sistema SHALL manter o estado escolhido, e SHALL tratar como ligado quem nunca fez essa escolha

#### Scenario: Indicação do modo manual
- **WHEN** o envio automático está desligado
- **THEN** o sistema SHALL indicar na interface que a captura é manual e que a imagem só é enviada ao acionar o botão

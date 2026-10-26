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
O sistema SHALL monitorar variações de pixels entre quadros consecutivos em um canvas leve para detectar quando o dado entra em movimento e quando atinge o repouso estático.

#### Scenario: Ciclo de rolagem e estabilização
- **WHEN** uma rolagem de dados causa variação significativa de pixels seguida por estabilidade de no mínimo 800ms
- **THEN** o sistema SHALL congelar um quadro de alta resolução e acionar automaticamente a análise de reconhecimento

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

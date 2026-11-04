# Spec Delta

## ADDED Requirements

### Requirement: Envio de credencial configurada
O sistema SHALL permitir que o usuário informe um token de acesso nas configurações da aplicação, persistido localmente, e SHALL enviá-lo em todas as requisições ao backend quando estiver preenchido.

#### Scenario: Token preenchido nas configurações
- **WHEN** o usuário salva um token no painel de configurações e realiza uma captura
- **THEN** o sistema SHALL enviar o header `Authorization: Bearer <token>` nas requisições de reconhecimento e de envio da rolagem

#### Scenario: Backend rejeita o token
- **WHEN** o backend responde HTTP 401 a uma requisição
- **THEN** o sistema SHALL informar ao usuário que o token é inválido ou está ausente e indicar o painel de configurações para corrigi-lo

## MODIFIED Requirements

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

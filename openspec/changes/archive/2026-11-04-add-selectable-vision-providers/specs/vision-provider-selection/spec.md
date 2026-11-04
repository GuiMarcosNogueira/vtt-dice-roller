# Spec Delta

## Purpose

Permite que cada usuário escolha o provedor de IA de visão, informe a própria chave de API e selecione um modelo com suporte a imagem, de modo que o custo das leituras seja pago por quem as faz.

## ADDED Requirements

### Requirement: Catálogo fixo de provedores
O sistema SHALL expor um catálogo fixo de provedores de visão contendo `server` (padrão do servidor), `deepseek` e `openrouter`, cada um com identificador, nome e modelo padrão. O sistema SHALL NOT aceitar URL de provedor informada pelo usuário.

#### Scenario: Listagem de provedores
- **WHEN** um cliente consulta a lista de provedores
- **THEN** o sistema SHALL retornar `server`, `deepseek` e `openrouter` com `id`, `name`, `default_model` e um indicador de que o provedor exige chave do usuário (`requires_user_key`), verdadeiro para `deepseek` e `openrouter` e falso para `server`

#### Scenario: Provedor desconhecido
- **WHEN** uma requisição de reconhecimento ou de listagem de modelos informa um `provider` fora do catálogo
- **THEN** o sistema SHALL retornar HTTP 422 com `detail.code` igual a `unknown_provider` e SHALL NOT contatar nenhum serviço externo

### Requirement: Listagem de modelos com suporte a imagem
O sistema SHALL consultar o provedor escolhido com a chave do usuário e retornar apenas os modelos que aceitam imagem como entrada, cada um com `id` e `name`.

#### Scenario: Modelos do DeepSeek
- **WHEN** o usuário consulta os modelos de `deepseek` com uma chave válida
- **THEN** o sistema SHALL retornar somente os modelos cuja lista de modalidades de entrada inclui imagem

#### Scenario: Modelos do OpenRouter
- **WHEN** o usuário consulta os modelos de `openrouter` com uma chave válida
- **THEN** o sistema SHALL retornar somente os modelos cuja lista de modalidades de entrada inclui imagem

#### Scenario: Modelo sem informação de modalidade
- **WHEN** o provedor retorna um modelo sem informação de modalidades de entrada
- **THEN** o sistema SHALL incluí-lo na lista, e SHALL excluir apenas os modelos que declaram explicitamente não aceitar imagem

#### Scenario: Chave ausente
- **WHEN** a consulta de modelos de um provedor que exige chave chega sem a chave do usuário
- **THEN** o sistema SHALL retornar HTTP 422 com `detail.code` igual a `missing_api_key`

#### Scenario: Chave recusada pelo provedor
- **WHEN** o provedor rejeita a chave informada (resposta HTTP 401 ou 403)
- **THEN** o sistema SHALL retornar HTTP 400 com `detail.code` igual a `provider_auth_error`

#### Scenario: Falha ou timeout do provedor
- **WHEN** o provedor falha, retorna uma resposta ilegível ou não responde no tempo limite
- **THEN** o sistema SHALL retornar HTTP 502 com `detail.code` `upstream_error` ou HTTP 504 com `detail.code` `upstream_timeout`, respectivamente

#### Scenario: Provedor sem listagem por chave do usuário
- **WHEN** a listagem de modelos é pedida para o provedor `server`
- **THEN** o sistema SHALL retornar HTTP 422 com `detail.code` igual a `unknown_provider`

### Requirement: Sigilo da chave de API do usuário
O sistema SHALL usar a chave de API do usuário apenas durante a requisição que a recebeu e SHALL NOT armazená-la, registrá-la em logs nem incluí-la em respostas ou mensagens de erro.

#### Scenario: Provedor ecoa a chave na mensagem de erro
- **WHEN** o provedor retorna um erro cuja mensagem contém a chave do usuário
- **THEN** a resposta do sistema SHALL substituir a chave por um marcador e SHALL NOT conter o valor original

#### Scenario: Chave não persiste entre requisições
- **WHEN** uma requisição com chave do usuário termina e outra chega sem chave para um provedor que a exige
- **THEN** o sistema SHALL retornar HTTP 422 com `detail.code` igual a `missing_api_key`

### Requirement: Seleção de provedor, chave e modelo no frontend
O sistema SHALL oferecer nas configurações do frontend um seletor de provedor, um campo de chave de API mascarado e um seletor de modelo com busca, carregando a lista de modelos automaticamente quando houver provedor com chave do usuário e chave preenchida.

#### Scenario: Carregamento automático dos modelos
- **WHEN** o usuário escolhe `deepseek` ou `openrouter` e preenche a chave
- **THEN** o sistema SHALL carregar a lista de modelos com suporte a imagem, exibir um indicador de carregamento e pré-selecionar o modelo padrão do provedor quando ele estiver na lista

#### Scenario: Padrão do servidor
- **WHEN** o usuário escolhe `server`
- **THEN** o sistema SHALL ocultar os campos de chave e de modelo e SHALL NOT consultar a lista de modelos

#### Scenario: Erro ao carregar modelos
- **WHEN** a listagem de modelos falha (chave recusada, provedor indisponível ou timeout)
- **THEN** o sistema SHALL exibir uma mensagem específica para o erro, SHALL oferecer uma ação para tentar novamente e SHALL manter o salvamento das demais configurações disponível

#### Scenario: Persistência e uso da escolha
- **WHEN** o usuário salva as configurações com provedor, chave e modelo
- **THEN** o sistema SHALL manter a escolha neste navegador e SHALL enviar provedor, modelo e chave em cada reconhecimento seguinte

#### Scenario: Mensagens de erro de reconhecimento
- **WHEN** o reconhecimento retorna `missing_api_key`, `provider_auth_error` ou `unknown_provider`
- **THEN** a tela de revisão SHALL exibir uma mensagem específica orientando a corrigir o provedor ou a chave nas configurações, mantendo a seleção manual disponível

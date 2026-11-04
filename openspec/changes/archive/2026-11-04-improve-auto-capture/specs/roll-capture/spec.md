# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

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

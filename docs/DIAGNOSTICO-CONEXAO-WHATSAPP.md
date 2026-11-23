# Diagnóstico da conexão WhatsApp — 30/10/2026

## Conclusão

Não foi encontrado um prazo programado para encerrar uma sessão WhatsApp já conectada. O sistema tenta manter a sessão e reconectar após falhas temporárias, mas há defeitos no ciclo de conexão que podem impedir a recuperação ou mostrar uma situação incorreta no painel.

Foram reproduzidos quatro comportamentos usando o código TypeScript atual com banco, sockets e temporizadores simulados. Isso confirma os defeitos do código; não identifica, por si só, qual deles ocorreu na conta do usuário. Não foram encontrados registros operacionais das quedas relatadas nesta análise, e não foi realizado teste prolongado com uma conta real.

Nenhum arquivo de produção, credencial ou sessão foi alterado. Foram adicionados somente este relatório e um diagnóstico executável em `.security-work/whatsapp-connection-diagnostic.cjs`.

## Achados confirmados

### 1. Uma falha na inicialização pode interromper as tentativas de recuperação

Em `agilizap/backend/src/services/WbotServices/StartWhatsAppSession.ts:13`, o status muda para `OPENING`. Se `initWASocket` lançar um erro, o `catch` na linha 29 apenas registra o erro; não agenda nova tentativa e não o propaga.

O temporizador em `agilizap/backend/src/libs/wbot.ts:151` chama esse serviço uma vez. Sua própria captura também apenas registra erros. Se essa tentativa falhar antes de existir um socket capaz de emitir outro evento de fechamento, não há nova tentativa garantida.

Reprodução: simular erro em `initWASocket`, chamar o serviço real e verificar que ele retorna normalmente, deixa `OPENING` e não cria temporizador de reconexão.

### 2. O botão de reiniciar conexões pode deixá-las paradas

O botão em `agilizap/frontend/src/pages/Connections/index.js:724` chama `/whatsapp-restart/`, que chega a `restartWbot` em `agilizap/backend/src/libs/wbot.ts:130`.

Essa função somente executa `removeWbot(id, false)` para cada conexão. A remoção cancela a reconexão pendente e remove o listener de `connection.update` antes de fechar o socket. Não há chamada para iniciar novamente.

Reprodução: inicializar uma sessão simulada, chamar `restartWbot` e confirmar socket fechado, ausência de sessão registrada e nenhum temporizador de reconexão.

Isso depende do acionamento da rota; não foi encontrado um agendamento periódico que a chame.

### 3. Inicializações simultâneas criam sockets concorrentes para a mesma conexão

Em `agilizap/backend/src/libs/wbot.ts:182`, a inicialização não possui proteção contra chamadas concorrentes. Duas chamadas podem passar pela remoção da sessão anterior antes de qualquer uma registrar o novo socket. Ambas criam sockets, e o segundo registro substitui o primeiro no array, deixando o primeiro socket fora do controle desse array.

Os caminhos de iniciar e de sincronizar na tela de conexões chamam a mesma inicialização. Trata-se de risco condicionado a chamadas simultâneas; não há evidência de que elas ocorreram na conta analisada.

Reprodução: chamar `initWASocket` duas vezes com `Promise.all`; são criados dois sockets abertos para o mesmo ID.

Uma sessão concorrente é uma hipótese para eventos de substituição de conexão, mas a reprodução não simula a resposta dos servidores do WhatsApp e não prova que produzirá o código 440.

### 4. O status pode continuar CONNECTED com o socket desconectado

O caminho de falha temporária em `agilizap/backend/src/libs/wbot.ts:391` remove o socket e agenda reconexão, mas não atualiza o status no banco nem informa a transição ao painel. O status somente muda para `OPENING` quando a tentativa seguinte começa.

A rota de saúde WhatsApp usa o status do banco. O alerta operacional de WhatsApp desconectado consulta apenas `DISCONNECTED`, deixando de detectar os casos presos em `OPENING` e os casos indevidamente marcados como `CONNECTED`.

Reprodução: emitir fechamento temporário com código 408 em uma sessão simulada; o socket é removido e há temporizador, mas o status continua `CONNECTED`.

## O que já está previsto corretamente

- Credenciais em arquivos via `useMultiFileAuthState`, com salvamento em `creds.update`: `agilizap/backend/src/helpers/authState.ts:61` e `agilizap/backend/src/libs/wbot.ts:445`.
- Volume Docker persistente em `/app/sessions`: `docker-compose.yml`. Isso preserva a sessão entre recriações do container quando o volume é mantido; não valida o estado ou a integridade dos arquivos existentes no ambiente em uso.
- Retomada no início do backend quando o status permite ou existem credenciais: `StartAllWhatsAppsSessions.ts`.
- Reconexão com espera crescente de aproximadamente 2 a 31 segundos para falhas temporárias; reinicialização após um segundo para código 515.
- Keepalive a cada 25 segundos. Esse intervalo é uma checagem de atividade, não uma duração máxima da sessão.

## Situações que encerram ou interrompem a conexão

Em `wbot.ts`, os códigos 401, 403 e 500 levam à limpeza de credenciais e exigem intervenção para conectar novamente. O código 440 interrompe a reconexão automática e preserva os arquivos. Um código 403 isoladamente não comprova banimento; o sistema o trata como acesso proibido.

Existe limite de cinco QR codes gerados sem concluir o pareamento. Esse limite se aplica à etapa de conectar, não a uma sessão já estabelecida.

Em `agilizap/backend/src/server.ts:41`, uma exceção ou rejeição não tratada encerra o processo em produção. Isso derruba todas as sessões daquele processo. O Compose prevê reinício do container, mas uma falha na inicialização das sessões ainda pode cair no achado 1. É necessário verificar os registros para saber se isso aconteceu.

## Limites dos testes anteriores

Os testes REL-04 em `agilizap/backend/tests/reliability/run.cjs` atualizam manualmente campos de desconexão e conferem sua persistência. Eles não executam os eventos reais de `wbot.ts`, as tentativas automáticas nem uma conexão prolongada. Portanto, os resultados anteriores desses testes não comprovam estabilidade contínua da conexão.

## Validação executada nesta análise

Comando, a partir da raiz do projeto:

```powershell
node .security-work/whatsapp-connection-diagnostic.cjs
```

Resultado: quatro verificações isoladas aprovadas, confirmando os quatro comportamentos descritos. O diagnóstico carrega os arquivos reais com dependências simuladas e não acessa WhatsApp, banco, rede ou arquivos de sessão.

## Próxima investigação e correções indicadas

Primeiro, corrigir a repetição de tentativas quando a inicialização falha, impedir inicializações concorrentes por ID, fazer o reinício realmente iniciar novamente e atualizar o status ao cair. Registrar motivo, horário e tentativa em cada transição; há campos de observabilidade no modelo que o fluxo atual não preenche.

Para determinar a causa das quedas relatadas, correlacionar o horário da queda com `Connection closed with status code`, `Temporary disconnect`, `initWASocket error`, `Error starting WhatsApp session`, `process_critical_error` e os reinícios do backend. Sem esses registros, falha de rede, encerramento remoto, concorrência e erro do processo continuam hipóteses.

Após as correções, acompanhar uma sessão real por 24–48 horas como verificação inicial, incluindo uma interrupção controlada de rede e um reinício do backend. Conferir recuperação sem QR novo, atualização do painel e envio/recebimento após recuperar. Esse período fornece evidência inicial; não garante conexão permanente.

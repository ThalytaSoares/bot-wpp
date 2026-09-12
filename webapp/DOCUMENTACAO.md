# Documentacao da solucao - Hub Afiliados Shopee

Este documento explica a logica do projeto, como o codigo esta organizado e qual foi a estrategia usada para buscar ofertas, montar posts e enviar disparos para grupos do WhatsApp.

## Objetivo do projeto

O sistema foi criado para facilitar a rotina de um hub de afiliados da Shopee. A aplicacao permite:

- Buscar produtos/ofertas na API de afiliados da Shopee por palavra-chave.
- Aplicar filtros de qualidade, como nota minima.
- Montar um ranking das melhores ofertas.
- Gerar um texto de post pronto para WhatsApp.
- Editar o post antes de enviar manualmente.
- Conectar o WhatsApp via QR Code.
- Selecionar grupos de WhatsApp diretamente pela tela.
- Enviar ofertas manualmente.
- Criar agendamentos de disparo automatico.
- Registrar historico das ofertas enviadas.

## Estrutura principal

O projeto roda dentro da pasta `webapp`.

Arquivos principais:

- `server.js`: servidor HTTP, rotas da API e entrega dos arquivos da tela.
- `public/index.html`: estrutura visual da aplicacao.
- `public/app.js`: logica da interface, botoes, abas, chamadas para API e renderizacao dos resultados.
- `public/styles.css`: estilos da tela.
- `shopee.js`: integracao com a API da Shopee.
- `ranking.js`: filtros, pontuacao das ofertas e geracao do texto do post.
- `whatsapp.js`: conexao com WhatsApp via Baileys, QR Code, listagem de grupos e envio de mensagens.
- `targets.js`: leitura e salvamento dos grupos selecionados.
- `scheduler.js`: agendamentos, execucao automatica, disparo manual de agendamento e historico.
- `config.js`: variaveis de ambiente e configuracoes gerais.

## Como a aplicacao roda

A aplicacao usa Node.js puro com modulos ES.

Comandos:

```bash
npm install
npm start
```

No Render, a configuracao usada e:

- Root Directory: `webapp`
- Build Command: `npm install`
- Start Command: `npm start`

O servidor usa a porta definida pelo Render na variavel `PORT`. Localmente, se `PORT` nao existir, usa `3000`.

## Variaveis de ambiente

As principais variaveis sao:

- `SHOPEE_APP_ID`: ID da aplicacao de afiliados da Shopee.
- `SHOPEE_SECRET`: segredo usado para assinar as chamadas da API da Shopee.
- `APP_TIMEZONE`: fuso horario da aplicacao. O padrao e `America/Sao_Paulo`.
- `WHATSAPP_AUTH_DIR`: pasta onde a sessao do WhatsApp fica salva. Padrao: `auth_info_baileys`.
- `WHATSAPP_TARGETS_FILE`: arquivo onde os grupos selecionados ficam salvos. Padrao: `whatsapp-targets.json`.
- `SCHEDULES_FILE`: arquivo dos agendamentos. Padrao: `schedules.json`.
- `DISPATCH_HISTORY_FILE`: arquivo do historico de disparos. Padrao: `dispatch-history.json`.

Hoje os grupos nao precisam mais ser cadastrados manualmente no Render. Eles podem ser selecionados pela tela, na aba WhatsApp.

## Tela e funcionalidades

A tela foi organizada em abas:

### Manual

Usada para buscar ofertas sob demanda.

Fluxo:

1. A pessoa digita uma palavra-chave.
2. Define nota minima e limite.
3. Clica em `Buscar Top`.
4. O frontend chama a rota `GET /api/offers`.
5. O servidor busca produtos na Shopee.
6. O ranking filtra e ordena as ofertas.
7. A tela mostra as ofertas encontradas.
8. Ao selecionar uma oferta, o texto do post aparece no campo editavel.
9. A pessoa pode editar o texto antes de clicar em `Enviar`.

O botao `Enviar Top 3 agora` envia as primeiras 3 ofertas da busca manual atual para os grupos salvos.

### Agendamentos

Usada para configurar disparos automaticos.

Cada linha de agendamento possui:

- Ativo: define se o agendamento roda ou nao.
- Horario: horario desejado no fuso de Brasilia.
- Busca: texto que sera enviado para a API da Shopee.
- Qtd.: quantidade de ofertas que devem ser disparadas.
- Disparar agora: executa aquele agendamento imediatamente para teste.

Importante: o campo `Busca` da aba Manual e o campo `Busca` da aba Agendamentos sao independentes.

O que vale para disparo agendado e o texto salvo na aba Agendamentos. Por exemplo:

- `10:00` -> `achadinhos shopee dentistas`
- `20:00` -> `ofertas do dia dentistas`

Se a busca do agendamento for alterada, e necessario clicar em `Salvar agenda`.

### WhatsApp

Usada para conectar a conta e selecionar os destinos.

Fluxo:

1. Clicar em `Conectar`.
2. Escanear o QR Code com o WhatsApp.
3. Clicar em `Atualizar` para listar os grupos.
4. Selecionar os grupos desejados.
5. Clicar em `Salvar`.

Os envios manuais e automaticos usam os grupos salvos nessa etapa.

## Integracao com a Shopee

O arquivo `shopee.js` monta uma consulta GraphQL para o endpoint:

```text
https://open-api.affiliate.shopee.com.br/graphql
```

A busca recebe principalmente:

- `keyword`: palavra-chave digitada ou salva no agendamento.
- `listType`: tipo de lista enviado para a API. Atualmente o padrao usado e `0`.

A requisicao e assinada usando:

- `SHOPEE_APP_ID`
- timestamp atual
- corpo da requisicao
- `SHOPEE_SECRET`

Se as credenciais nao estiverem configuradas, o sistema retorna erro pedindo `SHOPEE_APP_ID` e `SHOPEE_SECRET`.

## Logica do ranking

A logica fica em `ranking.js`.

Primeiro, as ofertas sao filtradas por nota minima. Atualmente a tela e os agendamentos usam nota minima `4.0`.

Depois, cada oferta recebe um score com base em:

- quantidade de vendas;
- nota do produto;
- taxa de comissao.

O sistema ordena as ofertas pelo score e retorna apenas a quantidade definida no limite.

Isso significa que o limite nao garante que a Shopee sempre retornara aquela quantidade final. Exemplo: se o limite for 20, mas apenas 2 produtos passarem pelos filtros, a tela mostrara 2.

## Geracao do post

O post e montado em `ranking.js`, na funcao `gerarPost`.

O texto inclui:

- chamada principal;
- nome do produto;
- nota;
- preco;
- loja;
- link de afiliado.

Na aba Manual, esse texto aparece em um campo editavel antes do envio. Assim e possivel acrescentar, apagar ou adaptar a mensagem antes de disparar.

## Integracao com WhatsApp

A integracao usa a biblioteca gratuita `@whiskeysockets/baileys`.

Essa abordagem nao usa API oficial paga do WhatsApp. Ela conecta uma sessao de WhatsApp Web por QR Code.

Pontos importantes:

- A conexao depende da sessao do WhatsApp continuar valida.
- Se a sessao cair, e necessario escanear o QR Code novamente.
- Como nao e API oficial, pode haver instabilidade ou mudancas futuras no funcionamento.
- E importante usar com responsabilidade para evitar bloqueios ou limitacoes pelo WhatsApp.

O arquivo `whatsapp.js` cuida de:

- iniciar a conexao;
- gerar QR Code;
- informar status da conexao;
- listar grupos;
- enviar mensagens para os destinos salvos.

## Grupos de destino

Os grupos selecionados sao salvos pelo arquivo `targets.js`.

O arquivo de armazenamento padrao e:

```text
whatsapp-targets.json
```

Quando o usuario seleciona grupos na tela e clica em `Salvar`, o sistema grava os IDs desses grupos. Depois, todo envio usa essa lista.

## Agendamentos automaticos

A logica fica em `scheduler.js`.

O sistema possui dois agendamentos padrao:

- `10:00` com busca `achadinhos shopee dentistas`
- `20:00` com busca `ofertas do dia dentistas`

Cada agendamento possui:

- `id`
- `enabled`
- `time`
- `keyword`
- `limit`
- `minRating`
- `lastRunDate`

Quando a verificacao roda, o sistema:

1. Le os agendamentos salvos.
2. Confere o horario atual no fuso `America/Sao_Paulo`.
3. Verifica se algum agendamento esta dentro da janela de execucao.
4. Busca as ofertas na Shopee usando o campo `keyword`.
5. Filtra e monta o Top.
6. Envia os posts para os grupos salvos.
7. Registra o resultado no historico.
8. Marca `lastRunDate` para evitar envio duplicado no mesmo dia.

A janela de execucao aceita ate 15 minutos de atraso. Isso ajuda quando o Render demora alguns instantes para acordar.

## Cron-job.org

Como o Render gratuito pode dormir quando fica sem acessos, foi usado o cron-job.org como "despertador" externo.

O cron-job.org deve chamar:

```text
https://hub-afiliados-shopee.onrender.com/api/schedules/check
```

E recomendado criar chamadas proximas aos horarios dos agendamentos, por exemplo:

- 10:02
- 20:02

Quando esse endpoint e chamado, ele verifica se existe algum agendamento que deve rodar naquele momento.

## Disparo manual de agendamento

O botao `Disparar agora`, na aba Agendamentos, chama a rota:

```text
POST /api/schedules/run
```

Esse botao serve para testar um agendamento sem esperar o horario e sem mexer no cron-job.org.

Ele usa os dados salvos daquele agendamento:

- texto de busca;
- limite;
- nota minima;
- grupos salvos.

Se nenhuma oferta passar pelos filtros, o sistema registra uma falha no historico com a mensagem indicando qual busca foi usada.

## Historico de envios

O historico fica em `dispatch-history.json`.

Ele registra:

- horario da execucao;
- agendamento executado;
- modo: automatico ou manual;
- busca usada;
- quantidade encontrada;
- quantidade enviada;
- destinos;
- ofertas enviadas;
- erros, quando houver.

A tela de Agendamentos mostra esse historico para dar visibilidade do que foi enviado as 10h, as 20h ou em testes manuais.

## Estrategia da solucao

A estrategia escolhida foi manter a operacao simples para uma pessoa nao tecnica:

- As configuracoes sensiveis ficam no Render.
- A busca manual fica na tela.
- Os grupos sao escolhidos pela propria interface.
- Os agendamentos sao editaveis na interface.
- O cron-job.org apenas chama um link para acordar/verificar o sistema.
- O usuario nao precisa editar codigo nem variaveis de ambiente para trocar grupos ou palavras-chave.

Essa abordagem reduz a dependencia de manutencao tecnica no dia a dia.

## Limitacoes e cuidados

- O Render gratuito pode dormir, por isso o cron-job.org e importante.
- Os arquivos `schedules.json`, `whatsapp-targets.json` e `dispatch-history.json` ficam no ambiente do servidor. Em ambientes gratuitos, dados em disco podem ser perdidos se o servico for recriado.
- Para uma solucao mais robusta no futuro, o ideal seria salvar agendamentos, grupos e historico em um banco, como PostgreSQL.
- A biblioteca do WhatsApp nao e a API oficial. Ela funciona como sessao de WhatsApp Web.
- O WhatsApp pode desconectar e exigir novo QR Code.
- Disparos devem ser moderados para evitar bloqueios e preservar a qualidade dos grupos.

## Possiveis melhorias futuras

- Usar PostgreSQL para persistir agenda, grupos e historico.
- Criar autenticacao para proteger a tela.
- Permitir criar mais horarios pela interface.
- Permitir pausar envios por grupo.
- Adicionar intervalo entre mensagens para reduzir risco de bloqueio.
- Mostrar logs detalhados de cada envio.
- Separar campanhas por nicho, como dentistas, beleza, casa, cozinha etc.
- Criar uma tela de teste que simule a busca sem enviar mensagens.


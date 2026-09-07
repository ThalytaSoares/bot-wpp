# Hub Afiliados Shopee - Web

Aplicacao web em Node.js para buscar ofertas da Shopee, calcular um ranking e exibir as melhores ofertas do dia.

## Como rodar localmente

1. Entre na pasta:

```powershell
cd "C:\Users\Thalyta\Desktop\bot-wpp\webapp"
```

2. Crie um arquivo `.env` usando `.env.example` como base:

```env
SHOPEE_APP_ID=seu_app_id
SHOPEE_SECRET=seu_secret
WHATSAPP_TARGETS=5511999999999,120363000000000000@g.us
PORT=3000
```

3. Inicie o servidor:

```powershell
npm run dev
```

4. Acesse:

```text
http://localhost:3000
```

## O que esta versao faz

- Busca produtos na API de afiliados da Shopee.
- Filtra produtos com nota minima.
- Calcula score por vendas, avaliacao e comissao.
- Exibe o Top do Dia.
- Gera texto pronto para publicacao.

## Hospedagem gratuita no Render

1. Suba esta pasta para um repositorio no GitHub.
2. Acesse https://render.com e crie uma conta.
3. Clique em New > Web Service.
4. Conecte o repositorio.
5. Configure:

```text
Root Directory: webapp
Build Command: npm install
Start Command: npm start
Plan: Free
```

6. Em Environment, adicione:

```env
SHOPEE_APP_ID=seu_app_id
SHOPEE_SECRET=seu_secret
WHATSAPP_TARGETS=5511999999999,120363000000000000@g.us
```

Use numeros com codigo do pais e DDD, separados por virgula. Para grupos, use o ID do grupo terminado em `@g.us`.

Esta versao usa uma biblioteca gratuita baseada no WhatsApp Web. No primeiro uso, acesse os logs do servidor e escaneie o QR Code com o WhatsApp. Em hospedagem gratuita, a sessao pode cair se o servico reiniciar ou dormir.

7. Salve e aguarde o deploy.

Mantenha o arquivo `.env` apenas no seu computador. Nunca envie esse arquivo para o GitHub.

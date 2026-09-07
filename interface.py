import FreeSimpleGUI as sg

from shopee_api import buscar_produtos
from telegram_bot import publicar


def gerar_post(produto):
    return f"""🔥 ACHADINHO SHOPEE

📦 {produto['productName']}

⭐ {produto['ratingStar']}/5
💰 R$ {produto['price']}

🏪 {produto['shopName']}

👉 Confira:
{produto['offerLink']}
"""


def ai_score(produto):
    vendas = int(produto.get("sales", 0))
    nota = float(produto.get("ratingStar", 0))
    comissao = float(produto.get("commissionRate", 0))

    if nota < 4.5:
        return 0

    score_vendas = min(vendas / 1000, 1) * 100
    score_nota = nota * 20
    score_comissao = comissao * 1000

    score = score_vendas * 0.4 + score_nota * 0.3 + score_comissao * 0.3
    return round(score, 2)


sg.theme("DarkBlue3")

layout = [
    [sg.Text("Palavra-chave:"), sg.Input(key="-KEYWORD-", size=(30, 1))],
    [sg.Button("Buscar Produtos")],
    [
        sg.Table(
            values=[],
            headings=["Produto", "Preço", "Vendas", "Nota", "Comissão", "Score IA"],
            key="-TABELA-",
            auto_size_columns=False,
            col_widths=[45, 10, 10, 10, 10, 10],
            justification="left",
            enable_events=True,
            expand_x=True,
            expand_y=True,
        )
    ],
    [sg.Multiline("", size=(100, 12), key="-POST-")],
    [sg.Button("Gerar Post"), sg.Button("Publicar Telegram"), sg.Button("Publicar Top 20")],
]

window = sg.Window("Hub Afiliados Shopee", layout, size=(1200, 700), resizable=True)

produtos = []
produto_do_dia = None

while True:
    event, values = window.read()

    if event == sg.WINDOW_CLOSED:
        break

    if event == "Buscar Produtos":
        try:
            keyword = values["-KEYWORD-"]
            produtos = buscar_produtos(keyword=keyword, list_type=0)
            produtos = [p for p in produtos if float(p.get("ratingStar", 0)) >= 4.5]
            produtos.sort(key=ai_score, reverse=True)
            produto_do_dia = produtos[0] if produtos else None
            produtos = produtos[:20]

            tabela = []

            for i, p in enumerate(produtos):
                nome = p["productName"][:70]

                if i == 0:
                    nome = "🔥 PRODUTO DO DIA | " + nome

                tabela.append(
                    [
                        nome,
                        p["price"],
                        p["sales"],
                        p["ratingStar"],
                        f"{float(p['commissionRate']) * 100:.0f}%",
                        ai_score(p),
                    ]
                )

            window["-TABELA-"].update(values=tabela)
            sg.popup("Top 20 gerado + Produto do Dia definido!")

        except Exception as erro:
            sg.popup_error(f"Erro:\n\n{erro}")

    if event == "Gerar Post":
        if not values["-TABELA-"]:
            sg.popup("Selecione um produto.")
        else:
            indice = values["-TABELA-"][0]

            if indice < len(produtos):
                produto = produtos[indice]
                texto = gerar_post(produto)
                window["-POST-"].update(texto)

    if event == "Publicar Telegram":
        texto = values["-POST-"]

        if texto.strip():
            try:
                publicar(texto)
                sg.popup("Publicado com sucesso!")
            except Exception as erro:
                sg.popup_error(f"Erro Telegram:\n\n{erro}")

window.close()

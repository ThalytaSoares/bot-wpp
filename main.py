from shopee_api import buscar_produtos
from telegram_bot import publicar


def calcular_score(produto):
    vendas = produto["sales"]
    nota = float(produto["ratingStar"])
    comissao = float(produto["commissionRate"])

    return vendas * 0.5 + nota * 20 + comissao * 100


def gerar_post(produto):
    return f"""🔥 ACHADINHO SHOPEE

📦 {produto['productName']}

⭐ {produto['ratingStar']}/5
💰 R$ {produto['price']}

🏪 {produto['shopName']}

👉 Confira:
{produto['offerLink']}
"""


print("Buscando produtos...")

produtos = buscar_produtos()
produtos_ordenados = sorted(produtos, key=calcular_score, reverse=True)
melhor = produtos_ordenados[0]

print("\nProduto selecionado:")
print(melhor["productName"])

post = gerar_post(melhor)

print("\nPost gerado:")
print(post)

resposta = input("\nPublicar no Telegram? (s/n): ")

if resposta.lower() == "s":
    publicar(post)
    print("Publicado com sucesso!")
else:
    print("Cancelado.")

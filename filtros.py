def calcular_score(produto):
    vendas = produto["sales"]
    nota = float(produto["ratingStar"])
    comissao = float(produto["commissionRate"])

    return vendas * 0.5 + nota * 20 + comissao * 100

import hashlib
import json
import time

import requests

from config import APP_ID, SECRET


URL = "https://open-api.affiliate.shopee.com.br/graphql"


def buscar_produtos(keyword="", list_type=0):
    if not APP_ID or not SECRET:
        raise RuntimeError("Configure SHOPEE_APP_ID e SHOPEE_SECRET no arquivo webapp/.env.")

    query = f"""
    {{
      productOfferV2(
        keyword: "{keyword}",
        listType: {list_type}
      ) {{
        nodes {{
          itemId
          productName
          price
          sales
          ratingStar
          commissionRate
          imageUrl
          offerLink
          shopName
        }}
      }}
    }}
    """

    payload = json.dumps({"query": query}, separators=(",", ":"))
    timestamp = str(int(time.time()))
    assinatura = hashlib.sha256((APP_ID + timestamp + payload + SECRET).encode("utf-8")).hexdigest()

    headers = {
        "Content-Type": "application/json",
        "Authorization": (
            f"SHA256 Credential={APP_ID}, "
            f"Timestamp={timestamp}, "
            f"Signature={assinatura}"
        ),
    }

    response = requests.post(URL, headers=headers, data=payload, timeout=30)

    if response.status_code != 200:
        raise Exception(f"Erro HTTP {response.status_code}\n\n{response.text}")

    dados = response.json()

    if "errors" in dados:
        raise Exception(str(dados["errors"]))

    return dados["data"]["productOfferV2"]["nodes"]

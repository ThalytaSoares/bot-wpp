from pathlib import Path
import os


def carregar_env():
    env_path = Path(__file__).parent / "webapp" / ".env"

    if not env_path.exists():
        return

    for linha in env_path.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()

        if not linha or linha.startswith("#") or "=" not in linha:
            continue

        chave, valor = linha.split("=", 1)
        os.environ.setdefault(chave, valor.strip().strip("\"'"))


carregar_env()

APP_ID = os.getenv("SHOPEE_APP_ID", "")
SECRET = os.getenv("SHOPEE_SECRET", "")
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN", "")
CHAT_ID = os.getenv("CHAT_ID", "")

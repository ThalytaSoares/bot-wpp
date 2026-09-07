import asyncio

from telegram import Bot

from config import CHAT_ID, TELEGRAM_TOKEN


async def publicar_mensagem(texto):
    if not TELEGRAM_TOKEN or not CHAT_ID:
        raise RuntimeError("Configure TELEGRAM_TOKEN e CHAT_ID no arquivo webapp/.env.")

    bot = Bot(token=TELEGRAM_TOKEN)
    await bot.send_message(chat_id=CHAT_ID, text=texto)


def publicar(texto):
    asyncio.run(publicar_mensagem(texto))

import os
import discord
from discord import app_commands
from openai import OpenAI


# =========================
# CONFIGURATION
# =========================

DISCORD_TOKEN = os.getenv("BOT_TOKEN")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not DISCORD_TOKEN:
    raise RuntimeError("BOT_TOKEN est manquant.")

if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY est manquante.")


client_ai = OpenAI(api_key=OPENAI_API_KEY)

MODEL = os.getenv("XYRO_MODEL", "gpt-5.6-luna")


# =========================
# PERSONNALITÉ DE XYRO
# =========================

SYSTEM_PROMPT = """
Tu es Xyro.AI.

Ton créateur est Mashari.

Tu es Xyro.AI, et non ChatGPT.
OpenAI fournit une technologie utilisée par ton système,
mais ton identité est Xyro.AI et ton créateur est Mashari.

Tu réponds principalement en français.

Tu es cool, intelligent, rapide, amical et parfois drôle.
Tu aides pour :

- les devoirs
- les cours
- le code
- les jeux
- les questions générales
- les projets
- les explications techniques

Tu peux expliquer simplement quand une personne ne comprend pas.

Tu ne prétends jamais être une personne réelle.

Si tu n'es pas sûr d'une information,
indique-le clairement au lieu d'inventer une réponse.

Quand quelqu'un t'appelle "Xyro",
comprends qu'il s'adresse à toi.
"""


# =========================
# DISCORD
# =========================

intents = discord.Intents.default()
intents.message_content = True

bot = discord.Client(intents=intents)
tree = app_commands.CommandTree(bot)


# =========================
# FONCTION IA
# =========================

def demander_a_xyro(message):
    response = client_ai.responses.create(
        model=MODEL,
        instructions=SYSTEM_PROMPT,
        input=message
    )

    return response.output_text


# =========================
# CONNEXION
# =========================

@bot.event
async def on_ready():
    print(f"✅ Xyro.AI connecté en tant que {bot.user}")

    try:
        synced = await tree.sync()
        print(f"✅ {len(synced)} commande(s) Discord synchronisée(s)")
    except Exception as e:
        print(f"❌ Erreur synchronisation : {e}")


# =========================
# MESSAGE AUTOMATIQUE
# =========================

@bot.event
async def on_message(message):

    # Ignore Xyro lui-même
    if message.author == bot.user:
        return

    # Vérifie si quelqu'un écrit "Xyro"
    if "xyro" in message.content.lower():

        texte = message.content

        # Retire le nom Xyro
        texte = texte.replace("Xyro", "")
        texte = texte.replace("xyro", "")
        texte = texte.replace("XYRO", "")

        texte = texte.strip()

        # Si quelqu'un écrit seulement "Xyro"
        if not texte:
            texte = "Salut !"

        try:
            async with message.channel.typing():

                answer = demander_a_xyro(texte)

            if not answer:
                answer = "Je n'ai pas réussi à répondre."

            # Discord limite un message à 2000 caractères
            for i in range(0, len(answer), 2000):
                await message.reply(answer[i:i + 2000])

        except Exception as e:

            print(f"❌ Erreur Xyro : {e}")

            await message.reply(
                "🟠 Xyro rencontre momentanément un problème."
            )

    # Permet aussi aux commandes /ask et /ping de fonctionner
    await bot.process_commands(message)


# =========================
# /ASK
# =========================

@tree.command(
    name="ask",
    description="Parle directement avec Xyro.AI"
)
@app_commands.describe(
    message="Ton message pour Xyro"
)
async def ask(
    interaction: discord.Interaction,
    message: str
):

    await interaction.response.defer()

    try:

        answer = demander_a_xyro(message)

        if not answer:
            answer = "Je n'ai pas réussi à répondre."

        for i in range(0, len(answer), 2000):
            await interaction.followup.send(
                answer[i:i + 2000]
            )

    except Exception as e:

        print(f"❌ Erreur Xyro : {e}")

        await interaction.followup.send(
            "🟠 Xyro rencontre momentanément un problème."
        )


# =========================
# /PING
# =========================

@tree.command(
    name="ping",
    description="Vérifie si Xyro.AI est connecté"
)
async def ping(interaction: discord.Interaction):

    latency = round(bot.latency * 1000)

    await interaction.response.send_message(
        f"🏓 Pong ! Latence : {latency} ms"
    )


# =========================
# LANCEMENT
# =========================

bot.run(DISCORD_TOKEN)

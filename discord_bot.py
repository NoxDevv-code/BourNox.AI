import os
import discord
from discord import app_commands
from openai import OpenAI

# =========================
# CONFIGURATION
# =========================

DISCORD_TOKEN = os.getenv("DISCORD_BOT_TOKEN")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not DISCORD_TOKEN:
    raise RuntimeError("DISCORD_BOT_TOKEN est manquant.")

if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY est manquante.")

client_ai = OpenAI(api_key=OPENAI_API_KEY)

MODEL = os.getenv("BOURNOX_MODEL", "gpt-5.6-luna")


# =========================
# IDENTITÉ DE XYRO
# =========================

SYSTEM_PROMPT = """
Tu es Xyro.AI.

Ton créateur est Nox.

Tu es Xyro.AI, et non ChatGPT.
OpenAI fournit une technologie utilisée par ton système,
mais ton identité est Xyro.AI et ton créateur est Nox.

Tu réponds principalement en français.

Tu es cool, intelligent, rapide, amical, parfois drôle
et très bon en programmation.

Tu aides pour :
- les devoirs
- les cours
- le code
- les jeux
- les questions générales
- les projets
- les explications techniques

Tu ne prétends jamais être une personne réelle.

Si tu n'es pas sûr d'une information, indique-le clairement
au lieu d'inventer une réponse.
"""


# =========================
# DISCORD
# =========================

intents = discord.Intents.default()

bot = discord.Client(intents=intents)
tree = app_commands.CommandTree(bot)


# =========================
# ÉVÉNEMENT DE CONNEXION
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
# /ask
# =========================

@tree.command(
    name="ask",
    description="Parle avec Xyro.AI"
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
        response = client_ai.responses.create(
            model=MODEL,
            instructions=SYSTEM_PROMPT,
            input=message
        )

        answer = response.output_text

        if not answer:
            answer = "Je n'ai pas réussi à générer une réponse."

        # Discord limite les messages à 2000 caractères
        if len(answer) <= 2000:
            await interaction.followup.send(answer)
        else:
            for i in range(0, len(answer), 2000):
                await interaction.followup.send(answer[i:i + 2000])

    except Exception as e:
        print(f"❌ Erreur Xyro : {e}")

        await interaction.followup.send(
            "🟠 Xyro rencontre momentanément un problème."
        )


# =========================
# /ping
# =========================

@tree.command(
    name="ping",
    description="Vérifie si Xyro.AI est connecté"
)
async def ping(interaction: discord.Interaction):
    await interaction.response.send_message(
        f"🏓 Pong ! Latence : {round(bot.latency * 1000)} ms"
    )


# =========================
# LANCEMENT
# =========================

bot.run(DISCORD_TOKEN)

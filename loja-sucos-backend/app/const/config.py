import os
from dotenv import load_dotenv

load_dotenv()

ACCESS_TOKEN_EXPIRES_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRES_MINUTES", 720))
SECRET_KEY = os.getenv("SECRET_KEY", "developer_secret_key")
ALGORITHM = os.getenv("ALGORITHM", "HS256")

CORS_ORIGINS = [
    origem.strip()
    for origem in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    if origem.strip()
]

NOME_LOJA = os.getenv("NOME_LOJA", "Cia do Suco")

# Fuso usado para agrupar vendas por dia/hora nos relatórios
TIMEZONE_LOJA = os.getenv("TIMEZONE_LOJA", "America/Sao_Paulo")

# Conta que envia o relatório diário de estoque (Gmail: usar uma "senha de app"). Sem conta, nada é enviado.
EMAIL_CONTA = os.getenv("EMAIL_CONTA", "")
EMAIL_SENHA = os.getenv("EMAIL_SENHA", "")
EMAIL_SMTP_HOST = os.getenv("EMAIL_SMTP_HOST", "smtp.gmail.com")
EMAIL_SMTP_PORTA = int(os.getenv("EMAIL_SMTP_PORTA", 587))

# Hora (no fuso da loja) do relatório diário de estoque. Se a API estiver fora do ar nessa hora, o envio
# acontece assim que ela voltar, até a hora limite.
HORA_RELATORIO_ESTOQUE = int(os.getenv("HORA_RELATORIO_ESTOQUE", 8))
HORA_LIMITE_RELATORIO_ESTOQUE = int(os.getenv("HORA_LIMITE_RELATORIO_ESTOQUE", 12))

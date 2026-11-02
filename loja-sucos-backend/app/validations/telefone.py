import re


def normalizar_telefone(telefone: str | None) -> str | None:
    """Deixa só os dígitos e garante o DDI 55, no formato que o WhatsApp usa (ex.: 5591988887777)"""
    if telefone is None:
        return None

    digitos = re.sub(r"\D", "", telefone)
    if not digitos:
        return None

    # DDD + número (10 ou 11 dígitos) sem o DDI
    if len(digitos) in (10, 11):
        digitos = "55" + digitos

    if not (12 <= len(digitos) <= 13) or not digitos.startswith("55"):
        raise ValueError("Telefone inválido. Use DDD + número, ex.: (91) 98888-7777.")

    return digitos

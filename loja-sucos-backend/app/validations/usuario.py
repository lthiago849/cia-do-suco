import re


def validar_senha(senha: str | None) -> str | None:
    if senha:
        # Requisitos para a senha
        if len(senha) < 8:
            raise ValueError("A senha deve ter pelo menos 8 caracteres.")
        if not re.search(r"[A-Z]", senha):
            raise ValueError("A senha deve conter pelo menos uma letra maiúscula.")
        if not re.search(r"[a-z]", senha):
            raise ValueError("A senha deve conter pelo menos uma letra minúscula.")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", senha):
            raise ValueError("A senha deve conter pelo menos um caractere especial.")
    return senha

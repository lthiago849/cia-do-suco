async def atualizar_instancia(antigo, novo):
    for key, value in novo.model_dump(exclude_unset=True).items():
        setattr(antigo, key, value)
    return antigo

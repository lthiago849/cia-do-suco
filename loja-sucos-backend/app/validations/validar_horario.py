from datetime import datetime, timezone


def validar_horario() -> datetime:
    """Horário atual em UTC. O banco guarda TIMESTAMPTZ e os relatórios convertem para o fuso da loja.
    Mantém os microssegundos: o fiado é quitado da venda mais antiga para a mais nova, e duas vendas
    no mesmo segundo precisam continuar em ordem."""
    return datetime.now(timezone.utc)

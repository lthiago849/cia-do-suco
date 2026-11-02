from uuid import UUID
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.const.enums import OrigemPedido, StatusPedido
from app.controllers.pedido import (
    listar_pedidos, get_pedido_by_id, criar_pedido, atualizar_pedido, confirmar_entrega,
    cancelar_pedido, resumo_entregadores
)
from app.db.db import get_session
from app.schemas.auth import UsuarioOut
from app.schemas.pedido import (
    PedidoCreate, PedidoUpdate, EntregaPedido, CancelamentoPedido, PedidoResponse, EntregadorResumo
)
from app.security.auth import get_current_user

router = APIRouter(prefix="/pedidos", tags=["Pedidos de entrega"])


@router.get("/", response_model=list[PedidoResponse])
async def listar_pedidos_endpoint(abertos: bool = False, status_pedido: Optional[StatusPedido] = Query(None, alias="status"),
                                  data_inicio: Optional[date] = None, data_fim: Optional[date] = None,
                                  entregador_id: Optional[UUID] = None, cliente_id: Optional[UUID] = None,
                                  limit: int = Query(default=100, le=500), offset: int = 0,
                                  db: AsyncSession = Depends(get_session),
                                  _: UsuarioOut = Depends(get_current_user)):
    """<abertos>=true: fila de trabalho (aguardando entrega, mais antigo primeiro). Senão, histórico."""
    return await listar_pedidos(db, abertos, status_pedido, data_inicio, data_fim, entregador_id, cliente_id,
                                limit, offset)


@router.get("/entregadores", response_model=list[EntregadorResumo])
async def resumo_entregadores_endpoint(data_inicio: Optional[date] = None, data_fim: Optional[date] = None,
                                       db: AsyncSession = Depends(get_session),
                                       _: UsuarioOut = Depends(get_current_user)):
    """Quantas entregas cada funcionário fez no período e quanto recebeu de taxa de entrega"""
    return await resumo_entregadores(db, data_inicio, data_fim)


@router.get("/{id_pedido}", response_model=PedidoResponse)
async def get_pedido_endpoint(id_pedido: UUID, db: AsyncSession = Depends(get_session),
                              _: UsuarioOut = Depends(get_current_user)):
    return await get_pedido_by_id(db, id_pedido)


@router.post("/", response_model=PedidoResponse, status_code=status.HTTP_201_CREATED)
async def criar_pedido_endpoint(pedido_create: PedidoCreate, db: AsyncSession = Depends(get_session),
                                current_user: UsuarioOut = Depends(get_current_user)):
    """Pedido de entrega cadastrado pelo atendente (cliente que pediu por mensagem ou ligação)"""
    return await criar_pedido(db, pedido_create, OrigemPedido.ATENDENTE, current_user.id)


@router.put("/{id_pedido}", response_model=PedidoResponse)
async def atualizar_pedido_endpoint(id_pedido: UUID, pedido_update: PedidoUpdate,
                                    db: AsyncSession = Depends(get_session),
                                    _: UsuarioOut = Depends(get_current_user)):
    """Revisão antes da entrega: itens, endereço, forma de pagamento (inclusive fiado) e observação"""
    return await atualizar_pedido(db, id_pedido, pedido_update)


@router.post("/{id_pedido}/entregar", response_model=PedidoResponse)
async def confirmar_entrega_endpoint(id_pedido: UUID, entrega: EntregaPedido, db: AsyncSession = Depends(get_session),
                                     current_user: UsuarioOut = Depends(get_current_user)):
    """Confirma a entrega informando quem entregou: o pedido vira venda (baixa o estoque) e a taxa de entrega
    fica registrada para o entregador"""
    return await confirmar_entrega(db, id_pedido, entrega, current_user.id)


@router.post("/{id_pedido}/cancelar", response_model=PedidoResponse)
async def cancelar_pedido_endpoint(id_pedido: UUID, cancelamento: CancelamentoPedido,
                                   db: AsyncSession = Depends(get_session),
                                   current_user: UsuarioOut = Depends(get_current_user)):
    return await cancelar_pedido(db, id_pedido, cancelamento, current_user.id)

from decimal import Decimal
from typing import Annotated

from pydantic import PlainSerializer

# Valores decimais saem como número no JSON (o padrão do pydantic é string), facilitando o frontend
DecimalJson = Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]

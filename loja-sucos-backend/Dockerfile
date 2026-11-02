FROM python:3.13.1-slim AS build-environment

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc curl && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

ENV POETRY_HOME="/opt/poetry"
ENV POETRY_VERSION=2.0.0

RUN curl -sSL https://install.python-poetry.org | python3 - --version $POETRY_VERSION \
    && ln -s $POETRY_HOME/bin/poetry /usr/local/bin/poetry

ENV POETRY_VIRTUALENVS_IN_PROJECT=true

WORKDIR /app
COPY app/ ./
RUN poetry install --no-interaction --no-ansi --without dev

FROM python:3.13.1-slim AS runtime-environment

ENV TZ=America/Sao_Paulo

WORKDIR /app
COPY --from=build-environment /app /app

ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--app-dir", "../"]

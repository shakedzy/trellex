FROM toads.jfrog.io/docker/python:3.11-slim

WORKDIR /app

COPY pyproject.toml .

RUN pip install --no-cache-dir .

COPY . .

RUN mkdir -p data session

EXPOSE 5000

ENV TRELLEX_HOST=0.0.0.0
ENV TRELLEX_PORT=5000

CMD ["python", "app.py"]

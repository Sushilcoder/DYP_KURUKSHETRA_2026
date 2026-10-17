FROM python:3.12.15-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN apt-get update && apt-get install -y --no-install-recommends libreoffice-impress fonts-liberation fontconfig \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --create-home --uid 10001 renderer
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
RUN mkdir -p /app/storage/materials && chown -R renderer:renderer /app
USER renderer
EXPOSE 8082
CMD ["uvicorn","app:app","--host","0.0.0.0","--port","8082"]

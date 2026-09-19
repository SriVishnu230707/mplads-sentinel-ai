FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN useradd --create-home --uid 10001 sentinel
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY backend /app/backend
RUN chmod 755 /app/backend/docker-entrypoint.sh
USER sentinel
EXPOSE 8000
ENTRYPOINT ["/app/backend/docker-entrypoint.sh"]

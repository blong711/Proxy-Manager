# ---- Build stage ----
FROM python:3.12-slim AS builder

WORKDIR /app

# Cài dependencies trước để cache layer
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# ---- Runtime stage ----
FROM python:3.12-slim

WORKDIR /app

# Copy installed packages từ builder
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy source code
COPY app ./app

# Expose port backend
EXPOSE 8000

# Chạy với uvicorn (không dùng --reload trong production)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY cinemind_reco ./cinemind_reco
USER nobody
CMD ["uvicorn", "cinemind_reco.api:app", "--host", "0.0.0.0", "--port", "8001"]

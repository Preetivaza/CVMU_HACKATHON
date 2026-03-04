@echo off
cd d:\nextjs\RDD\ml-service
python -m venv venv
call venv\Scripts\activate.bat
pip install -r requirements.txt
pip install "pydantic[email]" pytest pytest-asyncio httpx uvicorn
start /b uvicorn app.main:app --port 8001
echo "Waiting for Uvicorn to start..."
timeout /t 5 /nobreak
pytest test_clustering_pipeline.py -v > pytest_output.log 2>&1
type pytest_output.log

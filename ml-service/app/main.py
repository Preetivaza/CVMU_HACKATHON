from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from app.routers import clustering, risk, satellite, detections, public_inference
from app.core.config import settings
from app.core.database import connect_to_mongo, close_mongo_connection, get_database

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_to_mongo()
    yield
    # Shutdown
    await close_mongo_connection()

app = FastAPI(
    lifespan=lifespan,
    title="Road Damage ML Service",
    description="ML Microservice for DBSCAN clustering, satellite analysis, and risk calculation",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include ML routers
app.include_router(clustering.router, prefix="/ml/clustering", tags=["Clustering"])
app.include_router(risk.router, prefix="/ml/risk", tags=["Risk"])
app.include_router(satellite.router, prefix="/ml/satellite", tags=["Satellite"])

# Include the Detections router (For Member 1's AI data)
app.include_router(detections.router)

# Include the Public Inference router
app.include_router(public_inference.router)

@app.get("/")
async def root():
    return {
        "service": "Road Damage ML Service",
        "version": "1.0.0",
        "status": "running",
    }


# Health Check to verify Atlas connection
@app.get("/ml/health")
async def health_check(db = Depends(get_database)):
    db_status = "disconnected"
    try:
        # Ping the database to ensure active connection
        if db is not None:
            await db.command('ping')
            db_status = "connected"
    except Exception as e:
        print(f"Health check DB ping failed: {e}")

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "service": "ml-service",
        "database": db_status
    }
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import clustering, risk, satellite
from app.core.config import settings
from app.core.database import connect_to_mongo, close_mongo_connection


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

# Include routers
app.include_router(clustering.router, prefix="/ml/clustering", tags=["Clustering"])
app.include_router(risk.router, prefix="/ml/risk", tags=["Risk"])
app.include_router(satellite.router, prefix="/ml/satellite", tags=["Satellite"])


@app.get("/")
async def root():
    return {
        "service": "Road Damage ML Service",
        "version": "1.0.0",
        "status": "running",
    }


@app.get("/ml/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "ml-service",
    }

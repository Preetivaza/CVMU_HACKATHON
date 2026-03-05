from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    # MongoDB
    MONGODB_URI: str = "mongodb://localhost:27017/road_damage_db"
    DATABASE_NAME: str = "road_damage_db"
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
    # Clustering config
    DBSCAN_EPS_METERS: float = 10.0  # 10 meter radius
    DBSCAN_MIN_SAMPLES: int = 3  # Minimum 3 points to form cluster
    
    # Risk calculation weights
    RISK_WEIGHT_SEVERITY_NORMAL: float = 0.7
    RISK_WEIGHT_AGING_NORMAL: float = 0.3
    RISK_WEIGHT_SEVERITY_REPEAT: float = 0.6
    RISK_WEIGHT_AGING_REPEAT: float = 0.4
    REPEAT_THRESHOLD: int = 3
    
    # Google Earth Engine
    GEE_SERVICE_ACCOUNT: str = ""
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()

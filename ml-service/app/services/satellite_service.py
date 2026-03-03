<<<<<<< HEAD
import ee
import traceback
=======
import random
import ee
import json
import os
>>>>>>> 731845e (cluster DBSCAN done)
from datetime import datetime
from dateutil.relativedelta import relativedelta
from typing import Dict, Any, List
from google.oauth2.service_account import Credentials
from app.core.config import settings
from app.services.risk_service import update_aging_index

<<<<<<< HEAD
def _initialize_gee():
    """Helper to initialize Earth Engine with the service account"""
    if not settings.GEE_SERVICE_ACCOUNT:
        raise ValueError("GEE_SERVICE_ACCOUNT environment variable is not set")
        
    credentials = Credentials.from_service_account_file(
        settings.GEE_SERVICE_ACCOUNT, 
        scopes=['https://www.googleapis.com/auth/earthengine']
    )
    ee.Initialize(credentials)
=======
# Global initialization flag
_EE_INITIALIZED = False

def initialize_ee():
    """Initialize Earth Engine if not already done."""
    global _EE_INITIALIZED
    if _EE_INITIALIZED:
        return True
    
    if not settings.GEE_SERVICE_ACCOUNT:
        return False
        
    try:
        # Check if the path is relative or absolute
        gee_json_path = settings.GEE_SERVICE_ACCOUNT
        if not os.path.isabs(gee_json_path):
            # Assume it's relative to the app root (which is ml-service)
            gee_json_path = os.path.join(os.getcwd(), gee_json_path)

        if not os.path.exists(gee_json_path):
            print(f"GEE Credentials not found at: {gee_json_path}")
            return False

        with open(gee_json_path, 'r') as f:
            creds = json.load(f)
            service_account = creds.get('client_email')
            
        credentials = ee.ServiceAccountCredentials(service_account, gee_json_path)
        ee.Initialize(credentials)
        _EE_INITIALIZED = True
        print(f"Earth Engine initialized successfully with account: {service_account}")
        return True
    except Exception as e:
        print(f"Failed to initialize Earth Engine: {e}")
        return False
>>>>>>> 731845e (cluster DBSCAN done)

async def run_satellite_analysis(
    cluster_id: str,
    coordinates: List[float],
    radius_meters: float = 50
) -> Dict[str, Any]:
    """
<<<<<<< HEAD
    Run Earth Engine satellite analysis focusing on structural road aging.
    Evaluates Sentinel-2 Bare Soil Index (BSI) and Sentinel-1 SAR Roughness over a 6-month interval.
    """
    try:
        # 1. Initialize API
        _initialize_gee()
        
        # 2. Setup Region & Dates (6 Month Interval Comparison)
        region = ee.Geometry.Point(coordinates).buffer(radius_meters)
        
        now = datetime.utcnow()
        recent_end = now.strftime('%Y-%m-%d')
        recent_start = (now - relativedelta(months=3)).strftime('%Y-%m-%d') # Rolling 3 months for current data to pierce clouds
        
        past_end = (now - relativedelta(months=6)).strftime('%Y-%m-%d')
        past_start = (now - relativedelta(months=9)).strftime('%Y-%m-%d')
        
        # 3. Sentinel-2 Optical Analysis (Bare Soil Index)
        # Cloud masking up to 20%
        s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
            .filterBounds(region) \
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
            
        past_s2 = s2.filterDate(past_start, past_end).median()
        recent_s2 = s2.filterDate(recent_start, recent_end).median()
        
        def calc_bsi(img):
            bsi = img.expression(
                '((SWIR + RED) - (NIR + BLUE)) / ((SWIR + RED) + (NIR + BLUE))', {
                'SWIR': img.select('B11'), 'RED': img.select('B4'),
                'NIR': img.select('B8'),   'BLUE': img.select('B2')
            }).rename('BSI')
            return img.addBands(bsi)
            
        try:
            recent_bsi = calc_bsi(recent_s2).select('BSI').reduceRegion(ee.Reducer.mean(), region, 10).get('BSI').getInfo()
            past_bsi = calc_bsi(past_s2).select('BSI').reduceRegion(ee.Reducer.mean(), region, 10).get('BSI').getInfo()
            recent_bsi_val = recent_bsi if recent_bsi is not None else 0
            past_bsi_val = past_bsi if past_bsi is not None else 0
            bsi_delta = max(0, recent_bsi_val - past_bsi_val)
        except Exception:
            # Fallback if optical data is completely cloud-covered during that time window
            print(f"Optical (Sentinel-2) data insufficient/cloudy. Relying purely on Radar (SAR).")
            bsi_delta = 0
            
        # 4. Sentinel-1 SAR Analysis (Roughness)
        # Bypasses clouds and moderate tree canopy cover
        s1 = ee.ImageCollection('COPERNICUS/S1_GRD') \
            .filterBounds(region) \
            .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV')) \
            .filter(ee.Filter.eq('instrumentMode', 'IW'))
            
        past_s1 = s1.filterDate(past_start, past_end).select('VV').median()
        recent_s1 = s1.filterDate(recent_start, recent_end).select('VV').median()

        try:
            sar_past_val = past_s1.reduceRegion(ee.Reducer.mean(), region, 10).get('VV').getInfo()
            sar_recent_val = recent_s1.reduceRegion(ee.Reducer.mean(), region, 10).get('VV').getInfo()
            
            p_val = sar_past_val if sar_past_val is not None else -10  # Standard dB default
            r_val = sar_recent_val if sar_recent_val is not None else -10
            
            # Substantial structural breakage scatters radar differently
            sar_delta = abs(r_val - p_val)
        except Exception as e:
            print(f"SAR S1 failed for {cluster_id}: {str(e)}")
            sar_delta = 0

        # 5. Compile the Final Derived Aging Index (0 to 1 scale)
        # BSI handles surface erosion, SAR handles severe structural bumps (potholes) under trees
        raw_aging_score = (bsi_delta * 2.5) + (sar_delta * 0.15)
        normalized_aging_index = round(min(1.0, max(0.1, raw_aging_score)), 4)
        
        # 6. Update the Database Document
        result = await update_aging_index(cluster_id, normalized_aging_index)
        
        if result["status"] == "error":
            return {
                "status": "error",
                "message": f"Failed to update cluster: {result['message']}"
            }
        
        return {
            "status": "completed",
            "cluster_id": cluster_id,
            "aging_index": normalized_aging_index,
            "analysis_date": datetime.utcnow().isoformat(),
            "message": "6-Month Sentinel-1 & Sentinel-2 analysis completed successfully"
        }
        
    except Exception as exc:
        traceback.print_exc()
        return {
            "status": "error",
            "message": f"GEE Analysis Failed: {str(exc)}"
        }
=======
    Run 3-year Satellite Aging Fusion analysis using NDVI Trend.
    Formula: 0.7 * Vision Severity + 0.3 * Satellite Aging
    We fetch NDVI (B8, B4) for 2023, 2024, and 2025 to see the 'death of the road'.
    """
    print(f"Starting 3-year NDVI Trend Analysis for cluster: {cluster_id}")
    if not initialize_ee():
        return {"status": "error", "message": "GEE failure."}

    try:
        # Longitude, Latitude
        lon, lat = float(coordinates[0]), float(coordinates[1])
        point = ee.Geometry.Point([lon, lat])
        
        years = [2023, 2024, 2025]
        ndvi_values = {}

        for year in years:
            # Wider window to ensure data hits
            col = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED") \
                .filterBounds(point) \
                .filterDate(f"{year}-01-01", f"{year}-12-31") \
                .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 50))
            
            count = col.size().getInfo()
            if count == 0:
                print(f"   [GEE] No data for {year}. Using proxy.")
                val = 0.15
            else:
                img = col.median()
                # Ensure bands exist before calc
                ndvi = img.normalizedDifference(['B8', 'B4'])
                
                stats = ndvi.reduceRegion(
                    reducer=ee.Reducer.mean(),
                    geometry=point,
                    scale=10
                ).getInfo()
                val = stats.get('nd', 0.15) if stats else 0.15
            
            ndvi_values[str(year)] = round(float(val), 4)

        v23, v25 = ndvi_values["2023"], ndvi_values["2025"]
        drop_total = (v23 - v25)
        aging_index = min(max(0.5 + (drop_total * 2.5), 0.0), 1.0)
        
        print(f"[GEE] Aging Fusion: {v23} -> {v25} | Index: {aging_index:.4f}")

        # Update Database
        await update_aging_index(cluster_id, aging_index)
        
        return {
            "status": "completed",
            "cluster_id": cluster_id,
            "aging_index": aging_index,
            "trend": ndvi_values,
            "message": "3-year NDVI trend analysis successfully completed.",
            "analysis_metadata": {
                "formula": "0.7*Vision + 0.3*Satellite",
                "bands": ["B8", "B4"],
                "source": "Sentinel-2 MSI"
            }
        }
    except Exception as e:
        print(f"Satellite Trend Analysis failed: {e}")
        return {"status": "error", "message": str(e)}
async def validate_road_material(
    coordinates: List[float],
) -> Dict[str, Any]:
    """
    Validate if a coordinate is likely on a road surface using Sentinel-1 (Radar) and Sentinel-2 (Multispectral).
    - Sentinel-2: Uses NDVI to detect vegetation (Roads < 0.45).
    - Sentinel-1: Uses SAR backscatter (VV) to detect smooth/hard surfaces (Roads > -18dB).
    """
    if not initialize_ee():
        return {"status": "skipped", "message": "GEE not initialized", "likely_road": True}

    try:
        point = ee.Geometry.Point(coordinates)
        
        # --- Sentinel-2 (Vegetation Check) ---
        s2 = ee.ImageCollection('COPERNICUS/S2_SR') \
            .filterBounds(point) \
            .filterDate('2023-01-01', datetime.utcnow().strftime('%Y-%m-%d')) \
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20)) \
            .median()
        
        ndvi = s2.normalizedDifference(['B8', 'B4']).rename('NDVI')
        
        # --- Sentinel-1 (Radar/Pavement Check) ---
        # SAR backscatter is higher for man-made surfaces like asphalt/concrete
        s1 = ee.ImageCollection('COPERNICUS/S1_GRD') \
            .filterBounds(point) \
            .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV')) \
            .filter(ee.Filter.eq('instrumentMode', 'IW')) \
            .median()
        
        # Sample both
        combined = ndvi.addBands(s1.select('VV'))
        stats = combined.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=point,
            scale=10
        ).getInfo()

        ndvi_val = stats.get('NDVI', 0.5)
        vv_val   = stats.get('VV', -20)
        
        # Road Logic:
        # 1. Not too much vegetation (NDVI < 0.45)
        # 2. Hard surface signature (Sentinel-1 VV typically > -18dB for urban/road)
        is_not_veg = ndvi_val < 0.45
        is_hard_surface = vv_val > -18.0
        
        likely_road = is_not_veg and is_hard_surface
        
        print(f"[GEE] Road check: NDVI={ndvi_val:.2f}, VV={vv_val:.2f}dB -> Likely Road: {likely_road}")
        
        return {
            "status": "completed",
            "likely_road": likely_road,
            "ndvi": round(ndvi_val, 4),
            "vv_db": round(vv_val, 4),
            "source": "Sentinel-1/2 Hybrid"
        }
    except Exception as e:
        print(f"Road material validation failed: {e}")
        return {"status": "error", "message": str(e), "likely_road": True}
>>>>>>> 731845e (cluster DBSCAN done)

async def check_gee_connection() -> bool:
    """
    Check if Google Earth Engine is configured and reachable.
    """
<<<<<<< HEAD
    try:
        _initialize_gee()
        return True
    except Exception:
        return False
=======
    return initialize_ee()
>>>>>>> 731845e (cluster DBSCAN done)

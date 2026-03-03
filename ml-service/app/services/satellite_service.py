import ee
import traceback
from datetime import datetime
from dateutil.relativedelta import relativedelta
from typing import Dict, Any, List
from google.oauth2.service_account import Credentials
from app.core.config import settings
from app.services.risk_service import update_aging_index

def _initialize_gee():
    """Helper to initialize Earth Engine with the service account"""
    if not settings.GEE_SERVICE_ACCOUNT:
        raise ValueError("GEE_SERVICE_ACCOUNT environment variable is not set")
        
    credentials = Credentials.from_service_account_file(
        settings.GEE_SERVICE_ACCOUNT, 
        scopes=['https://www.googleapis.com/auth/earthengine']
    )
    ee.Initialize(credentials)

async def run_satellite_analysis(
    cluster_id: str,
    coordinates: List[float],
    radius_meters: float = 50
) -> Dict[str, Any]:
    """
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

async def check_gee_connection() -> bool:
    """
    Check if Google Earth Engine is configured and reachable.
    """
    try:
        _initialize_gee()
        return True
    except Exception:
        return False

import io
import base64
import uuid
from datetime import datetime
from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    Image = ImageDraw = ImageFont = None

# If there's an actual YOLO model, we would load it here
# from ultralytics import YOLO
# model = YOLO("path/to/best.pt")

from app.core.database import get_collection, Collections

router = APIRouter(prefix="/api/v1/public", tags=["Public Report"])

@router.post("/infer-image")
async def infer_public_image(file: UploadFile = File(...)):
    """
    Accepts a pothole image from a public user, runs YOLO inference,
    and returns detections + base64 preview image.
    """
    if file.content_type and not file.content_type.startswith("image/"):
        # Handle cases where some devices don't send content-type correctly
        if not file.filename.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            raise HTTPException(status_code=400, detail="Must be an image file.")

    contents = await file.read()
    
    # Run YOLO Inference here
    # Since we might not have the model loaded in this service natively (it's in member 1),
    # we simulate the YOLO detection logic for presentation/efficiency if model is empty.
    
    try:
        img = Image.open(io.BytesIO(contents))
        img = img.convert("RGB")
        width, height = img.size
    except Exception as e:
        print(f"Error reading image: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid image file. {str(e)}")

    # --- MOCK YOLO DETECTIONS FOR DEMO / IF MODEL NOT PRESENT ---
    # In production, replace this block with:
    # results = model(img)
    # detections = parse_results(results)
    
    # We will simulate detecting 1 pothole at the center
    cx, cy = int(width / 2), int(height / 2)
    w, h = int(width * 0.3), int(height * 0.3)
    
    detections = [
        {
            "class_name": "pothole",
            "confidence": 0.89,
            "bbox": [int(cx - w/2), int(cy - h/2), int(cx + w/2), int(cy + h/2)] # xmin, ymin, xmax, ymax
        }
    ]
    # ------------------------------------------------------------
    
    # Draw bounding boxes on the image for preview
    if ImageDraw is not None:
        draw = ImageDraw.Draw(img)
        for det in detections:
            box = det["bbox"]
            label = f"{det['class_name']} {det['confidence']:.2f}"
            draw.rectangle(box, outline="red", width=3)
            draw.text((box[0], max(0, box[1] - 15)), label, fill="red")
            
    # Convert image back to base64
    buffered = io.BytesIO()
    img.save(buffered, format="JPEG")
    img_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
    
    return {
        "success": True,
        "detections": detections,
        "preview_base64": f"data:image/jpeg;base64,{img_base64}"
    }

from typing import Optional

class PublicSubmitRequest(BaseModel):
    latitude: float
    longitude: float
    detections: list
    image_base64: Optional[str] = None  # Optional, if we want to save the base64 string

@router.post("/submit-detection")
async def submit_public_detection(payload: PublicSubmitRequest):
    """
    Saves the user-confirmed detection into the database.
    This creates an entry compatible with the DBSCAN clustering logic.
    """
    detections_col = get_collection(Collections.RAW_DETECTIONS)
    
    doc = {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [payload.longitude, payload.latitude]
        },
        "properties": {
            "source": "public_report",
            "video_id": f"public_{uuid.uuid4().hex[:8]}", # Unique ID acting like a session
            "model_version": "public_yolo_v1",
            "timestamp": datetime.utcnow().isoformat(),
            "classes": [d["class_name"] for d in payload.detections],
            "scores": [float(d["confidence"]) for d in payload.detections],
        },
        "processed": False,
        "cluster_id": None,
        "created_at": datetime.utcnow()
    }
    
    result = await detections_col.insert_one(doc)
    
    return {
        "success": True,
        "inserted_id": str(result.inserted_id),
        "message": "Detection submitted successfully."
    }

import io
import os
import numpy as np
from PIL import Image

try:
    from ultralytics import YOLO
except ImportError:
    YOLO = None

import cv2

class YOLOService:
    _instance = None
    
    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(YOLOService, cls).__new__(cls, *args, **kwargs)
            cls._instance.model = None
            cls._instance.load_model()
        return cls._instance
        
    def load_model(self):
        # We assume the model is in the root directory next to ml-service
        # __file__ is ml-service/app/services/yolo_service.py
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        model_path = os.path.join(base_dir, "best.pt")
        if YOLO and os.path.exists(model_path):
            print(f"Loading YOLO model from {model_path}...")
            self.model = YOLO(model_path)
            print("YOLO model loaded successfully!")
        else:
            print(f"Warning: ultralytics is not installed or {model_path} not found.")

    def is_road_image(self, img_pil: Image.Image) -> bool:
        """
        Basic validation: Converts PIL image to OpenCV, 
        checks if the overall color profile resembles grey/dark asphalt.
        """
        # Convert RGB to BGR
        open_cv_image = np.array(img_pil)
        open_cv_image = open_cv_image[:, :, ::-1].copy()
        
        # Convert to HSV to analyze color saturation and brightness
        hsv = cv2.cvtColor(open_cv_image, cv2.COLOR_BGR2HSV)
        v_channel = hsv[:,:,2]
        s_channel = hsv[:,:,1]
        
        # Roads are typically low saturation (grey/black/drab)
        avg_saturation = np.mean(s_channel)
        
        # If the image is extremely vibrant (high saturation, e.g., a selfie, grassy field), 
        # it's likely not a road.
        if avg_saturation > 150: 
            return False
            
        return True

    def infer_image(self, img_pil: Image.Image):
        """
        Runs YOLO model inference on a PIL image.
        Returns the detections list.
        """
        if not self.model:
            raise RuntimeError("YOLO model is not loaded.")
            
        results = self.model(img_pil)
        
        detections = []
        for result in results:
            boxes = result.boxes
            for box in boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                cls_id = int(box.cls[0])
                class_name = result.names[cls_id]
                
                detections.append({
                    "class_name": class_name,
                    "confidence": conf,
                    "bbox": [int(x1), int(y1), int(x2), int(y2)]
                })
                
        return detections

yolo_service = YOLOService()

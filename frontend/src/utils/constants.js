// Damage types detected by AI
export const DAMAGE_TYPES = ['pothole', 'crack', 'patch', 'depression', 'other'];

// Confidence levels for detections
export const CONFIDENCE_LEVELS = ['low', 'medium', 'high'];

// Risk levels for clusters and areas
export const RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'];

// Repair status workflow
export const REPAIR_STATUSES = ['pending', 'scheduled', 'in_progress', 'repaired', 'verified'];

// User roles
export const USER_ROLES = ['admin', 'operator', 'viewer'];

// Video upload statuses
export const VIDEO_STATUSES = ['uploaded', 'processing', 'completed', 'failed'];

// Road types
export const ROAD_TYPES = ['highway', 'arterial', 'collector', 'local'];

// Analytics snapshot types
export const ANALYTICS_TYPES = ['monthly_trend', 'priority_ranking', 'zone_summary'];

// API Response status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
};

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

// Clustering configuration (used by FastAPI ML service)
export const CLUSTERING_CONFIG = {
  EPS_METERS: 10,       // 10 meter radius for DBSCAN
  MIN_SAMPLES: 3,       // Minimum 3 points to form a cluster
};

// Risk calculation weights
export const RISK_WEIGHTS = {
  SEVERITY_NORMAL: 0.7,
  AGING_NORMAL: 0.3,
  SEVERITY_REPEAT: 0.6,  // When repeat_count > 3
  AGING_REPEAT: 0.4,
  REPEAT_THRESHOLD: 3,
};

// Zoom levels for map rendering
export const ZOOM_LEVELS = {
  HEATMAP_MAX: 12,      // Zoom 0-12: Show heatmap
  CLUSTER_MIN: 12,      // Zoom 12-15: Show cluster circles
  CLUSTER_MAX: 15,
  POINTS_MIN: 15,       // Zoom 15+: Show individual points
};

// FastAPI ML service URL
export const ML_SERVICE_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

// File upload limits
export const UPLOAD_LIMITS = {
  MAX_VIDEO_SIZE: 500 * 1024 * 1024,  // 500MB
  MAX_GPS_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo'],
  ALLOWED_DATA_TYPES: ['text/csv', 'application/json'],
};

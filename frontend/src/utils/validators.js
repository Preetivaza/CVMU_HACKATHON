/**
 * Validate GeoJSON Point geometry
 * @param {Object} geometry
 * @returns {boolean}
 */
export const isValidGeoPoint = (geometry) => {
  if (!geometry || geometry.type !== 'Point') return false;
  if (!Array.isArray(geometry.coordinates)) return false;
  if (geometry.coordinates.length !== 2) return false;
  
  const [lon, lat] = geometry.coordinates;
  return typeof lon === 'number' && 
         typeof lat === 'number' &&
         lon >= -180 && lon <= 180 &&
         lat >= -90 && lat <= 90;
};

/**
 * Validate GeoJSON Polygon geometry
 * @param {Object} geometry
 * @returns {boolean}
 */
export const isValidGeoPolygon = (geometry) => {
  if (!geometry || geometry.type !== 'Polygon') return false;
  if (!Array.isArray(geometry.coordinates)) return false;
  if (geometry.coordinates.length === 0) return false;
  
  // Check that each ring is a valid array of coordinates
  return geometry.coordinates.every(ring => 
    Array.isArray(ring) && 
    ring.length >= 4 && // Minimum 4 points (3 + closing point)
    ring.every(coord => 
      Array.isArray(coord) && 
      coord.length === 2 &&
      typeof coord[0] === 'number' &&
      typeof coord[1] === 'number'
    )
  );
};

/**
 * Validate GeoJSON LineString geometry
 * @param {Object} geometry
 * @returns {boolean}
 */
export const isValidGeoLineString = (geometry) => {
  if (!geometry || geometry.type !== 'LineString') return false;
  if (!Array.isArray(geometry.coordinates)) return false;
  if (geometry.coordinates.length < 2) return false;
  
  return geometry.coordinates.every(coord =>
    Array.isArray(coord) &&
    coord.length === 2 &&
    typeof coord[0] === 'number' &&
    typeof coord[1] === 'number'
  );
};

/**
 * Validate detection properties from Member 1
 * @param {Object} detection
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export const validateDetection = (detection) => {
  const errors = [];
  
  if (!detection || typeof detection !== 'object') {
    return { isValid: false, errors: ['Detection must be an object'] };
  }
  
  // Check geometry
  if (!isValidGeoPoint(detection.geometry)) {
    errors.push('Invalid geometry: must be a valid GeoJSON Point');
  }
  
  const props = detection.properties || {};
  
  // Required fields validation
  if (!props.damage_type) {
    errors.push('Missing required field: damage_type');
  }
  
  if (typeof props.confidence !== 'number' || props.confidence < 0 || props.confidence > 1) {
    errors.push('confidence must be a number between 0 and 1');
  }
  
  if (typeof props.severity_score !== 'number' || props.severity_score < 0 || props.severity_score > 1) {
    errors.push('severity_score must be a number between 0 and 1');
  }
  
  // Optional but validated fields
  if (props.bbox_area_ratio !== undefined && 
      (typeof props.bbox_area_ratio !== 'number' || props.bbox_area_ratio < 0 || props.bbox_area_ratio > 1)) {
    errors.push('bbox_area_ratio must be a number between 0 and 1');
  }
  
  if (props.normalized_acceleration !== undefined &&
      (typeof props.normalized_acceleration !== 'number' || props.normalized_acceleration < 0 || props.normalized_acceleration > 1)) {
    errors.push('normalized_acceleration must be a number between 0 and 1');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Calculate risk level from score
 * @param {number} score - Risk score between 0 and 1
 * @returns {string}
 */
export const getRiskLevel = (score) => {
  if (score >= 0.85) return 'Critical';
  if (score >= 0.70) return 'High';
  if (score >= 0.50) return 'Medium';
  return 'Low';
};

/**
 * Calculate confidence level from confidence score
 * @param {number} confidence - Confidence score between 0 and 1
 * @returns {string}
 */
export const getConfidenceLevel = (confidence) => {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
};

/**
 * Validate email format
 * @param {string} email
 * @returns {boolean}
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && emailRegex.test(email);
};

/**
 * Validate password strength
 * @param {string} password
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export const validatePassword = (password) => {
  const errors = [];
  
  if (!password || typeof password !== 'string') {
    return { isValid: false, errors: ['Password is required'] };
  }
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate MongoDB ObjectId format
 * @param {string} id
 * @returns {boolean}
 */
export const isValidObjectId = (id) => {
  return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
};

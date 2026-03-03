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

  if (!detection.video_id) errors.push('Missing required field: video_id');
  if (detection.frame_id === undefined) errors.push('Missing required field: frame_id');
  if (!detection.conditions || typeof detection.conditions !== 'object') {
    errors.push('Missing or invalid field: conditions');
  }
  if (detection.damage_score === undefined || typeof detection.damage_score !== 'number') {
    errors.push('Missing or invalid field: damage_score');
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

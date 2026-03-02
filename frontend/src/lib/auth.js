import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

/**
 * Hash a password
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Verify a password against a hash
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a JWT token
 * @param {Object} payload - User data to include in token
 * @returns {string}
 */
export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify and decode a JWT token
 * @param {string} token
 * @returns {Object|null}
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Extract token from Authorization header
 * @param {Request} request
 * @returns {string|null}
 */
export function extractToken(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Middleware to verify authentication
 * @param {Request} request
 * @returns {Object} - { isValid, user, error }
 */
export async function verifyAuth(request) {
  const token = extractToken(request);
  
  if (!token) {
    return { isValid: false, user: null, error: 'No token provided' };
  }
  
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return { isValid: false, user: null, error: 'Invalid or expired token' };
  }
  
  return { isValid: true, user: decoded, error: null };
}

/**
 * Check if user has required role
 * @param {Object} user
 * @param {string[]} allowedRoles
 * @returns {boolean}
 */
export function hasRole(user, allowedRoles) {
  return user && allowedRoles.includes(user.role);
}

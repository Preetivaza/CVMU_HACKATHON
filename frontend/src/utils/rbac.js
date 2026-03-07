/**
 * RBAC UTILITY
 * Role-based access control helpers used across API routes.
 */
import { ROLE_HIERARCHY, ADMIN_ROLES } from './constants';

/**
 * Check if an actor's role can assign/update a target role.
 * @param {string} actorRole   - The role of the person making the request
 * @param {string} targetRole  - The role they want to assign
 * @returns {boolean}
 */
export function canAssignRole(actorRole, targetRole) {
  const allowed = ROLE_HIERARCHY[actorRole] || [];
  return allowed.includes(targetRole);
}

/**
 * Check if a role has admin panel access.
 * @param {string} role
 * @returns {boolean}
 */
export function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

/**
 * Build a MongoDB query fragment to filter data based on the user's role.
 * This is the core data-masking function.
 *
 * @param {Object} user - User document from DB (must have role, _id, authority_zone)
 * @returns {Object} MongoDB query filter to merge into your query
 */
export function getDataFilter(user) {
  if (!user) return {};

  switch (user.role) {
    case 'master_admin':
    case 'city_admin':
    case 'viewer':
      // Full access — no additional filter
      return {};

    case 'zone_officer':
      // Only see clusters within their assigned zone polygon
      if (user.authority_zone?.geometry) {
        return {
          geometry: {
            $geoWithin: { $geometry: user.authority_zone.geometry },
          },
        };
      }
      // If no zone assigned yet, return nothing
      return { _id: null };

    case 'state_authority':
      // Only highways
      return { road_type: 'highway' };

    case 'contractor':
      // Only roads/clusters assigned to them
      return { 'properties.assigned_to_user_id': user._id.toString() };

    default:
      return {};
  }
}

/**
 * Get the roles a given actor is allowed to see in user listings.
 * @param {string} actorRole
 * @returns {string[]|null} null means no restriction
 */
export function getVisibleRoles(actorRole) {
  if (actorRole === 'master_admin') return null; // see everyone
  if (actorRole === 'city_admin') {
    return ['city_admin', 'zone_officer', 'state_authority', 'contractor', 'viewer'];
  }
  return null;
}

/**
 * ROAD DAMAGE COST ESTIMATION UTILITY (INDIA SOR 2025-26)
 * Based on PWD/NHAI standard schedule of rates align with NH/City Road standards.
 */

export const COST_MATRIX = {
  pothole: {
    label: 'Pothole (Class A)',
    baseRate: 775, // Avg of ₹650 – ₹900
    unit: 'm²',
    method: '20mm Premix Carpet + Seal Coat',
    minArea: 0.5
  },
  edge_break: {
    label: 'Edge Break (Class B)',
    baseRate: 525, // Avg of ₹450 – ₹600
    unit: 'm',
    method: 'Earthen Shoulder filling + Compaction',
    minArea: 1.0
  },
  crack: {
    label: 'Crack (Class C)',
    baseRate: 225, // Avg of ₹150 – ₹300
    unit: 'm',
    method: 'Bitumen Emulsion/Crack Sealing',
    minArea: 2.0
  },
  rutting: {
    label: 'Rutting (Class D)',
    baseRate: 1500, // Avg of ₹1,200 – ₹1,800
    unit: 'm²',
    method: 'Full Bituminous Concrete (BC) Overlay',
    minArea: 5.0
  },
  pavement_failure: {
    label: 'Pavement Failure (Class E)',
    baseRate: 3000, // ₹2,500+
    unit: 'm²',
    method: 'WMM Base Repair + Surface DBM',
    minArea: 10.0
  },
  other: {
    label: 'General Maintenance',
    baseRate: 400,
    unit: 'm²',
    method: 'Patch repair / Cleaning',
    minArea: 0.5
  }
};

export const LOCATION_MULTIPLIERS = {
  NH: { label: 'National Highway', m: 1.4 },
  MDR: { label: 'Urban/City Road', m: 1.0 },
  PMGSY: { label: 'Rural Road', m: 0.8 }
};

/**
 * Calculate estimation for a cluster
 * @param {Object} cluster - Cluster feature (GeoJSON)
 * @param {string} roadCategory - 'NH', 'MDR', or 'PMGSY'
 */
export function calculateEstimation(cluster, roadCategory = 'MDR') {
  if (!cluster) return null;
  const p = cluster.properties || {};
  
  // Identify type from damage_type or damage_types map
  const typeKey = p.damage_type || Object.keys(p.damage_types || {})[0] || 'other';
  const config = COST_MATRIX[typeKey] || COST_MATRIX.other;

  // Area calculation: Use AI reported radius or default to 5m.
  // We assume a cluster of detections covers a circular area with a 40% density factor.
  const radius = p.radius_meters || 5; 
  const area = Math.max(config.minArea, Math.PI * Math.pow(radius, 2) * 0.4); 
  
  const locData = LOCATION_MULTIPLIERS[roadCategory] || LOCATION_MULTIPLIERS.MDR;
  const mLoc = locData.m;
  
  const conf = p.avg_confidence || 0.8;
  
  // Gatekeeper logic: Low confidence detections go to "Audit Mode" (0 cost)
  if (conf < 0.70) {
    return { auditMode: true, confidence: Math.round(conf * 100) };
  }

  // Cost calculation formula
  // Total Cost = (Area * Base Rate) * Mloc * Mconf
  // Mconf is 1.0 for reliable detections
  const mConf = 1.0; 
  const subtotal = (area * config.baseRate) * mLoc * mConf;
  
  // Tax and Labor buffers (Typical Indian Gov BoQ)
  const gst = subtotal * 0.18;
  const labor = subtotal * 0.15; // 15% labor
  const contingency = subtotal * 0.05; // 5% site contingency
  
  return {
    id: p._id || 'N/A',
    location: `${p.city || 'Standard Road'}, India`,
    coordinates: cluster.geometry?.coordinates ? `${cluster.geometry.coordinates[1].toFixed(5)}, ${cluster.geometry.coordinates[0].toFixed(5)}` : 'N/A',
    damageType: config.label,
    repairMethod: config.method,
    unit: config.unit,
    quantity: area.toFixed(2),
    baseRate: config.baseRate,
    multiplierLoc: mLoc,
    roadCategory: locData.label,
    confidence: Math.round(conf * 100),
    status: p.status || 'pending',
    costs: {
      subtotal: Math.round(subtotal),
      gst: Math.round(gst),
      labor: Math.round(labor),
      contingency: Math.round(contingency),
      grandTotal: Math.round(subtotal + gst + labor + contingency)
    },
    verificationRequired: conf < 0.90,
    timestamp: new Date().toISOString()
  };
}

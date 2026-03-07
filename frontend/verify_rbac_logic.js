/**
 * VERIFY RBAC FILTERING
 * Tests the getDataFilter logic for zone_officer.
 */
const { getDataFilter } = require('./src/utils/rbac');

const mockZone = {
  name: "West Zone",
  geometry: {
    type: "Polygon",
    coordinates: [[[0,0], [10,0], [10,10], [0,10], [0,0]]]
  }
};

const zoneOfficer = {
  role: 'zone_officer',
  authority_zone: mockZone
};

const cityAdmin = {
  role: 'city_admin'
};

console.log('--- Testing getDataFilter ---');

const officerFilter = getDataFilter(zoneOfficer);
console.log('Zone Officer Filter:', JSON.stringify(officerFilter, null, 2));

const adminFilter = getDataFilter(cityAdmin);
console.log('City Admin Filter:', JSON.stringify(adminFilter, null, 2));

// Validation
if (officerFilter.geometry?.$geoWithin?.$geometry?.type === 'Polygon') {
  console.log('✅ Zone filter correctly constructed for officer');
} else {
  console.error('❌ Zone filter FAILED for officer');
}

if (Object.keys(adminFilter).length === 0) {
  console.log('✅ Empty filter for admin (full access)');
} else {
  console.error('❌ Admin filter should be empty');
}

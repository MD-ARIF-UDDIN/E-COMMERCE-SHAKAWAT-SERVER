/**
 * Recursively renames 'id' property to '_id' in objects and arrays.
 * This ensures compatibility with frontends expecting MongoDB-style IDs.
 */
function mapId(obj) {
  if (Array.isArray(obj)) {
    return obj.map(mapId);
  }
  if (obj !== null && typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      if (key === 'id') {
        newObj['_id'] = mapId(obj[key]);
      } else {
        newObj[key] = mapId(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
}

module.exports = { mapId };

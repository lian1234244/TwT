const assert = require('assert');
const path = require('path');

const {
  isAllowedPermissionCheck,
  isAllowedPermissionRequest,
} = require(path.join(__dirname, '..', 'desktop', 'permission-policy.js'));

assert.strictEqual(isAllowedPermissionCheck('geolocation', {}), true);
assert.strictEqual(isAllowedPermissionCheck('media', { mediaType: 'video' }), true);
assert.strictEqual(isAllowedPermissionCheck('media', { mediaType: 'audio' }), false);
assert.strictEqual(isAllowedPermissionCheck('media', { mediaType: 'unknown' }), false);
assert.strictEqual(isAllowedPermissionCheck('notifications', {}), false);

assert.strictEqual(isAllowedPermissionRequest('geolocation', {}), true);
assert.strictEqual(isAllowedPermissionRequest('media', { mediaTypes: ['video'] }), true);
assert.strictEqual(isAllowedPermissionRequest('media', { mediaTypes: ['audio'] }), false);
assert.strictEqual(isAllowedPermissionRequest('media', { mediaTypes: ['video', 'audio'] }), false);
assert.strictEqual(isAllowedPermissionRequest('media', {}), false);

console.log('camera permission policy tests passed');

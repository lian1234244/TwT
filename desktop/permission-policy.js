'use strict';

function isAllowedPermissionCheck(permission, details) {
  if (permission === 'geolocation') return true;
  if (permission !== 'media') return false;
  return !!details && details.mediaType === 'video';
}

function isAllowedPermissionRequest(permission, details) {
  if (permission === 'geolocation') return true;
  if (permission !== 'media') return false;
  const mediaTypes = details && Array.isArray(details.mediaTypes) ? details.mediaTypes : [];
  return mediaTypes.length === 1 && mediaTypes[0] === 'video';
}

module.exports = {
  isAllowedPermissionCheck,
  isAllowedPermissionRequest,
};

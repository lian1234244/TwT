(function(root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HomeWeatherLocation = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  function locationError(code) {
    var labels = {
      1: 'GEOLOCATION_DENIED',
      2: 'GEOLOCATION_UNAVAILABLE',
      3: 'GEOLOCATION_TIMEOUT',
    };
    return new Error(labels[Number(code)] || 'GEOLOCATION_FAILED');
  }

  function normalizePosition(position) {
    var coords = position && position.coords || {};
    var latitude = Number(coords.latitude);
    var longitude = Number(coords.longitude);
    var accuracy = Number(coords.accuracy);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new Error('GEOLOCATION_INVALID');
    }
    return {
      latitude: latitude,
      longitude: longitude,
      accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : 0,
      provider: 'system',
    };
  }

  function requestSystemLocation(geolocation, options) {
    options = options || {};
    var timeoutMs = Math.max(100, Number(options.timeoutMs) || 8000);
    if (!geolocation || typeof geolocation.getCurrentPosition !== 'function') {
      return Promise.reject(new Error('GEOLOCATION_UNAVAILABLE'));
    }
    return new Promise(function(resolve, reject) {
      var settled = false;
      var timer = setTimeout(function() {
        if (settled) return;
        settled = true;
        reject(new Error('GEOLOCATION_TIMEOUT'));
      }, timeoutMs + 120);
      function finish(callback, value) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        callback(value);
      }
      geolocation.getCurrentPosition(function(position) {
        try { finish(resolve, normalizePosition(position)); }
        catch (error) { finish(reject, error); }
      }, function(error) {
        finish(reject, locationError(error && error.code));
      }, {
        enableHighAccuracy: options.enableHighAccuracy !== false,
        timeout: timeoutMs,
        maximumAge: Math.max(0, Number(options.maximumAge) || 5 * 60 * 1000),
      });
    });
  }

  return {
    normalizePosition: normalizePosition,
    requestSystemLocation: requestSystemLocation,
  };
});

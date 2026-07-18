function cleanPart(value) {
  return String(value || '').trim();
}

function isValidCoordinatePair(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function cityWithRegion(region, city) {
  region = cleanPart(region);
  city = cleanPart(city);
  if (!city) return region;
  if (!region || city.includes(region) || region.includes(city)) return city;
  return region + city;
}

function localizedCityLabel(region, city) {
  region = cleanPart(region);
  city = cleanPart(city);
  const chineseOnly = value => /^[\u3400-\u9fff]+$/.test(value);
  if (chineseOnly(region) && !/(省|市|自治区|特别行政区)$/.test(region)) {
    region += /^(北京|上海|天津|重庆)$/.test(region) ? '市' : '省';
  }
  if (chineseOnly(city) && !/(市|自治州|地区|盟|县|区|特别行政区)$/.test(city)) city += '市';
  return cityWithRegion(region, city);
}

function distanceSquared(latitude, longitude, city) {
  const lat = Number(city && city[2]);
  const lon = Number(city && city[3]);
  if (!isValidCoordinatePair(lat, lon)) return Infinity;
  const latitudeScale = Math.cos(Number(latitude) * Math.PI / 180);
  const dx = (lon - Number(longitude)) * latitudeScale;
  const dy = lat - Number(latitude);
  return dx * dx + dy * dy;
}

function nearestAdministrativeCity(cities, latitude, longitude) {
  if (!isValidCoordinatePair(latitude, longitude) || !Array.isArray(cities)) return null;
  let nearest = null;
  let nearestDistance = Infinity;
  for (const city of cities) {
    const distance = distanceSquared(latitude, longitude, city);
    if (distance >= nearestDistance) continue;
    nearestDistance = distance;
    nearest = city;
  }
  if (!nearest) return null;
  return {
    name: cleanPart(nearest[0]),
    country: cleanPart(nearest[1]),
    latitude: Number(nearest[2]),
    longitude: Number(nearest[3]),
    distanceSquared: nearestDistance,
    provider: 'offline-city-index',
  };
}

function fromBigDataCloud(body) {
  body = body || {};
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  if (!isValidCoordinatePair(latitude, longitude)) throw new Error('REVERSE_LOCATION_INVALID');
  const region = cleanPart(body.principalSubdivision);
  const locality = cleanPart(body.locality || body.localityInfo && body.localityInfo.administrative && body.localityInfo.administrative[0] && body.localityInfo.administrative[0].name);
  const city = cityWithRegion(region, cleanPart(body.city || body.locality || body.principalSubdivision));
  if (!city) throw new Error('REVERSE_LOCATION_NAME_MISSING');
  return {
    city,
    locality,
    region,
    country: cleanPart(body.countryName || body.countryCode),
    latitude,
    longitude,
    provider: 'bigdatacloud',
  };
}

function fromNominatim(body) {
  body = body || {};
  const address = body.address || {};
  const latitude = Number(body.lat);
  const longitude = Number(body.lon);
  if (!isValidCoordinatePair(latitude, longitude)) throw new Error('REVERSE_LOCATION_INVALID');
  const region = cleanPart(address.state || address.province || address.region);
  const locality = cleanPart(address.suburb || address.district || address.city_district);
  const city = cityWithRegion(region, cleanPart(address.city || address.municipality || address.town || address.county));
  if (!city) throw new Error('REVERSE_LOCATION_NAME_MISSING');
  return {
    city,
    locality,
    region,
    country: cleanPart(address.country),
    latitude,
    longitude,
    provider: 'nominatim',
  };
}

module.exports = {
  cityWithRegion,
  fromBigDataCloud,
  fromNominatim,
  isValidCoordinatePair,
  localizedCityLabel,
  nearestAdministrativeCity,
};

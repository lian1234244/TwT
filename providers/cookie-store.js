'use strict';

const fs = require('fs');

function parseCookieHeader(input) {
  const out = {};
  String(input || '').split(';').forEach(part => {
    const raw = part.trim();
    const index = raw.indexOf('=');
    if (index <= 0) return;
    out[raw.slice(0, index).trim()] = raw.slice(index + 1).trim();
  });
  return out;
}

function serializeCookie(input) {
  if (Array.isArray(input)) input = input.join('; ');
  if (input && typeof input === 'object') {
    return Object.entries(input).filter(([, value]) => value != null && value !== '')
      .map(([key, value]) => `${key}=${value}`).join('; ');
  }
  return Object.entries(parseCookieHeader(input))
    .map(([key, value]) => `${key}=${value}`).join('; ');
}

function createCookieStore(filePath) {
  let value = '';
  try { value = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8').trim() : ''; } catch (_) {}
  return {
    get: () => value,
    object: () => parseCookieHeader(value),
    set(input) {
      value = serializeCookie(input);
      try { fs.writeFileSync(filePath, value, 'utf8'); } catch (_) {}
      return value;
    },
    clear() {
      value = '';
      try { fs.rmSync(filePath, { force: true }); } catch (_) {}
    },
  };
}

module.exports = { createCookieStore, parseCookieHeader, serializeCookie };

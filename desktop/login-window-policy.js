'use strict';

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function fitLoginWindowBounds(workArea, preferred = {}) {
  const area = workArea || {};
  const areaX = Math.round(finiteNumber(area.x, 0));
  const areaY = Math.round(finiteNumber(area.y, 0));
  const areaWidth = Math.max(1, Math.round(finiteNumber(area.width, preferred.width || 900)));
  const areaHeight = Math.max(1, Math.round(finiteNumber(area.height, preferred.height || 720)));
  const margin = Math.max(8, Math.min(32, Math.round(finiteNumber(preferred.margin, 20))));
  const availableWidth = Math.max(1, areaWidth - margin * 2);
  const availableHeight = Math.max(1, areaHeight - margin * 2);
  const width = Math.max(1, Math.min(Math.round(finiteNumber(preferred.width, 900)), availableWidth));
  const height = Math.max(1, Math.min(Math.round(finiteNumber(preferred.height, 720)), availableHeight));

  return {
    x: areaX + Math.max(0, Math.floor((areaWidth - width) / 2)),
    y: areaY + Math.max(0, Math.floor((areaHeight - height) / 2)),
    width,
    height,
    minWidth: Math.min(width, Math.max(1, Math.round(finiteNumber(preferred.minWidth, 760)))),
    minHeight: Math.min(height, Math.max(1, Math.round(finiteNumber(preferred.minHeight, 560)))),
  };
}

module.exports = { fitLoginWindowBounds };

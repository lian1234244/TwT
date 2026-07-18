'use strict';

const BASE_CHROMIUM_SWITCHES = [
  ['autoplay-policy', 'no-user-gesture-required'],
  ['enable-gpu-rasterization'],
  ['enable-oop-rasterization'],
  ['enable-zero-copy'],
  ['enable-accelerated-2d-canvas'],
  ['disable-background-timer-throttling'],
  ['disable-renderer-backgrounding'],
  ['disable-backgrounding-occluded-windows'],
];

const FORCED_GPU_SWITCHES = [
  ['ignore-gpu-blocklist'],
  ['force_high_performance_gpu'],
  ['use-angle', 'd3d11'],
];

function chromiumPerformanceSwitches(env = process.env) {
  const switches = BASE_CHROMIUM_SWITCHES.map(item => item.slice());
  if (env && env.MINERADIO_FORCE_GPU === '1') {
    switches.push(...FORCED_GPU_SWITCHES.map(item => item.slice()));
  }
  return switches;
}

module.exports = {
  chromiumPerformanceSwitches,
};

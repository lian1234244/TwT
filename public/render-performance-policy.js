(function(root, factory) {
  var policy = factory();
  if (typeof module === 'object' && module.exports) module.exports = policy;
  if (root) root.MineradioRenderPerformancePolicy = policy;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  'use strict';

  var COMPOSITE_FPS = {
    eco: 36,
    balanced: 48,
    high: 60,
    ultra: 72,
  };

  function normalizeTier(tier) {
    tier = Math.round(Number(tier) || 0);
    return Math.max(0, Math.min(2, tier));
  }

  function compositePlaybackFps(quality, tier) {
    var base = COMPOSITE_FPS[String(quality || '')] || COMPOSITE_FPS.high;
    tier = normalizeTier(tier);
    if (tier >= 2) return Math.min(base, 60);
    if (tier >= 1) return Math.min(base, 66);
    return base;
  }

  function interactionFps(tier) {
    tier = normalizeTier(tier);
    return tier >= 2 ? 24 : (tier >= 1 ? 30 : 40);
  }

  function normalizeVisualFps(value) {
    var fps = Number(value);
    if (!isFinite(fps) || fps < 0) return -1;
    if (fps === 0) return 0;
    if (fps <= 26) return 24;
    if (fps <= 45) return 30;
    if (fps <= 90) return 60;
    return 120;
  }

  function resolveVisualFps(selection, automaticFps, interactionCap) {
    var selected = normalizeVisualFps(selection);
    var cap = Math.max(0, Number(interactionCap) || 0);
    if (cap > 0) return selected > 0 ? Math.min(selected, cap) : cap;
    if (selected >= 0) return selected;
    return Math.max(0, Number(automaticFps) || 0);
  }

  function percentile(sortedValues, ratio) {
    if (!sortedValues.length) return 0;
    var index = Math.max(0, Math.min(sortedValues.length - 1, Math.ceil(sortedValues.length * ratio) - 1));
    return sortedValues[index];
  }

  function createObserver(options) {
    options = options || {};
    var sampleWindowMs = Math.max(1000, Number(options.sampleWindowMs) || 2000);
    var historyLimit = Math.max(1, Math.min(120, Number(options.historyLimit) || 30));
    var frameLimit = Math.max(60, Math.min(720, Number(options.frameLimit) || 360));
    var state = {
      windowStartedAt: 0,
      frameTimes: [],
      frameCount: 0,
      longTaskCount: 0,
      longTaskDurationMs: 0,
      activeTaskMask: 0,
      lastTaskMask: 0,
      targetFps: 0,
      last: null,
      history: [],
    };

    function resetWindow(now) {
      state.windowStartedAt = now;
      state.frameTimes.length = 0;
      state.frameCount = 0;
      state.longTaskCount = 0;
      state.longTaskDurationMs = 0;
      state.activeTaskMask = 0;
    }

    function summarize(now) {
      var elapsed = Math.max(1, now - state.windowStartedAt);
      var sorted = state.frameTimes.slice().sort(function(a, b) { return a - b; });
      var total = 0;
      for (var i = 0; i < sorted.length; i++) total += sorted[i];
      var averageFrameMs = sorted.length ? total / sorted.length : 0;
      var p95FrameMs = percentile(sorted, 0.95);
      var targetFps = Math.max(0, Number(state.targetFps) || 0);
      var observedFastFrame = percentile(sorted, 0.20) || (1000 / 60);
      var frameBudgetMs = targetFps > 0
        ? 1000 / targetFps
        : Math.max(1000 / 144, Math.min(1000 / 30, observedFastFrame));
      var longFrameCount = 0;
      for (var j = 0; j < sorted.length; j++) {
        if (sorted[j] > frameBudgetMs * 1.50) longFrameCount += 1;
      }
      var longFrameRatio = sorted.length ? longFrameCount / sorted.length : 0;
      var status = 'stable';
      if (p95FrameMs > frameBudgetMs * 1.45 || longFrameRatio > 0.20 || state.longTaskDurationMs > elapsed * 0.18) {
        status = 'critical';
      } else if (p95FrameMs > frameBudgetMs * 1.15 || longFrameRatio > 0.08 || state.longTaskCount > 0) {
        status = 'pressured';
      }
      var snapshot = {
        observeOnly: true,
        status: status,
        sampledAt: Math.round(now),
        windowMs: Math.round(elapsed),
        fps: Math.round(state.frameCount * 1000 / elapsed),
        targetFps: targetFps,
        frameBudgetMs: Number(frameBudgetMs.toFixed(2)),
        averageFrameMs: Number(averageFrameMs.toFixed(2)),
        p95FrameMs: Number(p95FrameMs.toFixed(2)),
        longFrameRatio: Number(longFrameRatio.toFixed(3)),
        longTaskCount: state.longTaskCount,
        longTaskDurationMs: Math.round(state.longTaskDurationMs),
        activeTaskMask: state.activeTaskMask,
        lastTaskMask: state.lastTaskMask,
      };
      state.last = snapshot;
      state.history.push(snapshot);
      if (state.history.length > historyLimit) state.history.splice(0, state.history.length - historyLimit);
      resetWindow(now);
      return snapshot;
    }

    function recordFrame(now, frameMs, targetFps, taskMask) {
      now = Math.max(0, Number(now) || 0);
      frameMs = Math.max(0, Math.min(250, Number(frameMs) || 0));
      if (!state.windowStartedAt) resetWindow(now);
      state.frameCount += 1;
      state.targetFps = Math.max(0, Number(targetFps) || 0);
      state.lastTaskMask = Math.max(0, Number(taskMask) || 0) | 0;
      state.activeTaskMask |= state.lastTaskMask;
      if (frameMs > 0) {
        state.frameTimes.push(frameMs);
        if (state.frameTimes.length > frameLimit) state.frameTimes.splice(0, state.frameTimes.length - frameLimit);
      }
      if (now - state.windowStartedAt >= sampleWindowMs) return summarize(now);
      return null;
    }

    function recordLongTask(durationMs) {
      durationMs = Math.max(0, Number(durationMs) || 0);
      if (!durationMs) return;
      state.longTaskCount += 1;
      state.longTaskDurationMs += durationMs;
    }

    function snapshot() {
      return {
        observeOnly: true,
        last: state.last,
        history: state.history.slice(),
      };
    }

    return {
      recordFrame: recordFrame,
      recordLongTask: recordLongTask,
      snapshot: snapshot,
    };
  }

  return {
    compositePlaybackFps: compositePlaybackFps,
    interactionFps: interactionFps,
    normalizeVisualFps: normalizeVisualFps,
    resolveVisualFps: resolveVisualFps,
    createObserver: createObserver,
  };
});

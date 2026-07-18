function evenDimension(value, fallback) {
  const n = Math.max(2, Math.round(Number(value) || Number(fallback) || 2));
  return n % 2 === 0 ? n : n - 1;
}

function encoderAlignedDimension(value, fallback) {
  const n = Math.max(8, Number(value) || Number(fallback) || 8);
  return Math.max(8, Math.round(n / 8) * 8);
}

function fitAspectWithin(aspect, maxWidth, maxHeight) {
  const safeAspect = Number(aspect) > 0 ? Number(aspect) : (16 / 9);
  const widthLimit = evenDimension(maxWidth, 1920);
  const heightLimit = evenDimension(maxHeight, 1080);
  if (safeAspect >= widthLimit / heightLimit) {
    return {
      width: widthLimit,
      height: Math.min(heightLimit, encoderAlignedDimension(widthLimit / safeAspect, heightLimit)),
    };
  }
  return {
    width: Math.min(widthLimit, encoderAlignedDimension(heightLimit * safeAspect, widthLimit)),
    height: heightLimit,
  };
}

function obsCanvasSize(payload, windowInfo) {
  const clientWidth = Number(windowInfo && windowInfo.clientWidth) || 1920;
  const clientHeight = Number(windowInfo && windowInfo.clientHeight) || 1080;
  const aspect = clientWidth > 0 && clientHeight > 0 ? clientWidth / clientHeight : (16 / 9);
  const resolution = String(payload && payload.resolution || 'screen');
  if (resolution === '1080') return fitAspectWithin(aspect, 1920, 1080);
  if (resolution === '1440') return fitAspectWithin(aspect, 2560, 1440);
  if (resolution === '2160') return fitAspectWithin(aspect, 3840, 2160);
  return {
    width: evenDimension(clientWidth, 1920),
    height: evenDimension(clientHeight, 1080),
  };
}

function aspectDifference(a, b) {
  if (!(a > 0) || !(b > 0)) return Number.POSITIVE_INFINITY;
  return Math.abs(a - b) / b;
}

function obsClientCrop(windowInfo, sourceTransform) {
  const windowWidth = Number(windowInfo && windowInfo.windowWidth) || 0;
  const windowHeight = Number(windowInfo && windowInfo.windowHeight) || 0;
  const clientWidth = Number(windowInfo && windowInfo.clientWidth) || 0;
  const clientHeight = Number(windowInfo && windowInfo.clientHeight) || 0;
  const sourceWidth = Number(sourceTransform && sourceTransform.sourceWidth) || 0;
  const sourceHeight = Number(sourceTransform && sourceTransform.sourceHeight) || 0;
  if (!(windowWidth > 0 && windowHeight > 0 && clientWidth > 0 && clientHeight > 0 && sourceWidth > 0 && sourceHeight > 0)) {
    return { left: 0, top: 0, right: 0, bottom: 0, mode: 'unknown' };
  }

  const sourceAspect = sourceWidth / sourceHeight;
  const clientAspect = clientWidth / clientHeight;
  const windowAspect = windowWidth / windowHeight;
  const clientDiff = aspectDifference(sourceAspect, clientAspect);
  const windowDiff = aspectDifference(sourceAspect, windowAspect);

  // OBS already excluded the frame. Cropping again would cut into the wallpaper.
  if (clientDiff <= windowDiff || clientDiff < 0.0025) {
    return { left: 0, top: 0, right: 0, bottom: 0, mode: 'client' };
  }

  const rawWindowX = Number(windowInfo && windowInfo.windowX);
  const rawWindowY = Number(windowInfo && windowInfo.windowY);
  const rawClientX = Number(windowInfo && windowInfo.clientX);
  const rawClientY = Number(windowInfo && windowInfo.clientY);
  const windowX = Number.isFinite(rawWindowX) ? rawWindowX : 0;
  const windowY = Number.isFinite(rawWindowY) ? rawWindowY : 0;
  const clientX = Number.isFinite(rawClientX) ? rawClientX : windowX;
  const clientY = Number.isFinite(rawClientY) ? rawClientY : windowY;
  const logicalLeft = Math.max(0, clientX - windowX);
  const logicalTop = Math.max(0, clientY - windowY);
  const logicalRight = Math.max(0, windowWidth - logicalLeft - clientWidth);
  const logicalBottom = Math.max(0, windowHeight - logicalTop - clientHeight);
  const scaleX = sourceWidth / windowWidth;
  const scaleY = sourceHeight / windowHeight;
  const left = Math.max(0, Math.round(logicalLeft * scaleX));
  const top = Math.max(0, Math.round(logicalTop * scaleY));
  const right = Math.max(0, Math.round(logicalRight * scaleX));
  const bottom = Math.max(0, Math.round(logicalBottom * scaleY));

  if (left + right >= sourceWidth - 2 || top + bottom >= sourceHeight - 2) {
    return { left: 0, top: 0, right: 0, bottom: 0, mode: 'invalid' };
  }
  return { left, top, right, bottom, mode: 'window' };
}

module.exports = {
  evenDimension,
  encoderAlignedDimension,
  fitAspectWithin,
  obsCanvasSize,
  obsClientCrop,
};

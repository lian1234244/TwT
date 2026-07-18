const assert = require('assert');
const { obsCanvasSize, obsClientCrop } = require('../desktop/wallpaper-capture-geometry');

const maximizedWindow = {
  windowX: 0,
  windowY: 0,
  windowWidth: 1920,
  windowHeight: 1048,
  clientX: 0,
  clientY: 39,
  clientWidth: 1920,
  clientHeight: 1009,
};

assert.deepStrictEqual(
  obsClientCrop(maximizedWindow, { sourceWidth: 1920, sourceHeight: 1009 }),
  { left: 0, top: 0, right: 0, bottom: 0, mode: 'client' },
);
assert.deepStrictEqual(
  obsClientCrop(maximizedWindow, { sourceWidth: 1920, sourceHeight: 1048 }),
  { left: 0, top: 39, right: 0, bottom: 0, mode: 'window' },
);

const dpiScaledWindow = {
  windowX: 100,
  windowY: 50,
  windowWidth: 1280,
  windowHeight: 699,
  clientX: 105,
  clientY: 76,
  clientWidth: 1270,
  clientHeight: 667,
};
assert.deepStrictEqual(
  obsClientCrop(dpiScaledWindow, { sourceWidth: 1920, sourceHeight: 1049 }),
  { left: 8, top: 39, right: 8, bottom: 9, mode: 'window' },
);

const negativeMonitorOrigin = {
  windowX: -1928,
  windowY: -8,
  windowWidth: 1920,
  windowHeight: 1048,
  clientX: -1920,
  clientY: 31,
  clientWidth: 1904,
  clientHeight: 1001,
};
assert.deepStrictEqual(
  obsClientCrop(negativeMonitorOrigin, { sourceWidth: 1920, sourceHeight: 1048 }),
  { left: 8, top: 39, right: 8, bottom: 8, mode: 'window' },
);

assert.deepStrictEqual(obsCanvasSize({ resolution: 'screen' }, maximizedWindow), { width: 1920, height: 1008 });
assert.deepStrictEqual(obsCanvasSize({ resolution: '1080' }, maximizedWindow), { width: 1920, height: 1008 });
assert.deepStrictEqual(obsCanvasSize({ resolution: '1440' }, maximizedWindow), { width: 2560, height: 1344 });
assert.deepStrictEqual(obsCanvasSize({ resolution: '2160' }, maximizedWindow), { width: 3840, height: 2016 });

const standardWidescreen = { clientWidth: 1920, clientHeight: 1080 };
assert.deepStrictEqual(obsCanvasSize({ resolution: '1080' }, standardWidescreen), { width: 1920, height: 1080 });
assert.deepStrictEqual(obsCanvasSize({ resolution: '1440' }, standardWidescreen), { width: 2560, height: 1440 });
assert.deepStrictEqual(obsCanvasSize({ resolution: '2160' }, standardWidescreen), { width: 3840, height: 2160 });

const ultrawide = { clientWidth: 3440, clientHeight: 1440 };
assert.deepStrictEqual(obsCanvasSize({ resolution: '1080' }, ultrawide), { width: 1920, height: 800 });
assert.deepStrictEqual(obsCanvasSize({ resolution: '1440' }, ultrawide), { width: 2560, height: 1072 });
assert.deepStrictEqual(obsCanvasSize({ resolution: '2160' }, ultrawide), { width: 3840, height: 1608 });

const portrait = { clientWidth: 1080, clientHeight: 1920 };
assert.deepStrictEqual(obsCanvasSize({ resolution: '1080' }, portrait), { width: 608, height: 1080 });
assert.deepStrictEqual(obsCanvasSize({ resolution: '1440' }, portrait), { width: 808, height: 1440 });
assert.deepStrictEqual(obsCanvasSize({ resolution: '2160' }, portrait), { width: 1216, height: 2160 });

for (const resolution of ['1080', '1440', '2160']) {
  const wideCanvas = obsCanvasSize({ resolution }, maximizedWindow);
  const portraitCanvas = obsCanvasSize({ resolution }, portrait);
  assert.strictEqual(wideCanvas.height % 8, 0, `${resolution} wide derived height must be encoder aligned`);
  assert.strictEqual(portraitCanvas.width % 8, 0, `${resolution} portrait derived width must be encoder aligned`);
}

console.log('wallpaper capture geometry tests passed');

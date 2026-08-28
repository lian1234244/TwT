const http = require('http');

function testEndpoint(path, label) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = http.get('http://localhost:3000' + path, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        const ms = Date.now() - start;
        console.log(label + ': ' + ms + 'ms, status=' + res.statusCode + ', len=' + body.length);
        resolve();
      });
    });
    req.on('error', (err) => {
      const ms = Date.now() - start;
      console.log(label + ': FAILED ' + ms + 'ms - ' + err.message);
      resolve();
    });
    req.setTimeout(120000, () => {
      const ms = Date.now() - start;
      console.log(label + ': TIMEOUT ' + ms + 'ms');
      req.destroy();
      resolve();
    });
  });
}

(async () => {
  console.log('=== API Speed Test ===');
  await testEndpoint('/api/app/version', 'Version');
  await testEndpoint('/api/search?keywords=周杰伦&page=1&limit=5', 'Search');
  await testEndpoint('/api/search?keywords=周杰伦&page=1&limit=5', 'Search(cached)');
  await testEndpoint('/api/song/url?id=1824025071&quality=hires', 'SongURL');
  await testEndpoint('/api/song/url?id=1824025071&quality=hires', 'SongURL(cached)');
  await testEndpoint('/api/lyric?id=1824025071', 'Lyric');
  await testEndpoint('/api/lyric?id=1824025071', 'Lyric(cached)');
  console.log('=== Done ===');
  process.exit(0);
})();
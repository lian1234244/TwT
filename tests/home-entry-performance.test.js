const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const start = source.indexOf('function updateEmptyHomeVisibility(opts)');
const end = source.indexOf('function runHomeSearch(', start);
assert(start >= 0 && end > start, 'home visibility function must exist');

const visibilityBody = source.slice(start, end);
const renderCalls = (visibilityBody.match(/renderHomeDiscover\(\);/g) || []).length;
assert(renderCalls <= 1, `Home reveal must render at most once synchronously, found ${renderCalls}`);

[
  'function prepareEmptyHomeReveal()',
  "document.body.classList.add('home-entry-prepared', 'home-entry-settling')",
  'prepareEmptyHomeReveal();',
  'function completePreparedHomeReveal()',
  'body.home-entry-settling .home-card',
].forEach((contract) => {
  assert(source.includes(contract), `missing smooth Home entry contract: ${contract}`);
});

console.log('home entry performance contract tests passed');

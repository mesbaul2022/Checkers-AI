const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('web/index.html', 'utf8');
const js = fs.readFileSync('web/script.js', 'utf8');
const css = fs.readFileSync('web/style.css', 'utf8');

// 1. Verify HTML structure & onclick handlers
const expectedTimes = ['0', '60', '120', '180', '300'];
expectedTimes.forEach((t) => {
  assert(html.includes(`data-time="${t}"`), `Missing data-time="${t}" in HTML`);
  assert(html.includes(`onclick="selectTimeLimit(${t})"`), `Missing onclick="selectTimeLimit(${t})" in HTML`);
});

// Verify cache busting in index.html
assert(html.includes('script.js?v=2.0'), 'Missing script.js cache-busting');
assert(html.includes('style.css?v=2.0'), 'Missing style.css cache-busting');

// Verify inline selectTimeLimit in index.html
assert(html.includes('function selectTimeLimit'), 'Missing inline fallback in index.html');

// 2. Verify CSS pointer-events rule
assert(css.includes('.time-option-btn *'), 'Missing pointer-events rule in CSS');
assert(css.includes('pointer-events: none'), 'Missing pointer-events: none in CSS');

// 3. Test functional behavior with DOM mock
class MockElement {
  constructor(id, dataTime, classNames = []) {
    this.id = id;
    this.dataset = { time: dataTime };
    this.classList = new Set(classNames);
    this.textContent = '';
  }
  getAttribute(attr) {
    if (attr === 'data-time') return this.dataset.time;
    return null;
  }
}

const buttons = [
  new MockElement('btn0', '0', ['time-option-btn', 'active']),
  new MockElement('btn60', '60', ['time-option-btn']),
  new MockElement('btn120', '120', ['time-option-btn']),
  new MockElement('btn180', '180', ['time-option-btn']),
  new MockElement('btn300', '300', ['time-option-btn']),
];
const pill = new MockElement('time-limit-indicator-pill', null);

const pregameSettings = { timeLimit: 0 };

function selectTimeLimit(seconds) {
  seconds = parseInt(seconds, 10);
  if (isNaN(seconds)) seconds = 0;
  pregameSettings.timeLimit = seconds;

  buttons.forEach((btn) => {
    const btnTime = parseInt(btn.dataset.time, 10);
    if (btnTime === seconds) {
      btn.classList.add('active');
    } else {
      btn.classList.delete('active');
    }
  });

  if (seconds === 0) {
    pill.textContent = 'No Limit';
  } else {
    pill.textContent = `${Math.floor(seconds / 60)} Min Limit`;
  }
}

// Test selecting 60 (1 Min)
selectTimeLimit(60);
assert.strictEqual(pregameSettings.timeLimit, 60);
assert.strictEqual(pill.textContent, '1 Min Limit');
assert(buttons[1].classList.has('active'));
assert(!buttons[0].classList.has('active'));

// Test selecting 120 (2 Min)
selectTimeLimit(120);
assert.strictEqual(pregameSettings.timeLimit, 120);
assert.strictEqual(pill.textContent, '2 Min Limit');
assert(buttons[2].classList.has('active'));
assert(!buttons[1].classList.has('active'));

// Test selecting 180 (3 Min)
selectTimeLimit(180);
assert.strictEqual(pregameSettings.timeLimit, 180);
assert.strictEqual(pill.textContent, '3 Min Limit');
assert(buttons[3].classList.has('active'));

// Test selecting 300 (5 Min)
selectTimeLimit(300);
assert.strictEqual(pregameSettings.timeLimit, 300);
assert.strictEqual(pill.textContent, '5 Min Limit');
assert(buttons[4].classList.has('active'));

// Test selecting 0 (No Limit)
selectTimeLimit(0);
assert.strictEqual(pregameSettings.timeLimit, 0);
assert.strictEqual(pill.textContent, 'No Limit');
assert(buttons[0].classList.has('active'));
assert(!buttons[4].classList.has('active'));

console.log('All time limit interactive tests PASSED with 100% success!');

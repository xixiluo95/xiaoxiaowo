/* 「小小我」mockup 共享脚本：RoughJS 手绘叠加层 */
const INK = '#5B4A3F';
const CALM_STROKE = '#D8D2C4';

function roughRect(canvas, opts = {}) {
  const rc = rough.canvas(canvas);
  const dpr = 2;
  const w = canvas.width / dpr, h = canvas.height / dpr;
  const pad = 3;
  rc.rectangle(pad, pad, w - pad * 2, h - pad * 2, Object.assign({
    roughness: 1.2, bowing: 3.5, strokeWidth: 2,
    stroke: INK, seed: 42, fill: undefined,
  }, opts));
}

/* 给 .r-card 元素叠加手绘边框 */
function sketchCards(selector = '.r-card', opts = {}) {
  document.querySelectorAll(selector).forEach((el, i) => {
    const cv = document.createElement('canvas');
    cv.className = 'rough-layer';
    const dpr = 2;
    const w = el.offsetWidth + 8, h = el.offsetHeight + 8;
    cv.width = w * dpr; cv.height = h * dpr;
    cv.getContext('2d').scale(dpr, dpr);
    el.appendChild(cv);
    roughRect(cv, Object.assign({ seed: 42 + i * 7 }, opts, el.dataset.stroke ? { stroke: el.dataset.stroke } : {}, el.dataset.fill ? { fill: el.dataset.fill, fillStyle: 'solid' } : {}));
  });
}

/* 手绘心形：在 canvas 中绘制，size 为 css 像素 */
function drawHeart(canvas, { color = '#FFFFFF', stroke = CALM_STROKE, fillStyle = 'solid', seed = 42, strokeWidth = 2.5 } = {}) {
  const dpr = 2;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const w = canvas.width / dpr, h = canvas.height / dpr;
  const rc = rough.canvas(canvas);
  const s = Math.min(w, h) / 100;
  const ox = (w - 100 * s) / 2, oy = (h - 100 * s) / 2;
  ctx.save();
  // heart path 手工缩放：M50,88 C20,62 6,42 15,24 C23,9 42,11 50,26 C58,11 77,9 85,24 C94,42 80,62 50,88 Z
  const p = `M ${ox + 50 * s} ${oy + 88 * s}
    C ${ox + 20 * s} ${oy + 62 * s}, ${ox + 6 * s} ${oy + 42 * s}, ${ox + 15 * s} ${oy + 24 * s}
    C ${ox + 23 * s} ${oy + 9 * s}, ${ox + 42 * s} ${oy + 11 * s}, ${ox + 50 * s} ${oy + 26 * s}
    C ${ox + 58 * s} ${oy + 11 * s}, ${ox + 77 * s} ${oy + 9 * s}, ${ox + 85 * s} ${oy + 24 * s}
    C ${ox + 94 * s} ${oy + 42 * s}, ${ox + 80 * s} ${oy + 62 * s}, ${ox + 50 * s} ${oy + 88 * s} Z`;
  rc.path(p, {
    roughness: 1.6, bowing: 3, strokeWidth, stroke,
    fill: color, fillStyle, fillWeight: 1.2, hachureGap: 6, seed,
  });
  ctx.restore();
}

/* 手绘小图标：日历 / 小人 */
function prep(canvas) {
  const dpr = 2;
  canvas.getContext('2d').scale(dpr, dpr);
  return { w: canvas.width / dpr, h: canvas.height / dpr };
}
function drawIconCalendar(canvas) {
  const { w, h } = prep(canvas);
  const rc = rough.canvas(canvas);
  const x = w * 0.16, y = h * 0.2, bw = w * 0.68, bh = h * 0.62;
  const o = { roughness: 1.6, bowing: 2, strokeWidth: 2, stroke: INK, seed: 9 };
  rc.rectangle(x, y, bw, bh, o);
  rc.line(x, y + bh * 0.26, x + bw, y + bh * 0.24, o);
  rc.line(x + bw * 0.25, y - h * 0.08, x + bw * 0.25, y + bh * 0.14, o);
  rc.line(x + bw * 0.75, y - h * 0.08, x + bw * 0.75, y + bh * 0.14, o);
  // 小心心点
  rc.circle(x + bw * 0.5, y + bh * 0.62, bw * 0.16, Object.assign({}, o, { fill: '#FFC94D', fillStyle: 'solid' }));
}

function drawIconPerson(canvas) {
  const { w, h } = prep(canvas);
  const rc = rough.canvas(canvas);
  const o = { roughness: 1.6, bowing: 2, strokeWidth: 2, stroke: INK, seed: 11 };
  rc.circle(w * 0.5, h * 0.3, w * 0.26, o);
  rc.path(`M ${w * 0.22} ${h * 0.86} C ${w * 0.24} ${h * 0.56}, ${w * 0.76} ${h * 0.56}, ${w * 0.78} ${h * 0.86}`, o);
}

function drawIconMic(canvas, color = INK) {
  const { w, h } = prep(canvas);
  const rc = rough.canvas(canvas);
  const o = { roughness: 1.4, bowing: 2, strokeWidth: 2, stroke: color, seed: 13 };
  rc.rectangle(w * 0.38, h * 0.12, w * 0.24, h * 0.44, o);
  rc.path(`M ${w * 0.24} ${h * 0.42} C ${w * 0.26} ${h * 0.68}, ${w * 0.74} ${h * 0.68}, ${w * 0.76} ${h * 0.42}`, o);
  rc.line(w * 0.5, h * 0.66, w * 0.5, h * 0.84, o);
  rc.line(w * 0.34, h * 0.86, w * 0.66, h * 0.86, o);
}

function drawIconKeyboard(canvas, color = INK) {
  const { w, h } = prep(canvas);
  const rc = rough.canvas(canvas);
  const o = { roughness: 1.4, bowing: 2, strokeWidth: 2, stroke: color, seed: 15 };
  rc.rectangle(w * 0.12, h * 0.28, w * 0.76, h * 0.46, o);
  [[0.28, 0.42], [0.5, 0.41], [0.72, 0.43], [0.34, 0.6], [0.66, 0.61]].forEach(([px, py]) => {
    rc.circle(w * px, h * py, 3.5, Object.assign({}, o, { fill: color, fillStyle: 'solid' }));
  });
  rc.line(w * 0.4, h * 0.62, w * 0.6, h * 0.62, o);
}

/* 手绘日记本：本子 + 斜放铅笔 */
function drawIconBook(canvas, color = INK) {
  const { w, h } = prep(canvas);
  const rc = rough.canvas(canvas);
  const o = { roughness: 1.5, bowing: 2, strokeWidth: 2, stroke: color, seed: 17 };
  // 本子封面
  rc.rectangle(w * 0.16, h * 0.18, w * 0.52, h * 0.64, o);
  // 书脊线
  rc.line(w * 0.26, h * 0.18, w * 0.25, h * 0.82, o);
  // 封面上的两行字
  rc.line(w * 0.34, h * 0.4, w * 0.58, h * 0.39, o);
  rc.line(w * 0.34, h * 0.54, w * 0.52, h * 0.53, o);
  // 斜放铅笔（笔身 + 笔尖）
  rc.line(w * 0.56, h * 0.78, w * 0.84, h * 0.26, o);
  rc.line(w * 0.62, h * 0.84, w * 0.9, h * 0.32, o);
  rc.path(`M ${w * 0.56} ${h * 0.78} L ${w * 0.55} ${h * 0.9} L ${w * 0.62} ${h * 0.84} Z`,
    Object.assign({}, o, { fill: color, fillStyle: 'solid' }));
}

/* 手绘按钮边框（长条） */
function sketchButton(canvas, opts = {}) {
  const { w, h } = prep(canvas);
  const rc = rough.canvas(canvas);
  rc.rectangle(3, 3, w - 6, h - 6, Object.assign({
    roughness: 1.3, bowing: 3, strokeWidth: 2, stroke: INK, seed: 21,
  }, opts));
}

/* 加载完成后统一渲染 */
function renderRough() {
  sketchCards();
  document.querySelectorAll('canvas[data-heart]').forEach(cv => {
    const d = cv.dataset;
    drawHeart(cv, {
      color: d.heart || '#FFFFFF',
      stroke: d.stroke || CALM_STROKE,
      fillStyle: d.fillstyle || 'solid',
      seed: +(d.seed || 42),
      strokeWidth: +(d.strokewidth || 2.5),
    });
  });
  document.querySelectorAll('canvas[data-icon]').forEach(cv => {
    const fn = { calendar: drawIconCalendar, person: drawIconPerson, mic: drawIconMic, keyboard: drawIconKeyboard, book: drawIconBook }[cv.dataset.icon];
    if (fn) fn(cv, cv.dataset.color || undefined);
  });
  document.querySelectorAll('canvas[data-btn]').forEach(cv => {
    sketchButton(cv, cv.dataset.stroke ? { stroke: cv.dataset.stroke } : {});
  });
}

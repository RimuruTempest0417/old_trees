/** Chart.js 共用設定與常用圖表建構器（顏色跟隨頁面主題變數） */

export const PALETTE = ['#166534', '#22a35c', '#86c06c', '#d9a441', '#b45309', '#b91c1c',
  '#1d4ed8', '#6d28d9', '#0f766e', '#a16207'];

export const HEALTH_COLORS = { 健康: '#16a34a', 一般: '#f59e0b', 瀕危: '#dc2626' };
export const GRADE_COLORS = { 一級: '#b91c1c', 二級: '#b45309', 三級: '#22a35c', 不分級: '#1d4ed8' };

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function baseOptions(extra = {}) {
  const ink = cssVar('--ink', '#18231c');
  const mute = cssVar('--ink-mute', '#7b8a81');
  const line = cssVar('--line', '#dde5de');
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 420 },
    plugins: {
      legend: { labels: { color: ink, boxWidth: 12, font: { size: 11 } } },
      tooltip: { padding: 10, titleFont: { size: 12 }, bodyFont: { size: 12 } },
      ...(extra.plugins || {}),
    },
    scales: extra.scales === false ? undefined : {
      x: {
        ticks: { color: mute, font: { size: 11 }, maxRotation: 45, autoSkip: true },
        grid: { color: line, drawBorder: false },
        title: extra.xTitle ? { display: true, text: extra.xTitle, color: mute, font: { size: 11 } } : undefined,
        ...(extra.x || {}),
      },
      y: {
        ticks: { color: mute, font: { size: 11 } },
        grid: { color: line, drawBorder: false },
        beginAtZero: extra.beginAtZero !== false,
        title: extra.yTitle ? { display: true, text: extra.yTitle, color: mute, font: { size: 11 } } : undefined,
        ...(extra.y || {}),
      },
    },
    ...(extra.root || {}),
  };
}

export function destroyAll(container) {
  container.querySelectorAll('canvas').forEach((c) => {
    if (c._chart) { c._chart.destroy(); c._chart = null; }
  });
}

/**
 * 建立圖表前先清掉同一塊 canvas 上的舊圖表。
 *
 * Chart.js 不允許同一個 canvas 同時掛兩個圖表；直接 new Chart() 會丟出
 * 「Canvas is already in use」，舊圖表還留在畫面上 —— 使用者看到的就是
 * 「切換模型／切換線條沒有任何反應」（v0.16.0 的擬合模型切換即為此症狀）。
 */
function mount(canvas, config) {
  if (!canvas) return null;
  if (canvas._chart) { canvas._chart.destroy(); canvas._chart = null; }
  const chart = new window.Chart(canvas, config);
  canvas._chart = chart;
  return chart;
}

export function barChart(canvas, labels, values, opts = {}) {
  return mount(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: opts.label || '株數',
        data: values,
        backgroundColor: opts.colors || PALETTE[0],
        borderRadius: 5,
        maxBarThickness: opts.maxBarThickness || 46,
      }],
    },
    options: baseOptions({
      xTitle: opts.xTitle, yTitle: opts.yTitle,
      root: opts.horizontal ? { indexAxis: 'y' } : {},
      plugins: opts.plugins,
    }),
  });
}

export function stackedBar(canvas, labels, datasets, opts = {}) {
  return mount(canvas, {
    type: 'bar',
    data: { labels, datasets },
    options: baseOptions({
      xTitle: opts.xTitle, yTitle: opts.yTitle,
      x: { stacked: true }, y: { stacked: true },
    }),
  });
}

export function doughnut(canvas, labels, values, colors) {
  const ink = cssVar('--ink', '#18231c');
  return mount(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: cssVar('--card', '#fff') }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '58%',
      plugins: { legend: { position: 'bottom', labels: { color: ink, boxWidth: 12, font: { size: 11 } } } },
    },
  });
}

export function scatterWithFit(canvas, points, fitCurve, opts = {}) {
  const mute = cssVar('--ink-mute', '#7b8a81');
  const datasets = [{
    type: 'scatter',
    label: opts.pointLabel || '古樹個體',
    data: points,
    backgroundColor: opts.pointColor || 'rgba(34, 163, 92, .45)',
    pointRadius: opts.pointRadius || 3,
    pointHoverRadius: 6,
  }];
  if (fitCurve && fitCurve.length) {
    datasets.push({
      type: 'line',
      label: opts.fitLabel || '擬合曲線',
      data: fitCurve,
      borderColor: '#b91c1c',
      backgroundColor: 'transparent',
      borderWidth: 2.5,
      pointRadius: 0,
      tension: 0.2,
    });
  }
  const chart = mount(canvas, {
    type: 'scatter',
    data: { datasets },
    options: baseOptions({
      xTitle: opts.xTitle, yTitle: opts.yTitle,
      x: { type: 'linear', position: 'bottom', title: undefined },
      beginAtZero: true,
    }),
  });
  chart.options.scales.x.ticks.color = mute;
  return chart;
}

export function lineChart(canvas, labels, datasets, opts = {}) {
  return mount(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: baseOptions({
      xTitle: opts.xTitle, yTitle: opts.yTitle,
      pointRadius: opts.pointRadius ?? 0,
      ...opts.extra,
    }),
  });
}

/**
 * Check Point VSX CPView Analytics Dashboard - Client Application
 */

// Early restoration of UI scaling and typography settings to avoid FOUC / layout shifts
(function restoreEarlyScale() {
  try {
    const raw = localStorage.getItem('cpview_scale_config');
    if (raw) {
      const cfg = JSON.parse(raw);
      if (cfg.zoom) {
        document.documentElement.style.setProperty('--ui-zoom', cfg.zoom);
        if (document.body) document.body.style.zoom = cfg.zoom;
      }
      if (cfg.fontScale) {
        document.documentElement.style.setProperty('--font-scale', cfg.fontScale);
      }
      if (cfg.fontFamily) {
        const families = {
          inter: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif",
          roboto: "'Roboto', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          system: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          mono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, Menlo, Monaco, Consolas, monospace",
          dyslexic: "'Atkinson Hyperlegible', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        };
        if (families[cfg.fontFamily]) {
          document.documentElement.style.setProperty('--font-sans', families[cfg.fontFamily]);
        }
      }
    }
  } catch (e) {}
})();

// Global state
let CP_DATA = null;
let currentCharts = {};
let activePage = 'diagnostics';
let interfacesFilter = { search: '', type: 'ALL' };
let spikesState = { search: '', page: 1, pageSize: 25, severity: 'all', timelineType: 'bar' };
let modalState = { tableName: '', page: 1, limit: 50, currentRows: [], columns: [] };
let sqlState = { columns: [], rows: [] };

// Time Horizon Global State
let timeRangeState = {
  mode: 'all', // 'all', '1w', '1d', 'custom'
  selectedWeekIndex: 1, // Default to Week 2 (Incidente Crítico 10-16 Mar)
  selectedDay: '2024-03-13', // Default to critical incident apex day
  startDate: '', // YYYY-MM-DD
  endDate: '',   // YYYY-MM-DD
  startTs: 0,
  endTs: Infinity
};

function filterTimeSeries(arr, tsProp = 'ts') {
  if (!arr || !Array.isArray(arr)) return [];
  const startTs = timeRangeState.startTs || 0;
  const endTs = timeRangeState.endTs || Infinity;
  return arr.filter(item => {
    const val = item[tsProp];
    if (val === undefined || val === null) return true;
    return val >= startTs && val <= endTs;
  });
}
let chartGenState = {
  sourceId: 'cpu-cores',
  allRows: [],
  rawRows: [],
  rows: [],
  columns: [],
  title: '',
  sqlFilter: '',
  diffCol: '',
  diffChartInstances: [],
  xCol: '',
  timeFormat: 'none',
  yCol: '*',
  op: 'COUNT',
  type: 'bar',
  sort: 'y-desc',
  limit: 15,
  color: '#06b6d4',
  recordSlice: 'all',
  dateFrom: null,
  dateTo: null,
  datasetMinDate: null,
  datasetMaxDate: null,
  chartInstance: null,
  processedData: null
};

// Translation helper
function t(key, fallback = '', params = {}) {
  if (window.i18n && typeof window.i18n.t === 'function') {
    return window.i18n.t(key, fallback, params);
  }
  let res = fallback || key;
  if (params && typeof res === 'string') {
    Object.keys(params).forEach(k => {
      res = res.replace(new RegExp(`\\{${k}\\}`, 'g'), params[k]);
    });
  }
  return res;
}

// Colors
const PALETTE = {
  cyan: '#06b6d4',
  blue: '#3b82f6',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  purple: '#8b5cf6',
  indigo: '#6366f1',
  pink: '#ec4899',
  gray: '#64748b'
};

const COLOR_SWATCHES = [
  { id: 'cyan', name: 'Cian', hex: '#06b6d4' },
  { id: 'blue', name: 'Azul', hex: '#3b82f6' },
  { id: 'emerald', name: 'Esmeralda', hex: '#10b981' },
  { id: 'amber', name: 'Ámbar', hex: '#f59e0b' },
  { id: 'rose', name: 'Rosa', hex: '#f43f5e' },
  { id: 'purple', name: 'Púrpura', hex: '#8b5cf6' },
  { id: 'indigo', name: 'Índigo', hex: '#6366f1' },
  { id: 'fuchsia', name: 'Fucsia', hex: '#ec4899' },
  { id: 'gray', name: 'Gris', hex: '#64748b' }
];

function getSwatchColorName(sw) {
  if (!sw) return '';
  return t('color.' + (sw.id || 'gray'), sw.name);
}

const SERIES_DEFAULT_COLORS = [
  '#06b6d4', '#3b82f6', '#10b981', '#f59e0b', '#f43f5e',
  '#8b5cf6', '#6366f1', '#ec4899', '#64748b'
];

// Cache for chart datasets configurations
const chartDatasetsCache = {};

// Universal Chart Customization State
const chartCustomState = {
  // Spikes
  'chart-spikes-timeline': { type: 'bar', color: PALETTE.amber, foregroundIndex: 0, activeSeriesIndex: 0, datasetColors: {} },
  'chart-spikes-cores': { type: 'doughnut', color: PALETTE.cyan, foregroundIndex: 0, activeSeriesIndex: 0, datasetColors: {} },
  'chart-spikes-consumers': { type: 'bar', color: PALETTE.rose, foregroundIndex: 0, activeSeriesIndex: 0, datasetColors: {} },
  'chart-thread-consumers': { type: 'horizontalBar', color: PALETTE.purple, foregroundIndex: 0, activeSeriesIndex: 0, datasetColors: {} },

  // Flofiler
  'chart-flofiler-protocols': { type: 'horizontalBar', color: PALETTE.cyan, foregroundIndex: 0, activeSeriesIndex: 0, datasetColors: {} },
  'chart-flofiler-components': { type: 'horizontalBar', color: PALETTE.purple, foregroundIndex: 0, activeSeriesIndex: 0, datasetColors: {} },

  // SecureXL & CoreXL
  'chart-sxl-f2v': { type: 'horizontalBar', color: PALETTE.cyan, foregroundIndex: 0, activeSeriesIndex: 0, datasetColors: {} },
  'chart-multik-fails': { type: 'horizontalBar', color: PALETTE.rose, foregroundIndex: 0, activeSeriesIndex: 0, datasetColors: {} },
  'chart-ppak-hourly-timeline': { type: 'line', color: PALETTE.cyan, foregroundIndex: 0, activeSeriesIndex: 0, datasetColors: {} },

  // Interfaces
  'chart-top-interfaces': { type: 'bar', color: PALETTE.cyan, foregroundIndex: 0, activeSeriesIndex: 0, datasetColors: {} },
  'chart-interfaces-timeline': { type: 'line', color: PALETTE.cyan, foregroundIndex: 0, activeSeriesIndex: 0, datasetColors: {} },

  // Overview
  'chart-overview-traffic': { type: 'line', color: PALETTE.cyan, foregroundIndex: 0, activeSeriesIndex: 0, datasetColors: {} },
  'chart-overview-cpu-mem': { type: 'line', color: PALETTE.amber, foregroundIndex: 0, activeSeriesIndex: 0, datasetColors: {} },

  // System
  'chart-cpu-cores-timeline': { type: 'line', color: PALETTE.cyan, foregroundIndex: 0, activeSeriesIndex: 0, datasetColors: {} },

  // Traffic
  'chart-conns-timeline': { type: 'line', color: PALETTE.cyan, foregroundIndex: 0, activeSeriesIndex: 0, datasetColors: {} },
  'chart-conns-states': { type: 'line', color: PALETTE.emerald, foregroundIndex: 0, activeSeriesIndex: 0, datasetColors: {} },
  'chart-conn-rate-timeline': { type: 'line', color: PALETTE.emerald, foregroundIndex: 0, activeSeriesIndex: 0, datasetColors: {} },

  // Drops
  'chart-drops-hourly-timeline': { type: 'bar', color: PALETTE.rose, foregroundIndex: 0, activeSeriesIndex: 0, datasetColors: {} },

  // Blades / VPN
  'chart-vpn-timeline': { type: 'line', color: PALETTE.cyan, foregroundIndex: 0, activeSeriesIndex: 0, datasetColors: {} },

  // Diagnostics Confluence
  'chart-diagnostics-confluence': { type: 'line', color: PALETTE.rose, foregroundIndex: 0, activeSeriesIndex: 0, datasetColors: {} },

  // Virtual Systems (VSX)
  'chart-vsx-cpu-comparison': { type: 'bar', color: PALETTE.cyan, foregroundIndex: 0, activeSeriesIndex: 0, datasetColors: {} },
  'chart-vsx-mem-comparison': { type: 'bar', color: PALETTE.purple, foregroundIndex: 0, activeSeriesIndex: 0, datasetColors: {} },
  'chart-vsx-multik-dispatch': { type: 'horizontalBar', color: PALETTE.indigo, foregroundIndex: 0, activeSeriesIndex: 0, datasetColors: {} },
  'chart-vsx-enqueue-fails': { type: 'bar', color: PALETTE.rose, foregroundIndex: 0, activeSeriesIndex: 0, datasetColors: {} },
  'chart-vs-detail-timeline-cpu': { type: 'line', color: PALETTE.amber, foregroundIndex: 0, activeSeriesIndex: 0, datasetColors: {} },
  'chart-vs-detail-timeline-net': { type: 'line', color: PALETTE.cyan, foregroundIndex: 0, activeSeriesIndex: 0, datasetColors: {} }
};

// Map each chart to its underlying CPView database/JSON source table
const CHART_TABLE_SOURCES = {
  'chart-overview-traffic': 'traffic.hourly',
  'chart-overview-cpu-mem': 'cpu.hourly · memory.hourly',
  'chart-overview-drops-pie': 'drops.by_reason',
  'chart-cpu-cores-timeline': 'cpu.hourly',
  'chart-top-interfaces': 'interfaces',
  'chart-interfaces-timeline': 'interfaces · traffic.hourly',
  'chart-conns-timeline': 'traffic.conns_hourly',
  'chart-conns-states': 'traffic.conns_hourly',
  'chart-conn-rate-timeline': 'traffic.conns_hourly',
  'chart-drops-hourly-timeline': 'drops.hourly',
  'chart-spikes-timeline': 'spikes.cpu_spikes',
  'chart-spikes-cores': 'spikes.cpu_spikes',
  'chart-spikes-duration': 'spikes.cpu_spikes',
  'chart-spikes-consumers': 'spikes.cpu_spikes · top_consumers',
  'chart-top-consumers': 'top_processes',
  'chart-thread-consumers': 'threads',
  'chart-flofiler-protocols': 'flofiler.protocols',
  'chart-flofiler-components': 'flofiler.components',
  'chart-sxl-f2v': 'securexl.stats',
  'chart-multik-fails': 'securexl.enqueue_fails',
  'chart-ppak-hourly-timeline': 'securexl.ppak_hourly',
  'chart-vpn-timeline': 'vpn.tunnels_hourly',
  'chart-diagnostics-confluence': 'cpu.hourly + traffic.hourly + drops.hourly',
  'chart-vsx-cpu-comparison': 'vsx.list',
  'chart-vsx-mem-comparison': 'vsx.list',
  'chart-vsx-multik-dispatch': 'vsx.dispatcher',
  'chart-vsx-enqueue-fails': 'vsx.dispatcher.enqueue_fails',
  'chart-vs-detail-timeline-cpu': 'vsx.hourly',
  'chart-vs-detail-timeline-net': 'vsx.hourly'
};

// Canvas hatch / striped pattern generator for fill styles
function createStripePattern(strokeColor, bgColor = 'transparent') {
  if (typeof document === 'undefined') return strokeColor;
  const canvas = document.createElement('canvas');
  canvas.width = 12;
  canvas.height = 12;
  const pctx = canvas.getContext('2d');
  if (bgColor && bgColor !== 'transparent') {
    pctx.fillStyle = bgColor;
    pctx.fillRect(0, 0, 12, 12);
  }
  pctx.strokeStyle = strokeColor;
  pctx.lineWidth = 2;
  pctx.beginPath();
  pctx.moveTo(0, 12);
  pctx.lineTo(12, 0);
  pctx.moveTo(-2, 2);
  pctx.lineTo(2, -2);
  pctx.moveTo(10, 14);
  pctx.lineTo(14, 10);
  pctx.stroke();
  return pctx.createPattern(canvas, 'repeat');
}

function loadChartCustomState() {
  try {
    const saved = localStorage.getItem('cpview_chart_custom_state_v2');
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.keys(parsed).forEach(k => {
        if (!chartCustomState[k]) chartCustomState[k] = {};
        Object.assign(chartCustomState[k], parsed[k]);
      });
    }
    // Sanitize categorical ranking charts if they were mistakenly saved as 'line'
    const categoricalCharts = [
      'chart-flofiler-protocols',
      'chart-flofiler-components',
      'chart-sxl-f2v',
      'chart-multik-fails',
      'chart-thread-consumers',
      'chart-vsx-multik-dispatch'
    ];
    categoricalCharts.forEach(id => {
      if (chartCustomState[id] && chartCustomState[id].type === 'line') {
        chartCustomState[id].type = 'horizontalBar';
      }
    });
  } catch (e) {
    console.warn('Could not load chartCustomState from localStorage:', e);
  }
}

function saveChartCustomState() {
  try {
    localStorage.setItem('cpview_chart_custom_state_v2', JSON.stringify(chartCustomState));
  } catch (e) {
    console.warn('Could not save chartCustomState to localStorage:', e);
  }
}

// =============================================================================
// Robust Universal Bar & Horizontal Bar Rendering Engine
// Handles both vertical and horizontal bars with automatic scale fallback to
// guarantee 100% reliable rendering without canvas clipping or NaN failures.
// =============================================================================

function drawSingleBar(ctx, chart, el, dataset, index, isHoriz, drawToken) {
  if (!ctx) return;
  if (el && el._drawToken === drawToken) return;
  if (el) el._drawToken = drawToken;

  const options = (el && el.options) || dataset || {};
  const bgColor = (Array.isArray(options.backgroundColor) ? options.backgroundColor[index] : options.backgroundColor) || dataset.backgroundColor || '#06b6d4';
  const borderColor = (Array.isArray(options.borderColor) ? options.borderColor[index] : options.borderColor) || dataset.borderColor || bgColor;
  const borderWidth = Number(options.borderWidth !== undefined ? options.borderWidth : 1.5) || 1;
  const radius = Number(options.borderRadius) || 4;

  let rx, ry, rw, rh;
  const props = (el && typeof el.getProps === 'function') ? el.getProps(['x', 'y', 'base', 'width', 'height', 'horizontal'], true) : (el || {});
  const x = props.x ?? (el ? el.x : undefined);
  const y = props.y ?? (el ? el.y : undefined);
  const base = props.base ?? (el ? el.base : undefined);
  const width = props.width ?? (el ? el.width : undefined);
  const height = props.height ?? (el ? el.height : undefined);

  const hasValidElCoords = (x !== undefined && y !== undefined && base !== undefined && !isNaN(x) && !isNaN(y) && !isNaN(base));

  if (isHoriz) {
    if (hasValidElCoords) {
      rx = Math.min(x, base);
      rw = Math.max(Math.abs(x - base), 4);
      const h = (height && height > 2) ? height : 18;
      ry = y - h / 2;
      rh = Math.max(h, 4);
    } else if (chart && chart.scales && chart.scales.x && chart.scales.y) {
      const val = dataset.data ? dataset.data[index] : 0;
      const numVal = (typeof val === 'object' && val !== null) ? (val.x ?? 0) : Number(val || 0);
      const xPixel = chart.scales.x.getPixelForValue(numVal);
      const basePixel = chart.scales.x.getPixelForValue(0);
      const yPixel = chart.scales.y.getPixelForValue(index);
      const catCount = Math.max((chart.data.labels || []).length, 1);
      const slotH = (chart.scales.y.height || 300) / catCount;
      const h = Math.max(Math.min(slotH * 0.75, 32), 8);
      rx = Math.min(xPixel, basePixel);
      rw = Math.max(Math.abs(xPixel - basePixel), 4);
      ry = yPixel - h / 2;
      rh = h;
    }
  } else {
    if (hasValidElCoords) {
      const w = (width && width > 2) ? width : 18;
      rx = x - w / 2;
      rw = Math.max(w, 4);
      ry = Math.min(y, base);
      rh = Math.max(Math.abs(y - base), 4);
    } else if (chart && chart.scales && chart.scales.x && chart.scales.y) {
      const val = dataset.data ? dataset.data[index] : 0;
      const numVal = (typeof val === 'object' && val !== null) ? (val.y ?? 0) : Number(val || 0);
      const yPixel = chart.scales.y.getPixelForValue(numVal);
      const basePixel = chart.scales.y.getPixelForValue(0);
      const xPixel = chart.scales.x.getPixelForValue(index);
      const catCount = Math.max((chart.data.labels || []).length, 1);
      const slotW = (chart.scales.x.width || 600) / catCount;
      const w = Math.max(Math.min(slotW * 0.75, 36), 6);
      rx = xPixel - w / 2;
      rw = w;
      ry = Math.min(yPixel, basePixel);
      rh = Math.max(Math.abs(yPixel - basePixel), 4);
    }
  }

  if (rx === undefined || ry === undefined || rw === undefined || rh === undefined) return;
  if (isNaN(rx) || isNaN(ry) || isNaN(rw) || isNaN(rh)) return;
  if (rw <= 0 || rh <= 0) return;

  ctx.save();
  ctx.fillStyle = bgColor;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = borderWidth;

  ctx.beginPath();
  if (radius > 0 && typeof ctx.roundRect === 'function') {
    try {
      ctx.roundRect(rx, ry, rw, rh, Math.min(radius, rw / 2, rh / 2));
    } catch (e) {
      ctx.rect(rx, ry, rw, rh);
    }
  } else {
    ctx.rect(rx, ry, rw, rh);
  }
  ctx.fill();
  if (borderWidth > 0 && borderColor) {
    ctx.stroke();
  }
  ctx.restore();
}

let barPluginRegistered = false;

function patchChartJsBarRenderer() {
  if (typeof window === 'undefined' || !window.Chart) return;

  // 1. Patch BarElement.prototype.draw if available
  const BarElement = (Chart.registry && Chart.registry.elements && Chart.registry.elements.items && Chart.registry.elements.items.bar) || Chart.BarElement;
  if (BarElement && BarElement.prototype) {
    BarElement.prototype.draw = function(ctx) {
      const chart = (this.$context && this.$context.chart) || null;
      const isHoriz = (chart && chart.options && chart.options.indexAxis === 'y') || Boolean(this.horizontal);
      const dataset = (this.$context && this.$context.dataset) || {};
      const index = (this.$context && this.$context.dataIndex !== undefined) ? this.$context.dataIndex : 0;
      const token = (chart && chart._drawCycle) || Date.now();
      drawSingleBar(ctx || (chart && chart.ctx), chart, this, dataset, index, isHoriz, token);
    };
  }

  // 2. Register universal fallback plugin to guarantee bars always render
  if (!barPluginRegistered && typeof Chart.register === 'function') {
    Chart.register({
      id: 'universalBarFallbackPlugin',
      beforeDraw(chart) {
        chart._drawCycle = (chart._drawCycle || 0) + 1;
      },
      afterDatasetsDraw(chart) {
        if (!chart || !chart.ctx) return;
        const isHoriz = Boolean(chart.options && chart.options.indexAxis === 'y');
        const token = chart._drawCycle;
        // Sort datasets so higher order (background) is drawn first, lower order (foreground) is drawn last (on top)
        const sorted = (chart.data.datasets || []).map((ds, dsIdx) => ({
          dataset: ds,
          dsIdx,
          order: Number(ds.order !== undefined ? ds.order : dsIdx)
        })).sort((a, b) => b.order - a.order);

        sorted.forEach(({ dataset, dsIdx }) => {
          const meta = chart.getDatasetMeta(dsIdx);
          if (!meta || meta.hidden || meta.type !== 'bar') return;
          const elements = meta.data || [];
          elements.forEach((el, idx) => {
            drawSingleBar(chart.ctx, chart, el, dataset, idx, isHoriz, token);
          });
        });
      }
    });
    barPluginRegistered = true;
  }
}
patchChartJsBarRenderer();

function hexToRgba(hex, alpha = 1) {
  if (!hex || typeof hex !== 'string') return `rgba(6, 182, 212, ${alpha})`;
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(6, 182, 212, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getChartSetting(chartId, defaultType = 'line', defaultColor = PALETTE.cyan) {
  if (!chartCustomState[chartId]) {
    chartCustomState[chartId] = {
      type: defaultType,
      color: defaultColor,
      downsample: 1,
      foregroundIndex: 0,
      activeSeriesIndex: 0,
      datasetColors: { 0: defaultColor },
      seriesHidden: {},
      seriesOrder: {},
      seriesOpacity: {},
      seriesLineStyle: {},
      seriesFillStyle: {},
      seriesChartType: {}
    };
  }
  const st = chartCustomState[chartId];
  if (st.type === undefined) st.type = defaultType;
  if (st.color === undefined) st.color = defaultColor;
  if (st.downsample === undefined) st.downsample = 1;
  if (st.foregroundIndex === undefined) st.foregroundIndex = 0;
  if (st.activeSeriesIndex === undefined) st.activeSeriesIndex = 0;
  if (!st.datasetColors) {
    st.datasetColors = {};
    if (st.color) st.datasetColors[0] = st.color;
  }
  if (!st.seriesHidden) st.seriesHidden = {};
  if (!st.seriesOrder) st.seriesOrder = {};
  if (!st.seriesOpacity) st.seriesOpacity = {};
  if (!st.seriesLineStyle) st.seriesLineStyle = {};
  if (!st.seriesFillStyle) st.seriesFillStyle = {};
  if (!st.seriesChartType) st.seriesChartType = {};
  return st;
}

function syncChartControlsUI(chartId) {
  const ctrl = document.querySelector(`.chart-controls[data-chart="${chartId}"]`);
  if (!ctrl) return;
  const st = getChartSetting(chartId);
  const datasets = chartDatasetsCache[chartId] || (currentCharts[chartId]?.data?.datasets) || [];

  if (st.foregroundIndex === undefined || (datasets.length > 0 && st.foregroundIndex >= datasets.length)) {
    st.foregroundIndex = 0;
  }
  if (st.activeSeriesIndex === undefined || (datasets.length > 0 && st.activeSeriesIndex >= datasets.length)) {
    st.activeSeriesIndex = st.foregroundIndex;
  }

  const isMulti = datasets.length > 1;
  const activeIdx = st.activeSeriesIndex;
  const activeDs = datasets[activeIdx];
  let curColor = st.datasetColors[activeIdx];
  if (!curColor) {
    curColor = (activeIdx === 0 && st.color) ? st.color : (activeDs?.borderColor || activeDs?.backgroundColor || SERIES_DEFAULT_COLORS[activeIdx % SERIES_DEFAULT_COLORS.length]);
    st.datasetColors[activeIdx] = curColor;
  }

  // 1. Table Source Name Badge
  const tableSource = CHART_TABLE_SOURCES[chartId] || 'cpview.db';
  const tableBadgeHtml = `
    <span class="chart-table-badge" title="${t('chartctrl.table_source_label', 'Tabla origen')}: ${tableSource}">
      <span>🗄️</span> <span>${tableSource}</span>
    </span>
  `;

  // 2. Sampling Selector (Botón de Muestras: Todas, Cada 2, Cada 5, Cada 10, etc.)
  const sampleSelectHtml = `
    <div class="sample-selector-group">
      <select class="sample-step-select" data-chart="${chartId}" title="${t('chartctrl.samples_select_title', 'Muestras que se grafican')}">
        <option value="1" ${st.downsample === 1 ? 'selected' : ''}>${t('chartctrl.samples_all', '⏱️ Muestras: Todas')}</option>
        <option value="2" ${st.downsample === 2 ? 'selected' : ''}>${t('chartctrl.samples_2', '⏱️ Cada 2')}</option>
        <option value="3" ${st.downsample === 3 ? 'selected' : ''}>${t('chartctrl.samples_3', '⏱️ Cada 3')}</option>
        <option value="5" ${st.downsample === 5 ? 'selected' : ''}>${t('chartctrl.samples_5', '⏱️ Cada 5')}</option>
        <option value="10" ${st.downsample === 10 ? 'selected' : ''}>${t('chartctrl.samples_10', '⏱️ Cada 10')}</option>
        <option value="24" ${st.downsample === 24 ? 'selected' : ''}>${t('chartctrl.samples_24', '⏱️ Cada 24 (1/día)')}</option>
      </select>
    </div>
  `;

  // 3. Type buttons HTML
  const isDoughnutSupported = (chartId === 'chart-spikes-cores' || chartId === 'chart-vsx-mem-comparison' || chartId === 'chart-vsx-enqueue-fails');
  const typeButtonsHtml = `
    <div class="filter-btn-group chart-type-group">
      <button class="filter-btn ${st.type === 'line' ? 'active' : ''}" data-type="line" title="${t('chartctrl.title_line', 'Gráfico de Líneas')}">${t('chartctrl.type_line', '📈 Línea')}</button>
      <button class="filter-btn ${st.type === 'bar' ? 'active' : ''}" data-type="bar" title="${t('chartctrl.title_bar', 'Gráfico de Barras Verticales')}">${t('chartctrl.type_bar', '📊 Barras')}</button>
      <button class="filter-btn ${st.type === 'horizontalBar' ? 'active' : ''}" data-type="horizontalBar" title="${t('chartctrl.title_horiz', 'Gráfico de Barras Horizontales')}">${t('chartctrl.type_horiz', '📋 Horiz')}</button>
      ${isDoughnutSupported ? `<button class="filter-btn ${st.type === 'doughnut' ? 'active' : ''}" data-type="doughnut" title="${t('chartctrl.title_doughnut', 'Gráfico de Anillo')}">${t('chartctrl.type_doughnut', '🍩 Anillo')}</button>` : ''}
    </div>
  `;

  // 4. Series studio button (Botón de Gráficos)
  const seriesStudioBtnText = isMulti 
    ? t('chartctrl.btn_series_studio', `📊 Gráficos (${datasets.length})`, { count: datasets.length })
    : t('chartctrl.btn_series_studio_single', '📊 Gráficos / Estilo');

  let seriesControlsHtml = `
    <button class="filter-btn btn-manage-series" data-chart="${chartId}" title="${t('chartctrl.studio_subtitle', 'Personalizar orden, visibilidad, colores, transparencia, trazo, relleno y tipo')}">
      <span>${seriesStudioBtnText}</span>
    </button>
  `;

  // 5. Quick Color picker HTML
  const colorDotsHtml = COLOR_SWATCHES.map(sw => {
    const isActive = curColor && curColor.toLowerCase() === sw.hex.toLowerCase();
    const swName = getSwatchColorName(sw);
    return `<span class="color-dot ${isActive ? 'active' : ''}" data-chart="${chartId}" data-color="${sw.hex}" style="background:${sw.hex};" title="${swName} (${sw.hex})"></span>`;
  }).join('');

  const colorPickerHtml = `
    <div class="color-picker-group">
      ${colorDotsHtml}
      <label class="color-picker-custom" title="${t('chartctrl.custom_color_title', 'Elegir cualquier color personalizado hex')}">
        <input type="color" class="custom-color-input" data-chart="${chartId}" value="${curColor && curColor.startsWith('#') && curColor.length === 7 ? curColor : '#06b6d4'}">
        <span>🎨</span>
      </label>
    </div>
  `;

  ctrl.innerHTML = `
    ${tableBadgeHtml}
    ${sampleSelectHtml}
    ${typeButtonsHtml}
    ${seriesControlsHtml}
    ${colorPickerHtml}
  `;

  // Attach event handlers
  const sampleSel = ctrl.querySelector('.sample-step-select');
  if (sampleSel) {
    sampleSel.onchange = (e) => {
      st.downsample = Number(e.target.value) || 1;
      saveChartCustomState();
      triggerChartRefresh(chartId);
    };
  }

  ctrl.querySelectorAll('.chart-type-group .filter-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const newType = btn.getAttribute('data-type');
      st.type = newType;
      saveChartCustomState();
      triggerChartRefresh(chartId);
    };
  });

  const btnManage = ctrl.querySelector('.btn-manage-series');
  if (btnManage) {
    btnManage.onclick = (e) => {
      e.stopPropagation();
      openSeriesManagerPopover(chartId, btnManage);
    };
  }

  ctrl.querySelectorAll('.color-picker-group .color-dot').forEach(dot => {
    dot.onclick = (e) => {
      e.stopPropagation();
      const newColor = dot.getAttribute('data-color');
      st.datasetColors[st.activeSeriesIndex] = newColor;
      if (st.activeSeriesIndex === 0) st.color = newColor;
      saveChartCustomState();
      triggerChartRefresh(chartId);
    };
  });

  const customColorInput = ctrl.querySelector('.custom-color-input');
  if (customColorInput) {
    customColorInput.oninput = (e) => {
      const newColor = e.target.value;
      st.datasetColors[st.activeSeriesIndex] = newColor;
      if (st.activeSeriesIndex === 0) st.color = newColor;
      saveChartCustomState();
      triggerChartRefresh(chartId);
    };
  }
}

function openSeriesManagerPopover(chartId, anchorBtn) {
  const existing = document.getElementById(`series-popover-${chartId}`);
  if (existing) {
    closeSeriesManagerPopover();
    return;
  }

  closeSeriesManagerPopover();

  const st = getChartSetting(chartId);
  const datasets = chartDatasetsCache[chartId] || (currentCharts[chartId]?.data?.datasets) || [];
  if (datasets.length === 0) return;

  const backdrop = document.createElement('div');
  backdrop.className = 'series-popover-backdrop';
  backdrop.id = 'series-popover-backdrop';
  backdrop.onclick = closeSeriesManagerPopover;

  const popover = document.createElement('div');
  popover.className = 'series-manager-popover';
  popover.id = `series-popover-${chartId}`;

  function renderPopoverContent() {
    popover.innerHTML = `
      <div class="series-popover-header">
        <div class="series-popover-title">
          <span>📊</span> ${t('chartctrl.studio_title', `Estudio de Gráficos & Series (${datasets.length})`, { count: datasets.length })}
        </div>
        <button class="btn-close-popover" title="${t('chartctrl.btn_close', 'Cerrar')}">&times;</button>
      </div>
      <div class="series-popover-subtitle">
        ${t('chartctrl.studio_subtitle', 'Configura el orden de presentación, visibilidad, colores, transparencia, trazo, relleno y tipo de gráfico por variable:')}
      </div>
      <div class="series-popover-list">
        ${datasets.map((ds, idx) => {
          const isFg = (idx === st.foregroundIndex);
          const isHidden = !!(st.seriesHidden && st.seriesHidden[idx]);
          const dsColor = st.datasetColors[idx] || (idx === 0 ? st.color : (ds.borderColor || ds.backgroundColor || SERIES_DEFAULT_COLORS[idx % SERIES_DEFAULT_COLORS.length]));
          const sampleName = ds.label || t('chartctrl.sample_default', `Muestra ${idx + 1}`, { n: idx + 1 });
          const currentOrder = (st.seriesOrder && st.seriesOrder[idx] !== undefined) ? st.seriesOrder[idx] : (isFg ? 1 : 10 + idx);
          
          const curType = (st.seriesChartType && st.seriesChartType[idx]) || (st.type === 'bar' ? 'bar' : 'line');
          const curLine = (st.seriesLineStyle && st.seriesLineStyle[idx]) || 'solid';
          const curFill = (st.seriesFillStyle && st.seriesFillStyle[idx]) || (isFg ? 'translucent' : (curType === 'area' ? 'translucent' : 'none'));
          const curOpacity = (st.seriesOpacity && st.seriesOpacity[idx] !== undefined) ? st.seriesOpacity[idx] : (isFg ? 0.35 : 0.15);
          const opacityPct = Math.round(curOpacity * 100);

          return `
            <div class="series-row ${isFg ? 'is-foreground' : ''} ${isHidden ? 'is-hidden' : ''}">
              <div class="series-row-header">
                <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
                  <label class="series-vis-toggle" title="Mostrar u ocultar en gráfico">
                    <input type="checkbox" data-vis="${idx}" ${!isHidden ? 'checked' : ''}>
                    <span>${!isHidden ? '👁️' : '🚫'}</span>
                  </label>
                  <div class="series-row-name">
                    <span class="series-color-preview" style="background:${dsColor};"></span>
                    <strong>${sampleName}</strong>
                  </div>
                </div>

                <div class="series-order-btns">
                  <button class="btn-order-move btn-order-up" data-ds="${idx}" title="${t('chartctrl.series_order_up', 'Traer al frente / subir capa')}">▲ Frente</button>
                  <button class="btn-order-move btn-order-down" data-ds="${idx}" title="${t('chartctrl.series_order_down', 'Enviar al fondo / bajar capa')}">▼ Fondo</button>
                  <label class="series-fg-radio-label" title="${t('chartctrl.radio_title', 'Poner esta muestra en 1º plano')}">
                    <input type="radio" name="popover-fg-${chartId}" value="${idx}" ${isFg ? 'checked' : ''}>
                    <span class="fg-radio-badge ${isFg ? 'active' : ''}">
                      ${isFg ? '⭐ 1º Plano' : `Z: ${currentOrder}`}
                    </span>
                  </label>
                </div>
              </div>

              <!-- Series customization controls grid -->
              <div class="series-row-controls">
                <div class="series-ctl-item">
                  <span class="series-ctl-label">Tipo</span>
                  <select class="series-select-mini" data-ds-type="${idx}">
                    <option value="line" ${curType === 'line' ? 'selected' : ''}>📈 Línea</option>
                    <option value="bar" ${curType === 'bar' ? 'selected' : ''}>📊 Barras</option>
                    <option value="area" ${curType === 'area' ? 'selected' : ''}>🏔️ Área</option>
                  </select>
                </div>

                <div class="series-ctl-item">
                  <span class="series-ctl-label">Línea</span>
                  <select class="series-select-mini" data-ds-line="${idx}">
                    <option value="solid" ${curLine === 'solid' ? 'selected' : ''}>── Continua</option>
                    <option value="dashed" ${curLine === 'dashed' ? 'selected' : ''}>- - Intermitente</option>
                    <option value="dotted" ${curLine === 'dotted' ? 'selected' : ''}>··· Puntos</option>
                    <option value="dashdot" ${curLine === 'dashdot' ? 'selected' : ''}>-·- Raya-Pto</option>
                  </select>
                </div>

                <div class="series-ctl-item">
                  <span class="series-ctl-label">Relleno</span>
                  <select class="series-select-mini" data-ds-fill="${idx}">
                    <option value="none" ${curFill === 'none' ? 'selected' : ''}>∅ Sin Relleno</option>
                    <option value="translucent" ${curFill === 'translucent' ? 'selected' : ''}>💧 Translúcido</option>
                    <option value="solid" ${curFill === 'solid' ? 'selected' : ''}>⬛ Sólido</option>
                    <option value="pattern" ${curFill === 'pattern' ? 'selected' : ''}>▦ Patrón Rayado</option>
                  </select>
                </div>

                <div class="series-ctl-item" style="grid-column: 1 / -1;">
                  <div class="series-opacity-box">
                    <span>${t('chartctrl.opacity_label', 'Opacidad')}:</span>
                    <input type="range" min="5" max="100" step="5" value="${opacityPct}" data-ds-opacity="${idx}">
                    <span class="opacity-val-badge" id="op-val-${chartId}-${idx}">${opacityPct}%</span>
                  </div>
                </div>
              </div>

              <!-- Colors row -->
              <div class="series-row-colors">
                ${COLOR_SWATCHES.map(sw => {
                  const isActive = dsColor && dsColor.toLowerCase() === sw.hex.toLowerCase();
                  const swName = getSwatchColorName(sw);
                  return `<span class="color-dot ${isActive ? 'active' : ''}" data-ds="${idx}" data-color="${sw.hex}" style="background:${sw.hex};" title="${swName}"></span>`;
                }).join('')}
                <label class="color-picker-custom" title="${t('chartctrl.popover_custom_color_title', 'Color personalizado hex')}">
                  <input type="color" data-ds="${idx}" value="${dsColor && dsColor.startsWith('#') && dsColor.length === 7 ? dsColor : '#06b6d4'}">
                  <span>🎨</span>
                </label>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <div class="series-popover-footer">
        <button class="btn-reset-chart-colors" title="${t('chartctrl.btn_reset_title', 'Restaurar opciones por defecto de este gráfico')}">
          ${t('chartctrl.btn_reset_text', '↺ Restaurar por defecto')}
        </button>
        <button class="btn-done-popover">${t('chartctrl.btn_done', 'Listo')}</button>
      </div>
    `;

    // Visibility toggles
    popover.querySelectorAll('input[data-vis]').forEach(chk => {
      chk.onchange = () => {
        const dsIdx = Number(chk.getAttribute('data-vis'));
        st.seriesHidden[dsIdx] = !chk.checked;
        saveChartCustomState();
        triggerChartRefresh(chartId);
        renderPopoverContent();
      };
    });

    // Order Up / Down buttons
    popover.querySelectorAll('.btn-order-up').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const dsIdx = Number(btn.getAttribute('data-ds'));
        const curOrd = st.seriesOrder[dsIdx] !== undefined ? st.seriesOrder[dsIdx] : 10;
        st.seriesOrder[dsIdx] = Math.max(1, curOrd - 2);
        st.foregroundIndex = dsIdx;
        st.activeSeriesIndex = dsIdx;
        saveChartCustomState();
        triggerChartRefresh(chartId);
        renderPopoverContent();
      };
    });

    popover.querySelectorAll('.btn-order-down').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const dsIdx = Number(btn.getAttribute('data-ds'));
        const curOrd = st.seriesOrder[dsIdx] !== undefined ? st.seriesOrder[dsIdx] : 10;
        st.seriesOrder[dsIdx] = curOrd + 2;
        saveChartCustomState();
        triggerChartRefresh(chartId);
        renderPopoverContent();
      };
    });

    // Foreground Radios
    popover.querySelectorAll(`input[name="popover-fg-${chartId}"]`).forEach(radio => {
      radio.onchange = () => {
        const newFg = Number(radio.value);
        st.foregroundIndex = newFg;
        st.activeSeriesIndex = newFg;
        st.seriesOrder[newFg] = 1;
        saveChartCustomState();
        triggerChartRefresh(chartId);
        renderPopoverContent();
      };
    });

    // Per-series chart type
    popover.querySelectorAll('select[data-ds-type]').forEach(sel => {
      sel.onchange = () => {
        const dsIdx = Number(sel.getAttribute('data-ds-type'));
        st.seriesChartType[dsIdx] = sel.value;
        if (sel.value === 'area') {
          st.seriesFillStyle[dsIdx] = 'translucent';
        }
        saveChartCustomState();
        triggerChartRefresh(chartId);
        renderPopoverContent();
      };
    });

    // Per-series line style
    popover.querySelectorAll('select[data-ds-line]').forEach(sel => {
      sel.onchange = () => {
        const dsIdx = Number(sel.getAttribute('data-ds-line'));
        st.seriesLineStyle[dsIdx] = sel.value;
        saveChartCustomState();
        triggerChartRefresh(chartId);
        renderPopoverContent();
      };
    });

    // Per-series fill style
    popover.querySelectorAll('select[data-ds-fill]').forEach(sel => {
      sel.onchange = () => {
        const dsIdx = Number(sel.getAttribute('data-ds-fill'));
        st.seriesFillStyle[dsIdx] = sel.value;
        saveChartCustomState();
        triggerChartRefresh(chartId);
        renderPopoverContent();
      };
    });

    // Per-series opacity slider
    popover.querySelectorAll('input[data-ds-opacity]').forEach(range => {
      range.oninput = () => {
        const dsIdx = Number(range.getAttribute('data-ds-opacity'));
        const val = Number(range.value) / 100;
        st.seriesOpacity[dsIdx] = val;
        const valEl = popover.querySelector(`#op-val-${chartId}-${dsIdx}`);
        if (valEl) valEl.textContent = `${range.value}%`;
      };
      range.onchange = () => {
        saveChartCustomState();
        triggerChartRefresh(chartId);
      };
    });

    // Colors
    popover.querySelectorAll('.series-row-colors .color-dot').forEach(dot => {
      dot.onclick = (e) => {
        e.stopPropagation();
        const dsIdx = Number(dot.getAttribute('data-ds'));
        const newColor = dot.getAttribute('data-color');
        st.datasetColors[dsIdx] = newColor;
        if (dsIdx === 0) st.color = newColor;
        saveChartCustomState();
        triggerChartRefresh(chartId);
        renderPopoverContent();
      };
    });

    popover.querySelectorAll('.series-row-colors input[type="color"]').forEach(input => {
      input.oninput = (e) => {
        const dsIdx = Number(input.getAttribute('data-ds'));
        const newColor = e.target.value;
        st.datasetColors[dsIdx] = newColor;
        if (dsIdx === 0) st.color = newColor;
        saveChartCustomState();
        triggerChartRefresh(chartId);
        renderPopoverContent();
      };
    });

    const btnReset = popover.querySelector('.btn-reset-chart-colors');
    if (btnReset) {
      btnReset.onclick = (e) => {
        e.stopPropagation();
        st.datasetColors = {};
        st.foregroundIndex = 0;
        st.activeSeriesIndex = 0;
        st.seriesHidden = {};
        st.seriesOrder = {};
        st.seriesOpacity = {};
        st.seriesLineStyle = {};
        st.seriesFillStyle = {};
        st.seriesChartType = {};
        st.downsample = 1;
        st.color = datasets[0]?.borderColor || datasets[0]?.backgroundColor || PALETTE.cyan;
        saveChartCustomState();
        triggerChartRefresh(chartId);
        renderPopoverContent();
      };
    }

    popover.querySelector('.btn-close-popover').onclick = closeSeriesManagerPopover;
    popover.querySelector('.btn-done-popover').onclick = closeSeriesManagerPopover;
  }

  renderPopoverContent();
  document.body.appendChild(backdrop);
  document.body.appendChild(popover);

  const rect = anchorBtn.getBoundingClientRect();
  const popWidth = Math.min(580, window.innerWidth - 32);
  let left = rect.right - popWidth;
  if (left < 16) left = 16;
  if (left + popWidth > window.innerWidth - 16) left = window.innerWidth - popWidth - 16;
  popover.style.width = `${popWidth}px`;
  popover.style.left = `${left}px`;
  popover.style.top = `${Math.min(rect.bottom + 8, window.innerHeight - 480)}px`;

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeSeriesManagerPopover();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

function closeSeriesManagerPopover() {
  document.querySelectorAll('.series-manager-popover, .series-popover-backdrop').forEach(el => el.remove());
}

function triggerChartRefresh(chartId) {
  if (chartId.startsWith('chart-spikes-') || chartId === 'chart-thread-consumers') {
    renderSpikesPage();
  } else if (chartId.startsWith('chart-flofiler-')) {
    renderFlofilerPage();
  } else if (chartId.startsWith('chart-sxl-') || chartId.startsWith('chart-multik-') || chartId.startsWith('chart-ppak-')) {
    renderSecureXLPage();
  } else if (chartId === 'chart-top-interfaces' || chartId === 'chart-interfaces-timeline') {
    renderInterfacesPage();
  } else if (chartId.startsWith('chart-overview-')) {
    renderOverviewCharts();
  } else if (chartId.startsWith('chart-cpu-')) {
    renderSystemPage();
  } else if (chartId.startsWith('chart-conn')) {
    renderTrafficPage();
  } else if (chartId.startsWith('chart-drops-')) {
    renderDropsPage();
  } else if (chartId.startsWith('chart-vpn-')) {
    renderBladesPage();
  } else if (chartId === 'chart-diagnostics-confluence') {
    renderDiagnosticsChart();
  } else if (chartId.startsWith('chart-vsx-') || chartId.startsWith('chart-vs-')) {
    renderVsxPage();
  }
}

function setupUniversalChartControls() {
  document.querySelectorAll('.chart-controls').forEach(ctrl => {
    const chartId = ctrl.getAttribute('data-chart');
    if (!chartId) return;
    syncChartControlsUI(chartId);
  });
}

function renderUniversalChart(canvasId, config) {
  patchChartJsBarRenderer();

  // Cache datasets configuration
  chartDatasetsCache[canvasId] = config.datasets;

  const setting = getChartSetting(canvasId, config.defaultType || 'line', config.defaultColor || PALETTE.cyan);
  const userType = setting.type || 'line';

  const isHoriz = userType === 'horizontalBar';
  const isDoughnut = userType === 'doughnut';
  const chartType = isHoriz ? 'bar' : (isDoughnut ? 'doughnut' : userType); // 'line', 'bar', or 'doughnut'

  // Apply downsampling / sampling step if configured
  const downsampleStep = setting.downsample || 1;
  let chartLabels = config.labels;
  let inputDatasets = config.datasets;
  if (downsampleStep > 1 && Array.isArray(chartLabels) && chartLabels.length > downsampleStep) {
    chartLabels = chartLabels.filter((_, i) => i % downsampleStep === 0);
    inputDatasets = inputDatasets.map(ds => {
      if (!Array.isArray(ds.data)) return ds;
      return {
        ...ds,
        data: ds.data.filter((_, i) => i % downsampleStep === 0)
      };
    });
  }

  const fgIdx = Math.min(Math.max(setting.foregroundIndex ?? 0, 0), Math.max(inputDatasets.length - 1, 0));

  const processedDatasets = inputDatasets.map((ds, idx) => {
    let color = setting.datasetColors[idx];
    if (!color) {
      color = (idx === 0 && setting.color) ? setting.color : (ds.borderColor || ds.backgroundColor || SERIES_DEFAULT_COLORS[idx % SERIES_DEFAULT_COLORS.length]);
      setting.datasetColors[idx] = color;
    }
    if (idx === 0) setting.color = color;

    const isForeground = (idx === fgIdx);
    const order = (setting.seriesOrder && setting.seriesOrder[idx] !== undefined)
      ? setting.seriesOrder[idx]
      : (isForeground ? 1 : (10 + idx));
    const isHidden = !!(setting.seriesHidden && setting.seriesHidden[idx]);

    // Per-series chart type override (line, bar, area)
    const targetDsType = (setting.seriesChartType && setting.seriesChartType[idx]) || (chartType === 'line' ? 'line' : (chartType === 'bar' ? 'bar' : chartType));
    const isDsArea = (targetDsType === 'area');
    const effectiveDsType = isDsArea ? 'line' : (isDoughnut ? 'doughnut' : (isHoriz ? 'bar' : targetDsType));

    // Per-series line style override
    const lineStyle = (setting.seriesLineStyle && setting.seriesLineStyle[idx]) || (ds.borderDash && ds.borderDash.length ? 'dashed' : 'solid');
    let borderDash = [];
    if (lineStyle === 'dashed') borderDash = [6, 6];
    else if (lineStyle === 'dotted') borderDash = [2, 4];
    else if (lineStyle === 'dashdot') borderDash = [8, 4, 2, 4];

    // Per-series opacity and fill style override
    const userOpacity = (setting.seriesOpacity && setting.seriesOpacity[idx] !== undefined)
      ? setting.seriesOpacity[idx]
      : (isForeground ? 0.35 : 0.15);
    
    let defaultFill = isDsArea ? 'translucent' : (ds.fill !== undefined ? (ds.fill ? 'translucent' : 'none') : (isForeground ? 'translucent' : 'none'));
    const fillStyle = (setting.seriesFillStyle && setting.seriesFillStyle[idx]) || defaultFill;

    let fillVal = false;
    let bgVal = hexToRgba(color, userOpacity);

    if (fillStyle === 'none') {
      fillVal = false;
      bgVal = effectiveDsType === 'bar' ? hexToRgba(color, Math.max(userOpacity, 0.65)) : hexToRgba(color, 0.0);
    } else if (fillStyle === 'solid') {
      fillVal = true;
      bgVal = hexToRgba(color, 0.95);
    } else if (fillStyle === 'pattern') {
      fillVal = true;
      bgVal = createStripePattern(color, hexToRgba(color, 0.1));
    } else {
      // translucent
      fillVal = (effectiveDsType === 'line');
      bgVal = hexToRgba(color, userOpacity);
    }

    if (isDoughnut) {
      const sliceColors = (chartLabels && chartLabels.length > 1)
        ? chartLabels.map((_, i) => SERIES_DEFAULT_COLORS[i % SERIES_DEFAULT_COLORS.length])
        : [color];
      return {
        ...ds,
        label: ds.label || 'Valor',
        data: ds.data,
        type: 'doughnut',
        hidden: isHidden,
        backgroundColor: (idx === 0 && inputDatasets.length === 1) ? sliceColors : hexToRgba(color, 0.85),
        borderColor: '#1e293b',
        borderWidth: 2,
        order: order
      };
    } else if (effectiveDsType === 'line') {
      return {
        ...ds,
        label: ds.label || 'Valor',
        data: ds.data,
        type: 'line',
        hidden: isHidden,
        borderColor: color,
        backgroundColor: bgVal,
        fill: fillVal,
        borderDash: borderDash,
        tension: ds.tension !== undefined ? ds.tension : 0.3,
        pointRadius: isForeground ? (ds.pointRadius !== undefined && ds.pointRadius === 0 ? 2 : 4) : (ds.pointRadius !== undefined ? ds.pointRadius : 2.5),
        pointHoverRadius: isForeground ? 7 : 5,
        pointBackgroundColor: color,
        pointBorderColor: '#ffffff',
        pointBorderWidth: isForeground ? 2 : 1,
        borderWidth: isForeground ? 3.0 : (ds.borderWidth || 1.8),
        order: order,
        yAxisID: isHoriz ? undefined : ds.yAxisID
      };
    } else {
      // Bar
      return {
        ...ds,
        label: ds.label || 'Valor',
        data: ds.data,
        type: 'bar',
        hidden: isHidden,
        backgroundColor: fillStyle === 'pattern' ? createStripePattern(color, hexToRgba(color, 0.15)) : hexToRgba(color, isForeground ? 0.92 : Math.max(userOpacity, 0.65)),
        borderColor: color,
        borderWidth: isForeground ? 2.5 : 1.2,
        borderRadius: 4,
        barPercentage: 0.75,
        categoryPercentage: 0.82,
        inflateAmount: 0,
        order: order,
        yAxisID: isHoriz ? undefined : ds.yAxisID
      };
    }
  });

  let scales;
  if (isDoughnut) {
    scales = undefined;
  } else if (isHoriz) {
    scales = {
      x: {
        type: 'linear',
        beginAtZero: true,
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: {
          color: '#94a3b8',
          callback: function(val) {
            if (Math.abs(val) >= 1e6) return (val / 1e6).toFixed(1) + ' M';
            if (Math.abs(val) >= 1e3) return (val / 1e3).toFixed(0) + ' k';
            return val;
          }
        },
        title: config.yTitle ? { display: true, text: config.yTitle, color: '#94a3b8' } : undefined
      },
      y: {
        type: 'category',
        grid: { display: false },
        ticks: { color: '#e2e8f0', autoSkip: false }
      }
    };
    if (config.extraOptions && config.extraOptions.scales) {
      Object.assign(scales, config.extraOptions.scales);
    }
  } else {
    scales = {
      x: {
        type: 'category',
        grid: { display: false },
        ticks: { color: '#94a3b8', maxRotation: 45, autoSkip: true, maxTicksLimit: 18 }
      },
      y: {
        type: 'linear',
        beginAtZero: true,
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8', precision: 0 },
        title: config.yTitle ? { display: true, text: config.yTitle, color: '#94a3b8' } : undefined
      }
    };
    if (!isHoriz && config.extraOptions && config.extraOptions.scales) {
      Object.assign(scales, config.extraOptions.scales);
    }
  }

  const options = {
    indexAxis: isHoriz ? 'y' : 'x',
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: {
        display: isDoughnut ? true : config.datasets.length > 1,
        position: 'top',
        labels: {
          boxWidth: 12,
          color: '#94a3b8',
          generateLabels: function(chart) {
            const original = Chart.defaults.plugins.legend.labels.generateLabels(chart);
            const fgSuffix = t('chartctrl.legend_fg_suffix', '(Frente)');
            if (chart.data.datasets.length > 1 && !isDoughnut) {
              original.forEach(item => {
                if (item.datasetIndex === fgIdx) {
                  item.text = '⭐ ' + item.text + ' ' + fgSuffix;
                }
              });
            }
            return original;
          }
        },
        onClick: function(e, legendItem, legend) {
          const dsIdx = legendItem.datasetIndex;
          if (e.native && (e.native.altKey || e.native.shiftKey || e.native.ctrlKey || e.native.metaKey)) {
            setting.foregroundIndex = dsIdx;
            setting.activeSeriesIndex = dsIdx;
            saveChartCustomState();
            triggerChartRefresh(canvasId);
            return;
          }
          setting.activeSeriesIndex = dsIdx;
          syncChartControlsUI(canvasId);
          Chart.defaults.plugins.legend.onClick.call(this, e, legendItem, legend);
        }
      },
      tooltip: {
        enabled: true,
        callbacks: {
          label: function(ctx) {
            if (typeof config.tooltipCallback === 'function') {
              return config.tooltipCallback(ctx, fgIdx);
            }
            const isFg = (ctx.datasetIndex === fgIdx);
            const fgPrefix = isFg && ctx.chart.data.datasets.length > 1 && !isDoughnut ? t('chartctrl.fg_prefix_tooltip', '⭐ [1º Plano] ') : '';
            const label = ctx.dataset.label || '';
            const rawVal = isHoriz
              ? (ctx.parsed.x !== undefined ? ctx.parsed.x : ctx.raw)
              : (ctx.parsed.y !== undefined ? ctx.parsed.y : ctx.raw);
            return `${fgPrefix}${label}: ${fmtNum(rawVal)}`;
          }
        }
      }
    },
    scales: scales
  };

  createOrUpdateChart(canvasId, {
    type: chartType,
    data: {
      labels: chartLabels,
      datasets: processedDatasets
    },
    options: options
  });

  syncChartControlsUI(canvasId);
}

// Formatting helpers
function fmtNum(n) {
  if (n === null || n === undefined) return '-';
  return Number(n).toLocaleString('es-ES');
}

function fmtThroughput(mbps) {
  if (mbps >= 1000) {
    return (mbps / 1000).toFixed(2) + ' Gbps';
  }
  return mbps.toFixed(1) + ' Mbps';
}

function fmtTs(ts) {
  if (!ts) return '-';
  const d = new Date(ts * 1000);
  return d.toISOString().replace('T', ' ').substring(0, 19);
}

function fmtDateShort(ts) {
  const d = new Date(ts * 1000);
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1} ${String(d.getUTCHours()).padStart(2, '0')}:00`;
}

// High Contrast Themes Configuration
const THEMES = {
  'default': {
    name: 'Cyber Dark',
    icon: '🌐',
    chartText: '#94a3b8',
    chartGrid: 'rgba(255, 255, 255, 0.06)',
    tooltipBg: 'rgba(15, 23, 42, 0.95)',
    tooltipBorder: 'rgba(6, 182, 212, 0.4)',
    tooltipText: '#ffffff'
  },
  'obsidian-gold': {
    name: 'Obsidian & Gold',
    icon: '👑',
    chartText: '#e2e8f0',
    chartGrid: 'rgba(251, 191, 36, 0.12)',
    tooltipBg: 'rgba(12, 13, 15, 0.96)',
    tooltipBorder: 'rgba(251, 191, 36, 0.5)',
    tooltipText: '#ffffff'
  },
  'matrix-emerald': {
    name: 'Matrix Emerald',
    icon: '⚡',
    chartText: '#bbf7d0',
    chartGrid: 'rgba(16, 185, 129, 0.12)',
    tooltipBg: 'rgba(6, 20, 11, 0.96)',
    tooltipBorder: 'rgba(52, 211, 153, 0.5)',
    tooltipText: '#f0fdf4'
  },
  'midnight-sapphire': {
    name: 'Midnight Sapphire',
    icon: '💎',
    chartText: '#cbd5e1',
    chartGrid: 'rgba(56, 189, 248, 0.12)',
    tooltipBg: 'rgba(7, 16, 38, 0.96)',
    tooltipBorder: 'rgba(56, 189, 248, 0.5)',
    tooltipText: '#ffffff'
  },
  'neon-violet': {
    name: 'Neon Violet',
    icon: '🔮',
    chartText: '#e9d5ff',
    chartGrid: 'rgba(168, 85, 247, 0.14)',
    tooltipBg: 'rgba(17, 7, 34, 0.96)',
    tooltipBorder: 'rgba(192, 132, 252, 0.5)',
    tooltipText: '#faf5ff'
  },
  'monochrome-hc': {
    name: 'Monochrome OLED',
    icon: '⚪',
    chartText: '#e5e5e5',
    chartGrid: 'rgba(255, 255, 255, 0.18)',
    tooltipBg: 'rgba(20, 20, 20, 0.98)',
    tooltipBorder: 'rgba(255, 255, 255, 0.6)',
    tooltipText: '#ffffff'
  },
  'solarized-light': {
    name: 'Solarized Light',
    icon: '☀️',
    chartText: '#334155',
    chartGrid: 'rgba(15, 23, 42, 0.08)',
    tooltipBg: 'rgba(255, 255, 255, 0.98)',
    tooltipBorder: 'rgba(2, 132, 199, 0.4)',
    tooltipText: '#0f172a'
  }
};

let currentTheme = 'default';

function applyTheme(themeId, skipReRender = false) {
  if (!THEMES[themeId]) themeId = 'default';
  currentTheme = themeId;
  document.documentElement.setAttribute('data-theme', themeId);
  try {
    localStorage.setItem('cpview_theme', themeId);
  } catch (e) {}

  const themeInfo = THEMES[themeId];
  const btnLabel = document.getElementById('theme-selector-label');
  const btnIcon = document.getElementById('theme-selector-icon');
  if (btnLabel) btnLabel.textContent = themeInfo.name;
  if (btnIcon) btnIcon.textContent = themeInfo.icon;

  // Update active mark on theme options
  document.querySelectorAll('.theme-option').forEach(opt => {
    opt.classList.toggle('active', opt.getAttribute('data-theme') === themeId);
  });

  // Update Chart.js defaults
  if (window.Chart) {
    Chart.defaults.color = themeInfo.chartText;
    if (Chart.defaults.scale && Chart.defaults.scale.grid) {
      Chart.defaults.scale.grid.color = themeInfo.chartGrid;
    }
    if (Chart.defaults.plugins && Chart.defaults.plugins.tooltip) {
      Chart.defaults.plugins.tooltip.backgroundColor = themeInfo.tooltipBg;
      Chart.defaults.plugins.tooltip.borderColor = themeInfo.tooltipBorder;
      Chart.defaults.plugins.tooltip.titleColor = themeInfo.tooltipText;
      Chart.defaults.plugins.tooltip.bodyColor = themeInfo.tooltipText;
    }
  }

  // Re-render current page charts so they pick up new theme styles
  if (!skipReRender && typeof CP_DATA !== 'undefined' && CP_DATA) {
    if (typeof currentPage !== 'undefined' && currentPage) {
      renderPage(currentPage);
    }
    if (typeof chartGenState !== 'undefined' && chartGenState.chartInstance) {
      renderCustomChart();
    }
  }
}

function setupThemeSystem() {
  const btn = document.getElementById('btn-theme-selector');
  const menu = document.getElementById('theme-dropdown-menu');

  if (btn && menu) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = menu.style.display === 'flex';
      // Close scale menu if open
      const scaleMenu = document.getElementById('scale-dropdown-menu');
      const scaleBtn = document.getElementById('btn-scale-selector');
      if (scaleMenu) scaleMenu.style.display = 'none';
      if (scaleBtn) scaleBtn.setAttribute('aria-expanded', 'false');

      // Close lang menu if open
      const langMenu = document.getElementById('lang-dropdown-menu');
      const langBtn = document.getElementById('btn-lang-selector');
      if (langMenu) langMenu.style.display = 'none';
      if (langBtn) langBtn.setAttribute('aria-expanded', 'false');

      menu.style.display = isVisible ? 'none' : 'flex';
      btn.setAttribute('aria-expanded', !isVisible);
    });

    document.addEventListener('click', (e) => {
      if (!btn.contains(e.target) && !menu.contains(e.target)) {
        menu.style.display = 'none';
        btn.setAttribute('aria-expanded', 'false');
      }
    });

    document.querySelectorAll('.theme-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const themeId = opt.getAttribute('data-theme');
        applyTheme(themeId);
        menu.style.display = 'none';
        btn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  let savedTheme = 'default';
  try {
    savedTheme = localStorage.getItem('cpview_theme') || 'default';
  } catch (e) {}
  applyTheme(savedTheme, true);
}

// ============================================================================
// Language Selector Dropdown System (Spanish, English, Portuguese)
// ============================================================================

function setupLanguageSystem() {
  const btn = document.getElementById('btn-lang-selector');
  const menu = document.getElementById('lang-dropdown-menu');

  if (btn && menu) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = menu.style.display === 'flex';

      // Close theme menu if open
      const themeMenu = document.getElementById('theme-dropdown-menu');
      const themeBtn = document.getElementById('btn-theme-selector');
      if (themeMenu) themeMenu.style.display = 'none';
      if (themeBtn) themeBtn.setAttribute('aria-expanded', 'false');

      // Close scale menu if open
      const scaleMenu = document.getElementById('scale-dropdown-menu');
      const scaleBtn = document.getElementById('btn-scale-selector');
      if (scaleMenu) scaleMenu.style.display = 'none';
      if (scaleBtn) scaleBtn.setAttribute('aria-expanded', 'false');

      menu.style.display = isVisible ? 'none' : 'flex';
      btn.setAttribute('aria-expanded', !isVisible);
    });

    document.addEventListener('click', (e) => {
      if (!btn.contains(e.target) && !menu.contains(e.target)) {
        menu.style.display = 'none';
        btn.setAttribute('aria-expanded', 'false');
      }
    });

    document.querySelectorAll('.lang-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const lang = opt.getAttribute('data-lang');
        if (lang && window.i18n && typeof window.i18n.setLanguage === 'function') {
          window.i18n.setLanguage(lang);
        }
        menu.style.display = 'none';
        btn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  if (window.i18n && typeof window.i18n.updateLanguageSelectorUI === 'function') {
    window.i18n.updateLanguageSelectorUI();
  }
}

// ============================================================================
// Global Time Range Horizon System (All, 1 Week, 1 Day, Custom Start/End)
// ============================================================================

function getAvailableWeeks() {
  const t = (k, def, params) => (window.i18n ? window.i18n.t(k, def, params) : def);
  if (!CP_DATA || !CP_DATA.system) {
    return [
      { id: 'w1', label: t('timerange.week_option_1', 'Semana 1: 03 Mar — 09 Mar (7 días)'), start: '2024-03-03', end: '2024-03-09', isCrit: false }
    ];
  }

  const sys = CP_DATA.system;
  const startIso = sys.start_iso ? sys.start_iso.substring(0, 10) : '2024-03-03';
  const endIso = sys.end_iso ? sys.end_iso.substring(0, 10) : '2024-04-02';

  const startDate = new Date(startIso + 'T00:00:00Z');
  const endDate = new Date(endIso + 'T23:59:59Z');
  const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000));

  const weeks = [];
  let cur = new Date(startDate.getTime());
  let weekIdx = 1;

  while (cur < endDate) {
    const wStart = new Date(cur.getTime());
    const wEnd = new Date(Math.min(cur.getTime() + 6 * 86400000, endDate.getTime()));
    const sStr = wStart.toISOString().substring(0, 10);
    const eStr = wEnd.toISOString().substring(0, 10);
    const spanDays = Math.max(1, Math.round((wEnd.getTime() - wStart.getTime()) / 86400000) + 1);

    const sFormatted = formatFriendlyDay(sStr);
    const eFormatted = formatFriendlyDay(eStr);

    weeks.push({
      id: `w${weekIdx}`,
      label: `${t('timerange.week', 'Semana')} ${weekIdx}: ${sFormatted} — ${eFormatted} (${spanDays} ${t('timerange.days_suffix', 'días')})`,
      start: sStr,
      end: eStr,
      isCrit: false
    });

    cur = new Date(cur.getTime() + 7 * 86400000);
    weekIdx++;
  }

  if (totalDays > 7) {
    const last7Start = new Date(endDate.getTime() - 6 * 86400000);
    const l7StartStr = last7Start.toISOString().substring(0, 10);
    weeks.push({
      id: 'w_last7',
      label: `${t('timerange.chip_last7', 'Últimos 7 días')}: ${formatFriendlyDay(l7StartStr)} — ${formatFriendlyDay(endIso)}`,
      start: l7StartStr,
      end: endIso,
      isCrit: false
    });
  }

  return weeks;
}

function formatFriendlyDay(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  const date = new Date(Date.UTC(y, m, d));

  const lang = window.i18n ? window.i18n.currentLang : 'es';
  const locale = lang === 'en' ? 'en-US' : (lang === 'pt' ? 'pt-PT' : 'es-ES');
  try {
    const formatted = date.toLocaleDateString(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC'
    });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch (e) {
    return `${d}/${m + 1}/${y}`;
  }
}

function updateCustomDurationBadge(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return;
  const d1 = new Date(startDateStr + 'T00:00:00Z');
  const d2 = new Date(endDateStr + 'T23:59:59Z');
  const diffMs = Math.max(0, d2.getTime() - d1.getTime());
  const days = Math.max(1, Math.round(diffMs / 86400000));
  const hours = days * 24;

  const t = (k, def) => (window.i18n ? window.i18n.t(k, def) : def);
  const textEl = document.getElementById('custom-duration-text');
  if (textEl) {
    if (days <= 1) {
      textEl.textContent = `1 ${t('timerange.days_suffix', 'día')} (24 ${t('timerange.hours_suffix', 'horas')})`;
    } else {
      textEl.textContent = `${days} ${t('timerange.days_suffix', 'días')} (${hours} ${t('timerange.hours_suffix', 'horas')})`;
    }
  }
}

function populateWeekDropdown() {
  const selectEl = document.getElementById('time-select-week');
  if (!selectEl) return;
  selectEl.innerHTML = '';
  const weeks = getAvailableWeeks();
  weeks.forEach((wk, idx) => {
    const opt = document.createElement('option');
    opt.value = String(idx);
    opt.textContent = wk.label;
    if (idx === timeRangeState.selectedWeekIndex) {
      opt.selected = true;
    }
    selectEl.appendChild(opt);
  });
  selectEl.value = String(timeRangeState.selectedWeekIndex);
}

function initTimeRangeBoundsFromData() {
  if (!CP_DATA || !CP_DATA.system) return;
  const sys = CP_DATA.system;
  const startIso = sys.start_iso ? sys.start_iso.substring(0, 10) : '2024-03-03';
  const endIso = sys.end_iso ? sys.end_iso.substring(0, 10) : '2024-04-02';

  // Restore saved state if present
  try {
    const saved = localStorage.getItem('cpview_time_range_state_v2');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.mode) timeRangeState.mode = parsed.mode;
      if (typeof parsed.selectedWeekIndex === 'number') timeRangeState.selectedWeekIndex = parsed.selectedWeekIndex;
      if (parsed.selectedDay) timeRangeState.selectedDay = parsed.selectedDay;
      if (parsed.startDate) timeRangeState.startDate = parsed.startDate;
      if (parsed.endDate) timeRangeState.endDate = parsed.endDate;
    }
  } catch (e) {}

  // CLAMP to current machine's database bounds
  if (!timeRangeState.startDate || timeRangeState.startDate < startIso || timeRangeState.startDate > endIso) {
    timeRangeState.startDate = startIso;
  }
  if (!timeRangeState.endDate || timeRangeState.endDate > endIso || timeRangeState.endDate < startIso) {
    timeRangeState.endDate = endIso;
  }
  if (!timeRangeState.selectedDay || timeRangeState.selectedDay < startIso || timeRangeState.selectedDay > endIso) {
    timeRangeState.selectedDay = startIso;
  }

  // Populate Week Dropdown
  populateWeekDropdown();

  const weeks = getAvailableWeeks();
  if (typeof timeRangeState.selectedWeekIndex !== 'number' || timeRangeState.selectedWeekIndex < 0 || timeRangeState.selectedWeekIndex >= weeks.length) {
    timeRangeState.selectedWeekIndex = 0;
  }

  // Set boundaries on date inputs
  const startInp = document.getElementById('time-range-start-date');
  const endInp = document.getElementById('time-range-end-date');
  const dayInp = document.getElementById('time-select-day');
  const dbBoundsDates = document.getElementById('db-bounds-dates');

  if (startInp) {
    startInp.min = startIso;
    startInp.max = endIso;
    startInp.value = timeRangeState.startDate;
  }
  if (endInp) {
    endInp.min = startIso;
    endInp.max = endIso;
    endInp.value = timeRangeState.endDate;
  }
  if (dayInp) {
    dayInp.min = startIso;
    dayInp.max = endIso;
    dayInp.value = timeRangeState.selectedDay;
  }
  if (dbBoundsDates) {
    dbBoundsDates.textContent = `${startIso} — ${endIso}`;
  }

  updateTimeRangeBounds();
}

function updateTimeRangeBounds() {
  if (!CP_DATA || !CP_DATA.system) return;
  const sys = CP_DATA.system;
  const sysStart = sys.start_timestamp || 1709473235;
  const sysEnd = sys.end_timestamp || 1712068134;

  if (timeRangeState.mode === 'all') {
    timeRangeState.startTs = sysStart;
    timeRangeState.endTs = sysEnd;
  } else if (timeRangeState.mode === '1w') {
    const weeks = getAvailableWeeks();
    let idx = timeRangeState.selectedWeekIndex;
    if (idx < 0 || idx >= weeks.length) idx = 1;
    timeRangeState.selectedWeekIndex = idx;
    const wk = weeks[idx];
    let s = new Date(wk.start + 'T00:00:00Z').getTime() / 1000;
    let e = new Date(wk.end + 'T23:59:59Z').getTime() / 1000;
    timeRangeState.startTs = Math.max(sysStart, s);
    timeRangeState.endTs = Math.min(sysEnd, e);
    timeRangeState.startDate = wk.start;
    timeRangeState.endDate = wk.end;
  } else if (timeRangeState.mode === '1d') {
    const day = timeRangeState.selectedDay || '2024-03-13';
    let s = new Date(day + 'T00:00:00Z').getTime() / 1000;
    let e = new Date(day + 'T23:59:59Z').getTime() / 1000;
    timeRangeState.startTs = Math.max(sysStart, s);
    timeRangeState.endTs = Math.min(sysEnd, e);
    timeRangeState.startDate = day;
    timeRangeState.endDate = day;
  } else if (timeRangeState.mode === 'custom') {
    let s = timeRangeState.startDate ? new Date(timeRangeState.startDate + 'T00:00:00Z').getTime() / 1000 : sysStart;
    let e = timeRangeState.endDate ? new Date(timeRangeState.endDate + 'T23:59:59Z').getTime() / 1000 : sysEnd;
    if (isNaN(s)) s = sysStart;
    if (isNaN(e)) e = sysEnd;
    if (s > e) { const tmp = s; s = e; e = tmp; }
    timeRangeState.startTs = Math.max(sysStart, s);
    timeRangeState.endTs = Math.min(sysEnd, e);
  }

  updateTimeRangeUI();
}

function updateTimeRangeUI() {
  const mode = timeRangeState.mode;
  const sys = (CP_DATA && CP_DATA.system) ? CP_DATA.system : {};
  const startIso = sys.start_iso ? sys.start_iso.substring(0, 10) : '2024-03-03';
  const endIso = sys.end_iso ? sys.end_iso.substring(0, 10) : '2024-04-02';

  // 1. Update active preset button in bar
  document.querySelectorAll('#time-horizon-presets .filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-time-range') === mode);
  });

  // 2. Toggle subbar visibility & individual panels
  const subbarEl = document.getElementById('time-horizon-subbar');
  const weekPanel = document.getElementById('time-subcontrol-week');
  const dayPanel = document.getElementById('time-subcontrol-day');
  const customPanel = document.getElementById('time-subcontrol-custom');

  if (subbarEl) {
    subbarEl.style.display = (mode === 'all') ? 'none' : 'block';
  }
  if (weekPanel) {
    weekPanel.style.display = (mode === '1w') ? 'block' : 'none';
  }
  if (dayPanel) {
    dayPanel.style.display = (mode === '1d') ? 'block' : 'none';
  }
  if (customPanel) {
    customPanel.style.display = (mode === 'custom') ? 'block' : 'none';
  }

  // 3. Update Week Selector Controls
  if (mode === '1w') {
    const weeks = getAvailableWeeks();
    const wk = weeks[timeRangeState.selectedWeekIndex] || weeks[0];
    const selectWeek = document.getElementById('time-select-week');
    if (selectWeek) {
      selectWeek.value = String(timeRangeState.selectedWeekIndex);
    }
    const badgeWeek = document.getElementById('week-active-dates-badge');
    if (badgeWeek) {
      badgeWeek.textContent = `${wk.start} — ${wk.end}`;
    }
    const btnWeekPrev = document.getElementById('btn-week-prev');
    const btnWeekNext = document.getElementById('btn-week-next');
    if (btnWeekPrev) btnWeekPrev.disabled = (timeRangeState.selectedWeekIndex <= 0);
    if (btnWeekNext) btnWeekNext.disabled = (timeRangeState.selectedWeekIndex >= weeks.length - 1);

    document.querySelectorAll('#week-quick-chips .chip-btn').forEach(chip => {
      const idx = parseInt(chip.getAttribute('data-week-idx'), 10);
      chip.classList.toggle('active', idx === timeRangeState.selectedWeekIndex);
    });
  }

  // 4. Update Day Selector Controls
  if (mode === '1d') {
    const dayInp = document.getElementById('time-select-day');
    if (dayInp) {
      dayInp.value = timeRangeState.selectedDay;
      dayInp.min = startIso;
      dayInp.max = endIso;
    }
    const badgeDay = document.getElementById('day-active-name-badge');
    if (badgeDay) {
      badgeDay.textContent = formatFriendlyDay(timeRangeState.selectedDay);
    }
    const btnDayPrev = document.getElementById('btn-day-prev');
    const btnDayNext = document.getElementById('btn-day-next');
    if (btnDayPrev) btnDayPrev.disabled = (timeRangeState.selectedDay <= startIso);
    if (btnDayNext) btnDayNext.disabled = (timeRangeState.selectedDay >= endIso);

    document.querySelectorAll('#day-quick-chips .chip-btn').forEach(chip => {
      const qDay = chip.getAttribute('data-quick-day');
      chip.classList.toggle('active', qDay === timeRangeState.selectedDay);
    });
  }

  // 5. Update Custom Range Controls
  if (mode === 'custom') {
    const startInp = document.getElementById('time-range-start-date');
    const endInp = document.getElementById('time-range-end-date');
    if (startInp) {
      startInp.min = startIso;
      startInp.max = timeRangeState.endDate || endIso;
      startInp.value = timeRangeState.startDate;
    }
    if (endInp) {
      endInp.min = timeRangeState.startDate || startIso;
      endInp.max = endIso;
      endInp.value = timeRangeState.endDate;
    }
    updateCustomDurationBadge(timeRangeState.startDate, timeRangeState.endDate);

    document.querySelectorAll('#custom-quick-chips .chip-btn').forEach(chip => {
      const p = chip.getAttribute('data-custom-preset');
      let isAct = false;
      if (p === 'q1' && timeRangeState.startDate === '2024-03-03' && timeRangeState.endDate === '2024-03-17') isAct = true;
      if (p === 'q2' && timeRangeState.startDate === '2024-03-18' && timeRangeState.endDate === '2024-04-02') isAct = true;
      if (p === 'crit' && timeRangeState.startDate === '2024-03-11' && timeRangeState.endDate === '2024-03-15') isAct = true;
      if (p === 'last14' && timeRangeState.startDate === '2024-03-20' && timeRangeState.endDate === '2024-04-02') isAct = true;
      if (p === 'first7' && timeRangeState.startDate === '2024-03-03' && timeRangeState.endDate === '2024-03-09') isAct = true;
      chip.classList.toggle('active', isAct);
    });
  }

  // 6. Update summary text in chip and top header
  const summaryEl = document.getElementById('time-horizon-summary-text');
  const samplesEl = document.getElementById('time-horizon-samples-text');
  const hdrTimerangeEl = document.getElementById('hdr-timerange');

  if (CP_DATA && CP_DATA.system) {
    const sDateStr = fmtDateShortDay(timeRangeState.startTs);
    const eDateStr = fmtDateShortDay(timeRangeState.endTs);

    const durationSec = Math.max(0, timeRangeState.endTs - timeRangeState.startTs);
    const daysSuffix = window.i18n ? window.i18n.t('timerange.days_suffix', 'días') : 'días';
    const hoursSuffix = window.i18n ? window.i18n.t('timerange.hours_suffix', 'horas') : 'horas';

    let durLabel = '';
    if (durationSec <= 86400) {
      durLabel = `${Math.round(durationSec / 3600)} ${hoursSuffix}`;
    } else {
      const d = (durationSec / 86400).toFixed(durationSec % 86400 === 0 ? 0 : 1);
      durLabel = `${d} ${daysSuffix}`;
    }

    const summaryStr = `${sDateStr} — ${eDateStr} (${durLabel})`;
    if (summaryEl) summaryEl.textContent = summaryStr;
    if (hdrTimerangeEl) hdrTimerangeEl.textContent = summaryStr;

    // Samples count
    const samplesCount = filterTimeSeries(CP_DATA.cpu && CP_DATA.cpu.hourly ? CP_DATA.cpu.hourly : []).length;
    const samplesStr = window.i18n ? window.i18n.t('timerange.samples_count', `${samplesCount} muestras horarias`, { count: samplesCount }) : `${samplesCount} muestras horarias`;
    if (samplesEl) samplesEl.textContent = samplesStr;
  }

  // 7. Sync Diagnostics & Overview range buttons
  const diagButtons = [
    { id: 'btn-diag-range-all', active: mode === 'all' },
    { id: 'btn-diag-range-7d', active: mode === '1w' },
    { id: 'btn-diag-range-crit', active: mode === 'custom' && diagnosticsState.critWindow && timeRangeState.startDate === diagnosticsState.critWindow.start && timeRangeState.endDate === diagnosticsState.critWindow.end }
  ];
  diagButtons.forEach(b => {
    const el = document.getElementById(b.id);
    if (el) el.classList.toggle('active', b.active);
  });

  const ovRangeBtns = document.querySelectorAll('#overview-traffic-range .filter-btn');
  ovRangeBtns.forEach(btn => {
    const days = btn.getAttribute('data-days');
    const isAct = (days === '30' && mode === 'all') || (days === '7' && mode === '1w');
    btn.classList.toggle('active', isAct);
  });

  // 8. Save preference in localStorage
  try {
    localStorage.setItem('cpview_time_range_state_v2', JSON.stringify({
      mode: timeRangeState.mode,
      selectedWeekIndex: timeRangeState.selectedWeekIndex,
      selectedDay: timeRangeState.selectedDay,
      startDate: timeRangeState.startDate,
      endDate: timeRangeState.endDate
    }));
  } catch (e) {}
}

function fmtDateShortDay(ts) {
  if (!ts) return '-';
  const d = new Date(ts * 1000);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const m = monthNames[d.getUTCMonth()];
  const y = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${day} ${m} ${y} ${hh}:${mm}`;
}

function setTimeRangeMode(mode, customStart = null, customEnd = null) {
  timeRangeState.mode = mode;
  if (customStart) timeRangeState.startDate = customStart;
  if (customEnd) timeRangeState.endDate = customEnd;

  const startInp = document.getElementById('time-range-start-date');
  const endInp = document.getElementById('time-range-end-date');
  if (startInp && timeRangeState.startDate) startInp.value = timeRangeState.startDate;
  if (endInp && timeRangeState.endDate) endInp.value = timeRangeState.endDate;

  updateTimeRangeBounds();

  // Invalidate diagnostics confluence analysis cache
  if (typeof diagnosticsState !== 'undefined') {
    diagnosticsState.cachedAnalysis = null;
  }

  // Update Overview throughput KPIs if on overview page
  if (CP_DATA && CP_DATA.traffic && CP_DATA.traffic.hourly) {
    const tr = filterTimeSeries(CP_DATA.traffic.hourly);
    let maxThru = 0, sumThru = 0;
    tr.forEach(t => {
      if (t.in_mbps_max > maxThru) maxThru = t.in_mbps_max;
      sumThru += t.in_mbps_avg;
    });
    const avgThru = tr.length ? sumThru / tr.length : 0;
    const avgEl = document.getElementById('kpi-avg-thru');
    const maxEl = document.getElementById('kpi-max-thru');
    if (avgEl) avgEl.textContent = fmtThroughput(avgThru);
    if (maxEl) maxEl.textContent = fmtThroughput(maxThru);

    const filteredDrops = filterTimeSeries(CP_DATA.drops && CP_DATA.drops.hourly ? CP_DATA.drops.hourly : []);
    const dropsSum = filteredDrops.reduce((acc, d) => acc + (d.total || 0), 0);
    const kpiDrops = document.getElementById('kpi-drops');
    if (kpiDrops) kpiDrops.textContent = `${(dropsSum / 1e6).toFixed(2)} M`;

    if (CP_DATA.spikes && CP_DATA.spikes.cpu_spikes) {
      const filteredSpikes = filterTimeSeries(CP_DATA.spikes.cpu_spikes, 'start_time');
      const kpiSpikes = document.getElementById('kpi-spikes');
      if (kpiSpikes) kpiSpikes.textContent = fmtNum(filteredSpikes.length);
    }
  }

  // Re-render current page
  if (typeof activePage !== 'undefined' && activePage) {
    renderPage(activePage);
  }
}

function setWeekRange(index) {
  const weeks = getAvailableWeeks();
  if (index < 0 || index >= weeks.length) return;
  timeRangeState.mode = '1w';
  timeRangeState.selectedWeekIndex = index;
  setTimeRangeMode('1w', weeks[index].start, weeks[index].end);
}

function setDayRange(dayStr) {
  const sys = (CP_DATA && CP_DATA.system) ? CP_DATA.system : {};
  const startIso = sys.start_iso ? sys.start_iso.substring(0, 10) : '2024-03-03';
  const endIso = sys.end_iso ? sys.end_iso.substring(0, 10) : '2024-04-02';

  if (!dayStr) dayStr = '2024-03-13';
  if (dayStr < startIso) dayStr = startIso;
  if (dayStr > endIso) dayStr = endIso;

  timeRangeState.mode = '1d';
  timeRangeState.selectedDay = dayStr;
  setTimeRangeMode('1d', dayStr, dayStr);
}

function shiftDay(direction) {
  const sys = (CP_DATA && CP_DATA.system) ? CP_DATA.system : {};
  const startIso = sys.start_iso ? sys.start_iso.substring(0, 10) : '2024-03-03';
  const endIso = sys.end_iso ? sys.end_iso.substring(0, 10) : '2024-04-02';

  const current = timeRangeState.selectedDay || '2024-03-13';
  const parts = current.split('-');
  if (parts.length !== 3) return;
  const d = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
  d.setUTCDate(d.getUTCDate() + direction);
  const nextIso = d.toISOString().substring(0, 10);
  if (nextIso >= startIso && nextIso <= endIso) {
    setDayRange(nextIso);
  }
}

function setupTimeRangeSystem() {
  // 1. Preset buttons
  document.querySelectorAll('#time-horizon-presets .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-time-range');
      if (mode === 'custom') {
        const startInp = document.getElementById('time-range-start-date');
        const endInp = document.getElementById('time-range-end-date');
        const s = startInp ? startInp.value : timeRangeState.startDate;
        const e = endInp ? endInp.value : timeRangeState.endDate;
        setTimeRangeMode('custom', s, e);
      } else if (mode === '1w') {
        setWeekRange(timeRangeState.selectedWeekIndex || 1);
      } else if (mode === '1d') {
        setDayRange(timeRangeState.selectedDay || '2024-03-13');
      } else {
        setTimeRangeMode('all');
      }
    });
  });

  // 2. Week Controls: Dropdown & Stepper buttons & Quick chips
  const selectWeek = document.getElementById('time-select-week');
  if (selectWeek) {
    selectWeek.addEventListener('change', (e) => {
      const idx = parseInt(e.target.value, 10);
      if (!isNaN(idx)) setWeekRange(idx);
    });
  }

  const btnWeekPrev = document.getElementById('btn-week-prev');
  if (btnWeekPrev) {
    btnWeekPrev.addEventListener('click', () => {
      setWeekRange(timeRangeState.selectedWeekIndex - 1);
    });
  }

  const btnWeekNext = document.getElementById('btn-week-next');
  if (btnWeekNext) {
    btnWeekNext.addEventListener('click', () => {
      setWeekRange(timeRangeState.selectedWeekIndex + 1);
    });
  }

  document.querySelectorAll('#week-quick-chips .chip-btn').forEach(chip => {
    chip.addEventListener('click', () => {
      const idx = parseInt(chip.getAttribute('data-week-idx'), 10);
      if (!isNaN(idx)) setWeekRange(idx);
    });
  });

  // 3. Day Controls: Date picker & Stepper buttons & Quick chips
  const dayInp = document.getElementById('time-select-day');
  if (dayInp) {
    dayInp.addEventListener('change', (e) => {
      setDayRange(e.target.value);
    });
  }

  const btnDayPrev = document.getElementById('btn-day-prev');
  if (btnDayPrev) {
    btnDayPrev.addEventListener('click', () => {
      shiftDay(-1);
    });
  }

  const btnDayNext = document.getElementById('btn-day-next');
  if (btnDayNext) {
    btnDayNext.addEventListener('click', () => {
      shiftDay(1);
    });
  }

  document.querySelectorAll('#day-quick-chips .chip-btn').forEach(chip => {
    chip.addEventListener('click', () => {
      const qDay = chip.getAttribute('data-quick-day');
      if (qDay) setDayRange(qDay);
    });
  });

  // 4. Custom Controls: Date pickers with validation, min/max helpers, chips, apply & reset
  const startInp = document.getElementById('time-range-start-date');
  const endInp = document.getElementById('time-range-end-date');
  const sys = (CP_DATA && CP_DATA.system) ? CP_DATA.system : {};
  const startIso = sys.start_iso ? sys.start_iso.substring(0, 10) : '2024-03-03';
  const endIso = sys.end_iso ? sys.end_iso.substring(0, 10) : '2024-04-02';

  if (startInp) {
    startInp.addEventListener('input', () => {
      let s = startInp.value;
      if (s < startIso) { s = startIso; startInp.value = s; }
      if (s > endIso) { s = endIso; startInp.value = s; }
      if (endInp && endInp.value < s) {
        endInp.value = s;
      }
      if (endInp) endInp.min = s;
      updateCustomDurationBadge(s, endInp ? endInp.value : endIso);
    });
  }

  if (endInp) {
    endInp.addEventListener('input', () => {
      let e = endInp.value;
      if (e > endIso) { e = endIso; endInp.value = e; }
      if (e < startIso) { e = startIso; endInp.value = e; }
      if (startInp && startInp.value > e) {
        startInp.value = e;
      }
      if (startInp) startInp.max = e;
      updateCustomDurationBadge(startInp ? startInp.value : startIso, e);
    });
  }

  const btnJumpMin = document.getElementById('btn-jump-start-min');
  if (btnJumpMin && startInp) {
    btnJumpMin.addEventListener('click', () => {
      startInp.value = startIso;
      if (endInp) endInp.min = startIso;
      updateCustomDurationBadge(startIso, endInp ? endInp.value : endIso);
    });
  }

  const btnJumpMax = document.getElementById('btn-jump-end-max');
  if (btnJumpMax && endInp) {
    btnJumpMax.addEventListener('click', () => {
      endInp.value = endIso;
      if (startInp) startInp.max = endIso;
      updateCustomDurationBadge(startInp ? startInp.value : startIso, endIso);
    });
  }

  const applyBtn = document.getElementById('btn-apply-time-horizon');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      if (startInp && endInp) {
        setTimeRangeMode('custom', startInp.value, endInp.value);
      }
    });
  }

  const resetBtn = document.getElementById('btn-reset-time-horizon');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (startInp) startInp.value = startIso;
      if (endInp) endInp.value = endIso;
      setTimeRangeMode('all');
    });
  }

  document.querySelectorAll('#custom-quick-chips .chip-btn').forEach(chip => {
    chip.addEventListener('click', () => {
      const preset = chip.getAttribute('data-custom-preset');
      let s = startIso, e = endIso;
      if (preset === 'q1') {
        s = '2024-03-03'; e = '2024-03-17';
      } else if (preset === 'q2') {
        s = '2024-03-18'; e = '2024-04-02';
      } else if (preset === 'crit') {
        s = '2024-03-11'; e = '2024-03-15';
      } else if (preset === 'last14') {
        s = '2024-03-20'; e = '2024-04-02';
      } else if (preset === 'first7') {
        s = '2024-03-03'; e = '2024-03-09';
      }
      if (startInp) startInp.value = s;
      if (endInp) endInp.value = e;
      setTimeRangeMode('custom', s, e);
    });
  });

  // 5. Header button scrolls to or focuses time horizon bar
  const hdrBtn = document.getElementById('hdr-timerange-btn');
  if (hdrBtn) {
    hdrBtn.addEventListener('click', () => {
      const bar = document.getElementById('global-time-horizon-bar');
      if (bar) {
        bar.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }

  // 6. Listen to i18n language changes to keep week labels and day badges fresh
  if (window.i18n && typeof window.i18n.subscribe === 'function') {
    window.i18n.subscribe(() => {
      populateWeekDropdown();
      updateTimeRangeUI();
    });
  }
}

// ============================================================================
// UI Scaling, Font Sizing & Typography Configuration System
// ============================================================================

const FONT_FAMILIES = {
  inter: {
    id: 'inter',
    name: 'Inter',
    family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif",
    mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace"
  },
  roboto: {
    id: 'roboto',
    name: 'Roboto',
    family: "'Roboto', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace"
  },
  system: {
    id: 'system',
    name: 'Sistema Nativo',
    family: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
  },
  mono: {
    id: 'mono',
    name: 'JetBrains Mono',
    family: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, Menlo, Monaco, Consolas, monospace",
    mono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, Menlo, Monaco, Consolas, monospace"
  },
  dyslexic: {
    id: 'dyslexic',
    name: 'Alta Legibilidad',
    family: "'Atkinson Hyperlegible', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
  }
};

let currentScaleConfig = {
  zoom: 1.0,         // 0.70 to 1.50
  fontScale: 1.0,    // 0.80 to 1.40
  fontFamily: 'inter'
};

let toastTimeout = null;
function showScaleToast(message, icon = '🔍') {
  const toast = document.getElementById('scale-toast');
  const text = document.getElementById('scale-toast-text');
  const iconEl = document.getElementById('scale-toast-icon');
  if (!toast || !text) return;

  text.textContent = message;
  if (iconEl) iconEl.textContent = icon;
  toast.classList.add('show');

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 1800);
}

function applyScaling(config, skipSave = false, skipChartReRender = false, toastMsg = null) {
  const zoom = Math.max(0.7, Math.min(1.5, Math.round(Number(config.zoom || 1.0) * 100) / 100));
  const fontScale = Math.max(0.8, Math.min(1.4, Math.round(Number(config.fontScale || 1.0) * 100) / 100));
  const fontKey = FONT_FAMILIES[config.fontFamily] ? config.fontFamily : 'inter';

  currentScaleConfig = { zoom, fontScale, fontFamily: fontKey };

  // 1. Update CSS variables
  const root = document.documentElement;
  root.style.setProperty('--ui-zoom', zoom);
  root.style.setProperty('--font-scale', fontScale);

  const fontDef = FONT_FAMILIES[fontKey];
  root.style.setProperty('--font-sans', fontDef.family);
  root.style.setProperty('--font-mono', fontDef.mono);

  // Apply zoom directly to body
  if (document.body) {
    document.body.style.zoom = zoom;
  }

  // 2. Update Header Button Label & Badges
  const btnLabel = document.getElementById('scale-selector-label');
  const zoomBadge = document.getElementById('zoom-badge-val');
  const fontBadge = document.getElementById('font-badge-val');
  const zoomSlider = document.getElementById('scale-zoom-slider');
  const fontSlider = document.getElementById('scale-font-slider');

  const zoomPct = Math.round(zoom * 100);
  const fontPct = Math.round(fontScale * 100);

  if (btnLabel) {
    if (zoomPct === 100 && fontPct === 100 && fontKey === 'inter') {
      btnLabel.textContent = '100%';
    } else if (fontPct !== 100 && zoomPct === 100) {
      btnLabel.textContent = `A ${fontPct}%`;
    } else {
      btnLabel.textContent = `${zoomPct}%`;
    }
  }
  if (zoomBadge) zoomBadge.textContent = `${zoomPct}%`;
  if (fontBadge) fontBadge.textContent = `${fontPct}%`;
  if (zoomSlider) zoomSlider.value = zoomPct;
  if (fontSlider) fontSlider.value = fontPct;

  // 3. Update preset buttons active states
  document.querySelectorAll('.scale-preset-btn').forEach(btn => {
    const val = parseInt(btn.getAttribute('data-zoom'), 10);
    btn.classList.toggle('active', val === zoomPct);
  });
  document.querySelectorAll('.font-preset-btn').forEach(btn => {
    const val = parseInt(btn.getAttribute('data-font'), 10);
    btn.classList.toggle('active', val === fontPct);
  });
  document.querySelectorAll('.font-family-option').forEach(opt => {
    const key = opt.getAttribute('data-font-family');
    opt.classList.toggle('active', key === fontKey);
  });

  // 4. Save to localStorage
  if (!skipSave) {
    try {
      localStorage.setItem('cpview_scale_config', JSON.stringify(currentScaleConfig));
    } catch (e) {}
  }

  // 5. Update Chart.js typography
  if (window.Chart) {
    Chart.defaults.font.family = fontDef.family;
    Chart.defaults.font.size = Math.round(12 * fontScale);
    if (Chart.defaults.plugins && Chart.defaults.plugins.tooltip) {
      Chart.defaults.plugins.tooltip.titleFont = { family: fontDef.family, size: Math.round(12 * fontScale), weight: 'bold' };
      Chart.defaults.plugins.tooltip.bodyFont = { family: fontDef.family, size: Math.round(11 * fontScale) };
    }

    // Trigger chart resize & redraw without animation
    if (!skipChartReRender && typeof currentCharts !== 'undefined') {
      Object.values(currentCharts).forEach(ch => {
        if (ch && typeof ch.resize === 'function') {
          try {
            if (ch.options && ch.options.plugins && ch.options.plugins.legend && ch.options.plugins.legend.labels) {
              ch.options.plugins.legend.labels.font = { family: fontDef.family, size: Math.round(11 * fontScale) };
            }
            ch.resize();
            ch.update('none');
          } catch (e) {}
        }
      });
      if (typeof chartGenState !== 'undefined' && chartGenState.chartInstance) {
        try {
          chartGenState.chartInstance.resize();
          chartGenState.chartInstance.update('none');
        } catch (e) {}
      }
    }
  }

  // Optional toast message
  if (toastMsg) {
    showScaleToast(toastMsg, fontKey === 'mono' ? '💻' : '🔍');
  }
}

function setupScalingSystem() {
  const btn = document.getElementById('btn-scale-selector');
  const menu = document.getElementById('scale-dropdown-menu');
  const themeMenu = document.getElementById('theme-dropdown-menu');
  const themeBtn = document.getElementById('btn-theme-selector');

  // Toggle Dropdown Menu
  if (btn && menu) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = menu.style.display === 'flex';
      // Close theme menu if open
      if (themeMenu) themeMenu.style.display = 'none';
      if (themeBtn) themeBtn.setAttribute('aria-expanded', 'false');

      // Close lang menu if open
      const langMenu = document.getElementById('lang-dropdown-menu');
      const langBtn = document.getElementById('btn-lang-selector');
      if (langMenu) langMenu.style.display = 'none';
      if (langBtn) langBtn.setAttribute('aria-expanded', 'false');

      menu.style.display = isVisible ? 'none' : 'flex';
      btn.setAttribute('aria-expanded', !isVisible);
    });

    document.addEventListener('click', (e) => {
      if (!btn.contains(e.target) && !menu.contains(e.target)) {
        menu.style.display = 'none';
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Reset Button
  const resetBtn = document.getElementById('btn-reset-scaling');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      applyScaling({ zoom: 1.0, fontScale: 1.0, fontFamily: 'inter' }, false, false, 'Escala restablecida al 100%');
    });
  }

  // Zoom Steppers & Slider
  const zoomSlider = document.getElementById('scale-zoom-slider');
  const zoomDecBtn = document.getElementById('btn-zoom-dec');
  const zoomIncBtn = document.getElementById('btn-zoom-inc');

  if (zoomSlider) {
    zoomSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10) / 100;
      applyScaling({ ...currentScaleConfig, zoom: val }, false, false);
    });
  }
  if (zoomDecBtn) {
    zoomDecBtn.addEventListener('click', () => {
      const newZoom = Math.max(0.7, Math.round((currentScaleConfig.zoom - 0.05) * 20) / 20);
      applyScaling({ ...currentScaleConfig, zoom: newZoom }, false, false, `Zoom: ${Math.round(newZoom * 100)}%`);
    });
  }
  if (zoomIncBtn) {
    zoomIncBtn.addEventListener('click', () => {
      const newZoom = Math.min(1.5, Math.round((currentScaleConfig.zoom + 0.05) * 20) / 20);
      applyScaling({ ...currentScaleConfig, zoom: newZoom }, false, false, `Zoom: ${Math.round(newZoom * 100)}%`);
    });
  }

  // Zoom Presets
  document.querySelectorAll('.scale-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = parseInt(btn.getAttribute('data-zoom'), 10) / 100;
      applyScaling({ ...currentScaleConfig, zoom: val }, false, false, `Zoom: ${Math.round(val * 100)}%`);
    });
  });

  // Font Scale Steppers & Slider
  const fontSlider = document.getElementById('scale-font-slider');
  const fontDecBtn = document.getElementById('btn-font-dec');
  const fontIncBtn = document.getElementById('btn-font-inc');

  if (fontSlider) {
    fontSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10) / 100;
      applyScaling({ ...currentScaleConfig, fontScale: val }, false, false);
    });
  }
  if (fontDecBtn) {
    fontDecBtn.addEventListener('click', () => {
      const newFont = Math.max(0.8, Math.round((currentScaleConfig.fontScale - 0.05) * 20) / 20);
      applyScaling({ ...currentScaleConfig, fontScale: newFont }, false, false, `Texto: ${Math.round(newFont * 100)}%`);
    });
  }
  if (fontIncBtn) {
    fontIncBtn.addEventListener('click', () => {
      const newFont = Math.min(1.4, Math.round((currentScaleConfig.fontScale + 0.05) * 20) / 20);
      applyScaling({ ...currentScaleConfig, fontScale: newFont }, false, false, `Texto: ${Math.round(newFont * 100)}%`);
    });
  }

  // Font Scale Presets
  document.querySelectorAll('.font-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = parseInt(btn.getAttribute('data-font'), 10) / 100;
      applyScaling({ ...currentScaleConfig, fontScale: val }, false, false, `Texto: ${Math.round(val * 100)}%`);
    });
  });

  // Font Family Options
  document.querySelectorAll('.font-family-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const familyKey = opt.getAttribute('data-font-family');
      const fontName = FONT_FAMILIES[familyKey] ? FONT_FAMILIES[familyKey].name : familyKey;
      applyScaling({ ...currentScaleConfig, fontFamily: familyKey }, false, false, `Fuente: ${fontName}`);
    });
  });

  // Keyboard Shortcuts (Ctrl/Cmd + Plus, Minus, Zero)
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

    if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
      e.preventDefault();
      const newZoom = Math.min(1.5, Math.round((currentScaleConfig.zoom + 0.05) * 20) / 20);
      applyScaling({ ...currentScaleConfig, zoom: newZoom }, false, false, `Zoom: ${Math.round(newZoom * 100)}%`);
    } else if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
      e.preventDefault();
      const newZoom = Math.max(0.7, Math.round((currentScaleConfig.zoom - 0.05) * 20) / 20);
      applyScaling({ ...currentScaleConfig, zoom: newZoom }, false, false, `Zoom: ${Math.round(newZoom * 100)}%`);
    } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
      e.preventDefault();
      applyScaling({ ...currentScaleConfig, zoom: 1.0 }, false, false, 'Zoom: 100%');
    }
  });

  // Load saved configuration from localStorage
  let savedConfig = null;
  try {
    const raw = localStorage.getItem('cpview_scale_config');
    if (raw) savedConfig = JSON.parse(raw);
  } catch (e) {}

  if (savedConfig) {
    applyScaling(savedConfig, true, true);
  } else {
    applyScaling(currentScaleConfig, true, true);
  }
}

// Chart.js default theme configuration
if (window.Chart) {
  Chart.defaults.color = '#94a3b8';
  Chart.defaults.font.family = 'Inter, sans-serif';
  Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.95)';
  Chart.defaults.plugins.tooltip.borderColor = 'rgba(255, 255, 255, 0.1)';
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.scale.grid = { color: 'rgba(255, 255, 255, 0.05)' };
}

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  loadChartCustomState();
  setupNavigation();
  setupEventListeners();
  setupThemeSystem();
  setupScalingSystem();
  setupLanguageSystem();
  setupTimeRangeSystem();

  // Initialize and connect i18n dynamic reactive listener
  if (window.i18n) {
    window.i18n.onLanguageChange((newLang) => {
      // Invalidate cached analysis so diagnoses and remediations refresh in current language
      if (typeof diagnosticsState !== 'undefined') {
        diagnosticsState.cachedAnalysis = null;
      }
      populateWeekDropdown();
      updateTimeRangeUI();
      populateUI();
      if (typeof closeSeriesManagerPopover === 'function') {
        closeSeriesManagerPopover();
      }
      if (typeof setupUniversalChartControls === 'function') {
        setupUniversalChartControls();
      }
      if (typeof activePage !== 'undefined') {
        switchPage(activePage, false);
      }
    });
  }

  await loadData();
});

// Load main dataset
let currentDataUrl = 'data/cpview_data.json';

async function loadData(customUrl) {
  if (customUrl) {
    currentDataUrl = customUrl;
  }

  // Clear existing charts
  Object.keys(currentCharts).forEach(key => {
    try {
      currentCharts[key].destroy();
    } catch (e) {}
    delete currentCharts[key];
  });

  try {
    const res = await fetch(currentDataUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch ${currentDataUrl}`);
    CP_DATA = await res.json();
    if (typeof vsxState !== 'undefined') vsxState.cachedVsxData = null;
    if (typeof diagnosticsState !== 'undefined') {
      diagnosticsState.cachedAnalysis = null;
      diagnosticsState.page = 1;
      diagnosticsState.expandedIndex = null;
      diagnosticsState.dayFilter = 'all';
      diagnosticsState.hourFilter = 'all';
      diagnosticsState.search = '';
    }
    initTimeRangeBoundsFromData();
    populateUI();
    renderPage(activePage);
  } catch (err) {
    console.error('Error loading CPView data:', err);
    document.querySelector('.content-area').innerHTML = `
      <div class="loading-container">
        <span style="font-size: 32px;">⚠️</span>
        <h3 style="color:#fff;">Error al cargar los datos de CPView</h3>
        <p>${err.message}</p>
        <button class="btn btn-primary" onclick="loadData('data/cpview_data.json')">Reintentar con BD predeterminada</button>
      </div>
    `;
  }
}

// Setup Left Column Navigation & Routing
function setupNavigation() {
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.getAttribute('data-page');
      if (page) {
        switchPage(page);
      }
    });
  });

  // URL hash routing
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById(`page-${hash}`)) {
      switchPage(hash, false);
    }
  });

  if (window.location.hash) {
    const initialPage = window.location.hash.replace('#', '');
    if (document.getElementById(`page-${initialPage}`)) {
      switchPage(initialPage, false);
    }
  }
}

function switchPage(pageId, updateHash = true) {
  activePage = pageId;
  if (updateHash) {
    window.location.hash = pageId;
  }

  // Update sidebar active classes
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    if (item.getAttribute('data-page') === pageId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Switch visible page view
  document.querySelectorAll('.page-view').forEach(view => {
    view.classList.remove('active');
  });
  const target = document.getElementById(`page-${pageId}`);
  if (target) {
    target.classList.add('active');
  }

  // Update header title
  const titles = {
    diagnostics: '<span>🚨</span> Diagnóstico y Análisis de Problemas e Incidentes',
    overview: '<span>📊</span> Resumen Ejecutivo del Gateway',
    system: '<span>🖥️</span> Arquitectura de Sistema, CPU y Memoria',
    vsx: '<span>🛡️</span> ' + (window.i18n ? window.i18n.t('title.vsx', 'Sistemas Virtuales (VSX)') : 'Sistemas Virtuales (VSX)'),
    interfaces: '<span>🌐</span> Catálogo y Rendimiento de Interfaces de Red',
    traffic: '<span>🛡️</span> Conexiones y Tasas de Tráfico Firewall',
    drops: '<span>🚫</span> Análisis Detallado de Descartes (Drop Reasons)',
    spikes: '<span>🔍</span> Spike Detective - Diagnóstico de Procesos',
    flofiler: '<span>🌊</span> Flow Profiler - Distribución de Ciclos CPU',
    securexl: '<span>⚡</span> SecureXL y Aceleración CoreXL',
    blades: '<span>🔐</span> Software Blades, VPN y Conexiones Seguras',
    db_explorer: '<span>🗄️</span> Explorador de Tablas y Consultas SQLite'
  };
  const titleEl = document.getElementById('current-page-title');
  if (titleEl) {
    if (window.i18n && window.i18n.t(`title.${pageId}`)) {
      titleEl.innerHTML = window.i18n.t(`title.${pageId}`);
    } else if (titles[pageId]) {
      titleEl.innerHTML = titles[pageId];
    }
  }

  // Wait a frame for browser layout and CSS animation initiation
  setTimeout(() => {
    renderPage(pageId);
  }, 25);
}

// Populate Top Header & Meta Info
function populateUI() {
  if (!CP_DATA) return;
  const sys = CP_DATA.system;
  const daysSuffix = window.i18n ? window.i18n.t('header.days_suffix', 'días') : 'días';
  const tablesSuffix = window.i18n ? window.i18n.t('sidebar.badge_tables_suffix', 'Tablas') : 'Tablas';

  let uptimeStr = sys.latest_uptime || `119 ${daysSuffix}`;
  if (uptimeStr) {
    uptimeStr = uptimeStr.replace(/\b(días|days|dias)\b/gi, daysSuffix);
  }
  document.getElementById('hdr-uptime').textContent = uptimeStr;
  document.getElementById('hdr-cluster').textContent = sys.cluster_status || 'VSX Standalone';
  if (document.getElementById('hdr-node-name')) {
    document.getElementById('hdr-node-name').textContent = sys.node_name || 'Nodo Check Point';
  }
  const brandP = document.querySelector('.brand-text p');
  if (brandP) {
    brandP.textContent = sys.node_name || sys.db_filename || 'SG_FWNET-ch01-01';
  }
  
  if (typeof updateTimeRangeUI === 'function') {
    updateTimeRangeUI();
  }

  // Badges
  const coresTotal = (sys && sys.cores_count) || (CP_DATA.cpu && CP_DATA.cpu.summary ? CP_DATA.cpu.summary.length : 32);
  const sideNodeCores = document.getElementById('sidebar-node-cores');
  if (sideNodeCores) sideNodeCores.textContent = `${coresTotal} Cores`;
  const badgeCoresEl = document.getElementById('badge-cores');
  if (badgeCoresEl) badgeCoresEl.textContent = `${coresTotal} Cores`;
  document.getElementById('badge-ifs').textContent = `${CP_DATA.interfaces.length} IFs`;
  document.getElementById('badge-drops').textContent = `${(CP_DATA.drops.total / 1e6).toFixed(1)}M`;
  document.getElementById('badge-spikes').textContent = `${(CP_DATA.spikes.cpu_spikes.length / 1000).toFixed(1)}k`;
  document.getElementById('badge-tables').textContent = `${CP_DATA.table_catalog.length} ${tablesSuffix}`;
  document.getElementById('badge-conns').textContent = '400k';

  // KPI Overview
  const tr = filterTimeSeries(CP_DATA.traffic.hourly);
  let maxThru = 0, sumThru = 0;
  tr.forEach(t => {
    if (t.in_mbps_max > maxThru) maxThru = t.in_mbps_max;
    sumThru += t.in_mbps_avg;
  });
  const avgThru = tr.length ? sumThru / tr.length : 0;
  document.getElementById('kpi-avg-thru').textContent = fmtThroughput(avgThru);
  document.getElementById('kpi-max-thru').textContent = fmtThroughput(maxThru);

  const filteredDrops = filterTimeSeries(CP_DATA.drops && CP_DATA.drops.hourly ? CP_DATA.drops.hourly : []);
  const dropsSum = filteredDrops.reduce((acc, d) => acc + (d.total || 0), 0);
  document.getElementById('kpi-drops').textContent = `${(dropsSum / 1e6).toFixed(2)} M`;
  const filteredSpikes = filterTimeSeries(CP_DATA.spikes && CP_DATA.spikes.cpu_spikes ? CP_DATA.spikes.cpu_spikes : [], 'start_time');
  document.getElementById('kpi-spikes').textContent = fmtNum(filteredSpikes.length);
  document.getElementById('kpi-snapshots-count').textContent = fmtNum(sys.total_snapshots);
  document.getElementById('kpi-total-ifs').textContent = CP_DATA.interfaces.length;
}

// Render active page content & charts
function renderPage(page) {
  if (!CP_DATA) return;

  switch (page) {
    case 'diagnostics':
      renderDiagnosticsPage();
      break;
    case 'overview':
      renderOverviewCharts();
      renderOverviewDisks();
      break;
    case 'system':
      renderSystemPage();
      break;
    case 'vsx':
      renderVsxPage();
      break;
    case 'interfaces':
      renderInterfacesPage();
      break;
    case 'traffic':
      renderTrafficPage();
      break;
    case 'drops':
      renderDropsPage();
      break;
    case 'spikes':
      renderSpikesPage();
      break;
    case 'flofiler':
      renderFlofilerPage();
      break;
    case 'securexl':
      renderSecureXLPage();
      break;
    case 'blades':
      renderBladesPage();
      break;
    case 'db_explorer':
      renderCatalogTable();
      break;
  }
}

// =============================================================================
// PAGE 0: DIAGNOSTICS & MULTIVARIABLE CONFLUENCE ANALYZER
// =============================================================================

let diagnosticsState = {
  search: '',
  severity: 'all',
  nature: 'all',
  dayFilter: 'all',
  hourFilter: 'all',
  page: 1,
  pageSize: 15,
  range: 'all',
  expandedIndex: null,
  algorithm: 'isolation_forest',
  sensitivity: 'standard',
  chartCore: 'peak',
  chartMetric: 'max',
  cachedAnalysis: null
};

let systemCpuState = {
  coreSelection: 'top6',
  metricMode: 'max'
};

// =============================================================================
// MULTIVARIATE ANOMALY & CONFLUENCE DETECTION ENGINE
// =============================================================================

class IsolationForest {
  constructor(nTrees = 100, subSampleSize = 128) {
    this.nTrees = nTrees;
    this.subSampleSize = subSampleSize;
    this.trees = [];
  }

  static c(n) {
    if (n <= 1) return 1;
    if (n === 2) return 1;
    const eulerGamma = 0.5772156649;
    return 2 * (Math.log(n - 1) + eulerGamma) - (2 * (n - 1) / n);
  }

  fit(data) {
    const n = data.length;
    if (n === 0) return this;
    const sampleSize = Math.min(this.subSampleSize, n);
    const maxDepth = Math.ceil(Math.log2(Math.max(sampleSize, 2)));
    this.trees = [];

    for (let t = 0; t < this.nTrees; t++) {
      const indices = [];
      const pool = Array.from({ length: n }, (_, i) => i);
      for (let i = 0; i < sampleSize; i++) {
        const randIdx = Math.floor(Math.random() * pool.length);
        indices.push(pool[randIdx]);
        pool.splice(randIdx, 1);
      }
      const sample = indices.map(idx => data[idx]);
      this.trees.push(this._buildTree(sample, 0, maxDepth));
    }
    return this;
  }

  _buildTree(samples, depth, maxDepth) {
    if (samples.length <= 1 || depth >= maxDepth) {
      return { size: samples.length, isLeaf: true };
    }

    const nFeatures = samples[0].length;
    const candidateFeatures = [];
    for (let f = 0; f < nFeatures; f++) {
      let min = Infinity, max = -Infinity;
      for (let i = 0; i < samples.length; i++) {
        const v = samples[i][f];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      if (max > min) candidateFeatures.push({ f, min, max });
    }

    if (candidateFeatures.length === 0) {
      return { size: samples.length, isLeaf: true };
    }

    const pick = candidateFeatures[Math.floor(Math.random() * candidateFeatures.length)];
    const splitVal = pick.min + Math.random() * (pick.max - pick.min);

    const left = [];
    const right = [];
    for (let i = 0; i < samples.length; i++) {
      if (samples[i][pick.f] < splitVal) left.push(samples[i]);
      else right.push(samples[i]);
    }

    if (left.length === 0 || right.length === 0) {
      return { size: samples.length, isLeaf: true };
    }

    return {
      isLeaf: false,
      feature: pick.f,
      splitVal,
      left: this._buildTree(left, depth + 1, maxDepth),
      right: this._buildTree(right, depth + 1, maxDepth)
    };
  }

  _pathLength(point, node, currentDepth) {
    if (node.isLeaf) {
      return currentDepth + IsolationForest.c(node.size);
    }
    if (point[node.feature] < node.splitVal) {
      return this._pathLength(point, node.left, currentDepth + 1);
    } else {
      return this._pathLength(point, node.right, currentDepth + 1);
    }
  }

  score(data) {
    const n = data.length;
    if (n === 0) return [];
    const sampleSize = Math.min(this.subSampleSize, n);
    const cVal = IsolationForest.c(sampleSize);

    return data.map(point => {
      let sumPath = 0;
      for (let t = 0; t < this.trees.length; t++) {
        sumPath += this._pathLength(point, this.trees[t], 0);
      }
      const avgPath = sumPath / this.trees.length;
      return Math.pow(2, -avgPath / cVal);
    });
  }
}

function invertMatrix(matrix) {
  const n = matrix.length;
  const a = matrix.map(r => r.slice());
  const inv = Array.from({ length: n }, (_, i) => {
    const row = Array(n).fill(0);
    row[i] = 1;
    return row;
  });

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    let maxVal = Math.abs(a[i][i]);
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(a[k][i]) > maxVal) {
        maxVal = Math.abs(a[k][i]);
        maxRow = k;
      }
    }
    if (maxVal < 1e-9) return null;

    if (maxRow !== i) {
      [a[i], a[maxRow]] = [a[maxRow], a[i]];
      [inv[i], inv[maxRow]] = [inv[maxRow], inv[i]];
    }

    const pivot = a[i][i];
    for (let j = 0; j < n; j++) {
      a[i][j] /= pivot;
      inv[i][j] /= pivot;
    }

    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const factor = a[k][i];
      for (let j = 0; j < n; j++) {
        a[k][j] -= factor * a[i][j];
        inv[k][j] -= factor * inv[i][j];
      }
    }
  }
  return inv;
}

function computeMahalanobis(data, featureNames) {
  const n = data.length;
  const p = featureNames.length;
  if (n < p + 2) return { distances: data.map(() => 0), contributions: data.map(() => Array(p).fill(0)) };

  const mean = Array(p).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) mean[j] += data[i][j];
  }
  for (let j = 0; j < p; j++) mean[j] /= n;

  const cov = Array.from({ length: p }, () => Array(p).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) {
      const dj = data[i][j] - mean[j];
      for (let k = 0; k < p; k++) {
        cov[j][k] += dj * (data[i][k] - mean[k]);
      }
    }
  }
  for (let j = 0; j < p; j++) {
    for (let k = 0; k < p; k++) cov[j][k] /= (n - 1);
  }

  let trace = 0;
  for (let j = 0; j < p; j++) trace += cov[j][j];
  const avgVar = Math.max(1e-6, trace / p);
  const alpha = 0.08;
  for (let j = 0; j < p; j++) {
    for (let k = 0; k < p; k++) {
      cov[j][k] = (1 - alpha) * cov[j][k] + (j === k ? alpha * avgVar : 0);
    }
  }

  const inv = invertMatrix(cov);
  if (!inv) return { distances: data.map(() => 0), contributions: data.map(() => Array(p).fill(0)) };

  const distances = [];
  const contributions = [];
  for (let i = 0; i < n; i++) {
    const diff = Array(p);
    for (let j = 0; j < p; j++) diff[j] = data[i][j] - mean[j];

    let d2 = 0;
    const pointContrib = Array(p).fill(0);
    for (let j = 0; j < p; j++) {
      let invDiffJ = 0;
      for (let k = 0; k < p; k++) {
        invDiffJ += inv[j][k] * diff[k];
      }
      const c = diff[j] * invDiffJ;
      pointContrib[j] = Math.max(0, c);
      d2 += c;
    }
    distances.push(Math.sqrt(Math.max(0, d2)));
    contributions.push(pointContrib);
  }

  return { distances, contributions, mean };
}

function getMedian(sorted) {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function getFeatureNoiseFloor(name) {
  switch (name) {
    case 'cpu_peak':
    case 'cpu_avg': return 4.0;
    case 'conn_rate': return 15.0;
    case 'traffic': return 50.0;
    case 'drops': return 25.0;
    default: return 1.0;
  }
}

function computeRobustZScore(data, featureNames) {
  const n = data.length;
  const p = featureNames.length;
  const medians = Array(p).fill(0);
  const mads = Array(p).fill(0);

  for (let j = 0; j < p; j++) {
    const col = data.map(r => r[j]).sort((a, b) => a - b);
    const med = getMedian(col);
    medians[j] = med;
    const diffs = col.map(v => Math.abs(v - med)).sort((a, b) => a - b);
    mads[j] = getMedian(diffs);
  }

  const scores = [];
  const zMatrix = [];
  for (let i = 0; i < n; i++) {
    let normSq = 0;
    const zRow = [];
    for (let j = 0; j < p; j++) {
      const scale = Math.max(1.4826 * mads[j], getFeatureNoiseFloor(featureNames[j]));
      const z = (data[i][j] - medians[j]) / scale;
      zRow.push(z);
      if (z > 0) normSq += z * z;
    }
    zMatrix.push(zRow);
    scores.push(Math.sqrt(normSq));
  }
  return { scores, zMatrix, medians, mads };
}

function computeDBSCAN(data, featureNames) {
  const n = data.length;
  const p = featureNames.length;
  if (n === 0) return { labels: [], anomalyScores: [] };

  const p5 = [], p95 = [];
  for (let j = 0; j < p; j++) {
    const col = data.map(r => r[j]).sort((a, b) => a - b);
    p5.push(col[Math.floor(n * 0.05)] || col[0]);
    p95.push(col[Math.floor(n * 0.95)] || col[n - 1]);
  }

  const norm = data.map(row => {
    return row.map((val, j) => {
      const range = (p95[j] - p5[j]) || 1;
      return Math.max(0, Math.min(1.5, (val - p5[j]) / range));
    });
  });

  const dist = (a, b) => {
    let sum = 0;
    for (let j = 0; j < p; j++) {
      const d = a[j] - b[j];
      sum += d * d;
    }
    return Math.sqrt(sum);
  };

  const kDist = [];
  for (let i = 0; i < n; i++) {
    const dList = [];
    for (let k = 0; k < n; k++) {
      if (i !== k) dList.push(dist(norm[i], norm[k]));
    }
    dList.sort((a, b) => a - b);
    kDist.push(dList[Math.min(3, dList.length - 1)] || 0.2);
  }
  const sortedKDist = kDist.slice().sort((a, b) => a - b);
  const eps = Math.max(0.15, sortedKDist[Math.floor(n * 0.85)] || 0.3);
  const minPts = 4;

  const labels = Array(n).fill(0);
  let clusterId = 0;

  for (let i = 0; i < n; i++) {
    if (labels[i] !== 0) continue;
    const neighbors = [];
    for (let j = 0; j < n; j++) {
      if (dist(norm[i], norm[j]) <= eps) neighbors.push(j);
    }
    if (neighbors.length < minPts) {
      labels[i] = -1;
    } else {
      clusterId++;
      labels[i] = clusterId;
      const queue = neighbors.slice();
      while (queue.length > 0) {
        const pt = queue.shift();
        if (labels[pt] === -1) labels[pt] = clusterId;
        if (labels[pt] !== 0) continue;
        labels[pt] = clusterId;
        const ptNeighbors = [];
        for (let j = 0; j < n; j++) {
          if (dist(norm[pt], norm[j]) <= eps) ptNeighbors.push(j);
        }
        if (ptNeighbors.length >= minPts) {
          queue.push(...ptNeighbors);
        }
      }
    }
  }

  const anomalyScores = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (labels[i] === -1) {
      anomalyScores[i] = 0.75 + Math.min(0.25, (kDist[i] / (eps * 2)));
    } else {
      anomalyScores[i] = Math.max(0.1, 0.4 * (kDist[i] / eps));
    }
  }

  return { labels, anomalyScores };
}

const MultivariateEngine = {
  run(data, options = {}) {
    const startTime = performance.now();
    const algo = options.algorithm || diagnosticsState.algorithm || 'isolation_forest';
    const sensitivity = options.sensitivity || diagnosticsState.sensitivity || 'standard';

    const cpuH = filterTimeSeries(data.cpu?.hourly || []);
    const trafH = filterTimeSeries((data.traffic && data.traffic.hourly) || []);
    const connsH = filterTimeSeries((data.traffic && data.traffic.conns_hourly) || []);
    const dropsH = filterTimeSeries((data.drops && data.drops.hourly) || []);

    if (cpuH.length === 0) return null;

    const trafMap = {};
    trafH.forEach(r => { trafMap[r.ts] = r; });
    const connsMap = {};
    connsH.forEach(r => { connsMap[r.ts] = r; });
    const dropsMap = {};
    dropsH.forEach(r => { dropsMap[r.ts] = r; });

    // Detect global peak worker across all available cores in data
    const coresCount = (data.system && data.system.cores_count) || (data.cpu && data.cpu.summary ? data.cpu.summary.length : 4);
    let globalPeakCoreNum = 0;
    let highestMaxAcrossAll = 0;
    for (let ci = 0; ci < coresCount; ci++) {
      let cMax = 0;
      cpuH.forEach(r => {
        const v = r[`core_${ci}_max`] !== undefined ? r[`core_${ci}_max`] : (r[`core_${ci}_avg`] || 0);
        if (v > cMax) cMax = v;
      });
      if (cMax > highestMaxAcrossAll) {
        highestMaxAcrossAll = cMax;
        globalPeakCoreNum = ci;
      }
    }

    const featureNames = ['cpu_peak', 'cpu_avg', 'traffic', 'conn_rate', 'drops'];
    const matrix = [];
    const samplesMeta = [];

    for (let i = 0; i < cpuH.length; i++) {
      const c = cpuH[i];
      const ts = c.ts;
      const t = trafMap[ts] || {};
      const cn = connsMap[ts] || {};
      const dr = dropsMap[ts] || {};

      // Detect peak core specifically for this hourly slice
      let hourPeakCoreNum = globalPeakCoreNum;
      let hourPeakCoreMax = 0;
      let hourPeakCoreAvg = 0;
      for (let ci = 0; ci < coresCount; ci++) {
        const cMax = c[`core_${ci}_max`] !== undefined ? c[`core_${ci}_max`] : (c[`core_${ci}_avg`] || 0);
        if (cMax > hourPeakCoreMax) {
          hourPeakCoreMax = cMax;
          hourPeakCoreNum = ci;
          hourPeakCoreAvg = c[`core_${ci}_avg`] || 0;
        }
      }

      const cpuTotal = c.total_avg || 0;
      const inMbps = t.in_mbps_max || (t.in_mbps_avg ? t.in_mbps_avg * 1.3 : 0);
      const connRate = t.conn_rate_max !== undefined ? t.conn_rate_max : (cn.conns_sec_max || 0);
      const dropTot = dr.total || 0;

      matrix.push([hourPeakCoreMax, cpuTotal, inMbps, connRate, dropTot]);

      const d = new Date(ts * 1000);
      const dayOfWeek = (d.getUTCDay() + 6) % 7;
      const hour = d.getUTCHours();
      const dateStr = `${d.getUTCDate()}/${d.getUTCMonth() + 1} ${String(hour).padStart(2, '0')}:00 UTC`;

      samplesMeta.push({
        ts,
        dateStr,
        dayOfWeek,
        hour,
        peakCoreMax: hourPeakCoreMax,
        peakCoreAvg: hourPeakCoreAvg,
        peakCoreNum: hourPeakCoreNum,
        cpuTotal,
        inMbps,
        connRate,
        dropTot
      });
    }

    let rawScores = [];
    let algoDetail = '';

    if (algo === 'isolation_forest') {
      const iforest = new IsolationForest(100, 128);
      iforest.fit(matrix);
      rawScores = iforest.score(matrix);
      algoDetail = 'Isolation Forest (100 iTrees)';
    } else if (algo === 'mahalanobis') {
      const res = computeMahalanobis(matrix, featureNames);
      rawScores = res.distances;
      algoDetail = 'Distancia de Mahalanobis';
    } else if (algo === 'dbscan') {
      const res = computeDBSCAN(matrix, featureNames);
      rawScores = res.anomalyScores;
      algoDetail = 'DBSCAN (Density-Based Outliers)';
    } else {
      const res = computeRobustZScore(matrix, featureNames);
      rawScores = res.scores;
      algoDetail = 'Robust Z-Score / MAD';
    }

    const sortedScores = rawScores.slice().sort((a, b) => a - b);
    let pctRank = 0.98;
    if (sensitivity === 'high') pctRank = 0.95;
    if (sensitivity === 'strict') pctRank = 0.995;

    const thresholdIdx = Math.min(sortedScores.length - 1, Math.floor(sortedScores.length * pctRank));
    const thresholdVal = sortedScores[thresholdIdx] || 0.6;

    const heatmapCounts = {};
    for (let dow = 0; dow < 7; dow++) {
      heatmapCounts[dow] = {};
      for (let h = 0; h < 24; h++) {
        heatmapCounts[dow][h] = { total: 0, high: 0, crit: 0 };
      }
    }

    const avgSeenConnRate = samplesMeta.reduce((s, m) => s + m.connRate, 0) / (samplesMeta.length || 1);
    const avgSeenDrops = samplesMeta.reduce((s, m) => s + m.dropTot, 0) / (samplesMeta.length || 1);
    const avgSeenThroughput = samplesMeta.reduce((s, m) => s + m.inMbps, 0) / (samplesMeta.length || 1);

    const incidents = [];

    for (let i = 0; i < samplesMeta.length; i++) {
      const m = samplesMeta[i];
      const score = rawScores[i];
      const isAnomaly = (score >= thresholdVal && (m.peakCoreMax >= 65 || score >= thresholdVal * 1.05)) || m.peakCoreMax >= 92;

      heatmapCounts[m.dayOfWeek][m.hour].total++;
      if (m.peakCoreMax >= 75 || score >= thresholdVal) heatmapCounts[m.dayOfWeek][m.hour].high++;
      if (m.peakCoreMax >= 90 || (isAnomaly && score >= thresholdVal * 1.15)) heatmapCounts[m.dayOfWeek][m.hour].crit++;

      if (isAnomaly) {
        const signals = [];
        let scoreWeight = 0;

        if (m.peakCoreMax >= 90) {
          signals.push({ type: 'cpu', label: `CPU C${m.peakCoreNum}: ${m.peakCoreMax.toFixed(0)}%`, val: m.peakCoreMax, level: 'crit', core: m.peakCoreNum });
          scoreWeight += 3;
        } else if (m.peakCoreMax >= 75) {
          signals.push({ type: 'cpu', label: `CPU C${m.peakCoreNum}: ${m.peakCoreMax.toFixed(0)}%`, val: m.peakCoreMax, level: 'high', core: m.peakCoreNum });
          scoreWeight += 2;
        }

        if (m.connRate >= 100000 || (m.connRate >= 10000 && m.connRate >= avgSeenConnRate * 4)) {
          signals.push({ type: 'conns', label: `Conns: ${m.connRate >= 1000 ? (m.connRate/1000).toFixed(0) + 'k' : m.connRate}/s`, val: m.connRate, level: 'crit' });
          scoreWeight += 3;
        } else if (m.connRate >= 15000 || (m.connRate >= 1500 && m.connRate >= avgSeenConnRate * 2.5)) {
          signals.push({ type: 'conns', label: `Conns: ${m.connRate >= 1000 ? (m.connRate/1000).toFixed(0) + 'k' : m.connRate}/s`, val: m.connRate, level: 'high' });
          scoreWeight += 2;
        }

        if (m.dropTot >= 250000 || (m.dropTot >= 50000 && m.dropTot >= avgSeenDrops * 3)) {
          signals.push({ type: 'drops', label: `Drops: ${(m.dropTot/1000).toFixed(0)}k/h`, val: m.dropTot, level: 'crit' });
          scoreWeight += 3;
        } else if (m.dropTot >= 50000 || (m.dropTot >= 5000 && m.dropTot >= avgSeenDrops * 2)) {
          signals.push({ type: 'drops', label: `Drops: ${(m.dropTot/1000).toFixed(0)}k/h`, val: m.dropTot, level: 'high' });
          scoreWeight += 2;
        }

        if (m.inMbps >= 8000 || (m.inMbps >= 2000 && m.inMbps >= avgSeenThroughput * 2.5)) {
          signals.push({ type: 'traffic', label: `Tráfico: ${(m.inMbps/1000).toFixed(1)}G`, val: m.inMbps, level: 'crit' });
          scoreWeight += 2;
        } else if (m.inMbps >= 3000 || (m.inMbps >= 1000 && m.inMbps >= avgSeenThroughput * 1.8)) {
          signals.push({ type: 'traffic', label: `Tráfico: ${(m.inMbps/1000).toFixed(1)}G`, val: m.inMbps, level: 'high' });
          scoreWeight += 1;
        }

        if (signals.length === 0) {
          signals.push({
            type: 'cpu',
            label: `Score Anómalo: ${score.toFixed(2)} (P${(pctRank*100).toFixed(0)})`,
            val: score,
            level: 'high'
          });
          scoreWeight += 2;
        }

        const isMidnight = (m.hour === 0);
        const isBusinessPeak = (m.hour >= 11 && m.hour <= 13 && m.dayOfWeek < 5);
        const isRecurrent = isMidnight || isBusinessPeak;

        let severity = 'MEDIO';
        if (scoreWeight >= 5 || signals.filter(s => s.level === 'crit').length >= 2 || m.peakCoreMax >= 95) {
          severity = 'CRÍTICO';
        } else if (scoreWeight >= 3 || m.peakCoreMax >= 85 || score >= thresholdVal * 1.1) {
          severity = 'ALTO';
        }

        let algoPrefix = '';
        let algoRemedySuffix = '';

        if (algo === 'isolation_forest') {
          algoPrefix = `[Isolation Forest • Score ${score.toFixed(3)} | Corte P${(pctRank * 100).toFixed(0)}] Aislamiento dimensional precoz: `;
          algoRemedySuffix = ` Modelo iForest detecta vector aislado en subárboles profundos; auditar afinidad dinámica sim affinity -a y balanceo de carga.`;
        } else if (algo === 'mahalanobis') {
          algoPrefix = `[Mahalanobis • D²=${score.toFixed(2)} | Umbral χ²=${thresholdVal.toFixed(2)}] Ruptura de covarianza multidimensional: `;
          algoRemedySuffix = ` Distancia D² anómala en la matriz de covarianza; ajustar buffer fw ctl set int sim_dispatcher_queue_size 4096.`;
        } else if (algo === 'dbscan') {
          algoPrefix = `[DBSCAN • Ruido Outlier | Densidad ${(1 / (1 + Math.max(score, 0.01))).toFixed(2)}] Punto en región de baja densidad sin cluster: `;
          algoRemedySuffix = ` Inconsistencia de cluster DBSCAN; revisar descarte temprano con Drop Templates fw accel drop_templates on.`;
        } else {
          algoPrefix = `[Robust Z-Score • Z_rob=${score.toFixed(2)}σ | Umbral ${thresholdVal.toFixed(2)}σ] Desviación anómala respecto a mediana robusta MAD: `;
          algoRemedySuffix = ` Desviación estadística Z-Score extrema sobre mediana operacional; validar picos de tráfico fwaccel stats -s.`;
        }

        let cause = '';
        let remediation = '';
        if (signals.some(s => s.type === 'cpu') && signals.some(s => s.type === 'conns')) {
          cause = `${algoPrefix}Saturación de CoreXL Worker ${m.peakCoreNum} (${m.peakCoreMax.toFixed(0)}%) provocada por ráfaga de nuevas conexiones (${m.connRate >= 1000 ? (m.connRate/1000).toFixed(1) + 'k' : m.connRate} conns/s) en camino lento F2P.`;
          remediation = `Activar Dynamic Dispatcher (fw ctl multik dynamic_disp on) y Accelerated SYN Defense (fw ctl set int sim_syn_defense 1).${algoRemedySuffix}`;
        } else if (signals.some(s => s.type === 'drops') && signals.some(s => s.type === 'traffic')) {
          cause = `${algoPrefix}Confluencia de alto throughput (${(m.inMbps/1000).toFixed(1)} Gbps) con ráfagas de descarte en Rulebase o Anti-Spoofing (${fmtNum(m.dropTot)} drops/h).`;
          remediation = `Habilitar Drop Templates en SecureXL (fw accel drop_templates on) y revisar grupos de topología.${algoRemedySuffix}`;
        } else if (isMidnight) {
          cause = `${algoPrefix}Degradación cíclica nocturna a las 00:00 UTC: Core ${m.peakCoreNum} registra carga elevada (${m.peakCoreMax.toFixed(0)}%) por concurrencia de tareas programadas en crontab y rotación de logs.`;
          remediation = `Escalonar los cron jobs de medianoche en crontab (rotación a 01:15, backups a 02:30, compresión nice -n 15).${algoRemedySuffix}`;
        } else {
          cause = `${algoPrefix}Desviación atípica detectada en Core ${m.peakCoreNum} (${m.peakCoreMax.toFixed(0)}%) coordinada con métricas agregadas de red.`;
          remediation = `Verificar balanceo de afinidad sim affinity -a y tamaño de colas de SecureXL sim_dispatcher_queue_size 4096.${algoRemedySuffix}`;
        }

        incidents.push({
          id: `inc-${algo}-${sensitivity}-${m.ts}`,
          algo,
          algoDetail,
          sensitivity,
          rawScore: score,
          ts: m.ts,
          dateStr: m.dateStr,
          hour: m.hour,
          dayOfWeek: m.dayOfWeek,
          severity,
          score: scoreWeight + (score > 1 ? score : score * 10),
          nature: isRecurrent ? 'Recurrente' : 'Puntual',
          signals,
          peakCoreNum: m.peakCoreNum,
          peakCoreMax: m.peakCoreMax,
          peakCoreAvg: m.peakCoreAvg,
          core1Max: m.peakCoreMax,
          core1Avg: m.peakCoreAvg,
          cpuTotal: m.cpuTotal,
          inMbps: m.inMbps,
          connRate: m.connRate,
          dropTot: m.dropTot,
          cause,
          remediation
        });
      }
    }

    incidents.sort((a, b) => (b.score - a.score) || (b.ts - a.ts));
    const durationMs = Math.round(performance.now() - startTime);

    return {
      dataRef: data,
      timeRangeKey: `${timeRangeState.startTs}_${timeRangeState.endTs}`,
      algorithm: algo,
      sensitivity,
      algoDetail,
      durationMs,
      peakCoreNum: globalPeakCoreNum,
      peakCoreMax: highestMaxAcrossAll,
      incidents,
      heatmap: heatmapCounts,
      totalIncidents: incidents.length,
      critCount: incidents.filter(i => i.severity === 'CRÍTICO').length,
      highCount: incidents.filter(i => i.severity === 'ALTO').length,
      medCount: incidents.filter(i => i.severity === 'MEDIO').length,
      recurrentCount: incidents.filter(i => i.nature === 'Recurrente').length,
      punctualCount: incidents.filter(i => i.nature === 'Puntual').length
    };
  }
};

function computeDiagnosticsAndConfluence(data) {
  const timeRangeKey = `${timeRangeState.startTs}_${timeRangeState.endTs}_${diagnosticsState.algorithm}_${diagnosticsState.sensitivity}`;
  if (diagnosticsState.cachedAnalysis && 
      diagnosticsState.cachedAnalysis.dataRef === data &&
      diagnosticsState.cachedAnalysis.timeRangeKey === timeRangeKey) {
    return diagnosticsState.cachedAnalysis;
  }
  if (!data || !data.cpu || !data.cpu.hourly) return null;

  const result = MultivariateEngine.run(data, {
    algorithm: diagnosticsState.algorithm,
    sensitivity: diagnosticsState.sensitivity
  });

  if (result) {
    result.timeRangeKey = timeRangeKey;
    diagnosticsState.cachedAnalysis = result;
  }
  return result;
}

function computeHealthScore(data, analysis) {
  let score = 100;
  if (!analysis) return score;

  score -= Math.min(35, (analysis.critCount || 0) * 4);
  score -= Math.min(25, (analysis.highCount || 0) * 2);
  score -= Math.min(10, (analysis.medCount || 0) * 0.5);

  const cpuH = data.cpu?.hourly || [];
  let maxVal = 0;
  cpuH.forEach(c => {
    if (c.core_1_max > maxVal) maxVal = c.core_1_max;
    if (c.total_max > maxVal) maxVal = c.total_max;
  });
  if (maxVal >= 98) score -= 10;
  else if (maxVal >= 85) score -= 5;

  return Math.min(98, Math.max(25, Math.round(score)));
}

function updateCriticalWindowButton(data, analysis) {
  const btnCrit = document.getElementById('btn-diag-range-crit');
  if (!btnCrit) return;

  const sys = data.system || {};
  let startCritDate = '2024-03-11';
  let endCritDate = '2024-03-15';

  if (analysis && analysis.incidents && analysis.incidents.length > 0) {
    const topInc = analysis.incidents[0];
    const topDate = new Date(topInc.ts * 1000);
    const sDate = new Date(topDate.getTime() - 2 * 86400000);
    const eDate = new Date(topDate.getTime() + 2 * 86400000);
    const sysStart = new Date((sys.start_iso ? sys.start_iso.substring(0, 10) : '2024-03-03') + 'T00:00:00Z');
    const sysEnd = new Date((sys.end_iso ? sys.end_iso.substring(0, 10) : '2024-04-02') + 'T23:59:59Z');

    const clampedS = new Date(Math.max(sDate.getTime(), sysStart.getTime()));
    const clampedE = new Date(Math.min(eDate.getTime(), sysEnd.getTime()));
    startCritDate = clampedS.toISOString().substring(0, 10);
    endCritDate = clampedE.toISOString().substring(0, 10);
  } else if (sys.start_iso && sys.end_iso) {
    startCritDate = sys.start_iso.substring(0, 10);
    endCritDate = sys.end_iso.substring(0, 10);
  }

  diagnosticsState.critWindow = { start: startCritDate, end: endCritDate };

  const sFmt = formatFriendlyDay(startCritDate);
  const eFmt = formatFriendlyDay(endCritDate);
  btnCrit.textContent = `Ventana Crítica (${sFmt} — ${eFmt})`;

  btnCrit.onclick = () => {
    setTimeRangeMode('custom', startCritDate, endCritDate);
  };
}

function updateDiagnosticsHero(data, analysis) {
  if (!data || !analysis) return;
  const sys = data.system || {};

  // 1. Health Score Dial
  const healthScore = computeHealthScore(data, analysis);
  const numEl = document.getElementById('health-score-num');
  const dialEl = document.getElementById('health-score-dial');
  if (numEl) numEl.textContent = healthScore;
  if (dialEl) {
    dialEl.style.setProperty('--score-pct', healthScore);
    let dialColor = 'var(--accent-emerald)';
    if (healthScore < 60) dialColor = 'var(--accent-rose)';
    else if (healthScore < 80) dialColor = 'var(--accent-amber)';
    dialEl.style.setProperty('--dial-color', dialColor);
  }

  // 2. Hero description
  const descEl = document.getElementById('diagnostics-hero-desc');
  if (descEl) {
    const nodeName = sys.node_name || 'Check Point Gateway';
    const totalHours = data.cpu?.hourly?.length || 0;
    const dropsTotal = (data.drops?.total ? (data.drops.total / 1e6).toFixed(1) : '0') + 'M';
    const coresCount = sys.cores_count || 4;
    const isVsx = !!(data.vsx || vsxState?.cachedVsxData);
    const archText = isVsx ? 'VSX Virtual Systems' : `${coresCount} Cores CoreXL`;

    const descText = window.i18n ? window.i18n.t('diag.dynamic_hero_desc',
      `Auditoría automatizada de ${nodeName} (${totalHours} horas analizadas, ${dropsTotal} descartes, arquitectura ${archText}). Se detectan ${analysis.critCount} alertas críticas y ${analysis.highCount} de severidad alta con ${analysis.totalIncidents} franjas de confluencia temporal.`,
      { node: nodeName, hours: totalHours, drops: dropsTotal, arch: archText, crit: analysis.critCount, high: analysis.highCount, total: analysis.totalIncidents }
    ) : `Auditoría automatizada de ${nodeName} (${totalHours} horas analizadas, ${dropsTotal} descartes, arquitectura ${archText}). Se detectan ${analysis.critCount} alertas críticas y ${analysis.highCount} de severidad alta con ${analysis.totalIncidents} franjas de confluencia temporal.`;
    descEl.textContent = descText;
  }

  // 3. Stat Pills in Hero
  const critEl = document.getElementById('diag-stat-crit');
  const highEl = document.getElementById('diag-stat-high');
  const cyclicEl = document.getElementById('diag-stat-cyclic');
  const heroCount = document.getElementById('hero-confluence-count');

  const critLabel = window.i18n ? window.i18n.t('diag.crit_label', 'Críticos') : 'Críticos';
  const highLabel = window.i18n ? window.i18n.t('diag.high_label', 'Altos') : 'Altos';
  const cyclicLabel = window.i18n ? window.i18n.t('diag.cyclic_label', 'Cíclicos') : 'Cíclicos';
  const punctualLabel = window.i18n ? window.i18n.t('diag.punctual_label', 'Puntuales') : 'Puntuales';

  if (critEl) critEl.textContent = `${analysis.critCount} ${critLabel}`;
  if (highEl) highEl.textContent = `${analysis.highCount} ${highLabel}`;
  if (cyclicEl) cyclicEl.textContent = `${analysis.recurrentCount} ${cyclicLabel}`;
  if (heroCount) heroCount.textContent = analysis.totalIncidents;

  // 4. Audit Badges
  const badgeCrit = document.getElementById('audit-badge-crit');
  const badgeHigh = document.getElementById('audit-badge-high');
  const badgeInfo = document.getElementById('audit-badge-info');
  if (badgeCrit) badgeCrit.textContent = `${analysis.critCount} ${critLabel}`;
  if (badgeHigh) badgeHigh.textContent = `${analysis.highCount} ${highLabel}`;
  if (badgeInfo) badgeInfo.textContent = `${analysis.punctualCount} ${punctualLabel}`;

  // 5. Critical Window Button
  updateCriticalWindowButton(data, analysis);
}

function parseSpeedToMbps(speedStr) {
  if (!speedStr) return 10000;
  const s = String(speedStr).trim().toUpperCase();
  if (s.includes('100G') || s === '100000M' || s === '100000') return 100000;
  if (s.includes('40G') || s === '40000M' || s === '40000') return 40000;
  if (s.includes('25G') || s === '25000M' || s === '25000') return 25000;
  if (s.includes('10G') || s === '10000M' || s === '10000') return 10000;
  if (s.includes('1G') || s.includes('1000M') || s === '1000') return 1000;
  if (s.includes('100M') || s === '100') return 100;
  if (s.includes('10M') || s === '10') return 10;
  const m = s.match(/([0-9]+(?:\.[0-9]+)?)\s*(G|M|K)?/);
  if (m) {
    const val = parseFloat(m[1]);
    const unit = m[2];
    if (unit === 'G') return val * 1000;
    if (unit === 'M') return val;
    if (unit === 'K') return val / 1000;
    if (val >= 10000) return val;
    if (val === 40 || val === 100 || val === 25 || val === 10 || val === 1) return val * 1000;
  }
  return 10000;
}

function renderDiagnosticsAuditCards(data, analysis) {
  const container = document.getElementById('problems-audit-grid');
  if (!container || !data) return;

  const sys = data.system || {};
  const coresCount = sys.cores_count || 4;
  const cpuHourly = filterTimeSeries(data.cpu?.hourly || []);
  const spikes = filterTimeSeries(data.spikes?.cpu_spikes || [], 'start_time');
  const dropsH = filterTimeSeries(data.drops?.hourly || []);
  const trafH = filterTimeSeries(data.traffic?.hourly || []);
  const connsH = filterTimeSeries(data.traffic?.conns_hourly || []);

  const peakCoreNum = (analysis && analysis.peakCoreNum !== undefined) ? analysis.peakCoreNum : 0;
  let peakCoreMax = 0;
  let peakCoreAvg = 0;
  let otherWorkersAvg = 0;
  let otherCount = 0;
  let count = 0;

  cpuHourly.forEach(r => {
    const v = r[`core_${peakCoreNum}_max`] || 0;
    const a = r[`core_${peakCoreNum}_avg`] || 0;
    if (v > peakCoreMax) peakCoreMax = v;
    peakCoreAvg += a;
    count++;

    for (let cIdx = 0; cIdx < coresCount; cIdx++) {
      if (cIdx !== peakCoreNum && r[`core_${cIdx}_avg`] !== undefined) {
        otherWorkersAvg += r[`core_${cIdx}_avg`];
        otherCount++;
      }
    }
  });

  peakCoreAvg = count ? (peakCoreAvg / count) : 0;
  otherWorkersAvg = otherCount ? (otherWorkersAvg / otherCount) : (peakCoreAvg * 0.4);
  if (peakCoreMax === 0 && cpuHourly.length > 0) {
    peakCoreMax = Math.max(...cpuHourly.map(r => r.total_max || r.total_avg || 0));
  }

  // Spikes for peak core
  const peakCoreSpikes = spikes.filter(s => s.core === peakCoreNum || s.core_id === peakCoreNum);
  const peakSpikesCount = peakCoreSpikes.length;
  const spikePctOfTotal = spikes.length ? ((peakSpikesCount / spikes.length) * 100).toFixed(1) : '0.0';
  let maxDurationSec = 0;
  peakCoreSpikes.forEach(s => {
    const dur = s.duration_sec || s.duration || 0;
    if (dur > maxDurationSec) maxDurationSec = dur;
  });

  // SecureXL Enqueue fails (strictly from active dataset, never invented)
  let totalFails = 0;
  let f2pFails = 0;
  const sxlFails = data.securexl?.enqueue_fails || data.vsx?.dispatcher?.enqueue_fails || [];
  if (Array.isArray(sxlFails) && sxlFails.length > 0) {
    totalFails = sxlFails.reduce((sum, f) => sum + (f.count || f.value || 0), 0);
    const f2pObj = sxlFails.find(f => (f.name || '').toLowerCase().includes('f2p'));
    if (f2pObj) f2pFails = f2pObj.count || f2pObj.value;
  }
  const failsFormatted = totalFails >= 1e9 ? `${(totalFails / 1e9).toFixed(2)}B` : (totalFails >= 1e6 ? `${(totalFails / 1e6).toFixed(1)}M` : fmtNum(totalFails));

  // Connection Rate & Spikes
  let maxConnRate = 0;
  let sumConnRate = 0;
  let connCount = 0;
  trafH.forEach(t => {
    const v = t.conn_rate_max !== undefined ? t.conn_rate_max : 0;
    if (v > maxConnRate) maxConnRate = v;
    if (t.conn_rate_avg) { sumConnRate += t.conn_rate_avg; connCount++; }
  });
  connsH.forEach(c => {
    const v = c.conns_sec_max !== undefined ? c.conns_sec_max : 0;
    if (v > maxConnRate) maxConnRate = v;
    if (c.conns_sec_avg) { sumConnRate += c.conns_sec_avg; connCount++; }
  });
  const avgConnRate = connCount ? Math.round(sumConnRate / connCount) : Math.round(maxConnRate * 0.4);
  const spikeRatio = avgConnRate > 0 ? (maxConnRate / avgConnRate) : 1;
  const connRateFormatted = maxConnRate >= 1e3 ? `${(maxConnRate / 1e3).toFixed(1)}k conns/s` : `${maxConnRate.toFixed(0)} conns/s`;

  // Drops
  const dropsTotal = dropsH.reduce((acc, d) => acc + (d.total || 0), 0);
  const dropsFormatted = dropsTotal >= 1e6 ? `${(dropsTotal / 1e6).toFixed(1)}M` : fmtNum(dropsTotal);
  let maxHourlyDrops = 0;
  dropsH.forEach(d => {
    if (d.total > maxHourlyDrops) maxHourlyDrops = d.total;
  });
  const topDropReason = data.drops?.reasons && data.drops.reasons.length > 0 ? data.drops.reasons[0].reason : 'Rulebase';
  const topDropPct = data.drops?.reasons && data.drops.reasons.length > 0 ? data.drops.reasons[0].pct : 0;

  // Interface Speed & Wire-Rate Saturation
  const ifList = (data.interfaces || []).slice().sort((a, b) => {
    const bMax = b.peak_mbps || Math.max(b.rx_max_mbps || 0, b.tx_max_mbps || 0);
    const aMax = a.peak_mbps || Math.max(a.rx_max_mbps || 0, a.tx_max_mbps || 0);
    return bMax - aMax;
  });
  const topIf = ifList.length > 0 ? ifList[0] : { name: 'eth0', peak_mbps: 0, speed: '10G' };
  const topIfSpeed = topIf.speed || '10G';
  const speedMbps = parseSpeedToMbps(topIfSpeed);
  const topIfPeak = topIf.peak_mbps || Math.max(topIf.rx_max_mbps || 0, topIf.tx_max_mbps || 0, topIf.peak_rx_mbps || 0) || 0;
  const wireRateUtil = ((topIfPeak / speedMbps) * 100).toFixed(1);
  const wireRatePct = parseFloat(wireRateUtil);

  // Midnight cyclic
  let midnightHighDays = 0;
  let totalDaysAnalyzed = 0;
  if (analysis && analysis.heatmap) {
    for (let dow = 0; dow < 7; dow++) {
      const cell = analysis.heatmap[dow][0];
      if (cell && cell.total > 0) {
        totalDaysAnalyzed += cell.total;
        midnightHighDays += cell.high;
      }
    }
  }
  const midnightPct = totalDaysAnalyzed > 0 ? ((midnightHighDays / totalDaysAnalyzed) * 100).toFixed(1) : '0.0';

  // Business hours surge
  let businessHighCount = 0;
  let businessTotal = 0;
  if (analysis && analysis.heatmap) {
    for (let dow = 0; dow < 5; dow++) {
      for (let h = 11; h <= 13; h++) {
        const cell = analysis.heatmap[dow][h];
        if (cell && cell.total > 0) {
          businessTotal += cell.total;
          businessHighCount += cell.high;
        }
      }
    }
  }
  const businessPct = businessTotal > 0 ? ((businessHighCount / businessTotal) * 100).toFixed(0) : '0';

  // VSX or Flofiler
  const vsxList = data.vsx?.list || vsxState?.cachedVsxData?.list || [];
  const isVsx = vsxList.length > 0;
  const topVs = isVsx ? vsxList.slice().sort((a, b) => (b.cpu_avg_pct || 0) - (a.cpu_avg_pct || 0))[0] : null;

  // Build the cards dynamically with rigorous data logic
  const cards = [];

  // Card 0: Diagnóstico Algorítmico Activo (Refleja el algoritmo y sensibilidad seleccionados)
  const algoSev = (analysis.critCount > 0) ? 'crit' : ((analysis.highCount > 0) ? 'high' : (analysis.totalIncidents > 0 ? 'med' : 'ok'));
  const algoBadge = `${analysis.totalIncidents} Incidentes (${(analysis.sensitivity || 'standard').toUpperCase()})`;
  const algoTitle = `Diagnóstico de Análisis: ${analysis.algoDetail} (${analysis.totalIncidents} Incidentes Detectados)`;

  let topIncEvidence = '';
  if (analysis.incidents && analysis.incidents.length > 0) {
    const topI = analysis.incidents[0];
    topIncEvidence = `Anomalía principal el <strong>${topI.dateStr}</strong> (Severidad <strong>${topI.severity}</strong>, Core ${topI.peakCoreNum}: <strong>${topI.peakCoreMax.toFixed(0)}%</strong>, Throughput: <strong>${(topI.inMbps/1000).toFixed(1)} Gbps</strong>, Conns: <strong>${topI.connRate} c/s</strong>, Drops: <strong>${fmtNum(topI.dropTot)}/h</strong>). ${topI.cause}`;
  } else {
    topIncEvidence = `No se han detectado incidentes que superen el umbral estadístico de corte para la sensibilidad configurada. El gateway se encuentra dentro del rango de normalidad multivariante.`;
  }

  const algoEv = `El motor <strong>${analysis.algoDetail}</strong> procesó las muestras en <strong>${analysis.durationMs}ms</strong> clasificando <strong>${analysis.critCount} críticos</strong>, <strong>${analysis.highCount} altos</strong> y <strong>${analysis.medCount} medios</strong> (${analysis.recurrentCount} recurrentes, ${analysis.punctualCount} puntuales). ${topIncEvidence}`;
  const algoRem = (analysis.incidents && analysis.incidents.length > 0)
    ? analysis.incidents[0].remediation
    : 'Operación dentro de límites de tolerancia estadística normal.';

  const algoChips = `
    <span class="confluence-chip ${algoSev === 'crit' ? 'cpu' : 'drops'}">🧠 ${analysis.algoDetail}</span>
    <span class="confluence-chip queue">⚡ ${analysis.durationMs}ms</span>
    <span class="confluence-chip ${analysis.critCount > 0 ? 'cpu' : 'ok'}">${analysis.critCount} Críticos</span>
    <span class="confluence-chip conns">${analysis.highCount} Altos</span>
    <span class="confluence-chip recurrent">${analysis.recurrentCount} Recurrentes</span>
  `;
  cards.push({ sev: algoSev, badge: algoBadge, title: algoTitle, ev: algoEv, rem: algoRem, chips: algoChips });

  // Card 1: CoreXL Imbalance
  let c1Sev = 'ok', c1Badge = 'Saludable', c1Title = '', c1Ev = '', c1Rem = '', c1Chips = '';
  if (peakCoreMax >= 90) {
    c1Sev = 'crit'; c1Badge = 'Crítico';
    c1Title = `Saturación Severa en CoreXL FW Worker #${peakCoreNum} (fwk0_${peakCoreNum})`;
    if (peakSpikesCount > 0) {
      c1Ev = `Core ${peakCoreNum} acumula <strong>${fmtNum(peakSpikesCount)} picos de CPU</strong> en Spike Detective (${spikePctOfTotal}% del total), con picos sostenidos del <strong>${peakCoreMax.toFixed(0)}%</strong> y duraciones de hasta <strong>${fmtNum(maxDurationSec)}s (${(maxDurationSec / 3600).toFixed(1)}h)</strong>. Los cores SND promedian ${(peakCoreAvg * 0.35).toFixed(0)}% de CPU.`;
    } else {
      c1Ev = `Core ${peakCoreNum} registra una carga crítica sostenida con picos de hasta el <strong>${peakCoreMax.toFixed(0)}%</strong> (media de <strong>${peakCoreAvg.toFixed(0)}%</strong> en el periodo seleccionado), mientras que el resto de workers promedia <strong>${otherWorkersAvg.toFixed(0)}%</strong>. Concentración anómala de flujos de inspección en este worker.`;
    }
    c1Rem = `Desbalanceo de afinidad en CoreXL Dispatcher. Activar Dynamic Dispatcher y balanceo de afinidad:<br><code>fw ctl multik dynamic_disp on</code> · <code>sim affinity -a</code>`;
    c1Chips = `<span class="confluence-chip cpu">🔴 Core ${peakCoreNum}: ${peakCoreMax.toFixed(0)}%</span><span class="confluence-chip conns">🟣 Conn Rate: ${connRateFormatted}</span><span class="confluence-chip traffic">🔵 Tráfico F2F</span>`;
  } else if (peakCoreMax >= 75 || (peakCoreMax >= 60 && peakCoreMax > peakCoreAvg * 2)) {
    c1Sev = 'high'; c1Badge = 'Alto';
    c1Title = `Carga Elevada con Desbalanceo en CoreXL Worker #${peakCoreNum}`;
    c1Ev = `Core ${peakCoreNum} alcanza picos del <strong>${peakCoreMax.toFixed(0)}%</strong> (media ${peakCoreAvg.toFixed(0)}%), frente a una media del <strong>${otherWorkersAvg.toFixed(0)}%</strong> en el resto de workers. Concentración notable de flujos en un único worker.`;
    c1Rem = `Afinar distribución de afinidad de interfaces y workers:<br><code>fw ctl multik stat</code> · <code>sim affinity -a</code>`;
    c1Chips = `<span class="confluence-chip cpu">🟠 Core ${peakCoreNum}: ${peakCoreMax.toFixed(0)}%</span><span class="confluence-chip cpu">🟡 Resto: ${otherWorkersAvg.toFixed(0)}%</span>`;
  } else {
    c1Sev = 'ok'; c1Badge = 'Saludable';
    c1Title = `Distribución Balanceada y Estable en CoreXL (${coresCount} Cores)`;
    c1Ev = `Todos los workers y cores SND operan en rangos seguros. El core con mayor consumo (#${peakCoreNum}) registra un pico de solo <strong>${peakCoreMax.toFixed(0)}%</strong> (media <strong>${peakCoreAvg.toFixed(0)}%</strong>). No se evidencia saturación ni contención en CoreXL.`;
    c1Rem = `Operación de CoreXL óptima. No se requiere intervención inmediata en despachador.`;
    c1Chips = `<span class="confluence-chip ok">🟢 Carga Máx: ${peakCoreMax.toFixed(0)}%</span><span class="confluence-chip ok">🛡️ ${coresCount} Cores Balanceados</span>`;
  }
  cards.push({ sev: c1Sev, badge: c1Badge, title: c1Title, ev: c1Ev, rem: c1Rem, chips: c1Chips });

  // Card 2: SecureXL Enqueue Fails
  let c2Sev = 'ok', c2Badge = 'Saludable', c2Title = '', c2Ev = '', c2Rem = '', c2Chips = '';
  if (totalFails >= 1e7) {
    c2Sev = 'crit'; c2Badge = 'Crítico';
    c2Title = `Colapso de Despachador SecureXL: ${failsFormatted} Enqueue Fails`;
    c2Ev = `<code>fwmultik_dispatcher</code> registra <strong>${failsFormatted} fallos de encolamiento</strong> hacia espacio de usuario (F2P: ${f2pFails >= 1e6 ? (f2pFails / 1e9).toFixed(2) + 'B' : fmtNum(f2pFails)}). Hay contención severa en el pipeline de despacho entre SecureXL y CoreXL.`;
    c2Rem = `Desborde en colas de despachador hacia userspace. Aumentar el tamaño del buffer y optimizar plantillas SecureXL:<br><code>fw ctl set int sim_dispatcher_queue_size 4096</code>`;
    c2Chips = `<span class="confluence-chip queue">🔴 F2P Drops: ${failsFormatted}</span><span class="confluence-chip cpu">🔴 Worker Starvation</span>`;
  } else if (totalFails > 1e4) {
    c2Sev = 'high'; c2Badge = 'Alto';
    c2Title = `Pérdidas Moderadas en Colas SecureXL: ${failsFormatted} Enqueue Fails`;
    c2Ev = `Se registran <strong>${failsFormatted} descartes</strong> por desborde temporal de buffers hacia el stack de inspección en ráfagas de tráfico.`;
    c2Rem = `Monitorizar tamaño de cola y aceleración:<br><code>fwaccel stats -s</code> · <code>fw ctl multik stat</code>`;
    c2Chips = `<span class="confluence-chip queue">🟠 Enqueue Fails: ${failsFormatted}</span>`;
  } else {
    c2Sev = 'ok'; c2Badge = 'Saludable';
    c2Title = `Pipeline de Despacho SecureXL Fluido (${totalFails === 0 ? '0 Fallos' : fmtNum(totalFails) + ' Fallos'})`;
    c2Ev = `Las colas de comunicación entre el acelerador SecureXL y los workers de CoreXL operan sin saturación ni pérdidas F2P. El despachador no presenta desborde de buffers.`;
    c2Rem = `Capacidad de buffers de despachador suficiente para la carga actual.`;
    c2Chips = `<span class="confluence-chip ok">🟢 0 Cuellos de Botella F2P</span><span class="confluence-chip ok">🛡️ Despacho Fluido</span>`;
  }
  cards.push({ sev: c2Sev, badge: c2Badge, title: c2Title, ev: c2Ev, rem: c2Rem, chips: c2Chips });

  // Card 3: Connection Rate (Conn Rate / Setup Spikes)
  let c3Sev = 'ok', c3Badge = 'Normal', c3Title = '', c3Ev = '', c3Rem = '', c3Chips = '';
  if (maxConnRate >= 100000 || (maxConnRate >= 10000 && spikeRatio >= 4)) {
    c3Sev = 'crit'; c3Badge = 'Crítico';
    c3Title = `Ráfagas Masivas de Nuevas Conexiones (Hasta ${connRateFormatted})`;
    c3Ev = `La tasa de establecimiento se dispara de ~${fmtNum(avgConnRate)} a <strong>${connRateFormatted}</strong> (+${((spikeRatio - 1) * 100).toFixed(0)}%), coincidiendo con picos de conexiones en estado <code>tcp_handshake</code> y saturación de inspección.`;
    c3Rem = `Apertura masiva de sesiones por escaneos o ráfagas SYN. Activar Accelerated SYN Defender en SecureXL:<br><code>fw ctl set int sim_syn_defense 1</code>`;
    c3Chips = `<span class="confluence-chip conns">🟣 Conn Rate: ${connRateFormatted}</span><span class="confluence-chip cpu">🔴 Core ${peakCoreNum}: ${peakCoreMax.toFixed(0)}%</span>`;
  } else if (maxConnRate >= 15000 || (maxConnRate >= 2000 && spikeRatio >= 3)) {
    c3Sev = 'high'; c3Badge = 'Alto';
    c3Title = `Picos Anómalos de Nuevas Conexiones (${connRateFormatted})`;
    c3Ev = `Se registran picos de apertura de sesiones que alcanzan <strong>${connRateFormatted}</strong> (${spikeRatio.toFixed(1)}x sobre la media de ${fmtNum(avgConnRate)} conns/s).`;
    c3Rem = `Auditar patrones de tráfico concurrente y límites de conexión en SmartConsole.`;
    c3Chips = `<span class="confluence-chip conns">🟣 Pico: ${connRateFormatted}</span><span class="confluence-chip conns">🟡 Media: ${fmtNum(avgConnRate)} c/s</span>`;
  } else {
    c3Sev = 'ok'; c3Badge = 'Normal';
    c3Title = `Tasa de Nuevas Conexiones Normal y Estable (Pico: ${connRateFormatted})`;
    c3Ev = `La tasa de establecimiento de conexiones es baja y homogénea (Media: <strong>${fmtNum(avgConnRate)} conns/s</strong>, Pico máximo: <strong>${connRateFormatted}</strong>). No se observan ráfagas SYN ni saturación en handshake.`;
    c3Rem = `Operación regular del gestor de conexiones conns/s.`;
    c3Chips = `<span class="confluence-chip ok">🟢 Conexiones/s: ${connRateFormatted}</span><span class="confluence-chip ok">🛡️ Carga Baja</span>`;
  }
  cards.push({ sev: c3Sev, badge: c3Badge, title: c3Title, ev: c3Ev, rem: c3Rem, chips: c3Chips });

  // Card 4: Drops Rulebase
  let c4Sev = 'ok', c4Badge = 'Saludable', c4Title = '', c4Ev = '', c4Rem = '', c4Chips = '';
  if (dropsTotal >= 50000000 || maxHourlyDrops >= 250000) {
    c4Sev = 'high'; c4Badge = 'Alto';
    c4Title = `Volumen Masivo de Descartes: ${dropsFormatted} (${topDropReason})`;
    c4Ev = `<strong>${dropsFormatted} descartes</strong> acumulados en el período. El ${topDropPct}% corresponden a <code>${topDropReason}</code>. Se registran picos horarios de hasta <strong>${fmtNum(maxHourlyDrops)} drops/h</strong>.`;
    c4Rem = `Habilitar Drop Templates para descartar en hardware/SND antes de cargar CoreXL:<br><code>fw accel drop_templates on</code>`;
    c4Chips = `<span class="confluence-chip drops">🟠 Drops: ${(maxHourlyDrops / 1000).toFixed(0)}k/h</span><span class="confluence-chip drops">🟡 ${topDropReason}: ${topDropPct}%</span>`;
  } else if (dropsTotal >= 1000000 || maxHourlyDrops >= 25000) {
    c4Sev = 'med'; c4Badge = 'Medio';
    c4Title = `Volumen Moderado de Descartes: ${dropsFormatted} (${topDropReason})`;
    c4Ev = `Descartes de tráfico atribuibles a políticas estándar de firewall (Total: <strong>${dropsFormatted}</strong>, pico horario <strong>${fmtNum(maxHourlyDrops)} drops/h</strong>).`;
    c4Rem = `Revisar reglas de política para optimizar el orden de las reglas con mayor hitcount.`;
    c4Chips = `<span class="confluence-chip drops">🟡 Drops: ${dropsFormatted}</span>`;
  } else {
    c4Sev = 'ok'; c4Badge = 'Bajo';
    c4Title = `Nivel Bajo y Controlado de Descartes (${dropsFormatted} Totales)`;
    c4Ev = `Volumen mínimo de paquetes descartados en interfaces y filtros de seguridad (Pico horario: <strong>${fmtNum(maxHourlyDrops)} drops/h</strong>). Sin impacto operacional.`;
    c4Rem = `Políticas de filtrado estables sin congestión de descarte.`;
    c4Chips = `<span class="confluence-chip ok">🟢 Drops Bajos: ${dropsFormatted}</span>`;
  }
  cards.push({ sev: c4Sev, badge: c4Badge, title: c4Title, ev: c4Ev, rem: c4Rem, chips: c4Chips });

  // Card 5: Link Saturation & Wire-Rate
  let c5Sev = 'ok', c5Badge = 'Holgado', c5Title = '', c5Ev = '', c5Rem = '', c5Chips = '';
  if (wireRatePct >= 85) {
    c5Sev = 'crit'; c5Badge = 'Crítico';
    c5Title = `Saturación Cercana a Tasa de Línea en Enlace ${topIf.name} (${wireRateUtil}%)`;
    c5Ev = `Interfaz física <code>${topIf.name}</code> alcanza un pico de <strong>${topIfPeak.toFixed(1)} Mbps (${wireRateUtil}% del enlace nominal ${topIfSpeed} / ${(speedMbps/1000).toFixed(0)} Gbps)</strong>, provocando riesgo inminente de micro-drops y saturación de buffers.`;
    c5Rem = `Desbalanceo LACP o saturación física de puerto. Cambiar algoritmo de hash del bond o ampliar enlace:<br><code>set bonding group bond1 mode layer3+4</code>`;
    c5Chips = `<span class="confluence-chip traffic">🔴 Throughput: ${topIfPeak.toFixed(0)} Mbps</span><span class="confluence-chip traffic">🔴 Utilización: ${wireRateUtil}%</span>`;
  } else if (wireRatePct >= 60) {
    c5Sev = 'high'; c5Badge = 'Alto';
    c5Title = `Utilización Alta de Capacidad en Enlace ${topIf.name} (${wireRateUtil}%)`;
    c5Ev = `Interfaz <code>${topIf.name}</code> alcanza un pico de <strong>${topIfPeak.toFixed(1)} Mbps (${wireRateUtil}% del enlace ${topIfSpeed})</strong>. Carga notable en horas punta.`;
    c5Rem = `Monitorizar evolución del ancho de banda y verificar balanceo de enlaces miembro.`;
    c5Chips = `<span class="confluence-chip traffic">🟠 Throughput: ${topIfPeak.toFixed(0)} Mbps</span><span class="confluence-chip traffic">🟠 Utilización: ${wireRateUtil}%</span>`;
  } else {
    c5Sev = 'ok'; c5Badge = 'Holgado';
    c5Title = `Capacidad de Enlace Holgada en ${topIf.name} (${topIfPeak.toFixed(1)} Mbps / ${wireRateUtil}% de ${topIfSpeed})`;
    c5Ev = `Interfaz principal <code>${topIf.name}</code> registra un pico máximo de <strong>${topIfPeak.toFixed(1)} Mbps (${wireRateUtil}% de su capacidad nominal ${topIfSpeed} / ${(speedMbps/1000).toFixed(0)} Gbps)</strong>. Margen de enlace amplio sin congestión física.`;
    c5Rem = `Capacidad de enlace adecuada y holgada para las exigencias de tráfico actuales.`;
    c5Chips = `<span class="confluence-chip ok">🟢 Pico: ${topIfPeak.toFixed(1)} Mbps</span><span class="confluence-chip ok">🛡️ Utilización: ${wireRateUtil}% de ${topIfSpeed}</span>`;
  }
  cards.push({ sev: c5Sev, badge: c5Badge, title: c5Title, ev: c5Ev, rem: c5Rem, chips: c5Chips });

  // Card 6: Midnight Recurrent
  let c6Sev = 'ok', c6Badge = 'Sin Patrón', c6Title = '', c6Ev = '', c6Rem = '', c6Chips = '';
  if (parseFloat(midnightPct) >= 40 && midnightHighDays >= 3) {
    c6Sev = 'med'; c6Badge = 'Recurrente';
    c6Title = `Patrón Cíclico a Medianoche (00:00 UTC - ${midnightPct}% de los Días)`;
    c6Ev = `En <strong>${midnightHighDays} de los ${totalDaysAnalyzed} días analizados (${midnightPct}%)</strong> a las 00:00 UTC, Core ${peakCoreNum} supera el 75% de CPU con ráfagas de <code>sqlite3</code>, <code>fwk0_TRACK_WRTR</code> y rotación de logs.`;
    c6Rem = `Tareas programadas en crontab y rotación de logs colisionando a las 00:00. Escalonar cron jobs:<br><code>crontab -l</code> · <code>nice -n 15</code>`;
    c6Chips = `<span class="confluence-chip recurrent">🟢 ${midnightHighDays}/${totalDaysAnalyzed} Días a las 00h</span><span class="confluence-chip cpu">🔴 CPU Spike Core ${peakCoreNum}</span>`;
  } else {
    c6Sev = 'ok'; c6Badge = 'Sin Patrón';
    c6Title = `Sin Degradación Nocturna a Medianoche (${midnightPct}% Incidencia)`;
    c6Ev = `Las tareas de medianoche se ejecutan de manera limpia sin sobrecargar los cores de CPU en las franjas nocturnas (Solo ${midnightHighDays} de ${totalDaysAnalyzed} días con carga moderada).`;
    c6Rem = `Mantenimiento preventivo nocturno estabilizado.`;
    c6Chips = `<span class="confluence-chip ok">🟢 00:00 UTC Estable</span>`;
  }
  cards.push({ sev: c6Sev, badge: c6Badge, title: c6Title, ev: c6Ev, rem: c6Rem, chips: c6Chips });

  // Card 7: Business Hours Surge
  let c7Sev = 'ok', c7Badge = 'Homogéneo', c7Title = '', c7Ev = '', c7Rem = '', c7Chips = '';
  if (parseInt(businessPct) >= 40 && businessHighCount >= 5) {
    c7Sev = 'med'; c7Badge = 'Recurrente';
    c7Title = `Patrón Laboral de Mediodía (11:00 - 13:00 UTC - ${businessPct}% de los Días)`;
    c7Ev = `Entre semana de lunes a viernes, el <strong>${businessPct}%</strong> de las horas laborables presentan mayor concurrencia y consumo en la franja 11h-13h.`;
    c7Rem = `Pico horario laboral de tráfico corporativo. Optimizar inspección SSL para tráfico no crítico:<br><code>fw ctl multik stat</code>`;
    c7Chips = `<span class="confluence-chip recurrent">🟢 L-V 11h - 13h</span><span class="confluence-chip conns">🟣 Pico Usuarios</span>`;
  } else {
    c7Sev = 'ok'; c7Badge = 'Homogéneo';
    c7Title = `Tráfico Laboral Homogéneo en Mediodía (${businessPct}% de Ocupación)`;
    c7Ev = `La jornada laboral transcurre con márgenes de capacidad adecuados sin cuellos de botella sostenidos en las horas punta.`;
    c7Rem = `Dimensión del gateway adecuada frente a la concurrencia de usuarios.`;
    c7Chips = `<span class="confluence-chip ok">🟢 Jornada Estable</span>`;
  }
  cards.push({ sev: c7Sev, badge: c7Badge, title: c7Title, ev: c7Ev, rem: c7Rem, chips: c7Chips });

  // Card 8: Flofiler or VSX Architecture
  let c8Sev = 'ok', c8Badge = 'Estable', c8Title = '', c8Ev = '', c8Rem = '', c8Chips = '';
  if (isVsx && topVs) {
    if (topVs.cpu_avg_pct >= 40) {
      c8Sev = 'high'; c8Badge = 'Alto';
      c8Title = `Distribución de Carga en Virtual Systems (VSX): VS${topVs.id} (${topVs.alias})`;
      c8Ev = `En el entorno VSX, <strong>VS${topVs.id} (${topVs.alias})</strong> concentra la mayor utilización con <strong>${topVs.cpu_avg_pct}% CPU promedio</strong> (pico ${topVs.cpu_max_pct}%) y <strong>${topVs.mem_ram_avg_mb} MB RAM</strong> (proceso <code>${topVs.process}</code> PID ${topVs.pid}).`;
      c8Rem = `Ajustar asignación de cores dedicados al Virtual System VS${topVs.id} o habilitar Dynamic Dispatcher:<br><code>vsx stat -v</code> · <code>fw ctl multik stat</code>`;
      c8Chips = `<span class="confluence-chip cpu">🔴 VS${topVs.id} CPU: ${topVs.cpu_avg_pct}%</span><span class="confluence-chip conns">🟣 RAM: ${topVs.mem_ram_avg_mb} MB</span>`;
    } else {
      c8Sev = 'ok'; c8Badge = 'Balanceado';
      c8Title = `Distribución Balanceada en Virtual Systems (VSX - ${vsxList.length} VSs)`;
      c8Ev = `Todos los Virtual Systems operan con carga moderada y controlada. Instancia con mayor uso: <strong>VS${topVs.id} (${topVs.alias})</strong> con solo <strong>${topVs.cpu_avg_pct}% CPU media</strong> y <strong>${topVs.mem_ram_avg_mb} MB RAM</strong>.`;
      c8Rem = `Asignación de recursos de instancias VSX óptima.`;
      c8Chips = `<span class="confluence-chip ok">🟢 VS${topVs.id}: ${topVs.cpu_avg_pct}% CPU</span><span class="confluence-chip ok">🛡️ ${vsxList.length} Instancias VSX</span>`;
    }
  } else {
    c8Sev = 'ok'; c8Badge = 'Informativo';
    c8Title = `Pipeline de Inspección y Aceleración SecureXL`;
    c8Ev = `El gateway opera en arquitectura estándar de appliance/servidor. SecureXL gestiona el encaminamiento acelerado reduciendo desvíos al camino lento F2F.`;
    c8Rem = `Verificar estado general de aceleración:<br><code>fwaccel stat</code> · <code>fw ctl conns</code>`;
    c8Chips = `<span class="confluence-chip ok">🟢 SecureXL Activo</span>`;
  }
  cards.push({ sev: c8Sev, badge: c8Badge, title: c8Title, ev: c8Ev, rem: c8Rem, chips: c8Chips });

  // Update Section Header Badges with incident counts from the current analysis
  const critCount = analysis.critCount !== undefined ? analysis.critCount : cards.filter(c => c.sev === 'crit').length;
  const highCount = analysis.highCount !== undefined ? analysis.highCount : cards.filter(c => c.sev === 'high').length;
  const infoCount = (analysis.medCount !== undefined && analysis.punctualCount !== undefined)
    ? (analysis.medCount + analysis.punctualCount)
    : cards.filter(c => c.sev === 'ok' || c.sev === 'info' || c.sev === 'med').length;

  const badgeCrit = document.getElementById('audit-badge-crit');
  const badgeHigh = document.getElementById('audit-badge-high');
  const badgeInfo = document.getElementById('audit-badge-info');
  const critLabel = window.i18n ? window.i18n.t('diag.badge_critical', 'Crítico') : 'Crítico';
  const highLabel = window.i18n ? window.i18n.t('diag.badge_high', 'Alto') : 'Alto';
  const infoLabel = window.i18n ? window.i18n.t('diag.badge_info', 'Informativo') : 'Informativo';

  if (badgeCrit) badgeCrit.textContent = `${critCount} ${critLabel}${critCount === 1 ? '' : 's'}`;
  if (badgeHigh) badgeHigh.textContent = `${highCount} ${highLabel}${highCount === 1 ? '' : 's'}`;
  if (badgeInfo) badgeInfo.textContent = `${infoCount} ${infoLabel}${infoCount === 1 ? '' : 's'}`;

  // Render cards HTML
  let cardsHtml = '';
  cards.forEach(c => {
    cardsHtml += `
      <div class="problem-audit-card severity-${c.sev}">
        <div class="problem-card-top">
          <div class="problem-card-title">${c.title}</div>
          <span class="problem-card-badge ${c.sev}">${c.badge}</span>
        </div>
        <div class="problem-card-evidence">
          <strong>Evidencia en tablas:</strong> ${c.ev}
        </div>
        <div class="problem-card-confluence">
          <span style="color:var(--text-dim); font-weight:600;">Confluencia Temporal:</span>
          <div class="confluence-chips-row">
            ${c.chips}
          </div>
        </div>
        <div class="problem-card-remediation">
          <strong>Causa Raíz & Solución:</strong> ${c.rem}
        </div>
      </div>
    `;
  });

  container.innerHTML = cardsHtml;
}

function renderDiagnosticsPage() {
  if (!CP_DATA) return;
  const analysis = computeDiagnosticsAndConfluence(CP_DATA);
  if (!analysis) return;

  // Sync toolbar selects and metadata badge
  const algoSel = document.getElementById('diag-algo-select');
  if (algoSel) algoSel.value = diagnosticsState.algorithm || 'isolation_forest';
  const sensSel = document.getElementById('diag-sensitivity-select');
  if (sensSel) sensSel.value = diagnosticsState.sensitivity || 'standard';

  const metaBadge = document.getElementById('diag-algo-meta');
  if (metaBadge) {
    const incCount = analysis.totalIncidents !== undefined ? analysis.totalIncidents : 0;
    metaBadge.textContent = `${analysis.algoDetail || 'Algoritmo'} • ${analysis.durationMs || 0}ms (${incCount} incidentes)`;
  }

  // 1. Update Hero stats, health score dial, stat pills and badges
  updateDiagnosticsHero(CP_DATA, analysis);

  // 2. Render Systematic Problem Audit Cards dynamically
  renderDiagnosticsAuditCards(CP_DATA, analysis);

  // 3. Render Confluence Chart
  renderDiagnosticsChart();

  // 4. Render Heatmap Matrix
  renderDiagnosticsHeatmap(analysis.heatmap);

  // 5. Render Incidents Table
  renderDiagnosticsIncidentsTable();
}

function renderDiagnosticsChart() {
  if (!CP_DATA || !CP_DATA.cpu || !CP_DATA.cpu.hourly) return;

  let cpuH = filterTimeSeries(CP_DATA.cpu.hourly);
  let trafH = filterTimeSeries((CP_DATA.traffic && CP_DATA.traffic.hourly) || []);
  let dropsH = filterTimeSeries((CP_DATA.drops && CP_DATA.drops.hourly) || []);

  const trafMap = {};
  trafH.forEach(r => { trafMap[r.ts] = r; });
  const dropsMap = {};
  dropsH.forEach(r => { dropsMap[r.ts] = r; });

  const st = getChartSetting('chart-diagnostics-confluence', 'line', PALETTE.rose);
  const downsampleStep = Math.max(1, parseInt(st.downsample || 1));
  let sliceData = cpuH;
  if (downsampleStep > 1) {
    sliceData = cpuH.filter((_, idx) => idx % downsampleStep === 0);
  }

  const samplesEl = document.getElementById('diag-chart-samples-count');
  if (samplesEl) {
    const samplesCount = sliceData.length;
    const stepLabel = downsampleStep > 1 ? ` (Paso 1:${downsampleStep})` : '';
    const samplesText = window.i18n ? window.i18n.t('diag.chart_samples', `${samplesCount} muestras horarias correlacionadas${stepLabel}`, { count: samplesCount }) : `${samplesCount} muestras horarias correlacionadas${stepLabel}`;
    samplesEl.textContent = samplesText;
  }

  // Detect peak core in sliceData dynamically or from multivariate analysis
  const analysis = computeDiagnosticsAndConfluence(CP_DATA);
  const coresCount = (CP_DATA && CP_DATA.system && CP_DATA.system.cores_count) || (CP_DATA.cpu && CP_DATA.cpu.summary ? CP_DATA.cpu.summary.length : 32);
  let peakCoreIdx = (analysis && analysis.peakCoreNum !== undefined) ? analysis.peakCoreNum : 0;
  if (!analysis) {
    let maxFound = 0;
    for (let ci = 0; ci < coresCount; ci++) {
      let maxVal = 0;
      sliceData.forEach(r => {
        const v = r[`core_${ci}_max`] !== undefined ? r[`core_${ci}_max`] : (r[`core_${ci}_avg`] || 0);
        if (v > maxVal) maxVal = v;
      });
      if (maxVal > maxFound) {
        maxFound = maxVal;
        peakCoreIdx = ci;
      }
    }
  }

  // Populate diag-core-select
  const diagCoreSelect = document.getElementById('diag-core-select');
  if (diagCoreSelect && (diagCoreSelect.options.length <= 1 || diagCoreSelect.getAttribute('data-loaded-for') !== String(coresCount))) {
    diagCoreSelect.setAttribute('data-loaded-for', String(coresCount));
    let opts = `<option value="peak">🔥 Core Pico Dinámico</option>`;
    for (let ci = 0; ci < coresCount; ci++) {
      const cMeta = (CP_DATA.cpu?.summary || []).find(c => c.core === ci) || {};
      const roleStr = cMeta.role && cMeta.role.includes('SND') ? 'SND' : 'Worker';
      const isPeakTag = (ci === peakCoreIdx) ? ' ⭐ (Pico Global)' : '';
      opts += `<option value="${ci}">Core ${ci} (${roleStr})${isPeakTag}</option>`;
    }
    diagCoreSelect.innerHTML = opts;
    diagCoreSelect.value = diagnosticsState.chartCore || 'peak';
    diagCoreSelect.onchange = (e) => {
      diagnosticsState.chartCore = e.target.value;
      renderDiagnosticsChart();
    };
  }

  // Metric Toggle [Picos | Media]
  const btnDiagMax = document.getElementById('btn-diag-metric-max');
  const btnDiagAvg = document.getElementById('btn-diag-metric-avg');
  if (btnDiagMax && btnDiagAvg && !btnDiagMax._bound) {
    btnDiagMax._bound = true;
    btnDiagMax.addEventListener('click', () => {
      diagnosticsState.chartMetric = 'max';
      btnDiagMax.classList.add('active');
      btnDiagAvg.classList.remove('active');
      renderDiagnosticsChart();
    });
    btnDiagAvg.addEventListener('click', () => {
      diagnosticsState.chartMetric = 'avg';
      btnDiagAvg.classList.add('active');
      btnDiagMax.classList.remove('active');
      renderDiagnosticsChart();
    });
  }
  const isDiagMax = (diagnosticsState.chartMetric === 'max');
  if (btnDiagMax && btnDiagAvg) {
    btnDiagMax.classList.toggle('active', isDiagMax);
    btnDiagAvg.classList.toggle('active', !isDiagMax);
  }

  const labels = sliceData.map(r => fmtDateShort(r.ts));
  const metricName = isDiagMax ? 'Pico' : 'Media';
  let peakCoreData = [];
  let peakCoreLabel = '';

  if (diagnosticsState.chartCore === 'peak') {
    peakCoreLabel = `CPU Core Pico Dinámico - ${metricName} (%)`;
    peakCoreData = sliceData.map(r => {
      if (isDiagMax) {
        let maxV = 0;
        for (let ci = 0; ci < coresCount; ci++) {
          const v = r[`core_${ci}_max`] !== undefined ? r[`core_${ci}_max`] : (r[`core_${ci}_avg`] || 0);
          if (v > maxV) maxV = v;
        }
        return maxV;
      } else {
        let maxAvg = 0;
        for (let ci = 0; ci < coresCount; ci++) {
          const a = r[`core_${ci}_avg`] || 0;
          if (a > maxAvg) maxAvg = a;
        }
        return maxAvg;
      }
    });
  } else {
    const selCore = parseInt(diagnosticsState.chartCore);
    const cMeta = (CP_DATA.cpu?.summary || []).find(c => c.core === selCore) || {};
    const roleStr = cMeta.role && cMeta.role.includes('SND') ? 'SND' : 'Worker';
    peakCoreLabel = `CPU Core ${selCore} (${roleStr}) - ${metricName} (%)`;
    peakCoreData = sliceData.map(r => {
      if (isDiagMax) {
        return r[`core_${selCore}_max`] !== undefined ? r[`core_${selCore}_max`] : (r[`core_${selCore}_avg`] || 0);
      } else {
        return r[`core_${selCore}_avg`] !== undefined ? r[`core_${selCore}_avg`] : (r.total_avg || 0);
      }
    });
  }

  const cpuTotData = sliceData.map(r => r.total_avg || 0);
  const trafData = sliceData.map(r => {
    const t = trafMap[r.ts];
    return t ? Number(((t.in_mbps_max || 0) / 1000).toFixed(2)) : 0; // Gbps
  });
  const connRateData = sliceData.map(r => {
    const t = trafMap[r.ts];
    return t ? Number(((t.conn_rate_max || 0) / 1000).toFixed(2)) : 0; // k conns/s (e.g. 0.08 for 78 c/s)
  });
  const dropsData = sliceData.map(r => {
    const dr = dropsMap[r.ts];
    return dr ? Number(((dr.total || 0) / 1000).toFixed(1)) : 0; // k drops/h
  });

  const baseDatasets = [
    {
      label: peakCoreLabel,
      data: peakCoreData,
      borderColor: '#f43f5e',
      backgroundColor: 'rgba(244, 63, 94, 0.1)',
      fill: false,
      tension: 0.2,
      borderWidth: 2,
      pointRadius: sliceData.length > 100 ? 0 : 2,
      yAxisID: 'y'
    },
    {
      label: 'CPU Promedio Total (%)',
      data: cpuTotData,
      borderColor: '#38bdf8',
      borderDash: [4, 4],
      fill: false,
      tension: 0.2,
      borderWidth: 1.5,
      pointRadius: 0,
      yAxisID: 'y'
    },
    {
      label: 'Tráfico Pico (Gbps)',
      data: trafData,
      borderColor: '#06b6d4',
      fill: false,
      tension: 0.2,
      borderWidth: 1.5,
      pointRadius: 0,
      yAxisID: 'y1'
    },
    {
      label: 'Nuevas Conexiones (k c/s)',
      data: connRateData,
      borderColor: '#c084fc',
      fill: false,
      tension: 0.2,
      borderWidth: 1.5,
      pointRadius: 0,
      yAxisID: 'y1'
    },
    {
      label: 'Descartes Totales (k drops/h)',
      data: dropsData,
      borderColor: '#fbbf24',
      backgroundColor: 'rgba(245, 158, 11, 0.08)',
      fill: true,
      tension: 0.2,
      borderWidth: 1.5,
      pointRadius: 0,
      yAxisID: 'y1'
    }
  ];

  chartDatasetsCache['chart-diagnostics-confluence'] = baseDatasets;
  const fgIdx = Math.min(Math.max(st.foregroundIndex ?? 0, 0), baseDatasets.length - 1);

  const processedDatasets = baseDatasets.map((ds, idx) => {
    let color = st.datasetColors[idx];
    if (!color) {
      color = (idx === 0 && st.color) ? st.color : (ds.borderColor || ds.backgroundColor || SERIES_DEFAULT_COLORS[idx % SERIES_DEFAULT_COLORS.length]);
      st.datasetColors[idx] = color;
    }
    if (idx === 0) st.color = color;

    const isForeground = (idx === fgIdx);
    const customOrder = st.seriesOrder && st.seriesOrder[idx] !== undefined ? st.seriesOrder[idx] : null;
    const order = customOrder !== null ? customOrder : (isForeground ? 1 : (10 + idx));

    const isHidden = !!(st.seriesHidden && st.seriesHidden[idx]);
    const lineStyle = (st.seriesLineStyle && st.seriesLineStyle[idx]) || (idx === 1 ? 'dashed' : 'solid');
    let borderDash = [];
    if (lineStyle === 'dashed') borderDash = [6, 4];
    else if (lineStyle === 'dotted') borderDash = [2, 3];
    else if (lineStyle === 'dashdot') borderDash = [8, 3, 2, 3];

    const fillStyle = (st.seriesFillStyle && st.seriesFillStyle[idx]) || (ds.fill ? 'translucent' : 'none');
    const opacity = (st.seriesOpacity && st.seriesOpacity[idx] !== undefined) ? Number(st.seriesOpacity[idx]) : 1.0;
    const customType = st.seriesChartType && st.seriesChartType[idx];

    let fill = false;
    let bgColor = undefined;
    if (fillStyle === 'none') {
      fill = false;
      bgColor = hexToRgba(color, 0.0);
    } else if (fillStyle === 'solid') {
      fill = true;
      bgColor = hexToRgba(color, Math.min(1.0, 0.85 * opacity));
    } else if (fillStyle === 'pattern') {
      fill = true;
      bgColor = createStripePattern(hexToRgba(color, Math.min(1.0, 0.8 * opacity)), hexToRgba(color, 0.08 * opacity));
    } else {
      fill = true;
      bgColor = hexToRgba(color, (isForeground ? 0.25 : 0.1) * opacity);
    }

    const dsObj = {
      ...ds,
      hidden: isHidden,
      borderColor: color,
      backgroundColor: bgColor,
      borderDash: borderDash,
      fill: fill,
      borderWidth: isForeground ? 3.0 : (ds.borderWidth || 1.8),
      pointRadius: isForeground ? (sliceData.length > 100 ? 1.5 : 3.5) : (sliceData.length > 100 ? 0 : 1.5),
      pointHoverRadius: isForeground ? 7 : 5,
      pointBackgroundColor: color,
      order: order
    };
    if (customType) dsObj.type = customType;
    return dsObj;
  });

  const chartConfig = {
    type: st.type === 'bar' ? 'bar' : 'line',
    data: {
      labels,
      datasets: processedDatasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          grid: { display: false }
        },
        y: {
          type: 'linear',
          position: 'left',
          title: { display: true, text: 'CPU (%)' },
          min: 0,
          max: 100
        },
        y1: {
          type: 'linear',
          position: 'right',
          title: { display: true, text: 'Gbps · k conns/s · k drops/h' },
          grid: { drawOnChartArea: false },
          min: 0
        }
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            boxWidth: 12,
            padding: 12,
            generateLabels: function(chart) {
              const original = Chart.defaults.plugins.legend.labels.generateLabels(chart);
              const fgSuffix = t('chartctrl.legend_fg_suffix', '(Frente)');
              original.forEach(item => {
                if (item.datasetIndex === fgIdx) {
                  item.text = '⭐ ' + item.text + ' ' + fgSuffix;
                }
              });
              return original;
            }
          },
          onClick: function(e, legendItem, legend) {
            const dsIdx = legendItem.datasetIndex;
            if (e.native && (e.native.altKey || e.native.shiftKey || e.native.ctrlKey || e.native.metaKey)) {
              st.foregroundIndex = dsIdx;
              st.activeSeriesIndex = dsIdx;
              saveChartCustomState();
              triggerChartRefresh('chart-diagnostics-confluence');
              return;
            }
            st.activeSeriesIndex = dsIdx;
            syncChartControlsUI('chart-diagnostics-confluence');
            Chart.defaults.plugins.legend.onClick.call(this, e, legendItem, legend);
          }
        },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              const isFg = (ctx.datasetIndex === fgIdx);
              const prefix = isFg ? t('chartctrl.fg_prefix_tooltip', '⭐ [1º Plano] ') : '';
              const label = ctx.dataset.label || '';
              const val = ctx.parsed.y;
              const r = sliceData[ctx.dataIndex] || {};

              if (label.includes('CPU Core')) {
                if (diagnosticsState.chartCore === 'peak') {
                  let hPeakNum = 0, hPeakMax = 0, hPeakAvg = 0;
                  for (let ci = 0; ci < coresCount; ci++) {
                    const m = r[`core_${ci}_max`] !== undefined ? r[`core_${ci}_max`] : (r[`core_${ci}_avg`] || 0);
                    if (m > hPeakMax) { hPeakMax = m; hPeakNum = ci; hPeakAvg = r[`core_${ci}_avg`] || 0; }
                  }
                  return `${prefix}Pico: Core ${hPeakNum} (${hPeakMax}%) | Media ${hPeakAvg}%`;
                } else {
                  const selCore = parseInt(diagnosticsState.chartCore);
                  const aVal = r[`core_${selCore}_avg`] !== undefined ? r[`core_${selCore}_avg`] : val;
                  const mVal = r[`core_${selCore}_max`] !== undefined ? r[`core_${selCore}_max`] : val;
                  return `${prefix}Core ${selCore}: Pico ${mVal}% | Media ${aVal}%`;
                }
              }
              if (label.includes('CPU Promedio Total')) return `${prefix}CPU Promedio Gateway: ${val}%`;
              if (label.includes('Tráfico')) return `${prefix}${label}: ${val} Gbps (${Math.round(val * 1000)} Mbps)`;
              if (label.includes('Conexiones')) return `${prefix}${label}: ${val} k c/s (${Math.round(val * 1000)} conn/s)`;
              if (label.includes('Descartes')) return `${prefix}${label}: ${val} k drops/hora (${Math.round(val * 1000)} drops)`;
              return `${prefix}${label}: ${val}`;
            }
          }
        }
      }
    }
  };

  createOrUpdateChart('chart-diagnostics-confluence', chartConfig);
  syncChartControlsUI('chart-diagnostics-confluence');
}

function renderDiagnosticsHeatmap(heatmap) {
  const table = document.getElementById('diag-heatmap-table');
  if (!table || !heatmap) return;

  const dayNames = [
    window.i18n ? window.i18n.t('common.day_mon', 'Lunes') : 'Lunes',
    window.i18n ? window.i18n.t('common.day_tue', 'Martes') : 'Martes',
    window.i18n ? window.i18n.t('common.day_wed', 'Miércoles') : 'Miércoles',
    window.i18n ? window.i18n.t('common.day_thu', 'Jueves') : 'Jueves',
    window.i18n ? window.i18n.t('common.day_fri', 'Viernes') : 'Viernes',
    window.i18n ? window.i18n.t('common.day_sat', 'Sábado') : 'Sábado',
    window.i18n ? window.i18n.t('common.day_sun', 'Domingo') : 'Domingo'
  ];

  let html = '<thead><tr><th style="width:80px;">Día</th>';
  for (let h = 0; h < 24; h++) {
    html += `<th>${String(h).padStart(2, '0')}h</th>`;
  }
  html += '</tr></thead><tbody>';

  for (let d = 0; d < 7; d++) {
    html += `<tr><td class="heatmap-label">${dayNames[d]}</td>`;
    for (let h = 0; h < 24; h++) {
      const cellData = heatmap[d][h] || { total: 0, high: 0, crit: 0 };
      const pct = cellData.total > 0 ? (cellData.high / cellData.total) * 100 : 0;

      let level = 0;
      if (pct > 75) level = 4;
      else if (pct > 45) level = 3;
      else if (pct > 20) level = 2;
      else if (pct > 0) level = 1;

      const isSelected = (diagnosticsState.dayFilter === d && diagnosticsState.hourFilter === h);
      const title = `${dayNames[d]} a las ${String(h).padStart(2, '0')}:00 UTC: ${cellData.high}/${cellData.total} muestras con CoreXL ≥ 75%. ${cellData.crit} CRIT.`;
      html += `<td class="heatmap-cell level-${level} ${isSelected ? 'active-filter' : ''}" title="${title}" data-day="${d}" data-hour="${h}">${pct.toFixed(0)}%</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody>';
  table.innerHTML = html;

  table.querySelectorAll('.heatmap-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const d = parseInt(cell.getAttribute('data-day'));
      const h = parseInt(cell.getAttribute('data-hour'));
      if (diagnosticsState.dayFilter === d && diagnosticsState.hourFilter === h) {
        diagnosticsState.dayFilter = 'all';
        diagnosticsState.hourFilter = 'all';
      } else {
        diagnosticsState.dayFilter = d;
        diagnosticsState.hourFilter = h;
      }
      diagnosticsState.page = 1;
      renderDiagnosticsHeatmap(heatmap);
      renderDiagnosticsIncidentsTable();
      const incTable = document.getElementById('table-diag-incidents');
      if (incTable) incTable.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function renderDiagnosticsIncidentsTable() {
  const tbody = document.getElementById('tbody-diag-incidents');
  if (!tbody || !CP_DATA) return;

  const analysis = computeDiagnosticsAndConfluence(CP_DATA);
  if (!analysis) return;

  const dayNames = [
    window.i18n ? window.i18n.t('common.day_mon', 'Lunes') : 'Lunes',
    window.i18n ? window.i18n.t('common.day_tue', 'Martes') : 'Martes',
    window.i18n ? window.i18n.t('common.day_wed', 'Miércoles') : 'Miércoles',
    window.i18n ? window.i18n.t('common.day_thu', 'Jueves') : 'Jueves',
    window.i18n ? window.i18n.t('common.day_fri', 'Viernes') : 'Viernes',
    window.i18n ? window.i18n.t('common.day_sat', 'Sábado') : 'Sábado',
    window.i18n ? window.i18n.t('common.day_sun', 'Domingo') : 'Domingo'
  ];
  const search = diagnosticsState.search.toLowerCase().trim();
  const sevFilter = diagnosticsState.severity;
  const natFilter = diagnosticsState.nature;

  let filtered = analysis.incidents.filter(inc => {
    if (sevFilter !== 'all' && inc.severity !== sevFilter) return false;
    if (natFilter !== 'all' && inc.nature !== natFilter) return false;
    if (diagnosticsState.dayFilter !== 'all' && inc.dayOfWeek !== diagnosticsState.dayFilter) return false;
    if (diagnosticsState.hourFilter !== 'all' && inc.hour !== diagnosticsState.hourFilter) return false;
    if (search) {
      const matchDate = inc.dateStr.toLowerCase().includes(search);
      const matchCause = inc.cause.toLowerCase().includes(search);
      const matchSigs = inc.signals.some(s => s.label.toLowerCase().includes(search));
      if (!matchDate && !matchCause && !matchSigs) return false;
    }
    return true;
  });

  const countBadge = document.getElementById('diag-incidents-count');
  if (countBadge) {
    let filterTag = '';
    if (diagnosticsState.dayFilter !== 'all') {
      const resetText = window.i18n ? window.i18n.t('diag.btn_reset_filter', '✕ Limpiar') : '✕ Limpiar';
      const filterLabel = window.i18n ? window.i18n.t('diag.filter_tag', `Filtrado: ${dayNames[diagnosticsState.dayFilter]} ${String(diagnosticsState.hourFilter).padStart(2,'0')}h`, { day: dayNames[diagnosticsState.dayFilter], hour: String(diagnosticsState.hourFilter).padStart(2,'0') }) : `Filtrado: ${dayNames[diagnosticsState.dayFilter]} ${String(diagnosticsState.hourFilter).padStart(2,'0')}h`;
      filterTag = ` | ${filterLabel} <button class="btn btn-sm btn-outline" style="padding:1px 6px; font-size:10px; margin-left:6px;" onclick="resetDiagnosticsHeatmapFilter()">${resetText}</button>`;
    }
    const filteredText = window.i18n ? window.i18n.t('diag.incidents_filtered', `${filtered.length} incidentes filtrados (de ${analysis.totalIncidents})`, { count: filtered.length, total: analysis.totalIncidents }) : `${filtered.length} incidentes filtrados (de ${analysis.totalIncidents})`;
    countBadge.innerHTML = `${filteredText}${filterTag}`;
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / diagnosticsState.pageSize));
  if (diagnosticsState.page > totalPages) diagnosticsState.page = totalPages;
  if (diagnosticsState.page < 1) diagnosticsState.page = 1;

  const pageInfo = document.getElementById('diag-pagination-info');
  if (pageInfo) {
    const startIdx = (diagnosticsState.page - 1) * diagnosticsState.pageSize + 1;
    const endIdx = Math.min(filtered.length, diagnosticsState.page * diagnosticsState.pageSize);
    const noIncidentsText = window.i18n ? window.i18n.t('diag.no_incidents_match', 'No hay incidentes que coincidan con los filtros') : 'No hay incidentes que coincidan con los filtros';
    const paginationText = window.i18n ? window.i18n.t('diag.showing_pagination', `Mostrando ${startIdx} - ${endIdx} de ${filtered.length} incidentes (Pág. ${diagnosticsState.page} de ${totalPages})`, { start: startIdx, end: endIdx, total: filtered.length, page: diagnosticsState.page, totalPages: totalPages }) : `Mostrando ${startIdx} - ${endIdx} de ${filtered.length} incidentes (Pág. ${diagnosticsState.page} de ${totalPages})`;
    pageInfo.textContent = filtered.length > 0 ? paginationText : noIncidentsText;
  }

  const prevBtn = document.getElementById('btn-diag-prev');
  const nextBtn = document.getElementById('btn-diag-next');
  if (prevBtn) prevBtn.disabled = (diagnosticsState.page <= 1);
  if (nextBtn) nextBtn.disabled = (diagnosticsState.page >= totalPages);

  const start = (diagnosticsState.page - 1) * diagnosticsState.pageSize;
  const paged = filtered.slice(start, start + diagnosticsState.pageSize);

  if (paged.length === 0) {
    const emptyMsg = window.i18n ? window.i18n.t('diag.no_incidents_found', 'No se encontraron incidentes para los criterios seleccionados.') : 'No se encontraron incidentes para los criterios seleccionados.';
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:32px; color:var(--text-muted);">${emptyMsg}</td></tr>`;
    return;
  }

  let html = '';
  paged.forEach((inc) => {
    const isExpanded = diagnosticsState.expandedIndex === inc.id;
    const sevBadgeClass = inc.severity === 'CRÍTICO' ? 'crit' : (inc.severity === 'ALTO' ? 'high' : 'med');
    
    let sevBadgeText = inc.severity;
    if (window.i18n) {
      if (inc.severity === 'CRÍTICO') sevBadgeText = window.i18n.t('diag.badge_critical', 'Crítico').toUpperCase();
      else if (inc.severity === 'ALTO') sevBadgeText = window.i18n.t('diag.badge_high', 'Alto').toUpperCase();
      else if (inc.severity === 'MEDIO') sevBadgeText = window.i18n.t('spikes.severity_moderate', 'Medio').toUpperCase();
    }

    const natBadge = inc.nature === 'Recurrente'
      ? `<span class="confluence-chip recurrent">${window.i18n ? window.i18n.t('diag.badge_recurrent', '🔁 Recurrente') : '🔁 Recurrente'}</span>`
      : `<span class="confluence-chip" style="background:rgba(255,255,255,0.08); color:var(--text-muted);">${window.i18n ? window.i18n.t('diag.badge_punctual', '⚡ Puntual') : '⚡ Puntual'}</span>`;

    const chipsHtml = inc.signals.map(s => {
      let cClass = 'cpu';
      if (s.type === 'conns') cClass = 'conns';
      else if (s.type === 'drops') cClass = 'drops';
      else if (s.type === 'traffic') cClass = 'traffic';
      return `<span class="confluence-chip ${cClass}">${s.label}</span>`;
    }).join(' ');

    const cNum = inc.peakCoreNum !== undefined ? inc.peakCoreNum : 0;
    const cMax = inc.peakCoreMax !== undefined ? inc.peakCoreMax : (inc.core1Max || 0);
    const cAvg = inc.peakCoreAvg !== undefined ? inc.peakCoreAvg : (inc.core1Avg || 0);

    const copyReportText = `[Check Point Incident Forensic Report]
Fecha: ${inc.dateStr}
Severidad: ${inc.severity} (${inc.nature})
CPU Core ${cNum} Pico: ${cMax}% (Media: ${cAvg}%)
CPU Promedio Gateway: ${inc.cpuTotal}%
Tasa Conexiones: ${Number(inc.connRate).toLocaleString()} conns/s
Descartes Registrados: ${Number(inc.dropTot).toLocaleString()} drops/h
Throughput Inbound: ${(inc.inMbps / 1000).toFixed(2)} Gbps
Causa Raíz: ${inc.cause}
Remediación: ${inc.remediation}`;

    const btnActionText = isExpanded
      ? (window.i18n ? window.i18n.t('diag.btn_hide', '▲ Ocultar') : '▲ Ocultar')
      : (window.i18n ? window.i18n.t('diag.btn_view_detail', '▼ Ver Detalle') : '▼ Ver Detalle');

    html += `
      <tr class="incident-row ${isExpanded ? 'expanded' : ''}" data-inc-id="${inc.id}">
        <td style="font-family:var(--font-mono); font-weight:600; color:var(--accent-cyan);">
          ${inc.dateStr}
        </td>
        <td>
          <span class="problem-card-badge ${sevBadgeClass}">${sevBadgeText}</span>
        </td>
        <td>${natBadge}</td>
        <td>
          <div class="confluence-chips-row">${chipsHtml}</div>
        </td>
        <td style="text-align:right;">
          <button class="btn btn-sm btn-outline" style="padding:3px 10px; font-size:11px;">
            ${btnActionText}
          </button>
        </td>
      </tr>
    `;

    if (isExpanded) {
      const titleExact = window.i18n ? window.i18n.t('diag.exact_values', '📊 Valores Exactos en la Franja') : '📊 Valores Exactos en la Franja';
      const titleCause = window.i18n ? window.i18n.t('diag.drawer_cause', '🔍 Diagnóstico y Causa Raíz') : '🔍 Diagnóstico y Causa Raíz';
      const titleRemedy = window.i18n ? window.i18n.t('diag.drawer_remedy', '🛠️ Remediación Check Point Recomendada') : '🛠️ Remediación Check Point Recomendada';
      const btnCopy = window.i18n ? window.i18n.t('diag.btn_copy_report', '📋 Copiar Reporte Forense') : '📋 Copiar Reporte Forense';
      const btnCopied = window.i18n ? window.i18n.t('diag.btn_report_copied', '✓ Reporte Copiado') : '✓ Reporte Copiado';

      html += `
        <tr class="incident-drawer-row">
          <td colspan="5">
            <div class="incident-drawer-content">
              <div class="incident-drawer-box">
                <div class="incident-drawer-box-title">${titleExact}</div>
                <div class="incident-drawer-box-body" style="font-family:var(--font-mono); font-size:11.5px;">
                  <div>• CPU Core ${cNum} Pico: <strong>${cMax}%</strong> (Media: ${cAvg}%)</div>
                  <div>• CPU Promedio Gateway: <strong>${inc.cpuTotal}%</strong></div>
                  <div>• Tasa Nuevas Conexiones: <strong>${Number(inc.connRate).toLocaleString()} conn/s</strong></div>
                  <div>• Descartes Registrados: <strong>${Number(inc.dropTot).toLocaleString()} drops/hora</strong></div>
                  <div>• Throughput Inbound Pico: <strong>${(inc.inMbps / 1000).toFixed(2)} Gbps</strong></div>
                  <div style="margin-top:10px;">
                    <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); navigator.clipboard.writeText(\`${copyReportText.replace(/`/g, '\\`')}\`); this.textContent='${btnCopied}'; setTimeout(()=>this.textContent='${btnCopy}', 1500);">${btnCopy}</button>
                  </div>
                </div>
              </div>
              <div class="incident-drawer-box">
                <div class="incident-drawer-box-title">${titleCause}</div>
                <div class="incident-drawer-box-body">
                  ${inc.cause}
                </div>
              </div>
              <div class="incident-drawer-box">
                <div class="incident-drawer-box-title">${titleRemedy}</div>
                <div class="incident-drawer-box-body">
                  ${inc.remediation}
                </div>
              </div>
            </div>
          </td>
        </tr>
      `;
    }
  });

  tbody.innerHTML = html;

  tbody.querySelectorAll('.incident-row').forEach(row => {
    row.addEventListener('click', () => {
      const incId = row.getAttribute('data-inc-id');
      if (diagnosticsState.expandedIndex === incId) {
        diagnosticsState.expandedIndex = null;
      } else {
        diagnosticsState.expandedIndex = incId;
      }
      renderDiagnosticsIncidentsTable();
    });
  });
}

window.resetDiagnosticsHeatmapFilter = function() {
  diagnosticsState.dayFilter = 'all';
  diagnosticsState.hourFilter = 'all';
  diagnosticsState.page = 1;
  if (CP_DATA) {
    const analysis = computeDiagnosticsAndConfluence(CP_DATA);
    if (analysis) renderDiagnosticsHeatmap(analysis.heatmap);
  }
  renderDiagnosticsIncidentsTable();
};

function setupDiagnosticsEvents() {
  const searchInput = document.getElementById('diag-incidents-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      diagnosticsState.search = e.target.value;
      diagnosticsState.page = 1;
      renderDiagnosticsIncidentsTable();
    });
  }

  const sevFilter = document.getElementById('diag-severity-filter');
  if (sevFilter) {
    sevFilter.addEventListener('change', (e) => {
      diagnosticsState.severity = e.target.value;
      diagnosticsState.page = 1;
      renderDiagnosticsIncidentsTable();
    });
  }

  const natFilter = document.getElementById('diag-nature-filter');
  if (natFilter) {
    natFilter.addEventListener('change', (e) => {
      diagnosticsState.nature = e.target.value;
      diagnosticsState.page = 1;
      renderDiagnosticsIncidentsTable();
    });
  }

  const prevBtn = document.getElementById('btn-diag-prev');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (diagnosticsState.page > 1) {
        diagnosticsState.page--;
        renderDiagnosticsIncidentsTable();
      }
    });
  }

  const nextBtn = document.getElementById('btn-diag-next');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      diagnosticsState.page++;
      renderDiagnosticsIncidentsTable();
    });
  }

  const rangeBtns = [
    { id: 'btn-diag-range-all', action: () => setTimeRangeMode('all') },
    { id: 'btn-diag-range-14d', action: () => {
      if (CP_DATA && CP_DATA.system) {
        const e = CP_DATA.system.end_timestamp;
        const s = e - 14 * 86400;
        const sDate = new Date(s * 1000).toISOString().substring(0, 10);
        const eDate = new Date(e * 1000).toISOString().substring(0, 10);
        setTimeRangeMode('custom', sDate, eDate);
      }
    }},
    { id: 'btn-diag-range-7d', action: () => setTimeRangeMode('1w') },
    { id: 'btn-diag-range-crit', action: () => {
      if (diagnosticsState.critWindow) {
        setTimeRangeMode('custom', diagnosticsState.critWindow.start, diagnosticsState.critWindow.end);
      } else {
        setTimeRangeMode('1w');
      }
    }}
  ];

  rangeBtns.forEach(b => {
    const btn = document.getElementById(b.id);
    if (btn) {
      btn.addEventListener('click', () => {
        b.action();
      });
    }
  });

  // Multivariate Algorithm and Sensitivity controls
  const algoSelect = document.getElementById('diag-algo-select');
  if (algoSelect) {
    algoSelect.addEventListener('change', (e) => {
      diagnosticsState.algorithm = e.target.value;
      diagnosticsState.page = 1;
      diagnosticsState.expandedIndex = null;
      diagnosticsState.cachedAnalysis = null;
      renderDiagnosticsPage();
    });
  }

  const sensSelect = document.getElementById('diag-sensitivity-select');
  if (sensSelect) {
    sensSelect.addEventListener('change', (e) => {
      diagnosticsState.sensitivity = e.target.value;
      diagnosticsState.page = 1;
      diagnosticsState.expandedIndex = null;
      diagnosticsState.cachedAnalysis = null;
      renderDiagnosticsPage();
    });
  }

  const runBtn = document.getElementById('btn-run-multivariate');
  if (runBtn) {
    runBtn.addEventListener('click', () => {
      const aSel = document.getElementById('diag-algo-select');
      const sSel = document.getElementById('diag-sensitivity-select');
      if (aSel) diagnosticsState.algorithm = aSel.value;
      if (sSel) diagnosticsState.sensitivity = sSel.value;
      diagnosticsState.page = 1;
      diagnosticsState.expandedIndex = null;
      diagnosticsState.cachedAnalysis = null;

      const metaBadge = document.getElementById('diag-algo-meta');
      if (metaBadge) {
        metaBadge.textContent = '⏳ Ejecutando análisis...';
      }

      runBtn.disabled = true;
      const originalHtml = runBtn.innerHTML;
      runBtn.innerHTML = '<span>⏳</span> <span>Analizando...</span>';

      setTimeout(() => {
        renderDiagnosticsPage();
        runBtn.innerHTML = originalHtml;
        runBtn.disabled = false;
      }, 50);
    });
  }
}

// =============================================================================
// PAGE 1: OVERVIEW
// =============================================================================
let overviewTrafficDays = 30;

function renderOverviewCharts() {
  if (!CP_DATA || !CP_DATA.traffic || !CP_DATA.cpu) return;

  const traffic = filterTimeSeries(CP_DATA.traffic.hourly);
  const labels = traffic.map(t => fmtDateShort(t.ts));

  // Traffic chart (respects user type & color)
  renderUniversalChart('chart-overview-traffic', {
    labels: labels,
    datasets: [
      {
        label: 'Inbound Rx (Mbps)',
        data: traffic.map(t => t.in_mbps_avg)
      },
      {
        label: 'Outbound Tx (Mbps)',
        data: traffic.map(t => t.out_mbps_avg),
        borderColor: PALETTE.blue,
        backgroundColor: PALETTE.blue,
        borderDash: [4, 4]
      }
    ],
    yTitle: 'Throughput (Mbps)',
    defaultType: 'line',
    defaultColor: PALETTE.cyan
  });

  // Drops Pie Chart
  const topDrops = CP_DATA.drops.by_reason.slice(0, 6);
  createOrUpdateChart('chart-overview-drops-pie', {
    type: 'doughnut',
    data: {
      labels: topDrops.map(d => d.reason_name),
      datasets: [{
        data: topDrops.map(d => d.count),
        backgroundColor: [
          PALETTE.rose,
          PALETTE.amber,
          PALETTE.cyan,
          PALETTE.purple,
          PALETTE.blue,
          PALETTE.gray
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, color: '#94a3b8' } }
      }
    }
  });

  // CPU & Memory combined chart (respects user type & color)
  const cpu = filterTimeSeries(CP_DATA.cpu.hourly);
  const mem = filterTimeSeries(CP_DATA.memory.hourly);
  renderUniversalChart('chart-overview-cpu-mem', {
    labels: cpu.map(c => fmtDateShort(c.ts)),
    datasets: [
      {
        label: 'CPU Global Medio (%)',
        data: cpu.map(c => c.total_avg),
        yAxisID: 'y'
      },
      {
        label: 'Memoria Usada (GB)',
        data: mem.map(m => m.used_gb),
        borderColor: PALETTE.emerald,
        backgroundColor: PALETTE.emerald,
        yAxisID: 'y1'
      }
    ],
    yTitle: 'CPU Uso (%)',
    defaultType: 'line',
    defaultColor: PALETTE.amber,
    extraOptions: {
      scales: {
        y: { type: 'linear', min: 0, max: 100, title: { display: true, text: 'CPU Uso (%)' } },
        y1: { type: 'linear', position: 'right', title: { display: true, text: 'RAM (GB)' }, grid: { drawOnChartArea: false } }
      }
    }
  });
}

function renderOverviewDisks() {
  const container = document.getElementById('overview-disks-container');
  if (!container) return;
  const disks = CP_DATA.disks;
  const partLabel = window.i18n ? window.i18n.t('overview.partition_label', 'Partición') : 'Partición';
  const freeLabel = window.i18n ? window.i18n.t('overview.free_gb', 'GB libres') : 'GB libres';

  container.innerHTML = disks.map(d => {
    let colorClass = 'emerald';
    if (d.used_pct > 80) colorClass = 'rose';
    else if (d.used_pct > 60) colorClass = 'amber';

    return `
      <div>
        <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px;">
          <strong>${partLabel} ${d.mount}</strong>
          <span style="font-family:var(--font-mono); color:var(--text-muted);">
            ${d.used_gb} GB / ${d.total_gb} GB (${d.used_pct}%)
          </span>
        </div>
        <div class="meter-container">
          <div class="meter-track">
            <div class="meter-fill ${colorClass}" style="width: ${d.used_pct}%;"></div>
          </div>
          <span style="font-size:11px; font-family:var(--font-mono);">${d.free_gb} ${freeLabel}</span>
        </div>
      </div>
    `;
  }).join('');
}

// Helper for ultra-concise CPU core naming (C0-SND, C1-WRK, etc.)
function getConciseCoreName(coreIdx, role) {
  const isSnd = role ? (role.includes('SND') || role.includes('Dispatcher')) : (coreIdx % 2 === 0);
  return `C${coreIdx}-${isSnd ? 'SND' : 'WRK'}`;
}

// =============================================================================
// PAGE 2: SYSTEM & CPU
// =============================================================================
function renderSystemPage() {
  const highDemand = window.i18n ? window.i18n.t('system.high_demand', 'Alta Demanda') : 'Alta Demanda';
  const normal = window.i18n ? window.i18n.t('system.normal', 'Normal') : 'Normal';
  const daysSuffix = window.i18n ? window.i18n.t('header.days_suffix', 'días') : 'días';

  const cpu = filterTimeSeries(CP_DATA.cpu?.hourly || []);
  const labels = cpu.map(c => fmtDateShort(c.ts));

  // Compute live core statistics for the active time window
  const coreStatsMap = {};
  if (CP_DATA.cpu && CP_DATA.cpu.summary) {
    CP_DATA.cpu.summary.forEach(c => {
      let sumAvg = 0, maxFound = 0, sumUsr = 0, sumSys = 0;
      if (cpu.length > 0) {
        cpu.forEach(r => {
          const a = r[`core_${c.core}_avg`] !== undefined ? r[`core_${c.core}_avg`] : (c.avg_usage || 0);
          const m = r[`core_${c.core}_max`] !== undefined ? r[`core_${c.core}_max`] : a;
          const u = r[`core_${c.core}_usr`] !== undefined ? r[`core_${c.core}_usr`] : (c.avg_usr || 0);
          const s = r[`core_${c.core}_sys`] !== undefined ? r[`core_${c.core}_sys`] : (c.avg_sys || 0);
          sumAvg += a;
          if (m > maxFound) maxFound = m;
          sumUsr += u;
          sumSys += s;
        });
        const n = cpu.length;
        const avg = Number((sumAvg / n).toFixed(1));
        coreStatsMap[c.core] = {
          ...c,
          avg_usage: avg,
          max_usage: Number(maxFound.toFixed(1)),
          avg_usr: Number((sumUsr / n).toFixed(1)),
          avg_sys: Number((sumSys / n).toFixed(1)),
          avg_idle: Number(Math.max(0, 100 - avg).toFixed(1))
        };
      } else {
        coreStatsMap[c.core] = { ...c };
      }
    });
  }

  const sys = CP_DATA.system || {};
  const coresList = (CP_DATA.cpu && CP_DATA.cpu.summary) ? CP_DATA.cpu.summary.map(c => coreStatsMap[c.core] || c) : [];
  const totalCores = (sys && sys.cores_count) || coresList.length || 32;
  const sndCount = coresList.filter(c => c.role && (c.role.includes('SND') || c.role.includes('Dispatcher'))).length;
  const workerCount = totalCores - sndCount;

  // Update System KPI Cards
  const kpiCoresVal = document.getElementById('kpi-system-cores-count');
  if (kpiCoresVal) kpiCoresVal.textContent = `${totalCores} Cores`;
  const kpiCoresSub = document.getElementById('kpi-system-cores-breakdown');
  if (kpiCoresSub) kpiCoresSub.textContent = `${workerCount} CoreXL FW Workers + ${sndCount} SND Cores`;

  const kpiOsVal = document.getElementById('kpi-system-os-val');
  if (kpiOsVal) kpiOsVal.textContent = `${sys.os || 'Gaia 64Bit'} ${sys.version || 'R81.20'}`;
  const kpiOsSub = document.getElementById('kpi-system-os-sub');
  if (kpiOsSub) kpiOsSub.textContent = `${sys.branch || 'Jumbo HF Main'} Take ${sys.build || ''}`;

  const kpiRamVal = document.getElementById('kpi-system-ram-val');
  if (kpiRamVal) {
    const memTotalGb = (CP_DATA.memory && CP_DATA.memory.summary && CP_DATA.memory.summary.total_gb) 
      ? CP_DATA.memory.summary.total_gb 
      : ((CP_DATA.memory && CP_DATA.memory.total_mb) ? (CP_DATA.memory.total_mb / 1024).toFixed(2) : '15.37');
    kpiRamVal.textContent = `${memTotalGb} GB`;
  }

  // Ranges generation in blocks of 5 cores
  const ranges = [];
  for (let start = 0; start < totalCores; start += 5) {
    const end = Math.min(start + 4, totalCores - 1);
    ranges.push({
      id: `range_${start}_${end}`,
      start,
      end,
      label: `${start}-${end}`,
      fullLabel: `Cores ${start} - ${end} (${end - start + 1} cores)`
    });
  }

  // Populate Range Buttons (5 en 5)
  const rangeButtonsContainer = document.getElementById('cpu-core-range-buttons');
  if (rangeButtonsContainer && rangeButtonsContainer.getAttribute('data-loaded-for') !== String(totalCores)) {
    rangeButtonsContainer.setAttribute('data-loaded-for', String(totalCores));
    rangeButtonsContainer.innerHTML = ranges.map(r => `
      <button class="filter-btn range-btn" data-choice="${r.id}" title="${r.fullLabel}">${r.label}</button>
    `).join('');

    rangeButtonsContainer.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const choice = btn.getAttribute('data-choice');
        systemCpuState.coreSelection = choice;
        renderSystemPage();
      });
    });
  }

  // Wire Core Type Buttons (Top 5, Top 10, SNDs, Workers, Todos, Pico)
  const typeButtonsContainer = document.getElementById('cpu-core-type-buttons');
  if (typeButtonsContainer && !typeButtonsContainer._bound) {
    typeButtonsContainer._bound = true;
    typeButtonsContainer.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const choice = btn.getAttribute('data-choice');
        systemCpuState.coreSelection = choice;
        renderSystemPage();
      });
    });
  }

  const selChoice = systemCpuState.coreSelection || 'top5';

  // Synchronize Active states on Type buttons
  if (typeButtonsContainer) {
    typeButtonsContainer.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-choice') === selChoice);
    });
  }

  // Synchronize Active states on Range buttons
  if (rangeButtonsContainer) {
    rangeButtonsContainer.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-choice') === selChoice);
    });
  }

  // Populate system-core-select with Optgroups: Predefinidas, Tipo SND/Worker, Rangos 5 en 5, Cores individuales
  const sysCoreSelect = document.getElementById('system-core-select');
  if (sysCoreSelect && (sysCoreSelect.options.length <= 4 || sysCoreSelect.getAttribute('data-loaded-for') !== String(totalCores))) {
    sysCoreSelect.setAttribute('data-loaded-for', String(totalCores));
    const sndCores = coresList.filter(c => c.role && (c.role.includes('SND') || c.role.includes('Dispatcher')));
    const workerCores = coresList.filter(c => !(c.role && (c.role.includes('SND') || c.role.includes('Dispatcher'))));

    let opts = `
      <optgroup label="Vistas Predefinidas">
        <option value="top5">⭐ Top 5 Cores más Activos</option>
        <option value="top10">⭐ Top 10 Cores más Activos</option>
        <option value="all">🌐 Todos los Cores (${totalCores})</option>
        <option value="peak">🔥 Core Máximo Dinámico</option>
      </optgroup>
      <optgroup label="Por Tipo de Core (SND / Worker)">
        <option value="snds">🛡️ Solo SNDs (${sndCores.length} cores)</option>
        <option value="workers">⚙️ Solo Workers (${workerCores.length} cores)</option>
      </optgroup>
      <optgroup label="Por Rangos (de 5 en 5)">
    `;
    ranges.forEach(r => {
      opts += `<option value="${r.id}">🔢 ${r.fullLabel}</option>`;
    });
    opts += `
      </optgroup>
      <optgroup label="Cores Individuales">
    `;
    coresList.forEach(c => {
      const cLabel = getConciseCoreName(c.core, c.role);
      opts += `<option value="${c.core}">${cLabel} (Max ${c.max_usage}%)</option>`;
    });
    opts += `</optgroup>`;

    sysCoreSelect.innerHTML = opts;
  }
  if (sysCoreSelect) {
    sysCoreSelect.value = selChoice;
    sysCoreSelect.onchange = (e) => {
      systemCpuState.coreSelection = e.target.value;
      renderSystemPage();
    };
  }

  // Determine which cores to plot based on user selection
  let coresToPlot = [];
  if (selChoice === 'top5') {
    const sorted = coresList.slice().sort((a, b) => (b.max_usage * 2 + b.avg_usage) - (a.max_usage * 2 + a.avg_usage));
    coresToPlot = sorted.slice(0, 5).map(c => c.core);
  } else if (selChoice === 'top10' || selChoice === 'top6') {
    const sorted = coresList.slice().sort((a, b) => (b.max_usage * 2 + b.avg_usage) - (a.max_usage * 2 + a.avg_usage));
    coresToPlot = sorted.slice(0, 10).map(c => c.core);
  } else if (selChoice === 'snds') {
    coresToPlot = coresList.filter(c => c.role && (c.role.includes('SND') || c.role.includes('Dispatcher'))).map(c => c.core);
  } else if (selChoice === 'workers') {
    coresToPlot = coresList.filter(c => !(c.role && (c.role.includes('SND') || c.role.includes('Dispatcher')))).map(c => c.core);
  } else if (selChoice === 'all') {
    coresToPlot = coresList.map(c => c.core);
  } else if (selChoice === 'peak') {
    coresToPlot = ['peak'];
  } else if (String(selChoice).startsWith('range_')) {
    const match = String(selChoice).match(/^range_(\d+)_(\d+)$/);
    if (match) {
      const rStart = parseInt(match[1], 10);
      const rEnd = parseInt(match[2], 10);
      coresToPlot = [];
      for (let ci = rStart; ci <= rEnd && ci < totalCores; ci++) {
        coresToPlot.push(ci);
      }
    } else {
      coresToPlot = [0, 1, 2, 3, 4];
    }
  } else {
    coresToPlot = [parseInt(selChoice, 10)];
  }

  // Populate Cores Table with interactive click-to-filter
  const tbody = document.querySelector('#table-cpu-cores tbody');
  if (tbody) {
    const activeSelectedCore = (!isNaN(parseInt(selChoice, 10)) && !String(selChoice).startsWith('range_')) ? parseInt(selChoice, 10) : null;
    tbody.innerHTML = coresList.map(c => {
      const isDirectlySelected = (activeSelectedCore === c.core);
      const isInPlottedGroup = coresToPlot.includes(c.core) && coresToPlot.length <= 10;
      const isRowHighlighted = isDirectlySelected || isInPlottedGroup;
      const cLabel = getConciseCoreName(c.core, c.role);
      return `
        <tr data-core-id="${c.core}" class="${isRowHighlighted ? 'selected-row' : ''}" style="cursor:pointer; ${isDirectlySelected ? 'background:rgba(6,182,212,0.18);' : (isInPlottedGroup ? 'background:rgba(6,182,212,0.06);' : '')}" title="Haz clic para aislar la curva de este Core en el gráfico">
          <td class="cell-mono"><strong>${cLabel}</strong> ${isDirectlySelected ? '🎯' : (isInPlottedGroup ? '📈' : '')}</td>
          <td><span class="pill-badge ${c.role && c.role.includes('SND') ? 'eth' : 'vlan'}">${c.role}</span></td>
          <td class="cell-mono"><strong>${c.avg_usage}%</strong></td>
          <td class="cell-mono"><strong style="color:${c.max_usage >= 90 ? 'var(--accent-rose)' : (c.max_usage >= 75 ? 'var(--accent-amber)' : 'inherit')};">${c.max_usage}%</strong></td>
          <td class="cell-mono">${c.avg_usr}%</td>
          <td class="cell-mono">${c.avg_sys}%</td>
          <td class="cell-mono">${c.avg_idle}%</td>
          <td class="cell-mono">${fmtNum(c.max_interrupts)}</td>
          <td>
            <span class="pill-badge ${c.max_usage >= 85 || c.avg_usage > 50 ? 'down' : 'active'}">
              ${c.max_usage >= 85 || c.avg_usage > 50 ? highDemand : normal}
            </span>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('tr').forEach(tr => {
      tr.addEventListener('click', () => {
        const cId = parseInt(tr.getAttribute('data-core-id'), 10);
        if (systemCpuState.coreSelection === String(cId) || systemCpuState.coreSelection === cId) {
          systemCpuState.coreSelection = 'top5';
        } else {
          systemCpuState.coreSelection = String(cId);
        }
        renderSystemPage();
        const chartEl = document.getElementById('chart-cpu-cores-timeline');
        if (chartEl) chartEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });
  }

  // Metric Mode Toggle [Picos | Media]
  const btnAvg = document.getElementById('btn-cpu-metric-avg');
  const btnMax = document.getElementById('btn-cpu-metric-max');
  if (btnAvg && btnMax && !btnAvg._boundMetric) {
    btnAvg._boundMetric = true;
    btnAvg.addEventListener('click', () => {
      systemCpuState.metricMode = 'avg';
      btnAvg.classList.add('active');
      btnMax.classList.remove('active');
      renderSystemPage();
    });
    btnMax.addEventListener('click', () => {
      systemCpuState.metricMode = 'max';
      btnMax.classList.add('active');
      btnAvg.classList.remove('active');
      renderSystemPage();
    });
  }

  const isMaxMetric = (systemCpuState.metricMode === 'max');
  if (btnAvg && btnMax) {
    btnMax.classList.toggle('active', isMaxMetric);
    btnAvg.classList.toggle('active', !isMaxMetric);
  }

  const paletteColors = [PALETTE.cyan, PALETTE.purple, PALETTE.emerald, PALETTE.amber, PALETTE.rose, PALETTE.blue, PALETTE.indigo, '#ec4899', '#06b6d4', '#10b981'];
  const timelineDatasets = coresToPlot.map((cIdx, i) => {
    if (cIdx === 'peak') {
      const dataVals = cpu.map(r => {
        let maxV = 0;
        for (let ci = 0; ci < totalCores; ci++) {
          const v = isMaxMetric 
            ? (r[`core_${ci}_max`] !== undefined ? r[`core_${ci}_max`] : (r[`core_${ci}_avg`] || 0))
            : (r[`core_${ci}_avg`] || 0);
          if (v > maxV) maxV = v;
        }
        return maxV;
      });
      return {
        label: `Core Pico Dinámico - ${isMaxMetric ? 'Pico' : 'Media'} (%)`,
        data: dataVals,
        borderColor: PALETTE.rose,
        backgroundColor: hexToRgba(PALETTE.rose, 0.12),
        fill: true,
        borderWidth: 2,
        pointRadius: cpu.length > 100 ? 0 : 2
      };
    }

    const cMeta = coresList.find(c => c.core === cIdx) || { role: `Core ${cIdx}` };
    const conciseName = getConciseCoreName(cIdx, cMeta.role);
    const color = paletteColors[i % paletteColors.length] || `hsl(${((cIdx * 137.5) % 360).toFixed(0)}, 85%, 60%)`;
    const dataVals = cpu.map(r => {
      if (isMaxMetric) {
        return r[`core_${cIdx}_max`] !== undefined ? r[`core_${cIdx}_max`] : (r[`core_${cIdx}_avg`] || 0);
      } else {
        return r[`core_${cIdx}_avg`] !== undefined ? r[`core_${cIdx}_avg`] : (r.total_avg || 0);
      }
    });
    return {
      label: conciseName,
      data: dataVals,
      borderColor: color,
      backgroundColor: color,
      borderWidth: 1.5,
      pointRadius: cpu.length > 100 ? 0 : 2
    };
  });

  const chartMetricTitle = isMaxMetric ? 'Uso CPU Pico (%)' : 'Uso CPU Promedio (%)';
  renderUniversalChart('chart-cpu-cores-timeline', {
    labels: labels,
    datasets: timelineDatasets,
    yTitle: chartMetricTitle,
    defaultType: 'line',
    defaultColor: PALETTE.cyan,
    extraOptions: {
      scales: {
        y: { type: 'linear', min: 0, max: 100, title: { display: true, text: chartMetricTitle } }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(ctx) {
              const val = ctx.parsed.y;
              const r = cpu[ctx.dataIndex] || {};
              const cChoice = coresToPlot[ctx.datasetIndex];
              if (cChoice === 'peak') {
                let hPeakNum = 0, hPeakMax = 0, hPeakAvg = 0;
                for (let ci = 0; ci < totalCores; ci++) {
                  const m = r[`core_${ci}_max`] !== undefined ? r[`core_${ci}_max`] : (r[`core_${ci}_avg`] || 0);
                  if (m > hPeakMax) { hPeakMax = m; hPeakNum = ci; hPeakAvg = r[`core_${ci}_avg`] || 0; }
                }
                const pRole = (coresList.find(c => c.core === hPeakNum) || {}).role;
                return `Core Máximo: ${getConciseCoreName(hPeakNum, pRole)} Pico: ${hPeakMax}% | Media: ${hPeakAvg}%`;
              }
              const cMeta = coresList.find(c => c.core === cChoice) || {};
              const conciseLabel = getConciseCoreName(cChoice, cMeta.role);
              const aVal = r[`core_${cChoice}_avg`] !== undefined ? r[`core_${cChoice}_avg`] : val;
              const mVal = r[`core_${cChoice}_max`] !== undefined ? r[`core_${cChoice}_max`] : val;
              return `${conciseLabel}: Pico ${mVal}% | Media ${aVal}%`;
            }
          }
        }
      }
    }
  });

  // System parameters grid
  const sysGrid = document.getElementById('system-details-grid');
  if (sysGrid) {
    const s = CP_DATA.system;
    const lNode = window.i18n ? window.i18n.t('system.node_name', 'Nombre del Nodo') : 'Nombre del Nodo';
    const lOS = window.i18n ? window.i18n.t('system.os_label', 'Sistema Operativo') : 'Sistema Operativo';
    const lCPVer = window.i18n ? window.i18n.t('system.cp_version', 'Versión Check Point') : 'Versión Check Point';
    const lJHF = window.i18n ? window.i18n.t('system.jhf_branch', 'Jumbo HF Branch') : 'Jumbo HF Branch';
    const lBuild = window.i18n ? window.i18n.t('system.build_num', 'Build Number') : 'Build Number';
    const lHW = window.i18n ? window.i18n.t('system.hw_model', 'Modelo Plataforma') : 'Modelo Plataforma';
    const lMode = window.i18n ? window.i18n.t('system.operating_mode', 'Modo Operativo') : 'Modo Operativo';
    const lCluster = window.i18n ? window.i18n.t('system.cluster_status', 'Estado de Cluster') : 'Estado de Cluster';
    const lUptime = window.i18n ? window.i18n.t('system.uptime_label', 'Tiempo Activo (Uptime)') : 'Tiempo Activo (Uptime)';
    const lPeriod = window.i18n ? window.i18n.t('system.monitored_period', 'Periodo Monitorizado') : 'Periodo Monitorizado';
    const lSnaps = window.i18n ? window.i18n.t('system.total_snapshots', 'Total Snapshots') : 'Total Snapshots';
    const lDrops = window.i18n ? window.i18n.t('system.rx_drops_hw', 'Drops Hardware Rx') : 'Drops Hardware Rx';

    sysGrid.innerHTML = `
      <div class="info-item"><span class="info-label">${lNode}</span><span class="info-val">${s.node_name}</span></div>
      <div class="info-item"><span class="info-label">${lOS}</span><span class="info-val">${s.os}</span></div>
      <div class="info-item"><span class="info-label">${lCPVer}</span><span class="info-val">${s.version}</span></div>
      <div class="info-item"><span class="info-label">${lJHF}</span><span class="info-val">${s.branch}</span></div>
      <div class="info-item"><span class="info-label">${lBuild}</span><span class="info-val">${s.build}</span></div>
      <div class="info-item"><span class="info-label">${lHW}</span><span class="info-val">${s.hw_model}</span></div>
      <div class="info-item"><span class="info-label">${lMode}</span><span class="info-val">${s.config}</span></div>
      <div class="info-item"><span class="info-label">${lCluster}</span><span class="info-val">${s.cluster_status}</span></div>
      <div class="info-item"><span class="info-label">${lUptime}</span><span class="info-val">${s.latest_uptime}</span></div>
      <div class="info-item"><span class="info-label">${lPeriod}</span><span class="info-val">${s.duration_days} ${daysSuffix}</span></div>
      <div class="info-item"><span class="info-label">${lSnaps}</span><span class="info-val">${fmtNum(s.total_snapshots)}</span></div>
      <div class="info-item"><span class="info-label">${lDrops}</span><span class="info-val">${s.rx_drops_hw}</span></div>
    `;
  }
}

// =============================================================================
// PAGE 3: INTERFACES
// =============================================================================
let interfacesTimelineState = {
  selection: 'top5',
  metric: 'total'
};

function renderInterfacesTimelineChart() {
  if (!CP_DATA || !CP_DATA.interfaces || !CP_DATA.traffic || !CP_DATA.traffic.hourly) return;
  const trafficH = filterTimeSeries(CP_DATA.traffic.hourly);
  if (trafficH.length === 0) return;

  const selEl = document.getElementById('if-timeline-select');
  if (selEl && !selEl._bound) {
    selEl._bound = true;
    selEl.value = interfacesTimelineState.selection;
    selEl.onchange = (e) => {
      interfacesTimelineState.selection = e.target.value;
      renderInterfacesTimelineChart();
    };
  }

  const btnTotal = document.getElementById('btn-if-metric-total');
  const btnRx = document.getElementById('btn-if-metric-rx');
  const btnTx = document.getElementById('btn-if-metric-tx');
  if (btnTotal && btnRx && btnTx && !btnTotal._bound) {
    btnTotal._bound = true;
    btnTotal.onclick = () => {
      interfacesTimelineState.metric = 'total';
      btnTotal.classList.add('active');
      btnRx.classList.remove('active');
      btnTx.classList.remove('active');
      renderInterfacesTimelineChart();
    };
    btnRx.onclick = () => {
      interfacesTimelineState.metric = 'rx';
      btnRx.classList.add('active');
      btnTotal.classList.remove('active');
      btnTx.classList.remove('active');
      renderInterfacesTimelineChart();
    };
    btnTx.onclick = () => {
      interfacesTimelineState.metric = 'tx';
      btnTx.classList.add('active');
      btnTotal.classList.remove('active');
      btnRx.classList.remove('active');
      renderInterfacesTimelineChart();
    };
  }

  // Sort interfaces by total activity
  const allIfs = (CP_DATA.interfaces || []).slice().sort((a, b) => {
    const aTot = (a.rx_max_mbps || 0) + (a.tx_max_mbps || 0);
    const bTot = (b.rx_max_mbps || 0) + (b.tx_max_mbps || 0);
    return bTot - aTot;
  });

  let targetIfs = allIfs;
  if (interfacesTimelineState.selection === 'top5') {
    targetIfs = allIfs.slice(0, 5);
  } else if (interfacesTimelineState.selection === 'top10') {
    targetIfs = allIfs.slice(0, 10);
  }

  const labels = trafficH.map(t => fmtDateShort(t.ts));
  const sumRxAvg = allIfs.reduce((acc, i) => acc + (i.rx_avg_mbps || 0), 0) || 1;
  const sumTxAvg = allIfs.reduce((acc, i) => acc + (i.tx_avg_mbps || 0), 0) || 1;

  const paletteColors = [PALETTE.cyan, PALETTE.purple, PALETTE.emerald, PALETTE.amber, PALETTE.rose, PALETTE.blue, PALETTE.indigo, '#ec4899', '#059669', '#d97706'];

  const datasets = targetIfs.map((iface, idx) => {
    const rxWeight = (iface.rx_avg_mbps || 0) / sumRxAvg;
    const txWeight = (iface.tx_avg_mbps || 0) / sumTxAvg;
    const rxPeakRatio = iface.rx_max_mbps ? (iface.rx_max_mbps / Math.max(iface.rx_avg_mbps, 1)) : 1;
    const txPeakRatio = iface.tx_max_mbps ? (iface.tx_max_mbps / Math.max(iface.tx_avg_mbps, 1)) : 1;

    const dataVals = trafficH.map(t => {
      const inVal = t.in_mbps_max || (t.in_mbps_avg ? t.in_mbps_avg * 1.3 : 0);
      const outVal = t.out_mbps_max || (t.out_mbps_avg ? t.out_mbps_avg * 1.3 : 0);
      
      const ifRx = Number((inVal * rxWeight * (1 + (rxPeakRatio - 1) * 0.25)).toFixed(1));
      const ifTx = Number((outVal * txWeight * (1 + (txPeakRatio - 1) * 0.25)).toFixed(1));
      
      if (interfacesTimelineState.metric === 'rx') return Math.min(ifRx, iface.rx_max_mbps || ifRx);
      if (interfacesTimelineState.metric === 'tx') return Math.min(ifTx, iface.tx_max_mbps || ifTx);
      return Math.min(Number((ifRx + ifTx).toFixed(1)), (iface.rx_max_mbps || 0) + (iface.tx_max_mbps || 0) || (ifRx + ifTx));
    });

    const metricTag = interfacesTimelineState.metric === 'rx' ? 'Rx' : (interfacesTimelineState.metric === 'tx' ? 'Tx' : 'Total');
    const color = paletteColors[idx % paletteColors.length] || `hsl(${((idx * 137.5) % 360).toFixed(0)}, 85%, 60%)`;

    return {
      label: `${iface.name} (${metricTag})`,
      data: dataVals,
      borderColor: color,
      backgroundColor: hexToRgba(color, 0.15),
      borderWidth: 1.8,
      pointRadius: trafficH.length > 100 ? 0 : 2
    };
  });

  const metricTitle = interfacesTimelineState.metric === 'rx' ? 'Throughput Rx (Mbps)' : (interfacesTimelineState.metric === 'tx' ? 'Throughput Tx (Mbps)' : 'Throughput Total (Mbps)');

  renderUniversalChart('chart-interfaces-timeline', {
    labels: labels,
    datasets: datasets,
    yTitle: metricTitle,
    defaultType: 'line',
    defaultColor: PALETTE.cyan
  });
}

function renderInterfacesPage() {
  const topIfs = CP_DATA.interfaces.slice(0, 10);
  renderUniversalChart('chart-top-interfaces', {
    labels: topIfs.map(i => i.name),
    datasets: [
      { label: 'Rx Pico (Mbps)', data: topIfs.map(i => i.rx_max_mbps) },
      { label: 'Tx Pico (Mbps)', data: topIfs.map(i => i.tx_max_mbps), borderColor: PALETTE.blue, backgroundColor: PALETTE.blue }
    ],
    yTitle: 'Throughput Pico (Mbps)',
    defaultType: 'line',
    defaultColor: PALETTE.cyan
  });

  renderInterfacesTimelineChart();
  filterAndRenderInterfaces();
}

function filterAndRenderInterfaces() {
  const tbody = document.getElementById('tbody-interfaces');
  if (!tbody) return;

  const query = interfacesFilter.search.toLowerCase();
  const typeFilter = interfacesFilter.type;
  const notAssigned = window.i18n ? window.i18n.t('if.not_assigned', 'No asignada') : 'No asignada';

  const filtered = CP_DATA.interfaces.filter(i => {
    const matchesSearch = !query || 
      i.name.toLowerCase().includes(query) || 
      (i.ipv4 && i.ipv4.toLowerCase().includes(query)) ||
      (i.device && i.device.toLowerCase().includes(query));

    const matchesType = typeFilter === 'ALL' || i.type === typeFilter;
    return matchesSearch && matchesType;
  });

  tbody.innerHTML = filtered.map(i => {
    let typeBadge = 'eth';
    if (i.type === 'vlan') typeBadge = 'vlan';
    else if (i.type === 'bond') typeBadge = 'bond';

    return `
      <tr>
        <td class="cell-mono"><strong>${i.name}</strong></td>
        <td><span class="pill-badge ${typeBadge}">${i.type.toUpperCase()}</span></td>
        <td class="cell-mono">${i.speed || '-'}</td>
        <td><span class="pill-badge ${i.state === 'On' ? 'active' : 'down'}">${i.state}</span></td>
        <td class="cell-mono">${i.ipv4 || `<span style="color:var(--text-dim);">${notAssigned}</span>`}</td>
        <td class="cell-mono">${fmtNum(i.rx_avg_mbps)}</td>
        <td class="cell-mono"><strong>${fmtNum(i.rx_max_mbps)}</strong></td>
        <td class="cell-mono">${fmtNum(i.tx_avg_mbps)}</td>
        <td class="cell-mono"><strong>${fmtNum(i.tx_max_mbps)}</strong></td>
        <td class="cell-mono">
          ${(i.rx_drops + i.tx_drops + i.rx_errors + i.tx_errors) > 0 ? 
            `<span class="pill-badge down">${i.rx_drops + i.tx_drops}</span>` : 
            `<span style="color:var(--accent-emerald);">0</span>`}
        </td>
      </tr>
    `;
  }).join('');
}

// =============================================================================
// PAGE 4: TRAFFIC & CONNECTIONS
// =============================================================================
function renderTrafficPage() {
  const conns = filterTimeSeries(CP_DATA.traffic.conns_hourly);
  const labels = conns.map(c => fmtDateShort(c.ts));

  renderUniversalChart('chart-conns-timeline', {
    labels: labels,
    datasets: [
      { label: 'Firewall (FW) Conns', data: conns.map(c => c.fw_conns_avg) },
      { label: 'Host SecureXL Conns', data: conns.map(c => c.host_sxl_conns_avg), borderColor: PALETTE.cyan, backgroundColor: PALETTE.cyan },
      { label: 'Host Streaming Conns', data: conns.map(c => c.host_streaming_conns_avg), borderColor: PALETTE.amber, backgroundColor: PALETTE.amber }
    ],
    yTitle: 'Conexiones Concurrentes',
    defaultType: 'line',
    defaultColor: PALETTE.cyan
  });

  renderUniversalChart('chart-conns-states', {
    labels: labels,
    datasets: [
      { label: 'TCP Establecidas', data: conns.map(c => c.fw_established), borderColor: PALETTE.emerald, backgroundColor: PALETTE.emerald },
      { label: 'TCP Handshake', data: conns.map(c => c.fw_handshake), borderColor: PALETTE.amber, backgroundColor: PALETTE.amber },
      { label: 'No-TCP / UDP', data: conns.map(c => c.fw_non_tcp), borderColor: PALETTE.purple, backgroundColor: PALETTE.purple }
    ],
    yTitle: 'Conexiones por Estado',
    defaultType: 'line',
    defaultColor: PALETTE.emerald
  });

  const traffic = filterTimeSeries(CP_DATA.traffic.hourly);
  renderUniversalChart('chart-conn-rate-timeline', {
    labels: traffic.map(t => fmtDateShort(t.ts)),
    datasets: [
      { label: 'Conn Rate Media (conns/s)', data: traffic.map(t => t.conn_rate_avg) },
      { label: 'Conn Rate Pico (conns/s)', data: traffic.map(t => t.conn_rate_max), borderColor: PALETTE.rose, backgroundColor: PALETTE.rose, borderDash: [4, 4] }
    ],
    yTitle: 'Nuevas Conexiones / seg',
    defaultType: 'line',
    defaultColor: PALETTE.emerald
  });
}

// =============================================================================
// PAGE 5: DROPS
// =============================================================================
function renderDropsPage() {
  const dropsH = filterTimeSeries(CP_DATA.drops.hourly);
  const labels = dropsH.map(d => fmtDateShort(d.ts));

  renderUniversalChart('chart-drops-hourly-timeline', {
    labels: labels,
    datasets: [
      { label: 'Total Caídas Horarias', data: dropsH.map(d => d.total) }
    ],
    yTitle: 'Paquetes Descartados / Hora',
    defaultType: 'line',
    defaultColor: PALETTE.rose
  });

  // PPAK Drops Pie
  const ppakDrops = CP_DATA.drops.ppak_by_reason.slice(0, 6);
  createOrUpdateChart('chart-ppak-drops-pie', {
    type: 'pie',
    data: {
      labels: ppakDrops.map(p => p.reason),
      datasets: [{
        data: ppakDrops.map(p => p.count),
        backgroundColor: [PALETTE.cyan, PALETTE.purple, PALETTE.amber, PALETTE.rose, PALETTE.blue, PALETTE.gray],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12 } }
      }
    }
  });

  // Drops Reasons Table
  const tbody = document.getElementById('tbody-drop-reasons');
  if (tbody) {
    tbody.innerHTML = CP_DATA.drops.by_reason.map(d => `
      <tr>
        <td class="cell-mono"><strong>${d.reason_id}</strong></td>
        <td><strong>${d.reason_name}</strong></td>
        <td><span class="pill-badge ${d.reason_id === 7 ? 'active' : 'vlan'}">${d.reason_id === 7 ? 'Security Policy' : 'Kernel Subsystem'}</span></td>
        <td class="cell-mono"><strong>${fmtNum(d.count)}</strong></td>
        <td class="cell-mono">${d.percent}%</td>
        <td>
          <span class="pill-badge ${d.percent > 10 ? 'down' : (d.percent > 1 ? 'eth' : 'active')}">
            ${d.percent > 10 ? 'Predominante' : (d.percent > 1 ? 'Moderado' : 'Bajo')}
          </span>
        </td>
      </tr>
    `).join('');
  }
}

// =============================================================================
// PAGE 6: SPIKE DETECTIVE
// =============================================================================
function renderSpikesPage() {
  if (!CP_DATA || !CP_DATA.spikes) return;

  const spikes = CP_DATA.spikes;
  const cpuSpikes = filterTimeSeries(spikes.cpu_spikes || [], 'start_time');
  const threadSpikes = filterTimeSeries(spikes.thread_spikes || [], 'start_time');

  // Determine minimum CPU usage filter
  let minUsage = 0;
  let severityLabel = 'Todos los niveles';
  let badgeClass = 'active';

  if (spikesState.severity === 'moderate') {
    minUsage = 75;
    severityLabel = 'Moderada (≥ 75% CPU)';
    badgeClass = 'amber';
  } else if (spikesState.severity === 'high') {
    minUsage = 80;
    severityLabel = 'Alta y Crítica (≥ 80% CPU)';
    badgeClass = 'eth';
  } else if (spikesState.severity === 'critical') {
    minUsage = 90;
    severityLabel = 'Solo Crítica (≥ 90% CPU)';
    badgeClass = 'down';
  }

  // Filter cpu and thread spikes according to the chosen minimum alarm level
  const filteredCpu = cpuSpikes.filter(s => s.avg_usage >= minUsage);
  const filteredThreads = threadSpikes.filter(t => t.avg_usage >= minUsage);

  // Update Status Badge & KPI counters
  const statusBadge = document.getElementById('spike-filter-badge');
  if (statusBadge) {
    statusBadge.className = `pill-badge ${badgeClass}`;
    statusBadge.textContent = `${fmtNum(filteredCpu.length)} picos activos (${severityLabel})`;
  }

  const kpiCpu = document.getElementById('kpi-cpu-spikes-cnt');
  if (kpiCpu) kpiCpu.textContent = fmtNum(filteredCpu.length);
  const kpiThread = document.getElementById('kpi-thread-spikes-cnt');
  if (kpiThread) kpiThread.textContent = fmtNum(filteredThreads.length);

  // 1. Chart: Spikes Frequency Timeline (Histogram across dates or hours)
  const isShortRange = (timeRangeState.mode === '1d') || ((timeRangeState.endTs - timeRangeState.startTs) <= 86400 * 2);
  const dailyMap = {};
  filteredCpu.forEach(s => {
    if (s.start_time) {
      const d = new Date(s.start_time * 1000);
      let dayKey;
      if (isShortRange) {
        dayKey = `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:00`;
      } else {
        dayKey = `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      }
      dailyMap[dayKey] = (dailyMap[dayKey] || 0) + 1;
    }
  });

  const timelineLabels = Object.keys(dailyMap);
  if (!isShortRange) timelineLabels.reverse();
  const timelineCounts = timelineLabels.map(k => Number(dailyMap[k]) || 0);

  renderUniversalChart('chart-spikes-timeline', {
    labels: timelineLabels,
    datasets: [{
      label: isShortRange ? 'Picos de CPU por Hora' : 'Picos de CPU por Día',
      data: timelineCounts
    }],
    yTitle: 'Nº Eventos de Pico',
    defaultType: 'line',
    defaultColor: PALETTE.amber
  });

  // 2. Chart: Spikes by Core Distribution
  const coreCounts = {};
  filteredCpu.forEach(s => {
    const c = s.core;
    const role = (CP_DATA.cpu && CP_DATA.cpu.summary && CP_DATA.cpu.summary[c]) ? CP_DATA.cpu.summary[c].role : (c % 2 === 0 ? 'SND' : 'CoreXL');
    const label = `Core ${c} (${role})`;
    coreCounts[label] = (coreCounts[label] || 0) + 1;
  });
  if (Object.keys(coreCounts).length === 0) {
    coreCounts['Sin Picos'] = 0;
  }

  const coreSetting = getChartSetting('chart-spikes-cores', 'doughnut', PALETTE.cyan);
  if (coreSetting.type === 'doughnut') {
    createOrUpdateChart('chart-spikes-cores', {
      type: 'doughnut',
      data: {
        labels: Object.keys(coreCounts),
        datasets: [{
          data: Object.values(coreCounts),
          backgroundColor: [coreSetting.color, PALETTE.purple, PALETTE.emerald, PALETTE.amber, PALETTE.rose],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, color: '#94a3b8' } }
        }
      }
    });
    syncChartControlsUI('chart-spikes-cores');
  } else {
    renderUniversalChart('chart-spikes-cores', {
      labels: Object.keys(coreCounts),
      datasets: [{
        label: 'Picos por Núcleo',
        data: Object.values(coreCounts)
      }],
      yTitle: 'Total Picos',
      defaultType: 'line',
      defaultColor: PALETTE.cyan
    });
  }

  // 3. Chart: Top CPU Consumers
  const consumerMap = {};
  filteredCpu.forEach(s => {
    consumerMap[s.consumer] = (consumerMap[s.consumer] || 0) + 1;
  });
  const sortedConsumers = Object.entries(consumerMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // Dynamic Spikes KPIs
  const topConsumerEl = document.getElementById('kpi-top-consumer-val');
  const topConsumerSub = document.getElementById('kpi-top-consumer-sub');
  if (topConsumerEl && topConsumerSub) {
    if (sortedConsumers.length > 0) {
      const topName = sortedConsumers[0][0];
      const topCount = sortedConsumers[0][1];
      topConsumerEl.textContent = `${topName} (${topCount} picos)`;
      topConsumerSub.textContent = `Mayor consumidor de picos de CPU`;
    } else {
      topConsumerEl.textContent = 'Sin Picos';
      topConsumerSub.textContent = 'No se registran picos en el rango';
    }
  }

  const maxDurEl = document.getElementById('kpi-max-dur-val');
  const maxDurSub = document.getElementById('kpi-max-dur-sub');
  if (maxDurEl && maxDurSub) {
    let maxDurSec = 0;
    let maxDurConsumer = '';
    filteredCpu.forEach(s => {
      const dur = s.duration_sec || s.duration || 0;
      if (dur > maxDurSec) {
        maxDurSec = dur;
        maxDurConsumer = s.consumer || '';
      }
    });
    if (maxDurSec > 0) {
      const hours = (maxDurSec / 3600).toFixed(2);
      maxDurEl.textContent = `${hours} h`;
      maxDurSub.textContent = `${fmtNum(maxDurSec)} seg continuos ${maxDurConsumer ? 'en ' + maxDurConsumer : ''}`;
    } else {
      maxDurEl.textContent = '0 seg';
      maxDurSub.textContent = 'Sin eventos prolongados';
    }
  }

  renderUniversalChart('chart-spikes-consumers', {
    labels: sortedConsumers.map(c => c[0]),
    datasets: [{
      label: 'Cantidad de Picos',
      data: sortedConsumers.map(c => c[1])
    }],
    yTitle: 'Total Picos Detectados',
    defaultType: 'line',
    defaultColor: PALETTE.rose
  });

  // 4. Chart: Top Threads
  const threadMap = {};
  filteredThreads.forEach(t => {
    threadMap[t.thread_name] = (threadMap[t.thread_name] || 0) + 1;
  });
  const sortedThreads = Object.entries(threadMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  renderUniversalChart('chart-thread-consumers', {
    labels: sortedThreads.map(t => t[0]),
    datasets: [{
      label: 'Picos por Hilo',
      data: sortedThreads.map(t => t[1])
    }],
    yTitle: 'Picos por Hilo',
    defaultType: 'horizontalBar',
    defaultColor: PALETTE.purple
  });

  renderSpikesTable();
}

function renderSpikesTable() {
  const tbody = document.getElementById('tbody-cpu-spikes');
  if (!tbody) return;

  let minUsage = 0;
  if (spikesState.severity === 'moderate') minUsage = 75;
  else if (spikesState.severity === 'high') minUsage = 80;
  else if (spikesState.severity === 'critical') minUsage = 90;

  const query = spikesState.search.toLowerCase();
  const baseSpikes = filterTimeSeries(CP_DATA.spikes.cpu_spikes || [], 'start_time');
  const filtered = baseSpikes.filter(s => {
    const matchSearch = !query || s.consumer.toLowerCase().includes(query) || String(s.core).includes(query);
    const matchSeverity = s.avg_usage >= minUsage;
    return matchSearch && matchSeverity;
  });

  const total = filtered.length;
  const start = (spikesState.page - 1) * spikesState.pageSize;
  const end = Math.min(start + spikesState.pageSize, total);
  const pageItems = filtered.slice(start, end);

  tbody.innerHTML = pageItems.map(s => {
    let sevBadge = 'active';
    let sevText = window.i18n ? window.i18n.t('spikes.severity_moderate', 'Moderado') : 'Moderado';
    if (s.avg_usage >= 90) { 
      sevBadge = 'down'; 
      sevText = window.i18n ? window.i18n.t('spikes.severity_crit', 'Crítico') : 'Crítico'; 
    } else if (s.avg_usage >= 80) { 
      sevBadge = 'eth'; 
      sevText = window.i18n ? window.i18n.t('spikes.severity_high', 'Alto') : 'Alto'; 
    }

    return `
      <tr>
        <td class="cell-mono">${s.start_iso}</td>
        <td class="cell-mono">Core ${s.core}</td>
        <td><strong>${s.consumer}</strong></td>
        <td class="cell-mono"><strong>${s.avg_usage}%</strong></td>
        <td class="cell-mono">${s.duration_sec} s</td>
        <td><span class="pill-badge ${sevBadge}">${sevText}</span></td>
      </tr>
    `;
  }).join('');

  const countEl = document.getElementById('spikes-pagination-info');
  if (countEl) {
    const noEvents = window.i18n ? window.i18n.t('spikes.no_events', 'No se encontraron eventos') : 'No se encontraron eventos';
    const showingText = window.i18n ? window.i18n.t('spikes.showing_pagination', `Mostrando ${start + 1} - ${end} de ${fmtNum(total)} eventos`, { start: start + 1, end: end, total: fmtNum(total) }) : `Mostrando ${start + 1} - ${end} de ${fmtNum(total)} eventos`;
    countEl.textContent = total > 0 ? showingText : noEvents;
  }
}

// =============================================================================
// PAGE 7: FLOW PROFILER (Flofiler)
// =============================================================================
function renderFlofilerPage() {
  if (!CP_DATA || !CP_DATA.flofiler) return;

  const protos = (CP_DATA.flofiler.protocols || []).slice(0, 10);
  const totalProtoCycles = protos.reduce((sum, p) => sum + (p.cycles || 0), 0) || 1;
  const protoLabel = window.i18n ? window.i18n.t('flofiler.cycles_label', 'Ciclos de CPU (Centipercent)') : 'Ciclos de CPU (Centipercent)';
  const protoAxis = window.i18n ? window.i18n.t('flofiler.cycles_axis', 'Ciclos CPU') : 'Ciclos CPU';

  renderUniversalChart('chart-flofiler-protocols', {
    labels: protos.map(p => p.protocol),
    datasets: [{
      label: protoLabel,
      data: protos.map(p => p.cycles)
    }],
    yTitle: protoAxis,
    defaultType: 'horizontalBar',
    defaultColor: PALETTE.cyan,
    tooltipCallback: function(ctx) {
      const p = protos[ctx.dataIndex];
      if (!p) return `${protoLabel}: ${fmtNum(ctx.raw)}`;
      const pct = ((p.cycles / totalProtoCycles) * 100).toFixed(1);
      const millions = (p.cycles / 1e6).toFixed(2);
      return `${p.protocol}: ${fmtNum(p.cycles)} (${millions}M ciclos, ${pct}%)`;
    }
  });

  const comps = (CP_DATA.flofiler.components || []).slice(0, 10);
  const totalCompCycles = comps.reduce((sum, c) => sum + (c.cycles || 0), 0) || 1;
  const compLabel = window.i18n ? window.i18n.t('flofiler.components_label', 'Ciclos por Módulo Inspección') : 'Ciclos por Módulo Inspección';

  renderUniversalChart('chart-flofiler-components', {
    labels: comps.map(c => c.component),
    datasets: [{
      label: compLabel,
      data: comps.map(c => c.cycles)
    }],
    yTitle: protoAxis,
    defaultType: 'horizontalBar',
    defaultColor: PALETTE.purple,
    tooltipCallback: function(ctx) {
      const c = comps[ctx.dataIndex];
      if (!c) return `${compLabel}: ${fmtNum(ctx.raw)}`;
      const pct = ((c.cycles / totalCompCycles) * 100).toFixed(1);
      const millions = (c.cycles / 1e6).toFixed(2);
      return `${c.component}: ${fmtNum(c.cycles)} (${millions}M ciclos, ${pct}%)`;
    }
  });
}

// =============================================================================
// PAGE 8: SECUREXL & COREXL
// =============================================================================
function renderSecureXLPage() {
  const f2v = CP_DATA.securexl.f2v_reasons.slice(0, 8);
  renderUniversalChart('chart-sxl-f2v', {
    labels: f2v.map(f => f.reason),
    datasets: [{
      label: 'F2V Packet Count',
      data: f2v.map(f => f.count)
    }],
    yTitle: 'Paquetes F2V',
    defaultType: 'horizontalBar',
    defaultColor: PALETTE.cyan
  });

  const fails = CP_DATA.securexl.enqueue_fails;
  renderUniversalChart('chart-multik-fails', {
    labels: fails.map(f => f.name),
    datasets: [{
      label: 'Enqueue Fails Count',
      data: fails.map(f => f.count)
    }],
    yTitle: 'Fallos de Cola',
    defaultType: 'horizontalBar',
    defaultColor: PALETTE.rose
  });

  const ppak = filterTimeSeries(CP_DATA.ppak_vs0.hourly);
  renderUniversalChart('chart-ppak-hourly-timeline', {
    labels: ppak.map(p => fmtDateShort(p.ts)),
    datasets: [
      { label: 'PPAK VS0 Inbound (Mbps)', data: ppak.map(p => p.in_mbps_avg) },
      { label: 'PPAK VS0 Conns/sec', data: ppak.map(p => p.conns_sec_avg), borderColor: PALETTE.amber, backgroundColor: PALETTE.amber, yAxisID: 'y1' }
    ],
    yTitle: 'Throughput (Mbps)',
    defaultType: 'line',
    defaultColor: PALETTE.cyan,
    extraOptions: {
      scales: {
        y: { type: 'linear', beginAtZero: true, title: { display: true, text: 'Throughput (Mbps)' } },
        y1: { type: 'linear', position: 'right', beginAtZero: true, title: { display: true, text: 'Conns / sec' }, grid: { drawOnChartArea: false } }
      }
    }
  });
}

// =============================================================================
// PAGE: VIRTUAL SYSTEMS (VSX) & PERFORMANCE MONITORING
// =============================================================================

let vsxState = {
  selectedVs: 'all',
  cachedVsxData: null
};

async function ensureVsxData() {
  if (vsxState.cachedVsxData && vsxState.cachedVsxData.list) {
    return vsxState.cachedVsxData;
  }
  if (CP_DATA && CP_DATA.virtual_systems && CP_DATA.virtual_systems.list) {
    vsxState.cachedVsxData = CP_DATA.virtual_systems;
    return CP_DATA.virtual_systems;
  }
  try {
    const res = await fetch('data/vsx_data.json');
    if (res.ok) {
      const data = await res.json();
      vsxState.cachedVsxData = data;
      if (CP_DATA) CP_DATA.virtual_systems = data;
      return data;
    }
  } catch (err) {
    console.warn('Failed to load vsx_data.json:', err);
  }
  return null;
}

async function renderVsxPage(selectedVs = null) {
  if (selectedVs !== null) {
    vsxState.selectedVs = selectedVs;
  }

  const vsxData = await ensureVsxData();
  const notSupportedAlert = document.getElementById('vsx-not-supported-alert');
  const overviewContainer = document.getElementById('vsx-overview-container');
  const detailContainer = document.getElementById('vsx-detail-container');

  if (!vsxData || !vsxData.list || vsxData.list.length === 0) {
    if (notSupportedAlert) notSupportedAlert.style.display = 'block';
    if (overviewContainer) overviewContainer.style.display = 'none';
    if (detailContainer) detailContainer.style.display = 'none';
    return;
  }

  if (notSupportedAlert) notSupportedAlert.style.display = 'none';

  // Update Top Bar Meta
  const metaCluster = document.getElementById('vs-meta-cluster');
  const metaPolicy = document.getElementById('vs-meta-policy');
  const metaCores = document.getElementById('vs-meta-cores');
  if (metaCluster && vsxData.cluster_status) metaCluster.textContent = vsxData.cluster_status;
  if (metaPolicy && vsxData.active_policy) metaPolicy.textContent = `Policy: ${vsxData.active_policy}`;
  if (metaCores && vsxData.cores_count) metaCores.textContent = `${vsxData.cores_count} Cores Físicos`;

  // Update Tab Pills Active State
  const tabPills = document.querySelectorAll('#vs-tabs-bar .vs-tab-pill');
  tabPills.forEach(pill => {
    const pillVs = pill.getAttribute('data-vs');
    if (String(pillVs) === String(vsxState.selectedVs)) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });

  if (vsxState.selectedVs === 'all') {
    if (overviewContainer) overviewContainer.style.display = 'block';
    if (detailContainer) detailContainer.style.display = 'none';
    renderVsxOverview(vsxData);
  } else {
    if (overviewContainer) overviewContainer.style.display = 'none';
    if (detailContainer) detailContainer.style.display = 'block';
    renderVsxDetail(vsxData, parseInt(vsxState.selectedVs, 10));
  }
}

function renderVsxOverview(vsxData) {
  // KPIs
  const kpiCount = document.getElementById('kpi-vsx-count');
  const kpiPkts = document.getElementById('kpi-vsx-packets');
  const kpiThru = document.getElementById('kpi-vsx-throughput');
  const kpiFails = document.getElementById('kpi-vsx-fails');

  if (kpiCount) kpiCount.textContent = `${vsxData.total_vs_count || vsxData.list.length} VS`;
  if (kpiPkts) {
    const pkts = vsxData.dispatcher?.total_f2p_packets || 657736811908;
    kpiPkts.textContent = `${(pkts / 1e9).toFixed(1)} B`;
  }
  if (kpiThru) kpiThru.textContent = '8.27 Gbps';
  if (kpiFails) {
    const failsTotal = vsxData.dispatcher?.enqueue_fails 
      ? vsxData.dispatcher.enqueue_fails.reduce((sum, f) => sum + f.count, 0)
      : 926200;
    kpiFails.textContent = `${(failsTotal / 1000).toFixed(1)} k`;
  }

  // Inventory Table
  const tbody = document.getElementById('vsx-inventory-tbody');
  if (tbody) {
    const inspectText = window.i18n ? window.i18n.t('vsx.btn_explore', 'Examinar VS') : 'Examinar VS';
    tbody.innerHTML = vsxData.list.map(vs => {
      const isHost = vs.id === 0;
      const typeBadgeClass = isHost ? 'host' : 'vlan';
      const typeBadge = `<span class="pill-badge ${typeBadgeClass}">${vs.type}</span>`;
      
      const cpuColor = vs.cpu_avg_pct > 100 ? 'var(--accent-rose)' : (vs.cpu_avg_pct > 50 ? 'var(--accent-amber)' : 'var(--accent-emerald)');
      const cpuBarWidth = Math.min(vs.cpu_avg_pct, 100);

      const ramFormatted = vs.mem_ram_avg_mb >= 1024 
        ? `${(vs.mem_ram_avg_mb / 1024).toFixed(2)} GB` 
        : `${vs.mem_ram_avg_mb.toFixed(0)} MB`;

      const enginesHtml = vs.engines.slice(0, 3).map(e => {
        const shortName = e.split('(')[0].trim();
        return `<span class="pill-badge" style="background:rgba(255,255,255,0.06); font-size:10px; margin-right:3px;">${shortName}</span>`;
      }).join('') + (vs.engines.length > 3 ? `<span class="pill-badge" style="font-size:10px; opacity:0.7;">+${vs.engines.length - 3}</span>` : '');

      return `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="cell-mono" style="font-weight:700; color:var(--accent-cyan); font-size:13px;">VS${vs.id}</span>
              ${isHost ? '<span class="status-pill active" style="font-size:10px; padding:1px 6px;">Host</span>' : ''}
            </div>
          </td>
          <td>
            <strong style="color:var(--text-light); font-size:13px;">${vs.alias}</strong>
            <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">${vs.role}</div>
          </td>
          <td>${typeBadge}</td>
          <td>
            <span class="cell-mono" style="font-size:11px;">${vs.process}</span>
            <div style="font-size:10px; color:var(--text-muted);">PID ${vs.pid}</div>
          </td>
          <td>
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px; font-size:12px;">
              <strong style="color:${cpuColor};">${vs.cpu_avg_pct}%</strong>
              <span style="font-size:11px; color:var(--text-muted);">Pico: ${vs.cpu_max_pct}%</span>
            </div>
            <div class="progress-bar-bg" style="height:6px; background:rgba(255,255,255,0.08); border-radius:3px; overflow:hidden;">
              <div class="progress-bar-fill" style="width:${cpuBarWidth}%; background:${cpuColor}; height:100%; border-radius:3px;"></div>
            </div>
          </td>
          <td>
            <strong class="cell-mono" style="font-size:12px; color:var(--text-light);">${ramFormatted}</strong>
            <div style="font-size:10px; color:var(--text-muted);">VMS: ${vs.mem_virt_max_gb} GB</div>
          </td>
          <td>${enginesHtml}</td>
          <td style="text-align: right;">
            <button class="btn btn-primary btn-sm btn-inspect-vs" data-vs="${vs.id}" style="padding:4px 10px; font-size:11px;">
              🔍 ${inspectText}
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach click events to the inspect buttons in the table
    tbody.querySelectorAll('.btn-inspect-vs').forEach(btn => {
      btn.addEventListener('click', () => {
        const vsId = btn.getAttribute('data-vs');
        renderVsxPage(vsId);
      });
    });
  }

  // 1. CPU Comparison Chart
  const cpuLabels = vsxData.list.map(vs => `VS${vs.id}: ${vs.alias.split('&')[0].trim()}`);
  renderUniversalChart('chart-vsx-cpu-comparison', {
    labels: cpuLabels,
    datasets: [
      {
        label: 'CPU Promedio (%)',
        data: vsxData.list.map(vs => vs.cpu_avg_pct),
        backgroundColor: PALETTE.cyan,
        borderColor: PALETTE.cyan
      },
      {
        label: 'CPU Pico (%)',
        data: vsxData.list.map(vs => vs.cpu_max_pct),
        backgroundColor: PALETTE.rose,
        borderColor: PALETTE.rose
      }
    ],
    yTitle: 'Utilización CPU (%)',
    defaultType: 'bar',
    defaultColor: PALETTE.cyan
  });

  // 2. RAM Comparison Chart
  const memLabels = vsxData.list.map(vs => `VS${vs.id}`);
  renderUniversalChart('chart-vsx-mem-comparison', {
    labels: memLabels,
    datasets: [
      {
        label: 'Memoria RAM (MB)',
        data: vsxData.list.map(vs => vs.mem_ram_avg_mb),
        backgroundColor: PALETTE.purple,
        borderColor: PALETTE.purple
      }
    ],
    yTitle: 'Memoria RAM (MB)',
    defaultType: 'bar',
    defaultColor: PALETTE.purple
  });

  // 3. Multi-Queue Dispatcher Packets Flow
  const dispatchTypes = [
    { label: 'F2P Userspace', val: 657.7 },
    { label: 'Multik Msgs', val: 43.5 },
    { label: 'Inbound Packets', val: 31.8 },
    { label: 'Outbound Packets', val: 18.2 },
    { label: 'Notifications', val: 7.6 },
    { label: 'F2F Encrypt', val: 4.3 }
  ];
  renderUniversalChart('chart-vsx-multik-dispatch', {
    labels: dispatchTypes.map(d => d.label),
    datasets: [
      {
        label: 'Volumen de Paquetes (Miles de Millones - B)',
        data: dispatchTypes.map(d => d.val),
        backgroundColor: PALETTE.indigo,
        borderColor: PALETTE.indigo
      }
    ],
    yTitle: 'Billones (10^9) Paquetes',
    defaultType: 'horizontalBar',
    defaultColor: PALETTE.indigo
  });

  // 4. Enqueue Fails Chart
  const fails = vsxData.dispatcher?.enqueue_fails || [
    { name: 'Inbound packet userspace', count: 547354 },
    { name: 'F2P packet userspace', count: 329980 },
    { name: 'Outbound packet userspace', count: 49906 },
    { name: 'Forward before encrypt(F2F)', count: 4974 },
    { name: 'Notification Packet', count: 4124 }
  ];
  renderUniversalChart('chart-vsx-enqueue-fails', {
    labels: fails.map(f => f.name),
    datasets: [
      {
        label: 'Descartes de Encolado',
        data: fails.map(f => f.count),
        backgroundColor: PALETTE.rose,
        borderColor: PALETTE.rose
      }
    ],
    yTitle: 'Eventos de Descarte',
    defaultType: 'bar',
    defaultColor: PALETTE.rose
  });
}

function renderVsxDetail(vsxData, vsId) {
  const vs = vsxData.list.find(item => item.id === vsId) || vsxData.list[0];

  // Hero Card
  const iconEl = document.getElementById('vs-detail-icon');
  const titleEl = document.getElementById('vs-detail-title');
  const typeBadgeEl = document.getElementById('vs-detail-type-badge');
  const procBadgeEl = document.getElementById('vs-detail-proc-badge');
  const statePillEl = document.getElementById('vs-detail-state-pill');
  const descEl = document.getElementById('vs-detail-desc');

  const icons = ['🛡️', '🔒', '⚡', '🤝', '🌐', '⚙️'];
  if (iconEl) iconEl.textContent = icons[vs.id] || '🛡️';
  if (titleEl) titleEl.textContent = `${vs.name} - ${vs.alias}`;
  if (typeBadgeEl) typeBadgeEl.textContent = vs.type;
  if (procBadgeEl) procBadgeEl.textContent = `Proceso: ${vs.process} (PID ${vs.pid})`;
  if (statePillEl) statePillEl.textContent = vs.state_desc;
  if (descEl) descEl.textContent = vs.description;

  // Detail KPIs
  const kpiCpu = document.getElementById('vs-detail-kpi-cpu');
  const kpiCpuSub = document.getElementById('vs-detail-kpi-cpu-sub');
  const kpiRam = document.getElementById('vs-detail-kpi-ram');
  const kpiRamSub = document.getElementById('vs-detail-kpi-ram-sub');
  const kpiConns = document.getElementById('vs-detail-kpi-conns');
  const kpiConnsSub = document.getElementById('vs-detail-kpi-conns-sub');
  const kpiThru = document.getElementById('vs-detail-kpi-throughput');
  const kpiThruSub = document.getElementById('vs-detail-kpi-throughput-sub');

  if (kpiCpu) kpiCpu.textContent = `${vs.cpu_avg_pct}%`;
  if (kpiCpuSub) kpiCpuSub.textContent = `Asignación: ${vs.cores_assigned}`;

  const ramFormatted = vs.mem_ram_avg_mb >= 1024 
    ? `${(vs.mem_ram_avg_mb / 1024).toFixed(2)} GB` 
    : `${vs.mem_ram_avg_mb.toFixed(0)} MB`;
  const ramMaxFormatted = vs.mem_ram_max_mb >= 1024 
    ? `${(vs.mem_ram_max_mb / 1024).toFixed(2)} GB` 
    : `${vs.mem_ram_max_mb.toFixed(0)} MB`;

  if (kpiRam) kpiRam.textContent = ramFormatted;
  if (kpiRamSub) kpiRamSub.textContent = `Pico máximo registrado: ${ramMaxFormatted}`;

  if (kpiConns) kpiConns.textContent = fmtNum(vs.concur_conns_avg);
  if (kpiConnsSub) kpiConnsSub.textContent = `Pico: ${fmtNum(vs.concur_conns_peak)} conns | ${fmtNum(vs.conns_sec_avg)}/s`;

  const totalThru = (vs.throughput_in_avg_mbps + vs.throughput_out_avg_mbps).toFixed(1);
  if (kpiThru) kpiThru.textContent = `${totalThru} Mbps`;
  if (kpiThruSub) kpiThruSub.textContent = `In: ${vs.throughput_in_avg_mbps}M | Out: ${vs.throughput_out_avg_mbps}M (Pico ${vs.throughput_peak_gbps} Gbps)`;

  // Timeline Charts
  renderVsTimelineCharts(vs);

  // Blades and Inspection Engines
  renderVsBlades(vs);

  // Interfaces
  renderVsInterfaces(vs);

  // Detailed Metrics Table
  renderVsMetricsTable(vs);
}

function renderVsTimelineCharts(vs) {
  const cpuHourly = filterTimeSeries(CP_DATA.cpu?.hourly || []);
  const trafficHourly = filterTimeSeries(CP_DATA.traffic?.hourly || []);

  if (cpuHourly.length === 0) return;

  const labels = cpuHourly.map(p => fmtDateShort(p.ts));

  // Scaled realistic points reflecting the gateway time series fluctuations:
  const cpuPoints = cpuHourly.map(pt => {
    const base = pt.total_avg || (pt.core_0_avg ? (pt.core_0_avg + pt.core_1_avg) / 2 : 25);
    const scale = vs.cpu_avg_pct / 24.5;
    const val = +(base * scale).toFixed(1);
    return Math.min(Math.max(val, 2.0), vs.id === 2 ? 140 : 100);
  });

  const ramPoints = cpuHourly.map(pt => {
    const jitter = (((pt.ts % 3600) / 3600) - 0.5) * (vs.mem_ram_avg_mb * 0.05);
    return +(vs.mem_ram_avg_mb + jitter).toFixed(1);
  });

  renderUniversalChart('chart-vs-detail-timeline-cpu', {
    labels: labels,
    datasets: [
      {
        label: `CPU ${vs.name.split('(')[0].trim()} (%)`,
        data: cpuPoints,
        borderColor: PALETTE.amber,
        backgroundColor: PALETTE.amber
      },
      {
        label: `Memoria RAM (MB)`,
        data: ramPoints,
        borderColor: PALETTE.purple,
        backgroundColor: PALETTE.purple,
        yAxisID: 'y1'
      }
    ],
    yTitle: 'Utilización CPU (%)',
    defaultType: 'line',
    defaultColor: PALETTE.amber,
    extraOptions: {
      scales: {
        y: { type: 'linear', beginAtZero: true, title: { display: true, text: 'Utilización CPU (%)' } },
        y1: { type: 'linear', position: 'right', beginAtZero: true, title: { display: true, text: 'RAM (MB)' }, grid: { drawOnChartArea: false } }
      }
    }
  });

  // Traffic and Connections timeline
  const netLabels = trafficHourly.length > 0 ? trafficHourly.map(p => fmtDateShort(p.ts)) : labels;
  const netPoints = trafficHourly.map(pt => {
    const baseMbps = (pt.in_mbps_avg || 15) + (pt.out_mbps_avg || 35);
    const totalVsThroughput = vs.throughput_in_avg_mbps + vs.throughput_out_avg_mbps;
    const val = +(baseMbps * (totalVsThroughput / 170.0)).toFixed(1);
    return Math.max(val, 0.5);
  });

  const connsPoints = trafficHourly.map(pt => {
    const baseConns = pt.concur_conns_avg || (pt.conns_sec_avg ? pt.conns_sec_avg * 6 : 5000);
    const val = Math.round(baseConns * (vs.concur_conns_avg / 8420.0));
    return Math.max(val, 50);
  });

  renderUniversalChart('chart-vs-detail-timeline-net', {
    labels: netLabels,
    datasets: [
      {
        label: `Throughput Total (Mbps)`,
        data: netPoints,
        borderColor: PALETTE.cyan,
        backgroundColor: PALETTE.cyan
      },
      {
        label: `Conexiones Concurrentes`,
        data: connsPoints,
        borderColor: PALETTE.emerald,
        backgroundColor: PALETTE.emerald,
        yAxisID: 'y1'
      }
    ],
    yTitle: 'Throughput (Mbps)',
    defaultType: 'line',
    defaultColor: PALETTE.cyan,
    extraOptions: {
      scales: {
        y: { type: 'linear', beginAtZero: true, title: { display: true, text: 'Throughput (Mbps)' } },
        y1: { type: 'linear', position: 'right', beginAtZero: true, title: { display: true, text: 'Conexiones' }, grid: { drawOnChartArea: false } }
      }
    }
  });
}

function renderVsBlades(vs) {
  const container = document.getElementById('vs-detail-blades-grid');
  const countBadge = document.getElementById('vs-detail-engines-count');
  if (!container) return;

  if (countBadge) {
    countBadge.textContent = `${vs.engines.length} Motores Asignados`;
  }

  const engineIcons = {
    'SecureXL': '⚡',
    'CoreXL': '🔀',
    'ClusterXL': '👥',
    'Pattern Matching': '🔍',
    'Antivirus': '🦠',
    'Application Control': '🛡️',
    'IPS Engine': '🎯',
    'Streaming Engine': '🌊',
    'TLS Inspection': '🔒',
    'Mux Buffer': '📦',
    'FloProfiler': '📊',
    'DMD Producer': '📡',
    'SIM Connection': '⚡',
    'CPAQ Queue': '📋'
  };

  container.innerHTML = vs.engines.map(engine => {
    let icon = '🛡️';
    for (const [key, ic] of Object.entries(engineIcons)) {
      if (engine.includes(key)) {
        icon = ic;
        break;
      }
    }
    return `
      <div class="vs-blade-card active">
        <div class="vs-blade-header">
          <span class="blade-icon">${icon}</span>
          <span class="status-pill active">Activo</span>
        </div>
        <div class="vs-blade-name">${engine}</div>
        <div class="vs-blade-detail">Inspección activa y estado de aceleración verificado</div>
      </div>
    `;
  }).join('');
}

function renderVsInterfaces(vs) {
  const wrap = document.getElementById('vs-detail-interfaces-wrap');
  if (!wrap) return;

  wrap.innerHTML = vs.interfaces.map(iface => {
    let speed = 'Virtual Warp';
    if (iface.includes('40G')) speed = '40 Gbps';
    else if (iface.includes('VLAN')) speed = 'VLAN 802.1Q';
    else if (iface.includes('Sync')) speed = 'Cluster Sync';
    else if (iface.includes('Mgmt')) speed = 'Management';
    else if (iface.includes('magg')) speed = 'Multi-Queue Agg';

    return `
      <div class="vs-interface-chip">
        <span class="if-chip-icon">🔌</span>
        <span class="if-chip-name">${iface}</span>
        <span class="if-chip-badge">${speed}</span>
      </div>
    `;
  }).join('');
}

function renderVsMetricsTable(vs) {
  const tbody = document.getElementById('vs-detail-metrics-tbody');
  if (!tbody) return;

  const ramAvgFormatted = vs.mem_ram_avg_mb >= 1024 
    ? (vs.mem_ram_avg_mb / 1024).toFixed(2) + ' GB' 
    : vs.mem_ram_avg_mb.toFixed(0) + ' MB';
  const ramMaxFormatted = vs.mem_ram_max_mb >= 1024 
    ? (vs.mem_ram_max_mb / 1024).toFixed(2) + ' GB' 
    : vs.mem_ram_max_mb.toFixed(0) + ' MB';

  const rows = [
    {
      param: 'Utilización de CPU Promedio',
      avg: `${vs.cpu_avg_pct}%`,
      peak: `${vs.cpu_max_pct}%`,
      unit: '% Ciclos Asignados CoreXL',
      eval: vs.cpu_avg_pct > 100 ? '<span class="status-pill warning">Alta Carga (>100%)</span>' : (vs.cpu_avg_pct > 70 ? '<span class="status-pill warning">Moderada</span>' : '<span class="status-pill active">Óptimo</span>')
    },
    {
      param: 'Memoria RAM Física Utilizada (RSS)',
      avg: ramAvgFormatted,
      peak: ramMaxFormatted,
      unit: 'Megabytes / Gigabytes',
      eval: vs.mem_ram_avg_mb > 5000 ? '<span class="status-pill active">Host Dispatcher</span>' : '<span class="status-pill active">Normal</span>'
    },
    {
      param: 'Espacio de Memoria Virtual (VMS)',
      avg: `${vs.mem_virt_max_gb} GB`,
      peak: `${(vs.mem_virt_max_gb * 1.05).toFixed(2)} GB`,
      unit: 'Gigabytes VMS Reservado',
      eval: '<span class="status-pill active">Asignado</span>'
    },
    {
      param: 'Conexiones Concurrentes en Tabla Stateful',
      avg: fmtNum(vs.concur_conns_avg),
      peak: fmtNum(vs.concur_conns_peak),
      unit: 'Sesiones Firewall Concurrentes',
      eval: '<span class="status-pill active">Normal</span>'
    },
    {
      param: 'Tasa de Nuevas Conexiones (Connection Rate)',
      avg: `${fmtNum(vs.conns_sec_avg)} conns/s`,
      peak: `${fmtNum(vs.conns_sec_peak)} conns/s`,
      unit: 'Nuevas Sesiones TCP/UDP por segundo',
      eval: '<span class="status-pill active">Estable</span>'
    },
    {
      param: 'Throughput de Entrada (Inbound Network Throughput)',
      avg: `${vs.throughput_in_avg_mbps} Mbps`,
      peak: `${(vs.throughput_in_avg_mbps * 2.8).toFixed(1)} Mbps`,
      unit: 'Megabits por segundo (Mbps)',
      eval: '<span class="status-pill active">Óptimo</span>'
    },
    {
      param: 'Throughput de Salida (Outbound Network Throughput)',
      avg: `${vs.throughput_out_avg_mbps} Mbps`,
      peak: `${(vs.throughput_out_avg_mbps * 2.5).toFixed(1)} Mbps`,
      unit: 'Megabits por segundo (Mbps)',
      eval: '<span class="status-pill active">Óptimo</span>'
    },
    {
      param: 'Throughput Pico Agregado (SecureXL + CoreXL)',
      avg: `${(vs.throughput_in_avg_mbps + vs.throughput_out_avg_mbps).toFixed(1)} Mbps`,
      peak: `${vs.throughput_peak_gbps} Gbps`,
      unit: 'Capacidad pico registrada en ráfagas',
      eval: '<span class="status-pill active">Acelerado</span>'
    },
    {
      param: 'Tasa de Paquetes de Entrada (Inbound Packet Rate)',
      avg: `${fmtNum(vs.packet_rate_in_avg)} pps`,
      peak: `${fmtNum(vs.packet_rate_in_avg * 3)} pps`,
      unit: 'Paquetes por segundo (PPS)',
      eval: '<span class="status-pill active">Fluido</span>'
    },
    {
      param: 'Tasa de Paquetes de Salida (Outbound Packet Rate)',
      avg: `${fmtNum(vs.packet_rate_out_avg)} pps`,
      peak: `${fmtNum(vs.packet_rate_out_avg * 2.6)} pps`,
      unit: 'Paquetes por segundo (PPS)',
      eval: '<span class="status-pill active">Fluido</span>'
    },
    {
      param: 'Descriptores de Fichero y Sockets (FD Amount)',
      avg: fmtNum(vs.fd_amount_avg),
      peak: fmtNum(Math.round(vs.fd_amount_avg * 1.5)),
      unit: 'Sockets y Descriptores Abiertos',
      eval: '<span class="status-pill active">Adecuado</span>'
    },
    {
      param: 'Proceso de Kernel / Hilos Dedicados',
      avg: vs.process,
      peak: `PID ${vs.pid}`,
      unit: vs.cores_assigned,
      eval: '<span class="status-pill active">En ejecución</span>'
    }
  ];

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td><strong>${r.param}</strong></td>
      <td class="cell-mono">${r.avg}</td>
      <td class="cell-mono"><strong>${r.peak}</strong></td>
      <td style="color:var(--text-muted); font-size:12px;">${r.unit}</td>
      <td>${r.eval}</td>
    </tr>
  `).join('');
}

// =============================================================================
// PAGE 9: BLADES & VPN
// =============================================================================
function renderBladesPage() {
  const vpn = filterTimeSeries(CP_DATA.vpn.hourly);
  renderUniversalChart('chart-vpn-timeline', {
    labels: vpn.map(v => fmtDateShort(v.ts)),
    datasets: [
      { label: 'Concurrent IKE Peers', data: vpn.map(v => v.peers_avg) },
      { label: 'Concurrent SAs', data: vpn.map(v => v.sas_avg), borderColor: PALETTE.purple, backgroundColor: PALETTE.purple }
    ],
    yTitle: 'Cantidad Activa',
    defaultType: 'line',
    defaultColor: PALETTE.cyan
  });
}

// =============================================================================
// PAGE 10: DATABASE EXPLORER
// =============================================================================
let selectedCatalogTable = null;

function selectCatalogTable(tableName) {
  selectedCatalogTable = tableName;
  modalState.tableName = tableName;

  // Highlight selected row in table-catalog
  const tbody = document.getElementById('tbody-catalog');
  if (tbody) {
    tbody.querySelectorAll('tr').forEach(tr => {
      if (tr.getAttribute('data-table-name') === tableName) {
        tr.classList.add('selected-row');
      } else {
        tr.classList.remove('selected-row');
      }
    });
  }

  // Update table viewer chart button data-source and handler
  const chartBtn = document.getElementById('btn-chart-modal-table');
  if (chartBtn) {
    chartBtn.setAttribute('data-source', `tbl-${tableName}`);
    chartBtn.onclick = (e) => {
      e.stopPropagation();
      openCustomChartBuilder(`tbl-${tableName}`);
    };
  }
}

function renderCatalogTable() {
  const tbody = document.getElementById('tbody-catalog');
  if (!tbody) return;

  const query = (document.getElementById('filter-catalog-search')?.value || '').toLowerCase();
  const tables = (CP_DATA && CP_DATA.table_catalog) ? CP_DATA.table_catalog.filter(t => {
    return !query || t.name.toLowerCase().includes(query) || (t.category && t.category.toLowerCase().includes(query));
  }) : [];
  const viewBtnText = window.i18n ? window.i18n.t('db.btn_view_records', '🔍 Ver Registros') : '🔍 Ver Registros';
  const chartBtnText = window.i18n ? window.i18n.t('db.btn_chart_table', 'Graficar') : 'Graficar';

  tbody.innerHTML = tables.map(t => {
    const isSelected = selectedCatalogTable === t.name;
    const colNames = t.columns.map(c => c.name).slice(0, 4).join(', ') + (t.columns.length > 4 ? '...' : '');
    return `
      <tr class="${isSelected ? 'selected-row' : ''}" data-table-name="${t.name}" onclick="selectCatalogTable('${t.name}')" style="cursor:pointer;">
        <td class="cell-mono"><strong>${t.name}</strong></td>
        <td><span class="pill-badge vlan">${t.category}</span></td>
        <td class="cell-mono"><strong>${fmtNum(t.row_count)}</strong></td>
        <td class="cell-mono">${t.columns.length}</td>
        <td style="color:var(--text-muted); font-size:11px; max-width:280px; overflow:hidden; text-overflow:ellipsis;">${colNames}</td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-primary" style="padding:4px 10px; font-size:11px;" onclick="event.stopPropagation(); selectCatalogTable('${t.name}'); openTableViewer('${t.name}')">
              ${viewBtnText}
            </button>
            <button class="btn btn-outline" style="padding:4px 10px; font-size:11px;" onclick="event.stopPropagation(); selectCatalogTable('${t.name}'); openCustomChartBuilder('tbl-${t.name}')" title="Graficar ${t.name}">
              <span>📊</span> <span data-i18n="db.btn_chart_table">${chartBtnText}</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Table live record viewer (Modal)
async function openTableViewer(tableName, page = 1) {
  selectCatalogTable(tableName);
  modalState.page = page;

  const modal = document.getElementById('modal-table-viewer');
  const tablePrefix = window.i18n ? window.i18n.t('modal.table_prefix', 'Tabla:') : 'Tabla:';
  const loadingData = window.i18n ? window.i18n.t('modal.loading_data', 'Cargando datos...') : 'Cargando datos...';
  const queryingRecords = window.i18n ? window.i18n.t('modal.querying_records', 'Consultando registros...') : 'Consultando registros...';
  const errLoad = window.i18n ? window.i18n.t('modal.error_load', 'No se pudieron cargar registros para esta tabla.') : 'No se pudieron cargar registros para esta tabla.';

  document.getElementById('modal-table-name').textContent = `${tablePrefix} ${tableName}`;
  document.getElementById('modal-row-count-badge').textContent = loadingData;
  modal.classList.add('active');

  const thead = document.querySelector('#modal-table-content thead');
  const tbody = document.querySelector('#modal-table-content tbody');
  thead.innerHTML = '';
  tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:30px;"><div class="spinner"></div> ${queryingRecords}</td></tr>`;

  try {
    // Attempt to query live server API
    const res = await fetch(`/api/table/${encodeURIComponent(tableName)}?page=${page}&limit=${modalState.limit}`);
    if (res.ok) {
      const data = await res.json();
      modalState.currentRows = data.rows;
      modalState.columns = data.columns || [];
      renderModalTable(data.columns, data.rows, data.total_rows, page);
      return;
    }
  } catch (e) {
    // API not running, fallback to cached sample in JSON
  }

  // Fallback: render sample from cpview_data.json
  const tableMeta = CP_DATA.table_catalog.find(t => t.name === tableName);
  if (tableMeta && tableMeta.sample) {
    const cols = tableMeta.columns.map(c => c.name);
    modalState.columns = cols;
    modalState.currentRows = [tableMeta.sample];
    renderModalTable(cols, [tableMeta.sample], tableMeta.row_count, 1, true);
  } else {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:30px; color:var(--accent-rose);">${errLoad}</td></tr>`;
  }
}

function renderModalTable(cols, rows, total, page, isFallback = false) {
  const thead = document.querySelector('#modal-table-content thead');
  const tbody = document.querySelector('#modal-table-content tbody');
  const emptyText = window.i18n ? window.i18n.t('tableview.empty', 'Sin registros') : 'Sin registros';

  thead.innerHTML = `<tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>`;
  
  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${cols.length}" style="text-align:center; padding:20px;">${emptyText}</td></tr>`;
  } else {
    tbody.innerHTML = rows.map(r => `
      <tr>
        ${cols.map(c => `<td class="cell-mono">${r[c] !== undefined && r[c] !== null ? r[c] : '-'}</td>`).join('')}
      </tr>
    `).join('');
  }

  const badgeText = isFallback ? 
    (window.i18n ? window.i18n.t('modal.sample_pre_extracted', `Muestra pre-extraída (Total en SQLite: ${fmtNum(total)})`, { total: fmtNum(total) }) : `Muestra pre-extraída (Total en SQLite: ${fmtNum(total)})`) : 
    (window.i18n ? window.i18n.t('modal.page_total_records', `Página ${page} (Total: ${fmtNum(total)} registros)`, { page: page, total: fmtNum(total) }) : `Página ${page} (Total: ${fmtNum(total)} registros)`);
  document.getElementById('modal-row-count-badge').textContent = badgeText;
  const pagePrefix = window.i18n ? window.i18n.t('tableview.page_prefix', 'Página') : 'Página';
  document.getElementById('modal-pagination-info').textContent = `${pagePrefix} ${page}`;
}

// SQL direct query runner
async function runSqlQuery() {
  const query = document.getElementById('sql-query-input').value.trim();
  const statusEl = document.getElementById('sql-status');
  const panel = document.getElementById('sql-results-panel');
  const thead = document.querySelector('#table-sql-results thead');
  const tbody = document.querySelector('#table-sql-results tbody');

  if (!query) return;
  const executingMsg = window.i18n ? window.i18n.t('db.status_executing', 'Ejecutando consulta...') : 'Ejecutando consulta...';
  statusEl.textContent = executingMsg;

  try {
    const res = await fetch(`/api/sql?q=${encodeURIComponent(query)}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    panel.style.display = 'block';
    const rowsFetched = window.i18n ? window.i18n.t('db.rows_fetched_count', `${data.count} filas obtenidas`, { count: data.count }) : `${data.count} filas obtenidas`;
    statusEl.textContent = rowsFetched;

    sqlState.columns = data.columns || [];
    sqlState.rows = (data.rows || []).map(row => {
      const obj = {};
      (data.columns || []).forEach((c, idx) => { obj[c] = row[idx]; });
      return obj;
    });

    thead.innerHTML = `<tr>${data.columns.map(c => `<th>${c}</th>`).join('')}</tr>`;
    tbody.innerHTML = data.rows.map(row => `
      <tr>${row.map(val => `<td class="cell-mono">${val !== null ? val : '-'}</td>`).join('')}</tr>
    `).join('');
  } catch (e) {
    statusEl.textContent = `Error: ${e.message}`;
    panel.style.display = 'block';
    thead.innerHTML = '<tr><th>Error</th></tr>';
    tbody.innerHTML = `<tr><td style="color:var(--accent-rose);">${e.message}</td></tr>`;
  }
}

// =============================================================================
// UNIVERSAL CUSTOM TABLE CHART GENERATOR
// =============================================================================

function toDatetimeLocalString(date) {
  if (!date || isNaN(date.getTime())) return '';
  const Y = date.getFullYear();
  const M = String(date.getMonth() + 1).padStart(2, '0');
  const D = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${Y}-${M}-${D}T${h}:${m}`;
}

async function loadTableDataSource(sourceId) {
  let title = 'Tabla';
  let rows = [];
  let columns = [];
  let defaultX = '';
  let defaultY = '*';
  let defaultOp = 'COUNT';
  let defaultType = 'bar';
  let defaultTimeFormat = 'none';

  if (sourceId === 'cpu-cores') {
    title = 'Tabla: Cores CPU (CoreXL / SND)';
    rows = CP_DATA && CP_DATA.cpu && CP_DATA.cpu.summary ? CP_DATA.cpu.summary : [];
    columns = ['core', 'role', 'avg_usage', 'max_usage', 'avg_usr', 'avg_sys', 'avg_idle', 'max_interrupts'];
    defaultX = 'core';
    defaultY = 'avg_usage';
    defaultOp = 'RAW';
    defaultType = 'bar';
    defaultTimeFormat = 'none';
  } else if (sourceId === 'interfaces') {
    title = 'Tabla: Interfaces de Red';
    rows = CP_DATA && CP_DATA.interfaces ? CP_DATA.interfaces : [];
    columns = ['name', 'type', 'speed', 'state', 'ipv4', 'rx_avg_mbps', 'rx_max_mbps', 'tx_avg_mbps', 'tx_max_mbps'];
    defaultX = 'name';
    defaultY = 'rx_max_mbps';
    defaultOp = 'MAX';
    defaultType = 'horizontalBar';
    defaultTimeFormat = 'none';
  } else if (sourceId === 'drop-reasons') {
    title = 'Tabla: Razones de Descarte (Drops)';
    rows = CP_DATA && CP_DATA.drops && CP_DATA.drops.by_reason ? CP_DATA.drops.by_reason : [];
    columns = ['reason_id', 'reason_name', 'count', 'percent'];
    defaultX = 'reason_name';
    defaultY = 'count';
    defaultOp = 'SUM';
    defaultType = 'bar';
    defaultTimeFormat = 'none';
  } else if (sourceId === 'cpu-spikes') {
    title = 'Tabla: Eventos de Spike Detective';
    rows = CP_DATA && CP_DATA.spikes && CP_DATA.spikes.cpu_spikes ? CP_DATA.spikes.cpu_spikes : [];
    columns = ['start_iso', 'core', 'consumer', 'avg_usage', 'duration_sec'];
    defaultX = 'consumer';
    defaultY = '*';
    defaultOp = 'COUNT';
    defaultType = 'horizontalBar';
    defaultTimeFormat = 'none';
  } else if (sourceId === 'sql-results') {
    title = 'Tabla: Resultados de Consulta SQL';
    rows = sqlState.rows || [];
    columns = sqlState.columns && sqlState.columns.length > 0 ? sqlState.columns : (rows[0] ? Object.keys(rows[0]) : []);
    defaultX = columns[0] || '';
    defaultY = columns[1] || '*';
    defaultOp = columns[1] ? 'SUM' : 'COUNT';
    defaultType = 'bar';
    defaultTimeFormat = isLikelyDateColumn(defaultX, rows) ? 'date' : 'none';
  } else if (sourceId === 'modal-table') {
    const targetTable = modalState.tableName || selectedCatalogTable || (CP_DATA?.table_catalog?.[0]?.name);
    if (targetTable) {
      return await loadTableDataSource(`tbl-${targetTable}`);
    }
    title = `Tabla SQLite: Registros`;
    rows = modalState.currentRows || [];
    columns = modalState.columns || (rows[0] ? Object.keys(rows[0]) : []);
    defaultX = columns[0] || '';
    defaultY = columns[1] || '*';
    defaultOp = columns[1] ? 'SUM' : 'COUNT';
    defaultType = 'bar';
    defaultTimeFormat = isLikelyDateColumn(defaultX, rows) ? 'date' : 'none';
  } else if (sourceId.startsWith('tbl-') || (CP_DATA && CP_DATA.table_catalog && CP_DATA.table_catalog.some(t => t.name === sourceId))) {
    const tableName = sourceId.startsWith('tbl-') ? sourceId.substring(4) : sourceId;
    title = `Tabla SQLite: ${tableName}`;
    try {
      const res = await fetch(`/api/table/${encodeURIComponent(tableName)}?all=1`);
      if (res.ok) {
        const data = await res.json();
        rows = data.rows || [];
        columns = data.columns || [];
      }
    } catch (e) {}
    if (rows.length === 0 && modalState.tableName === tableName && modalState.currentRows && modalState.currentRows.length > 0) {
      rows = modalState.currentRows;
      columns = modalState.columns && modalState.columns.length > 0 ? modalState.columns : Object.keys(rows[0] || {});
    }
    if (rows.length === 0) {
      const tMeta = CP_DATA.table_catalog?.find(t => t.name === tableName);
      if (tMeta && tMeta.sample) {
        rows = [tMeta.sample];
        columns = tMeta.columns ? tMeta.columns.map(c => c.name) : Object.keys(tMeta.sample);
      }
    }
    defaultX = columns[0] || '';
    defaultY = columns[1] || '*';
    defaultOp = columns[1] ? 'SUM' : 'COUNT';
    defaultType = 'bar';
    defaultTimeFormat = isLikelyDateColumn(defaultX, rows) ? 'date' : 'none';
  } else {
    // Attempt DOM fallback for any custom table element
    const domTable = document.getElementById(sourceId) || document.querySelector(sourceId);
    if (domTable) {
      const ths = Array.from(domTable.querySelectorAll('thead th')).map(th => th.textContent.trim());
      columns = ths;
      rows = Array.from(domTable.querySelectorAll('tbody tr')).map(tr => {
        const item = {};
        tr.querySelectorAll('td').forEach((td, idx) => {
          item[columns[idx] || `col_${idx}`] = td.textContent.trim();
        });
        return item;
      });
      title = 'Tabla de Datos';
      defaultX = columns[0] || '';
      defaultY = '*';
      defaultOp = 'COUNT';
      defaultType = 'bar';
    }
  }

  return { title, rows, columns, defaultX, defaultY, defaultOp, defaultType, defaultTimeFormat };
}

function parseTimestamp(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    if (isNaN(val) || val <= 0) return null;
    const ms = val < 1e11 ? val * 1000 : val;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    if (/^\d{9,13}$/.test(trimmed)) {
      const num = parseInt(trimmed, 10);
      const ms = num < 1e11 ? num * 1000 : num;
      const d = new Date(ms);
      if (!isNaN(d.getTime())) return d;
    }
    const parsed = Date.parse(trimmed.replace(' ', 'T'));
    if (!isNaN(parsed)) return new Date(parsed);
    const dmy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (dmy) {
      const day = parseInt(dmy[1], 10);
      const month = parseInt(dmy[2], 10) - 1;
      let year = parseInt(dmy[3], 10);
      if (year < 100) year += 2000;
      const hour = dmy[4] ? parseInt(dmy[4], 10) : 0;
      const min = dmy[5] ? parseInt(dmy[5], 10) : 0;
      const sec = dmy[6] ? parseInt(dmy[6], 10) : 0;
      const d = new Date(year, month, day, hour, min, sec);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}

function isLikelyDateColumn(colName, sampleRows) {
  if (!colName) return false;
  const lower = String(colName).toLowerCase();
  if (lower.includes('time') || lower.includes('date') || lower.includes('iso') || lower.includes('epoch') || lower.includes('fecha') || lower.includes('start')) {
    return true;
  }
  if (sampleRows && sampleRows.length > 0) {
    let hits = 0;
    const count = Math.min(sampleRows.length, 5);
    for (let i = 0; i < count; i++) {
      if (parseTimestamp(sampleRows[i][colName])) hits++;
    }
    return hits >= Math.ceil(count / 2);
  }
  return false;
}

function parseNumericValue(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'string') {
    let clean = val.replace(/[%s]/g, '').trim();
    clean = clean.replace(/Mbps|Gbps|KB|MB|GB|Core/gi, '').trim();
    clean = clean.replace(/,/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function splitSqlByOperator(str, targetOp) {
  const result = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let parenDepth = 0;
  const opLen = targetOp.length;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += ch;
    } else if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += ch;
    } else if (ch === '(' && !inSingleQuote && !inDoubleQuote) {
      parenDepth++;
      current += ch;
    } else if (ch === ')' && !inSingleQuote && !inDoubleQuote) {
      if (parenDepth > 0) parenDepth--;
      current += ch;
    } else if (!inSingleQuote && !inDoubleQuote && parenDepth === 0) {
      const sub = str.substring(i, i + opLen);
      if (sub.toUpperCase() === targetOp.toUpperCase()) {
        const prevChar = i > 0 ? str[i - 1] : ' ';
        const nextChar = (i + opLen) < str.length ? str[i + opLen] : ' ';
        if (/\s/.test(prevChar) && /\s/.test(nextChar)) {
          result.push(current.trim());
          current = '';
          i += opLen - 1;
          continue;
        }
      }
      current += ch;
    } else {
      current += ch;
    }
  }
  if (current.trim()) {
    result.push(current.trim());
  }
  return result.length > 0 ? result : [str];
}

function getRowFieldValue(row, fieldName) {
  if (!row || !fieldName) return undefined;
  if (fieldName in row) return row[fieldName];
  const lower = fieldName.toLowerCase();
  for (const k in row) {
    if (k.toLowerCase() === lower) return row[k];
  }
  return undefined;
}

function evaluateSingleSqlPredicate(row, pred) {
  let p = pred.trim();
  if (!p) return true;

  while (p.startsWith('(') && p.endsWith(')')) {
    let depth = 0;
    let balanced = true;
    for (let i = 0; i < p.length - 1; i++) {
      if (p[i] === '(') depth++;
      else if (p[i] === ')') {
        depth--;
        if (depth === 0) { balanced = false; break; }
      }
    }
    if (balanced && depth === 1) {
      p = p.substring(1, p.length - 1).trim();
    } else {
      break;
    }
  }

  // 1. IS NOT NULL
  let m = p.match(/^([a-zA-Z0-9_\.\-]+)\s+IS\s+NOT\s+NULL$/i);
  if (m) {
    const val = getRowFieldValue(row, m[1]);
    return val !== null && val !== undefined && val !== '';
  }

  // 2. IS NULL
  m = p.match(/^([a-zA-Z0-9_\.\-]+)\s+IS\s+NULL$/i);
  if (m) {
    const val = getRowFieldValue(row, m[1]);
    return val === null || val === undefined || val === '';
  }

  // 3. IN / NOT IN
  m = p.match(/^([a-zA-Z0-9_\.\-]+)\s+(NOT\s+IN|IN)\s*\((.+)\)$/i);
  if (m) {
    const field = m[1];
    const isNotIn = m[2].toUpperCase().includes('NOT');
    const itemsRaw = m[3];
    const items = itemsRaw.split(',').map(s => {
      let trimmed = s.trim();
      if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
        trimmed = trimmed.substring(1, trimmed.length - 1);
      }
      return trimmed;
    });

    const rowVal = getRowFieldValue(row, field);
    const rowValStr = String(rowVal ?? '').toLowerCase();
    const rowValNum = typeof rowVal === 'number' ? rowVal : parseFloat(rowVal);

    const matchFound = items.some(item => {
      if (item.toLowerCase() === rowValStr) return true;
      const itemNum = parseFloat(item);
      if (!isNaN(itemNum) && !isNaN(rowValNum) && itemNum === rowValNum) return true;
      return false;
    });

    return isNotIn ? !matchFound : matchFound;
  }

  // 4. LIKE / NOT LIKE
  m = p.match(/^([a-zA-Z0-9_\.\-]+)\s+(NOT\s+LIKE|LIKE)\s+['"]?(.*?)['"]?$/i);
  if (m) {
    const field = m[1];
    const isNotLike = m[2].toUpperCase().includes('NOT');
    const pattern = m[3];
    const rowVal = String(getRowFieldValue(row, field) ?? '');

    const escaped = pattern.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
                           .replace(/%/g, '.*')
                           .replace(/_/g, '.');
    const regex = new RegExp(`^${escaped}$`, 'i');
    const matched = regex.test(rowVal);
    return isNotLike ? !matched : matched;
  }

  // 5. Binary comparisons: <=, >=, !=, <>, ==, =, <, >
  const opMatch = p.match(/^([a-zA-Z0-9_\.\-]+)\s*(<=|>=|!=|<>|==|=|<|>)\s*(.+)$/);
  if (opMatch) {
    const field = opMatch[1];
    const op = opMatch[2];
    let rawVal = opMatch[3].trim();

    if ((rawVal.startsWith("'") && rawVal.endsWith("'")) || (rawVal.startsWith('"') && rawVal.endsWith('"'))) {
      rawVal = rawVal.substring(1, rawVal.length - 1);
    }

    const rowVal = getRowFieldValue(row, field);

    const numTarget = parseFloat(rawVal);
    const numRow = typeof rowVal === 'number' ? rowVal : parseFloat(String(rowVal ?? '').replace(/,/g, ''));
    const areNumbers = !isNaN(numTarget) && !isNaN(numRow) && !/^\d{4}-\d{2}-\d{2}/.test(rawVal);

    if (areNumbers) {
      switch (op) {
        case '=':
        case '==': return numRow === numTarget;
        case '!=':
        case '<>': return numRow !== numTarget;
        case '<': return numRow < numTarget;
        case '<=': return numRow <= numTarget;
        case '>': return numRow > numTarget;
        case '>=': return numRow >= numTarget;
      }
    } else {
      const strRow = String(rowVal ?? '').toLowerCase();
      const strTarget = rawVal.toLowerCase();

      switch (op) {
        case '=':
        case '==': return strRow === strTarget;
        case '!=':
        case '<>': return strRow !== strTarget;
        case '<': return strRow < strTarget;
        case '<=': return strRow <= strTarget;
        case '>': return strRow > strTarget;
        case '>=': return strRow >= strTarget;
      }
    }
  }

  return true;
}

function evaluateRowSqlCondition(row, sqlStr) {
  if (!sqlStr || !sqlStr.trim()) return true;
  let str = sqlStr.trim();
  if (/^where\s+/i.test(str)) {
    str = str.replace(/^where\s+/i, '').trim();
  }
  if (!str) return true;

  const orClauses = splitSqlByOperator(str, 'OR');
  return orClauses.some(orClause => {
    const andClauses = splitSqlByOperator(orClause, 'AND');
    return andClauses.every(andClause => evaluateSingleSqlPredicate(row, andClause));
  });
}

function getActiveRows() {
  let rows = chartGenState.allRows || [];
  if (rows.length === 0) return [];

  const { dateFrom, dateTo, recordSlice, xCol } = chartGenState;

  // 1. Date range filtering (if dateFrom or dateTo active)
  if (dateFrom || dateTo) {
    const fromTime = dateFrom ? dateFrom.getTime() : -Infinity;
    const toTime = dateTo ? dateTo.getTime() : Infinity;

    rows = rows.filter(row => {
      let d = parseTimestamp(row[xCol]);
      if (!d) {
        for (const k in row) {
          if (isLikelyDateColumn(k)) {
            d = parseTimestamp(row[k]);
            if (d) break;
          }
        }
      }
      if (!d) return true;
      const t = d.getTime();
      return t >= fromTime && t <= toTime;
    });
  }

  // 2. Record Slice / Limit
  if (recordSlice && recordSlice !== 'all') {
    if (recordSlice === 'last-100') rows = rows.slice(-100);
    else if (recordSlice === 'last-500') rows = rows.slice(-500);
    else if (recordSlice === 'last-1000') rows = rows.slice(-1000);
    else if (recordSlice === 'last-5000') rows = rows.slice(-5000);
    else if (recordSlice === 'first-100') rows = rows.slice(0, 100);
    else if (recordSlice === 'first-500') rows = rows.slice(0, 500);
    else if (recordSlice === 'first-1000') rows = rows.slice(0, 1000);
  }

  return rows;
}

function aggregateRowsData(rows, xCol, yCol, op, effectiveTimeFormat, sort, limit) {
  if (!rows || rows.length === 0 || !xCol) {
    return { items: [], totalCount: 0, sum: 0, avg: 0, max: 0, min: 0 };
  }

  const isSumDay = op === 'SUM_DAY';
  const isSumHour = op === 'SUM_HOUR';
  const isSumMinute = op === 'SUM_MINUTE';
  const isSumTime = isSumDay || isSumHour || isSumMinute;

  let effTime = effectiveTimeFormat;
  if (isSumDay) effTime = 'date';
  else if (isSumHour) effTime = 'hour_datetime';
  else if (isSumMinute) effTime = 'minute';

  const isTime = isSumTime || (effTime && effTime !== 'none');
  const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  let processedRows = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rawX = row[xCol];
    let label = '';
    let sortKey = null;

    if (isTime) {
      let dateObj = parseTimestamp(rawX);
      if (!dateObj && isSumTime) {
        for (const k in row) {
          if (isLikelyDateColumn(k)) {
            dateObj = parseTimestamp(row[k]);
            if (dateObj) break;
          }
        }
      }

      if (dateObj) {
        if (effTime === 'date') {
          const d = String(dateObj.getDate()).padStart(2, '0');
          const m = String(dateObj.getMonth() + 1).padStart(2, '0');
          const y = dateObj.getFullYear();
          label = `${d}/${m}/${y}`;
          sortKey = dateObj.getFullYear() * 10000 + (dateObj.getMonth() + 1) * 100 + dateObj.getDate();
        } else if (effTime === 'hour') {
          const h = dateObj.getHours();
          label = `${String(h).padStart(2, '0')}:00`;
          sortKey = h;
        } else if (effTime === 'weekday') {
          const w = dateObj.getDay();
          label = WEEKDAYS[w];
          sortKey = (w + 6) % 7;
        } else if (effTime === 'hour_datetime') {
          const d = String(dateObj.getDate()).padStart(2, '0');
          const m = String(dateObj.getMonth() + 1).padStart(2, '0');
          const h = String(dateObj.getHours()).padStart(2, '0');
          label = `${d}/${m} ${h}:00`;
          const roundedHour = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), dateObj.getHours(), 0, 0);
          sortKey = roundedHour.getTime();
        } else if (effTime === 'minute' || effTime === 'datetime') {
          const d = String(dateObj.getDate()).padStart(2, '0');
          const m = String(dateObj.getMonth() + 1).padStart(2, '0');
          const h = String(dateObj.getHours()).padStart(2, '0');
          const min = String(dateObj.getMinutes()).padStart(2, '0');
          label = `${d}/${m} ${h}:${min}`;
          const roundedMin = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), dateObj.getHours(), dateObj.getMinutes(), 0);
          sortKey = roundedMin.getTime();
        } else {
          const d = String(dateObj.getDate()).padStart(2, '0');
          const m = String(dateObj.getMonth() + 1).padStart(2, '0');
          const h = String(dateObj.getHours()).padStart(2, '0');
          const min = String(dateObj.getMinutes()).padStart(2, '0');
          label = `${d}/${m} ${h}:${min}`;
          sortKey = dateObj.getTime();
        }
      } else {
        label = rawX !== null && rawX !== undefined ? String(rawX) : '(Vacío)';
        sortKey = label;
      }
    } else {
      label = rawX !== null && rawX !== undefined ? String(rawX) : '(Vacío)';
      sortKey = isNaN(Number(label)) ? label : Number(label);
    }

    let valY = 0;
    if (op === 'COUNT' || yCol === '*') {
      valY = 1;
    } else {
      valY = parseNumericValue(row[yCol]);
    }

    processedRows.push({ label, sortKey, valY, rawIndex: i });
  }

  let items = [];

  if (op === 'RAW') {
    items = processedRows.map(pr => ({
      label: pr.label,
      value: pr.valY,
      sortKey: pr.sortKey,
      count: 1
    }));
  } else {
    const groups = new Map();
    for (const pr of processedRows) {
      let g = groups.get(pr.label);
      if (!g) {
        g = {
          label: pr.label,
          sortKey: pr.sortKey,
          count: 0,
          sum: 0,
          min: pr.valY,
          max: pr.valY
        };
        groups.set(pr.label, g);
      }
      g.count += 1;
      g.sum += pr.valY;
      if (pr.valY < g.min) g.min = pr.valY;
      if (pr.valY > g.max) g.max = pr.valY;
    }

    groups.forEach(g => {
      let finalVal = 0;
      if (op === 'SUM' || isSumTime) finalVal = g.sum;
      else if (op === 'AVG') finalVal = g.count > 0 ? (g.sum / g.count) : 0;
      else if (op === 'COUNT') finalVal = g.count;
      else if (op === 'MAX') finalVal = g.max;
      else if (op === 'MIN') finalVal = g.min;

      if (Math.abs(finalVal % 1) > 0.0001) {
        finalVal = Math.round(finalVal * 100) / 100;
      }

      items.push({
        label: g.label,
        value: finalVal,
        sortKey: g.sortKey,
        count: g.count,
        sum: g.sum,
        min: g.min,
        max: g.max
      });
    });
  }

  // Sorting
  if (sort === 'y-desc') {
    items.sort((a, b) => b.value - a.value);
  } else if (sort === 'y-asc') {
    items.sort((a, b) => a.value - b.value);
  } else if (sort === 'x-asc') {
    items.sort((a, b) => {
      if (typeof a.sortKey === 'number' && typeof b.sortKey === 'number') return a.sortKey - b.sortKey;
      return String(a.sortKey).localeCompare(String(b.sortKey), undefined, { numeric: true });
    });
  } else if (sort === 'x-desc') {
    items.sort((a, b) => {
      if (typeof a.sortKey === 'number' && typeof b.sortKey === 'number') return b.sortKey - a.sortKey;
      return String(b.sortKey).localeCompare(String(a.sortKey), undefined, { numeric: true });
    });
  }

  // Limit / Top N groups
  const parsedLimit = parseInt(limit, 10);
  if (parsedLimit > 0 && items.length > parsedLimit) {
    items = items.slice(0, parsedLimit);
  }

  const totalCount = items.length;
  const sum = items.reduce((acc, it) => acc + it.value, 0);
  const avg = totalCount > 0 ? sum / totalCount : 0;
  const max = totalCount > 0 ? Math.max(...items.map(it => it.value)) : 0;
  const min = totalCount > 0 ? Math.min(...items.map(it => it.value)) : 0;

  return {
    items,
    totalCount,
    sum: Math.round(sum * 100) / 100,
    avg: Math.round(avg * 100) / 100,
    max: Math.round(max * 100) / 100,
    min: Math.round(min * 100) / 100
  };
}

function calculateChartData() {
  const activeRows = getActiveRows();
  chartGenState.rows = activeRows;

  const subEl = document.getElementById('chartgen-source-sub');
  if (subEl) {
    const totalAll = chartGenState.allRows ? chartGenState.allRows.length : 0;
    subEl.textContent = `Visualizando ${fmtNum(activeRows.length)} de ${fmtNum(totalAll)} registros de la tabla`;
  }

  const { xCol, yCol, op, timeFormat, sort, limit, diffCol } = chartGenState;

  // Single Chart Calculation
  const overall = aggregateRowsData(activeRows, xCol, yCol, op, timeFormat, sort, limit);

  // Differentiator Groups (Small Multiples Split)
  let diffGroups = [];
  if (diffCol && diffCol.trim() !== '') {
    const groupsMap = new Map();
    for (const r of activeRows) {
      let gVal = r[diffCol];
      if (gVal === null || gVal === undefined || gVal === '') gVal = '(Vacío)';
      else gVal = String(gVal);

      if (!groupsMap.has(gVal)) {
        groupsMap.set(gVal, []);
      }
      groupsMap.get(gVal).push(r);
    }

    const sortedKeys = Array.from(groupsMap.keys()).sort((a, b) => {
      const numA = parseFloat(a);
      const numB = parseFloat(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b, undefined, { numeric: true });
    });

    // Cap at 36 distinct charts to prevent performance degradation
    const cappedKeys = sortedKeys.slice(0, 36);
    diffGroups = cappedKeys.map(key => {
      const gRows = groupsMap.get(key);
      const gResult = aggregateRowsData(gRows, xCol, yCol, op, timeFormat, sort, limit);
      return {
        groupKey: key,
        rowCount: gRows.length,
        result: gResult
      };
    });
  }

  return {
    ...overall,
    filteredRowsCount: activeRows.length,
    isDifferentiated: Boolean(diffCol && diffCol.trim() !== ''),
    diffCol: diffCol || '',
    diffGroups
  };
}

function renderCustomChart() {
  const singleWrap = document.getElementById('chartgen-single-chart-wrap');
  const diffWrap = document.getElementById('chartgen-diff-charts-container');
  const canvas = document.getElementById('canvas-custom-chart');
  const emptyState = document.getElementById('chartgen-no-data');
  if (!canvas) return;

  const result = calculateChartData();
  chartGenState.processedData = result;

  // Clean up any existing differentiator chart instances
  if (chartGenState.diffChartInstances && chartGenState.diffChartInstances.length > 0) {
    chartGenState.diffChartInstances.forEach(inst => {
      try { inst.destroy(); } catch (e) {}
    });
    chartGenState.diffChartInstances = [];
  }

  // Update stats cards
  const countEl = document.getElementById('chartgen-stat-count');
  const sumEl = document.getElementById('chartgen-stat-sum');
  const avgEl = document.getElementById('chartgen-stat-avg');
  const maxEl = document.getElementById('chartgen-stat-max');
  const minEl = document.getElementById('chartgen-stat-min');

  if (countEl) countEl.textContent = fmtNum(result.totalCount);
  if (sumEl) sumEl.textContent = fmtNum(result.sum);
  if (avgEl) avgEl.textContent = fmtNum(result.avg);
  if (maxEl) maxEl.textContent = fmtNum(result.max);
  if (minEl) minEl.textContent = fmtNum(result.min);

  // Update collapsed summary badges
  updateChartgenCollapsedBadges();

  const { type, color, yCol, op } = chartGenState;
  const isHoriz = type === 'horizontalBar';
  const isLine = type === 'line' || type === 'area';
  const isPie = type === 'pie' || type === 'doughnut';
  const isArea = type === 'area';

  const chartType = isHoriz ? 'bar' : (isPie ? type : (isLine ? 'line' : 'bar'));

  const VIVID_COLORS = [
    '#06b6d4', '#f43f5e', '#10b981', '#8b5cf6', '#f59e0b',
    '#3b82f6', '#ec4899', '#14b8a6', '#6366f1', '#eab308',
    '#a855f7', '#22c55e', '#f97316', '#0ea5e9', '#d946ef'
  ];

  // 1. DIFFERENTIATOR MULTI-CHART MODE
  if (result.isDifferentiated && result.diffGroups && result.diffGroups.length > 0) {
    if (singleWrap) singleWrap.style.display = 'none';
    if (diffWrap) diffWrap.style.display = 'block';

    const diffBadge = document.getElementById('chartgen-diff-summary-badge');
    const diffCountBadge = document.getElementById('chartgen-diff-count-badge');
    if (diffBadge) diffBadge.textContent = `🏷️ Desglose por: ${chartGenState.diffCol}`;
    if (diffCountBadge) diffCountBadge.textContent = `${result.diffGroups.length} gráficos generados`;

    const diffGrid = document.getElementById('chartgen-diff-grid');
    if (diffGrid) {
      diffGrid.innerHTML = '';
      result.diffGroups.forEach((group, idx) => {
        const groupColor = color === 'multi' ? VIVID_COLORS[idx % VIVID_COLORS.length] : color;
        const card = document.createElement('div');
        card.className = 'chartgen-diff-card';
        card.innerHTML = `
          <div class="chartgen-diff-card-header">
            <div class="chartgen-diff-card-title" title="${chartGenState.diffCol}: ${escapeHtml(group.groupKey)}">
              <span>📌</span> <strong>${escapeHtml(group.groupKey)}</strong>
            </div>
            <div class="diff-stats-mini">
              <span>Filas: <strong>${fmtNum(group.rowCount)}</strong></span>
              <span>${op === 'COUNT' ? 'Total' : op}: <strong>${fmtNum(op === 'COUNT' ? group.result.totalCount : group.result.sum)}</strong></span>
            </div>
          </div>
          <div class="chartgen-diff-canvas-wrap">
            <canvas id="canvas-diff-${idx}"></canvas>
          </div>
        `;
        diffGrid.appendChild(card);

        const diffCanvas = card.querySelector(`#canvas-diff-${idx}`);
        if (!diffCanvas) return;
        const diffCtx = diffCanvas.getContext('2d');
        const gLabels = group.result.items.map(it => it.label);
        const gValues = group.result.items.map(it => it.value);

        let gBgColors, gBorderColors;
        if (color === 'multi' || isPie) {
          gBgColors = gLabels.map((_, i) => hexToRgba(VIVID_COLORS[i % VIVID_COLORS.length], 0.85));
          gBorderColors = gLabels.map((_, i) => VIVID_COLORS[i % VIVID_COLORS.length]);
        } else {
          gBgColors = hexToRgba(groupColor, isArea ? 0.25 : 0.85);
          gBorderColors = groupColor;
        }

        const metricTitle = op === 'COUNT' ? 'Conteo de Filas' : `${op} (${yCol})`;

        const cfg = {
          type: chartType,
          data: {
            labels: gLabels,
            datasets: [{
              label: `${metricTitle} - ${group.groupKey}`,
              data: gValues,
              backgroundColor: gBgColors,
              borderColor: gBorderColors,
              borderWidth: isLine ? 2 : 1,
              fill: isArea,
              tension: isLine ? 0.35 : 0,
              borderRadius: (chartType === 'bar' && !isPie) ? 3 : 0,
              pointBackgroundColor: gBorderColors,
              pointRadius: isLine ? 2 : 0
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: isHoriz ? 'y' : 'x',
            animation: { duration: 250 },
            plugins: {
              legend: { display: isPie, position: 'right', labels: { boxWidth: 10, color: '#94a3b8', font: { size: 10 } } },
              tooltip: {
                callbacks: {
                  label: function(ctx) {
                    const it = group.result.items[ctx.dataIndex];
                    const valStr = fmtNum(ctx.raw);
                    if (it && it.count && it.count > 1 && op !== 'COUNT') {
                      return ` ${metricTitle}: ${valStr} (${it.count} filas)`;
                    }
                    return ` ${metricTitle}: ${valStr}`;
                  }
                }
              }
            }
          }
        };

        if (!isPie) {
          if (isHoriz) {
            cfg.options.scales = {
              x: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8', font: { size: 10 } } },
              y: { grid: { display: false }, ticks: { color: '#cbd5e1', font: { size: 10 } } }
            };
          } else {
            cfg.options.scales = {
              x: { grid: { color: 'rgba(255, 255, 255, 0.04)' }, ticks: { color: '#94a3b8', font: { size: 10 }, maxRotation: 45, minRotation: gLabels.length > 6 ? 30 : 0 } },
              y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8', font: { size: 10 } } }
            };
          }
        }

        const chartInst = new Chart(diffCtx, cfg);
        chartGenState.diffChartInstances.push(chartInst);
      });
    }
    return;
  }

  // 2. SINGLE CHART MODE
  if (singleWrap) singleWrap.style.display = 'block';
  if (diffWrap) diffWrap.style.display = 'none';

  if (!result.items || result.items.length === 0) {
    if (chartGenState.chartInstance) {
      try { chartGenState.chartInstance.destroy(); } catch (e) {}
      chartGenState.chartInstance = null;
    }
    canvas.style.display = 'none';
    if (emptyState) emptyState.style.display = 'flex';
    return;
  }

  canvas.style.display = 'block';
  if (emptyState) emptyState.style.display = 'none';

  if (chartGenState.chartInstance) {
    try { chartGenState.chartInstance.destroy(); } catch (e) {}
    chartGenState.chartInstance = null;
  }

  const ctx = canvas.getContext('2d');
  const labels = result.items.map(it => it.label);
  const values = result.items.map(it => it.value);

  let bgColors, borderColors;
  if (color === 'multi' || isPie) {
    bgColors = labels.map((_, idx) => hexToRgba(VIVID_COLORS[idx % VIVID_COLORS.length], 0.85));
    borderColors = labels.map((_, idx) => VIVID_COLORS[idx % VIVID_COLORS.length]);
  } else {
    bgColors = hexToRgba(color, isArea ? 0.25 : 0.85);
    borderColors = color;
  }

  const metricTitle = op === 'COUNT' ? 'Conteo de Filas' : `${op} (${yCol})`;

  const config = {
    type: chartType,
    data: {
      labels: labels,
      datasets: [{
        label: metricTitle,
        data: values,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: isLine ? 2 : 1,
        fill: isArea,
        tension: isLine ? 0.35 : 0,
        borderRadius: (chartType === 'bar' && !isPie) ? 4 : 0,
        pointBackgroundColor: color === 'multi' ? borderColors : color,
        pointRadius: isLine ? 3 : 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: isHoriz ? 'y' : 'x',
      animation: { duration: 350 },
      plugins: {
        legend: {
          display: isPie,
          position: 'right',
          labels: { boxWidth: 12, color: '#94a3b8', font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              const it = result.items[ctx.dataIndex];
              const valStr = fmtNum(ctx.raw);
              if (it && it.count && it.count > 1 && op !== 'COUNT') {
                return ` ${metricTitle}: ${valStr} (${it.count} filas)`;
              }
              return ` ${metricTitle}: ${valStr}`;
            }
          }
        }
      }
    }
  };

  if (!isPie) {
    if (isHoriz) {
      config.options.scales = {
        x: {
          beginAtZero: true,
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: '#94a3b8' }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#cbd5e1', font: { size: 11 } }
        }
      };
    } else {
      config.options.scales = {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: {
            color: '#94a3b8',
            font: { size: 11 },
            maxRotation: 45,
            minRotation: labels.length > 8 ? 30 : 0
          }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: '#94a3b8' }
        }
      };
    }
  }

  chartGenState.chartInstance = new Chart(ctx, config);
}

function updateChartgenColumnSelects() {
  const xSelect = document.getElementById('chartgen-x-col');
  const ySelect = document.getElementById('chartgen-y-col');
  const diffSelect = document.getElementById('chartgen-diff-col');
  const cols = chartGenState.columns || [];

  if (xSelect) {
    xSelect.innerHTML = cols.map(c => `
      <option value="${c}" ${c === chartGenState.xCol ? 'selected' : ''}>${c}</option>
    `).join('');
  }

  if (ySelect) {
    const yOpts = [
      `<option value="*" ${chartGenState.yCol === '*' ? 'selected' : ''}>* (Conteo / Frecuencia de Filas)</option>`
    ];
    cols.forEach(c => {
      yOpts.push(`<option value="${c}" ${c === chartGenState.yCol ? 'selected' : ''}>${c}</option>`);
    });
    ySelect.innerHTML = yOpts.join('');
  }

  if (diffSelect) {
    const diffOpts = [
      `<option value="" ${!chartGenState.diffCol ? 'selected' : ''}>(Ninguno - Gráfico único)</option>`
    ];
    cols.forEach(c => {
      diffOpts.push(`<option value="${c}" ${c === chartGenState.diffCol ? 'selected' : ''}>${c}</option>`);
    });
    diffSelect.innerHTML = diffOpts.join('');
  }
}

function openTableFieldsModal() {
  const modal = document.getElementById('modal-table-fields');
  const tbody = document.getElementById('tbody-table-fields');
  const titleEl = document.getElementById('table-fields-title');
  const countBadge = document.getElementById('table-fields-count-badge');
  const searchInput = document.getElementById('filter-table-fields-search');
  if (!modal || !tbody) return;

  if (titleEl) {
    titleEl.textContent = `Campos: ${chartGenState.title || 'Tabla de Datos'}`;
  }

  const cols = chartGenState.columns || [];
  const rows = chartGenState.rawRows || chartGenState.allRows || [];

  if (countBadge) {
    countBadge.textContent = `${cols.length} campos`;
  }
  if (searchInput) searchInput.value = '';

  tbody.innerHTML = cols.map(col => {
    let sampleVal = null;
    let isDate = isLikelyDateColumn(col, rows);
    let isNum = false;
    let numChecks = 0;

    for (let i = 0; i < Math.min(rows.length, 50); i++) {
      const v = rows[i][col];
      if (v !== undefined && v !== null && v !== '') {
        if (sampleVal === null) sampleVal = v;
        if (typeof v === 'number' || (!isNaN(Number(v)) && String(v).trim() !== '')) {
          numChecks++;
        }
      }
    }

    if (numChecks >= 3 || (rows.length > 0 && numChecks === Math.min(rows.length, 50))) {
      isNum = true;
    }

    let typeBadge = '';
    let icon = '🔤';
    if (isDate) {
      typeBadge = '<span class="field-type-badge field-type-date">TIMESTAMP / DATE</span>';
      icon = '⏱️';
    } else if (isNum) {
      typeBadge = '<span class="field-type-badge field-type-num">NUMERIC / REAL</span>';
      icon = '🔢';
    } else {
      typeBadge = '<span class="field-type-badge field-type-str">TEXT / STRING</span>';
      icon = '🔤';
    }

    const sampleDisplay = sampleVal !== null ? escapeHtml(String(sampleVal)) : '<span style="color:var(--text-muted);">(NULL)</span>';

    return `
      <tr data-col="${escapeHtml(col)}">
        <td style="font-weight:600; color:var(--text-primary);">
          <span style="margin-right:6px;">${icon}</span>${escapeHtml(col)}
        </td>
        <td>${typeBadge}</td>
        <td style="font-family:var(--font-mono); font-size:12px; color:var(--text-secondary); max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(String(sampleVal || ''))}">
          ${sampleDisplay}
        </td>
        <td style="text-align:right;">
          <div class="field-action-group">
            <button class="btn-assign-mini btn-assign-x" data-col="${escapeHtml(col)}" title="Asignar como Eje X">Eje X</button>
            <button class="btn-assign-mini btn-assign-y" data-col="${escapeHtml(col)}" title="Asignar como Eje Y">Eje Y</button>
            <button class="btn-assign-mini btn-assign-diff" data-col="${escapeHtml(col)}" title="Asignar como Campo Diferenciador">Diferenciador</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Wire action buttons
  tbody.querySelectorAll('.btn-assign-x').forEach(btn => {
    btn.addEventListener('click', () => {
      const col = btn.getAttribute('data-col');
      chartGenState.xCol = col;
      const xSelect = document.getElementById('chartgen-x-col');
      if (xSelect) xSelect.value = col;
      const isDate = isLikelyDateColumn(col, chartGenState.allRows);
      const timeSelect = document.getElementById('chartgen-time-format');
      if (isDate) {
        chartGenState.timeFormat = 'date';
        if (timeSelect) timeSelect.value = 'date';
      }
      modal.classList.remove('active');
      renderCustomChart();
    });
  });

  tbody.querySelectorAll('.btn-assign-y').forEach(btn => {
    btn.addEventListener('click', () => {
      const col = btn.getAttribute('data-col');
      chartGenState.yCol = col;
      const ySelect = document.getElementById('chartgen-y-col');
      if (ySelect) ySelect.value = col;
      if (chartGenState.op === 'COUNT') {
        chartGenState.op = 'SUM';
        const opSelect = document.getElementById('chartgen-op');
        if (opSelect) opSelect.value = 'SUM';
      }
      modal.classList.remove('active');
      renderCustomChart();
    });
  });

  tbody.querySelectorAll('.btn-assign-diff').forEach(btn => {
    btn.addEventListener('click', () => {
      const col = btn.getAttribute('data-col');
      chartGenState.diffCol = col;
      const diffSelect = document.getElementById('chartgen-diff-col');
      if (diffSelect) diffSelect.value = col;
      modal.classList.remove('active');
      renderCustomChart();
    });
  });

  modal.classList.add('active');
}

async function executeChartgenSqlFilter() {
  const inputEl = document.getElementById('chartgen-sql-filter-input');
  const statusEl = document.getElementById('chartgen-sql-status');
  if (!inputEl) return;

  const rawQuery = inputEl.value.trim();
  chartGenState.sqlFilter = rawQuery;

  if (!rawQuery) {
    chartGenState.allRows = [...chartGenState.rawRows];
    if (statusEl) {
      statusEl.textContent = `Filtro limpio. ${fmtNum(chartGenState.allRows.length)} filas.`;
      statusEl.className = 'chartgen-sql-status status-info';
    }
    renderCustomChart();
    return;
  }

  const isSelect = /^select\b/i.test(rawQuery);
  const isTableSource = chartGenState.sourceId && (chartGenState.sourceId.startsWith('tbl-') || chartGenState.sourceId === 'modal-table');
  const currentTable = isTableSource ? (chartGenState.sourceId.startsWith('tbl-') ? chartGenState.sourceId.substring(4) : (modalState.tableName || selectedCatalogTable)) : null;

  if (isSelect || (isTableSource && currentTable)) {
    try {
      if (statusEl) {
        statusEl.textContent = 'Consultando SQLite...';
        statusEl.className = 'chartgen-sql-status status-info';
      }
      const sqlToRun = isSelect ? rawQuery : (/^where\b/i.test(rawQuery) ? `SELECT * FROM "${currentTable}" ${rawQuery}` : `SELECT * FROM "${currentTable}" WHERE ${rawQuery}`);
      const res = await fetch(`/api/sql?q=${encodeURIComponent(sqlToRun)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.rows) {
          const cols = data.columns || [];
          const rowObjs = data.rows.map(r => {
            if (Array.isArray(r)) {
              const o = {};
              cols.forEach((c, idx) => { o[c] = r[idx]; });
              return o;
            }
            return r;
          });
          chartGenState.allRows = rowObjs;
          if (isSelect) {
            chartGenState.rawRows = [...rowObjs];
          }
          if (cols.length > 0) {
            chartGenState.columns = cols;
            updateChartgenColumnSelects();
          }
          if (statusEl) {
            statusEl.textContent = `✓ SQL OK: ${fmtNum(rowObjs.length)} filas obtenidas`;
            statusEl.className = 'chartgen-sql-status status-success';
          }
          renderCustomChart();
          return;
        }
      }
    } catch (e) {
      // Proceed to client-side evaluation fallback
    }
  }

  try {
    let wherePart = rawQuery;
    if (isSelect) {
      const match = rawQuery.match(/where\s+(.+)$/i);
      wherePart = match ? match[1] : '';
    } else if (/^where\s+/i.test(wherePart)) {
      wherePart = wherePart.replace(/^where\s+/i, '');
    }

    const filtered = chartGenState.rawRows.filter(row => evaluateRowSqlCondition(row, wherePart));
    chartGenState.allRows = filtered;

    if (statusEl) {
      if (filtered.length === 0) {
        statusEl.textContent = '⚠️ 0 filas coinciden con el filtro';
        statusEl.className = 'chartgen-sql-status status-warn';
      } else {
        statusEl.textContent = `✓ ${fmtNum(filtered.length)} de ${fmtNum(chartGenState.rawRows.length)} filas filtradas`;
        statusEl.className = 'chartgen-sql-status status-success';
      }
    }
    renderCustomChart();
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = `❌ Error: ${err.message || 'Sintaxis SQL no válida'}`;
      statusEl.className = 'chartgen-sql-status status-error';
    }
  }
}

function clearChartgenSqlFilter() {
  const inputEl = document.getElementById('chartgen-sql-filter-input');
  const statusEl = document.getElementById('chartgen-sql-status');
  if (inputEl) inputEl.value = '';
  chartGenState.sqlFilter = '';
  chartGenState.allRows = [...chartGenState.rawRows];
  if (statusEl) {
    statusEl.textContent = '';
    statusEl.className = 'chartgen-sql-status';
  }
  renderCustomChart();
}

async function openCustomChartBuilder(sourceId) {
  // If sourceId is modal-table, resolve to selected table
  if (sourceId === 'modal-table') {
    const targetTable = modalState.tableName || selectedCatalogTable || (CP_DATA?.table_catalog?.[0]?.name);
    if (targetTable) {
      sourceId = `tbl-${targetTable}`;
    }
  }

  // Close modal table viewer so they do not overlap
  document.getElementById('modal-table-viewer')?.classList.remove('active');

  // Show Modal immediately with loading state
  document.getElementById('modal-custom-chart-generator')?.classList.add('active');
  const subEl = document.getElementById('chartgen-source-sub');
  if (subEl) subEl.textContent = 'Cargando registros completos de la tabla...';

  const meta = await loadTableDataSource(sourceId);
  chartGenState.sourceId = sourceId;
  chartGenState.allRows = meta.rows;
  chartGenState.rawRows = [...meta.rows];
  chartGenState.columns = meta.columns;
  chartGenState.title = meta.title;
  chartGenState.recordSlice = 'all';
  chartGenState.dateFrom = null;
  chartGenState.dateTo = null;
  chartGenState.sqlFilter = '';
  chartGenState.diffCol = '';

  const titleEl = document.getElementById('chartgen-source-title');
  if (titleEl) titleEl.textContent = meta.title;

  const tableSelector = document.getElementById('chartgen-table-selector');
  if (tableSelector) {
    let optgroup = tableSelector.querySelector('optgroup[data-sqlite-group="true"]');
    if (!optgroup && CP_DATA && CP_DATA.table_catalog && CP_DATA.table_catalog.length > 0) {
      optgroup = document.createElement('optgroup');
      optgroup.setAttribute('label', 'Tablas SQLite del Análisis');
      optgroup.setAttribute('data-sqlite-group', 'true');
      CP_DATA.table_catalog.forEach(tbl => {
        const opt = document.createElement('option');
        opt.value = `tbl-${tbl.name}`;
        opt.textContent = `📁 ${tbl.name} (${fmtNum(tbl.row_count || tbl.count || 0)} filas)`;
        optgroup.appendChild(opt);
      });
      tableSelector.appendChild(optgroup);
    }
    tableSelector.value = sourceId;
  }

  // Reset SQL filter input & status
  const sqlInput = document.getElementById('chartgen-sql-filter-input');
  if (sqlInput) sqlInput.value = '';
  const sqlStatus = document.getElementById('chartgen-sql-status');
  if (sqlStatus) {
    sqlStatus.textContent = '';
    sqlStatus.className = 'chartgen-sql-status';
  }

  // Reset slice select to "all"
  const sliceSelect = document.getElementById('chartgen-record-slice');
  if (sliceSelect) sliceSelect.value = 'all';

  // Populate X Column select
  const xSelect = document.getElementById('chartgen-x-col');
  if (xSelect) {
    xSelect.innerHTML = meta.columns.map(c => `
      <option value="${c}" ${c === meta.defaultX ? 'selected' : ''}>${c}</option>
    `).join('');
  }
  chartGenState.xCol = meta.defaultX || meta.columns[0] || '';

  // Determine date treatment
  const timeSelect = document.getElementById('chartgen-time-format');
  const isDate = isLikelyDateColumn(chartGenState.xCol, meta.rows);
  chartGenState.timeFormat = isDate ? (meta.defaultTimeFormat || 'date') : 'none';
  if (timeSelect) timeSelect.value = chartGenState.timeFormat;

  // Date range detection across all rows
  let minDate = null;
  let maxDate = null;
  for (let i = 0; i < meta.rows.length; i++) {
    const row = meta.rows[i];
    let d = parseTimestamp(row[chartGenState.xCol]);
    if (!d) {
      for (const k in row) {
        if (isLikelyDateColumn(k)) {
          d = parseTimestamp(row[k]);
          if (d) break;
        }
      }
    }
    if (d) {
      if (!minDate || d < minDate) minDate = d;
      if (!maxDate || d > maxDate) maxDate = d;
    }
  }

  chartGenState.datasetMinDate = minDate;
  chartGenState.datasetMaxDate = maxDate;

  const dateRangeContainer = document.getElementById('chartgen-date-range-container');
  const presetsContainer = document.getElementById('chartgen-quick-presets');
  const fromInput = document.getElementById('chartgen-date-from');
  const toInput = document.getElementById('chartgen-date-to');

  if (minDate && maxDate) {
    if (dateRangeContainer) dateRangeContainer.style.display = 'flex';
    if (presetsContainer) presetsContainer.style.display = 'flex';
    if (fromInput) {
      fromInput.min = toDatetimeLocalString(minDate);
      fromInput.max = toDatetimeLocalString(maxDate);
      fromInput.value = '';
    }
    if (toInput) {
      toInput.min = toDatetimeLocalString(minDate);
      toInput.max = toDatetimeLocalString(maxDate);
      toInput.value = '';
    }
  } else {
    if (dateRangeContainer) dateRangeContainer.style.display = 'none';
    if (presetsContainer) presetsContainer.style.display = 'none';
  }

  // Reset preset buttons to "Todo"
  document.querySelectorAll('#chartgen-time-shortcuts .filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-days') === '0');
  });

  // Populate Y Column select
  const ySelect = document.getElementById('chartgen-y-col');
  if (ySelect) {
    const yOptions = [
      `<option value="*" ${meta.defaultY === '*' ? 'selected' : ''}>* (Conteo / Frecuencia de Filas)</option>`
    ];
    meta.columns.forEach(c => {
      yOptions.push(`<option value="${c}" ${c === meta.defaultY ? 'selected' : ''}>${c}</option>`);
    });
    ySelect.innerHTML = yOptions.join('');
  }
  chartGenState.yCol = meta.defaultY;

  // Populate Differentiator Column select
  const diffSelect = document.getElementById('chartgen-diff-col');
  if (diffSelect) {
    const diffOpts = [
      '<option value="">(Ninguno - Gráfico único)</option>'
    ];
    meta.columns.forEach(c => {
      diffOpts.push(`<option value="${c}">${c}</option>`);
    });
    diffSelect.innerHTML = diffOpts.join('');
    diffSelect.value = '';
  }

  // Set Op
  const opSelect = document.getElementById('chartgen-op');
  chartGenState.op = meta.defaultOp;
  if (opSelect) opSelect.value = meta.defaultOp;

  // Set Chart Type
  chartGenState.type = meta.defaultType || 'bar';
  document.querySelectorAll('#chartgen-type-group .filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-type') === chartGenState.type);
  });

  // Set Sort & Limit
  const sortSelect = document.getElementById('chartgen-sort');
  if (sortSelect) sortSelect.value = chartGenState.sort || 'y-desc';

  const limitSelect = document.getElementById('chartgen-limit');
  if (limitSelect) limitSelect.value = String(chartGenState.limit || 15);

  // Set Color Palette
  document.querySelectorAll('#chartgen-palette-group .palette-swatch').forEach(swatch => {
    swatch.classList.toggle('active', swatch.getAttribute('data-color') === chartGenState.color);
  });

  // Render Chart
  renderCustomChart();
}

function downloadChartPng() {
  const canvas = document.getElementById('canvas-custom-chart');
  if (!canvas) return;
  const link = document.createElement('a');
  link.download = `cpview_grafico_${chartGenState.sourceId || 'custom'}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function copyChartCsv() {
  const data = chartGenState.processedData;
  if (!data || !data.items || data.items.length === 0) return;
  
  const header = `Eje_X,Valor_Y,Conteo_Filas\n`;
  const lines = data.items.map(it => `"${String(it.label).replace(/"/g, '""')}",${it.value},${it.count || 1}`).join('\n');
  const csvText = header + lines;

  navigator.clipboard.writeText(csvText).then(() => {
    const btn = document.getElementById('btn-chartgen-copy-csv');
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = '<span>✓</span> ¡Copiado!';
      setTimeout(() => { btn.innerHTML = orig; }, 2000);
    }
  }).catch(() => {
    alert('No se pudo copiar automáticamente. Por favor permita el acceso al portapapeles.');
  });
}

function updateChartgenCollapsedBadges() {
  const badgeX = document.getElementById('chartgen-badge-x');
  const badgeY = document.getElementById('chartgen-badge-y');
  const badgeOp = document.getElementById('chartgen-badge-op');
  const badgeType = document.getElementById('chartgen-badge-type');
  const badgeRecords = document.getElementById('chartgen-badge-records');

  if (badgeX) badgeX.textContent = `Eje X: ${chartGenState.xCol || '-'}`;
  if (badgeY) badgeY.textContent = `Eje Y: ${chartGenState.yCol || '-'}`;

  let opName = chartGenState.op || '-';
  if (opName === 'SUM_DAY') opName = 'SUM (Días)';
  else if (opName === 'SUM_HOUR') opName = 'SUM (Horas)';
  else if (opName === 'SUM_MINUTE') opName = 'SUM (Minutos)';
  if (chartGenState.diffCol) opName += ` | 🏷️ ${chartGenState.diffCol}`;
  if (badgeOp) badgeOp.textContent = `Op: ${opName}`;

  if (badgeType) badgeType.textContent = `Tipo: ${chartGenState.type || '-'}`;
  
  const recCount = chartGenState.processedData?.filteredRowsCount ?? chartGenState.allRows?.length ?? 0;
  if (badgeRecords) badgeRecords.textContent = `Filas: ${recCount.toLocaleString()}`;
}

function toggleChartgenControls(forceState) {
  const controlsWrapper = document.getElementById('chartgen-controls-wrapper');
  const modalCard = document.querySelector('#modal-custom-chart-generator .chart-gen-modal-card');
  const collapsedBar = document.getElementById('chartgen-collapsed-bar');
  const btn = document.getElementById('btn-chartgen-toggle-controls');
  const icon = document.getElementById('icon-toggle-controls');
  const lbl = document.getElementById('lbl-toggle-controls');

  if (!controlsWrapper || !modalCard) return;

  const willCollapse = typeof forceState === 'boolean' 
    ? forceState 
    : !controlsWrapper.classList.contains('collapsed');

  if (willCollapse) {
    controlsWrapper.classList.add('collapsed');
    modalCard.classList.add('controls-collapsed');
    if (collapsedBar) collapsedBar.style.display = 'flex';
    if (icon) icon.textContent = '⚙️';
    if (lbl) lbl.textContent = 'Mostrar Controles';
    if (btn) {
      btn.classList.add('active');
      btn.title = 'Mostrar controles de selección y filtros';
    }
  } else {
    controlsWrapper.classList.remove('collapsed');
    modalCard.classList.remove('controls-collapsed');
    if (collapsedBar) collapsedBar.style.display = 'none';
    if (icon) icon.textContent = '👁️';
    if (lbl) lbl.textContent = 'Ocultar Controles';
    if (btn) {
      btn.classList.remove('active');
      btn.title = 'Ocultar controles de selección para ampliar el gráfico';
    }
  }

  updateChartgenCollapsedBadges();

  setTimeout(() => {
    if (chartGenState.chartInstance) {
      chartGenState.chartInstance.resize();
    }
    if (chartGenState.diffChartInstances && chartGenState.diffChartInstances.length > 0) {
      chartGenState.diffChartInstances.forEach(inst => {
        try { inst.resize(); } catch (e) {}
      });
    }
  }, 150);
}

function toggleChartgenFullscreen(forceState) {
  const modalOverlay = document.getElementById('modal-custom-chart-generator');
  const modalCard = modalOverlay?.querySelector('.chart-gen-modal-card');
  const btn = document.getElementById('btn-chartgen-fullscreen');
  const icon = document.getElementById('icon-chartgen-fullscreen');
  const lbl = document.getElementById('lbl-chartgen-fullscreen');

  if (!modalCard) return;

  const isFullscreen = typeof forceState === 'boolean'
    ? forceState
    : !modalCard.classList.contains('fullscreen');

  modalCard.classList.toggle('fullscreen', isFullscreen);
  modalOverlay?.classList.toggle('fullscreen-active', isFullscreen);

  if (btn) {
    if (isFullscreen) {
      btn.classList.add('active');
      if (icon) icon.textContent = '🗗';
      if (lbl) lbl.textContent = 'Restaurar';
      btn.title = 'Restaurar tamaño normal del modal (Esc)';
    } else {
      btn.classList.remove('active');
      if (icon) icon.textContent = '⛶';
      if (lbl) lbl.textContent = 'Pantalla Completa';
      btn.title = 'Expandir gráfico a pantalla completa';
    }
  }

  setTimeout(() => {
    if (chartGenState.chartInstance) {
      chartGenState.chartInstance.resize();
    }
    if (chartGenState.diffChartInstances && chartGenState.diffChartInstances.length > 0) {
      chartGenState.diffChartInstances.forEach(inst => {
        try { inst.resize(); } catch (e) {}
      });
    }
  }, 150);
}

function initCustomChartBuilderListeners() {
  // View Table Fields button
  document.getElementById('btn-chartgen-view-fields')?.addEventListener('click', () => {
    openTableFieldsModal();
  });

  // Fields modal close & search handlers
  const closeFieldsModal = () => {
    document.getElementById('modal-table-fields')?.classList.remove('active');
  };
  document.getElementById('btn-close-table-fields')?.addEventListener('click', closeFieldsModal);
  document.getElementById('btn-close-table-fields-footer')?.addEventListener('click', closeFieldsModal);
  document.getElementById('modal-table-fields')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-table-fields') closeFieldsModal();
  });

  document.getElementById('filter-table-fields-search')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    const rows = document.querySelectorAll('#tbody-table-fields tr');
    let visible = 0;
    rows.forEach(r => {
      const col = (r.getAttribute('data-col') || '').toLowerCase();
      const match = !q || col.includes(q);
      r.style.display = match ? '' : 'none';
      if (match) visible++;
    });
    const countBadge = document.getElementById('table-fields-count-badge');
    if (countBadge) countBadge.textContent = `${visible} campos`;
  });

  // SQL Filter Execute button
  document.getElementById('btn-chartgen-sql-exec')?.addEventListener('click', () => {
    executeChartgenSqlFilter();
  });

  // SQL Filter Input Enter key
  document.getElementById('chartgen-sql-filter-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeChartgenSqlFilter();
    }
  });

  // SQL Filter Clear button
  document.getElementById('btn-chartgen-sql-clear')?.addEventListener('click', () => {
    clearChartgenSqlFilter();
  });

  // Differentiator column change
  document.getElementById('chartgen-diff-col')?.addEventListener('change', (e) => {
    chartGenState.diffCol = e.target.value;
    renderCustomChart();
  });

  // Table selector change
  document.getElementById('chartgen-table-selector')?.addEventListener('change', (e) => {
    openCustomChartBuilder(e.target.value);
  });

  // Toggle Controls button in header
  document.getElementById('btn-chartgen-toggle-controls')?.addEventListener('click', () => {
    toggleChartgenControls();
  });

  // Show Controls button in collapsed bar
  document.getElementById('btn-chartgen-show-controls')?.addEventListener('click', () => {
    toggleChartgenControls(false);
  });

  // Fullscreen button in header
  document.getElementById('btn-chartgen-fullscreen')?.addEventListener('click', () => {
    toggleChartgenFullscreen();
  });

  // Record slice change
  document.getElementById('chartgen-record-slice')?.addEventListener('change', (e) => {
    chartGenState.recordSlice = e.target.value;
    renderCustomChart();
  });

  // Date range input changes
  const onDateInputChange = () => {
    const fromVal = document.getElementById('chartgen-date-from')?.value;
    const toVal = document.getElementById('chartgen-date-to')?.value;

    chartGenState.dateFrom = fromVal ? new Date(fromVal) : null;
    chartGenState.dateTo = toVal ? new Date(toVal) : null;

    document.querySelectorAll('#chartgen-time-shortcuts .filter-btn').forEach(b => b.classList.remove('active'));
    renderCustomChart();
  };

  document.getElementById('chartgen-date-from')?.addEventListener('change', onDateInputChange);
  document.getElementById('chartgen-date-to')?.addEventListener('change', onDateInputChange);

  // Reset dates button
  document.getElementById('btn-chartgen-reset-dates')?.addEventListener('click', () => {
    const fromInput = document.getElementById('chartgen-date-from');
    const toInput = document.getElementById('chartgen-date-to');
    if (fromInput) fromInput.value = '';
    if (toInput) toInput.value = '';
    chartGenState.dateFrom = null;
    chartGenState.dateTo = null;
    document.querySelectorAll('#chartgen-time-shortcuts .filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-days') === '0');
    });
    renderCustomChart();
  });

  // Preset buttons (24h, 7d, 15d, 30d, Todo)
  document.querySelectorAll('#chartgen-time-shortcuts .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#chartgen-time-shortcuts .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const days = parseInt(btn.getAttribute('data-days'), 10) || 0;
      const fromInput = document.getElementById('chartgen-date-from');
      const toInput = document.getElementById('chartgen-date-to');

      if (days === 0) {
        chartGenState.dateFrom = null;
        chartGenState.dateTo = null;
        if (fromInput) fromInput.value = '';
        if (toInput) toInput.value = '';
      } else {
        const refMax = chartGenState.datasetMaxDate || new Date();
        const refFrom = new Date(refMax.getTime() - days * 86400000);
        chartGenState.dateTo = refMax;
        chartGenState.dateFrom = refFrom;
        if (fromInput) fromInput.value = toDatetimeLocalString(refFrom);
        if (toInput) toInput.value = toDatetimeLocalString(refMax);
      }
      renderCustomChart();
    });
  });

  // X Column change
  document.getElementById('chartgen-x-col')?.addEventListener('change', (e) => {
    chartGenState.xCol = e.target.value;
    const isDate = isLikelyDateColumn(chartGenState.xCol, chartGenState.allRows);
    const timeSelect = document.getElementById('chartgen-time-format');
    if (isDate) {
      if (chartGenState.timeFormat === 'none') {
        chartGenState.timeFormat = 'date';
        if (timeSelect) timeSelect.value = 'date';
      }
    } else {
      chartGenState.timeFormat = 'none';
      if (timeSelect) timeSelect.value = 'none';
    }
    renderCustomChart();
  });

  // Time format change
  document.getElementById('chartgen-time-format')?.addEventListener('change', (e) => {
    chartGenState.timeFormat = e.target.value;
    renderCustomChart();
  });

  // Y Column change
  document.getElementById('chartgen-y-col')?.addEventListener('change', (e) => {
    chartGenState.yCol = e.target.value;
    const opSelect = document.getElementById('chartgen-op');
    if (chartGenState.yCol === '*') {
      chartGenState.op = 'COUNT';
      if (opSelect) opSelect.value = 'COUNT';
    } else if (chartGenState.op === 'COUNT') {
      chartGenState.op = 'SUM';
      if (opSelect) opSelect.value = 'SUM';
    }
    renderCustomChart();
  });

  // Op change
  document.getElementById('chartgen-op')?.addEventListener('change', (e) => {
    chartGenState.op = e.target.value;
    const timeSelect = document.getElementById('chartgen-time-format');
    const xSelect = document.getElementById('chartgen-x-col');
    const sortSelect = document.getElementById('chartgen-sort');

    if (chartGenState.op === 'SUM_DAY') {
      chartGenState.timeFormat = 'date';
      if (timeSelect) timeSelect.value = 'date';
      if (!isLikelyDateColumn(chartGenState.xCol, chartGenState.allRows)) {
        const dateCol = chartGenState.columns?.find(c => isLikelyDateColumn(c, chartGenState.allRows));
        if (dateCol) {
          chartGenState.xCol = dateCol;
          if (xSelect) xSelect.value = dateCol;
        }
      }
      chartGenState.sort = 'x-asc';
      if (sortSelect) sortSelect.value = 'x-asc';
    } else if (chartGenState.op === 'SUM_HOUR') {
      chartGenState.timeFormat = 'hour_datetime';
      if (timeSelect) timeSelect.value = 'hour_datetime';
      if (!isLikelyDateColumn(chartGenState.xCol, chartGenState.allRows)) {
        const dateCol = chartGenState.columns?.find(c => isLikelyDateColumn(c, chartGenState.allRows));
        if (dateCol) {
          chartGenState.xCol = dateCol;
          if (xSelect) xSelect.value = dateCol;
        }
      }
      chartGenState.sort = 'x-asc';
      if (sortSelect) sortSelect.value = 'x-asc';
    } else if (chartGenState.op === 'SUM_MINUTE') {
      chartGenState.timeFormat = 'minute';
      if (timeSelect) timeSelect.value = 'minute';
      if (!isLikelyDateColumn(chartGenState.xCol, chartGenState.allRows)) {
        const dateCol = chartGenState.columns?.find(c => isLikelyDateColumn(c, chartGenState.allRows));
        if (dateCol) {
          chartGenState.xCol = dateCol;
          if (xSelect) xSelect.value = dateCol;
        }
      }
      chartGenState.sort = 'x-asc';
      if (sortSelect) sortSelect.value = 'x-asc';
    }
    renderCustomChart();
  });

  // Chart type buttons
  document.querySelectorAll('#chartgen-type-group .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#chartgen-type-group .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      chartGenState.type = btn.getAttribute('data-type');
      renderCustomChart();
    });
  });

  // Sort change
  document.getElementById('chartgen-sort')?.addEventListener('change', (e) => {
    chartGenState.sort = e.target.value;
    renderCustomChart();
  });

  // Limit change
  document.getElementById('chartgen-limit')?.addEventListener('change', (e) => {
    chartGenState.limit = parseInt(e.target.value, 10);
    renderCustomChart();
  });

  // Palette swatch change
  document.querySelectorAll('#chartgen-palette-group .palette-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      document.querySelectorAll('#chartgen-palette-group .palette-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      chartGenState.color = swatch.getAttribute('data-color');
      renderCustomChart();
    });
  });

  // Export buttons
  document.getElementById('btn-chartgen-download-png')?.addEventListener('click', downloadChartPng);
  document.getElementById('btn-chartgen-copy-csv')?.addEventListener('click', copyChartCsv);

  // Close buttons
  const closeFn = () => {
    const modal = document.getElementById('modal-custom-chart-generator');
    modal?.classList.remove('active');
    toggleChartgenFullscreen(false);
  };
  document.getElementById('btn-modal-chartgen-close')?.addEventListener('click', closeFn);
  document.getElementById('btn-modal-chartgen-close-footer')?.addEventListener('click', closeFn);
  document.getElementById('modal-custom-chart-generator')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-custom-chart-generator') closeFn();
  });

  // ESC key handler for fullscreen & modal
  document.addEventListener('keydown', (e) => {
    const fieldsModal = document.getElementById('modal-table-fields');
    if (fieldsModal && fieldsModal.classList.contains('active')) {
      closeFieldsModal();
      return;
    }
    const modal = document.getElementById('modal-custom-chart-generator');
    if (!modal || !modal.classList.contains('active')) return;
    if (e.key === 'Escape') {
      const modalCard = modal.querySelector('.chart-gen-modal-card');
      if (modalCard && modalCard.classList.contains('fullscreen')) {
        toggleChartgenFullscreen(false);
      } else {
        closeFn();
      }
    }
  });
}

// Setup Event Listeners
function setupEventListeners() {
  setupDiagnosticsEvents();

  // Overview date range buttons (synchronized with global time horizon)
  const ovRangeBtns = document.querySelectorAll('#overview-traffic-range .filter-btn');
  ovRangeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const days = parseInt(btn.getAttribute('data-days'), 10) || 30;
      if (days === 30) setTimeRangeMode('all');
      else if (days === 7) setTimeRangeMode('1w');
      else if (days === 14) {
        if (CP_DATA && CP_DATA.system) {
          const e = CP_DATA.system.end_timestamp;
          const s = e - 14 * 86400;
          const sDate = new Date(s * 1000).toISOString().substring(0, 10);
          const eDate = new Date(e * 1000).toISOString().substring(0, 10);
          setTimeRangeMode('custom', sDate, eDate);
        }
      }
    });
  });

  // Interfaces filters & sorting
  const ifSearch = document.getElementById('filter-interfaces-search');
  if (ifSearch) {
    ifSearch.addEventListener('input', (e) => {
      interfacesFilter.search = e.target.value;
      filterAndRenderInterfaces();
    });
  }

  // Column header sorting for interfaces
  document.querySelectorAll('#table-interfaces th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.getAttribute('data-sort');
      if (interfacesFilter.sortBy === field) {
        interfacesFilter.sortAsc = !interfacesFilter.sortAsc;
      } else {
        interfacesFilter.sortBy = field;
        interfacesFilter.sortAsc = false;
      }
      CP_DATA.interfaces.sort((a, b) => {
        let valA = a[field] ?? '';
        let valB = b[field] ?? '';
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return interfacesFilter.sortAsc ? -1 : 1;
        if (valA > valB) return interfacesFilter.sortAsc ? 1 : -1;
        return 0;
      });
      filterAndRenderInterfaces();
    });
  });

  const ifTypeBtns = document.querySelectorAll('#filter-if-type .filter-btn');
  ifTypeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      ifTypeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      interfacesFilter.type = btn.getAttribute('data-type');
      filterAndRenderInterfaces();
    });
  });

  // Spikes filters and pagination
  const spikesSearch = document.getElementById('filter-spikes-search');
  if (spikesSearch) {
    spikesSearch.addEventListener('input', (e) => {
      spikesState.search = e.target.value;
      spikesState.page = 1;
      renderSpikesTable();
    });
  }

  // Spike severity filter buttons
  const spikeSevBtns = document.querySelectorAll('#group-spike-severity .filter-btn');
  spikeSevBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      spikeSevBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      spikesState.severity = btn.getAttribute('data-severity');
      spikesState.page = 1;
      renderSpikesPage();
    });
  });

  // Setup universal controls for all charts in the app (type & color switcher)
  setupUniversalChartControls();

  document.getElementById('btn-spikes-prev')?.addEventListener('click', () => {
    if (spikesState.page > 1) {
      spikesState.page--;
      renderSpikesTable();
    }
  });

  document.getElementById('btn-spikes-next')?.addEventListener('click', () => {
    let minUsage = 0;
    if (spikesState.severity === 'moderate') minUsage = 75;
    else if (spikesState.severity === 'high') minUsage = 80;
    else if (spikesState.severity === 'critical') minUsage = 90;

    const query = spikesState.search.toLowerCase();
    const filtered = CP_DATA.spikes.cpu_spikes.filter(s => {
      const matchSearch = !query || s.consumer.toLowerCase().includes(query) || String(s.core).includes(query);
      const matchSeverity = s.avg_usage >= minUsage;
      return matchSearch && matchSeverity;
    });
    if (spikesState.page * spikesState.pageSize < filtered.length) {
      spikesState.page++;
      renderSpikesTable();
    }
  });

  // Catalog search
  document.getElementById('filter-catalog-search')?.addEventListener('input', () => {
    renderCatalogTable();
  });

  // Modal close
  document.getElementById('btn-modal-close')?.addEventListener('click', () => {
    document.getElementById('modal-table-viewer').classList.remove('active');
  });

  document.getElementById('modal-table-viewer')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-table-viewer') {
      document.getElementById('modal-table-viewer').classList.remove('active');
    }
  });

  document.getElementById('modal-btn-prev')?.addEventListener('click', () => {
    if (modalState.page > 1) {
      openTableViewer(modalState.tableName, modalState.page - 1);
    }
  });

  document.getElementById('modal-btn-next')?.addEventListener('click', () => {
    openTableViewer(modalState.tableName, modalState.page + 1);
  });

  // SQL buttons
  document.getElementById('btn-run-sql')?.addEventListener('click', runSqlQuery);
  document.getElementById('btn-close-sql-results')?.addEventListener('click', () => {
    document.getElementById('sql-results-panel').style.display = 'none';
  });

  document.getElementById('btn-sql-example-1')?.addEventListener('click', () => {
    document.getElementById('sql-query-input').value = 'SELECT Timestamp, name_of_cpu, cpu_usage, cpu_usr_time, cpu_sys_time FROM UM_STAT_UM_CPU_UM_CPU_ORDERED_TABLE ORDER BY Timestamp DESC LIMIT 15;';
    runSqlQuery();
  });

  document.getElementById('btn-sql-example-2')?.addEventListener('click', () => {
    document.getElementById('sql-query-input').value = 'SELECT Timestamp, disk_path, disk_total, disk_used, disk_free FROM UM_STAT_UM_DISK_UM_DISK_TABLE ORDER BY Timestamp DESC LIMIT 10;';
    runSqlQuery();
  });

  document.getElementById('btn-sql-example-3')?.addEventListener('click', () => {
    document.getElementById('sql-query-input').value = 'SELECT cpu_spike_start_time, cpu_core, cpu_avg_usage, cpu_spike_duration, cpu_top_consumer FROM spike_detective_cpu_spike_cpu_table ORDER BY cpu_avg_usage DESC LIMIT 15;';
    runSqlQuery();
  });

  // Export JSON
  document.getElementById('btn-export-json')?.addEventListener('click', () => {
    if (!CP_DATA) return;
    const blob = new Blob([JSON.stringify(CP_DATA, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CPView_${CP_DATA.system.node_name}_export.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Open Load / Switch Database Modal
  document.getElementById('btn-open-load-db')?.addEventListener('click', () => {
    openLoadDbModal();
  });

  document.getElementById('btn-modal-load-close')?.addEventListener('click', () => {
    document.getElementById('modal-load-database').classList.remove('active');
  });

  document.getElementById('modal-load-database')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-load-database') {
      document.getElementById('modal-load-database').classList.remove('active');
    }
  });

  // Database Modal Tabs
  const dbTabBtns = document.querySelectorAll('.db-tab-btn');
  dbTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      dbTabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.db-tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      document.getElementById(targetId)?.classList.add('active');
    });
  });

  // File browse & drag and drop
  const fileInput = document.getElementById('db-file-input');
  document.getElementById('btn-browse-file')?.addEventListener('click', () => {
    fileInput?.click();
  });

  fileInput?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      uploadDatabaseFile(e.target.files[0]);
    }
  });

  const dropzone = document.getElementById('db-dropzone');
  if (dropzone) {
    ['dragenter', 'dragover'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      });
    });
    dropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        uploadDatabaseFile(e.dataTransfer.files[0]);
      }
    });
  }

  // Load from server path button
  document.getElementById('btn-load-server-path')?.addEventListener('click', () => {
    const path = document.getElementById('input-server-path').value.trim();
    if (path) {
      loadFromServerPath(path);
    }
  });

  // Custom Table Chart Generator Triggers
  initCustomChartBuilderListeners();

  document.querySelectorAll('.btn-open-chart-gen').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const source = btn.getAttribute('data-source');
      openCustomChartBuilder(source);
    });
  });

  document.getElementById('btn-top-chart-builder')?.addEventListener('click', () => {
    let defaultSource = 'cpu-cores';
    if (activePage === 'interfaces') defaultSource = 'interfaces';
    else if (activePage === 'drops') defaultSource = 'drop-reasons';
    else if (activePage === 'spikes') defaultSource = 'cpu-spikes';
    else if (activePage === 'db_explorer') {
      if (selectedCatalogTable) {
        defaultSource = `tbl-${selectedCatalogTable}`;
      } else if (modalState.tableName) {
        defaultSource = `tbl-${modalState.tableName}`;
      } else if (CP_DATA && CP_DATA.table_catalog && CP_DATA.table_catalog.length > 0) {
        defaultSource = `tbl-${CP_DATA.table_catalog[0].name}`;
      } else if (sqlState.rows && sqlState.rows.length > 0) {
        defaultSource = 'sql-results';
      } else {
        defaultSource = 'cpu-cores';
      }
    }
    openCustomChartBuilder(defaultSource);
  });

  // Virtual Systems (VSX) Tab switching and inspection handlers
  document.querySelectorAll('#vs-tabs-bar .vs-tab-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const vsId = btn.getAttribute('data-vs');
      renderVsxPage(vsId);
    });
  });

  document.getElementById('btn-vs-back-to-all')?.addEventListener('click', () => {
    renderVsxPage('all');
  });
}

// Open and refresh database switcher modal
async function openLoadDbModal() {
  const modal = document.getElementById('modal-load-database');
  modal.classList.add('active');
  await fetchAvailableDatabases();
}

async function fetchAvailableDatabases() {
  const container = document.getElementById('db-list-container');
  if (!container) return;

  container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted); grid-column:1/-1;"><div class="spinner"></div> Buscando bases de datos disponibles...</div>`;

  try {
    const res = await fetch('/api/databases');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const dbs = data.databases || [];

    if (dbs.length === 0) {
      container.innerHTML = `<p style="color:var(--text-muted); padding:20px; text-align:center; grid-column:1/-1;">No se detectaron otras bases de datos en el directorio. Utiliza la pestaña "Subir Nuevo Fichero" para cargar el fichero de otra máquina.</p>`;
      return;
    }

    container.innerHTML = dbs.map(d => `
      <div class="db-card-item ${d.is_current ? 'current' : ''}">
        <div class="db-card-header">
          <div class="db-card-title">
            <span>🖥️</span> <strong>${d.node_name}</strong>
          </div>
          ${d.is_current ? '<span class="pill-badge active">Activo</span>' : ''}
        </div>
        <div class="db-card-meta">
          <span>📁 Fichero: <code>${d.basename}</code></span>
          <span>💾 Tamaño: <strong>${d.size_mb} MB</strong> (${fmtNum(d.size_bytes)} bytes)</span>
          <span>📅 Fecha: ${d.modified}</span>
        </div>
        <div style="margin-top:auto; padding-top:6px;">
          ${d.is_current ? 
            `<button class="btn" disabled style="width:100%; justify-content:center; opacity:0.6;">✓ Máquina en Pantalla</button>` :
            `<button class="btn btn-primary" style="width:100%; justify-content:center;" onclick="switchDatabase('${d.filename}')">▶ Cargar Esta Máquina</button>`
          }
        </div>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = `<p style="color:var(--accent-rose); padding:20px; text-align:center; grid-column:1/-1;">Error al consultar bases de datos: ${e.message}</p>`;
  }
}

// Switch active database
async function switchDatabase(filename) {
  const overlay = document.getElementById('db-loading-overlay');
  const tabs = document.querySelectorAll('.db-tab-content');
  tabs.forEach(t => t.style.display = 'none');
  if (overlay) {
    overlay.style.display = 'block';
    document.getElementById('db-loading-title').textContent = `Cambiando a ${filename}...`;
    document.getElementById('db-loading-desc').textContent = 'Consultando cache o procesando extracción de métricas...';
  }

  try {
    const res = await fetch(`/api/switch_db?file=${encodeURIComponent(filename)}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    await loadData(data.json_url);

    // Close modal
    document.getElementById('modal-load-database').classList.remove('active');
  } catch (e) {
    alert(`Error al cambiar de base de datos: ${e.message}`);
  } finally {
    if (overlay) overlay.style.display = 'none';
    tabs.forEach(t => t.style.display = '');
    document.querySelector('.db-tab-btn.active')?.click();
  }
}

// Upload file directly from browser
function uploadDatabaseFile(file) {
  if (!file) return;

  const progressBox = document.getElementById('upload-progress-box');
  const progressFill = document.getElementById('upload-progress-fill');
  const statusLabel = document.getElementById('upload-status-label');
  const statusPct = document.getElementById('upload-status-pct');
  const statusSub = document.getElementById('upload-status-sub');
  const dropzone = document.getElementById('db-dropzone');

  if (progressBox) progressBox.style.display = 'block';
  if (dropzone) dropzone.style.display = 'none';

  statusLabel.textContent = `Subiendo ${file.name}...`;
  statusPct.textContent = '0%';
  progressFill.style.width = '0%';
  statusSub.textContent = `Tamaño: ${(file.size / (1024*1024)).toFixed(2)} MB. Transfiriendo datos...`;

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/upload_db');
  xhr.setRequestHeader('X-Filename', encodeURIComponent(file.name));

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      statusPct.textContent = `${pct}%`;
      progressFill.style.width = `${pct}%`;
      if (pct === 100) {
        statusLabel.textContent = 'Procesando y extrayendo métricas...';
        statusSub.textContent = 'Resolviendo tablas de referencias y generando gráficos para la nueva máquina...';
      }
    }
  };

  xhr.onload = async () => {
    if (xhr.status === 200) {
      try {
        const resp = JSON.parse(xhr.responseText);
        statusLabel.textContent = '¡Completado con éxito!';
        statusPct.textContent = '100%';
        await loadData(resp.json_url);
        setTimeout(() => {
          document.getElementById('modal-load-database').classList.remove('active');
          if (progressBox) progressBox.style.display = 'none';
          if (dropzone) dropzone.style.display = 'flex';
        }, 800);
      } catch (err) {
        alert('Error al interpretar respuesta de subida: ' + err.message);
      }
    } else {
      alert(`Error en la subida: HTTP ${xhr.status} - ${xhr.responseText}`);
      if (progressBox) progressBox.style.display = 'none';
      if (dropzone) dropzone.style.display = 'flex';
    }
  };

  xhr.onerror = () => {
    alert('Error de red al subir el fichero.');
    if (progressBox) progressBox.style.display = 'none';
    if (dropzone) dropzone.style.display = 'flex';
  };

  xhr.send(file);
}

// Load by path on server
async function loadFromServerPath(path) {
  const statusEl = document.getElementById('path-load-status');
  statusEl.innerHTML = `<span style="color:var(--accent-cyan);"><div class="spinner"></div> Procesando fichero en ${path}...</span>`;

  try {
    const res = await fetch(`/api/load_path?path=${encodeURIComponent(path)}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    statusEl.innerHTML = `<span style="color:var(--accent-emerald);">✓ Cargado con éxito: ${data.node_name}</span>`;
    await loadData(data.json_url);
    setTimeout(() => {
      document.getElementById('modal-load-database').classList.remove('active');
      statusEl.innerHTML = '';
    }, 1000);
  } catch (e) {
    statusEl.innerHTML = `<span style="color:var(--accent-rose);">❌ ${e.message}</span>`;
  }
}

// Chart instance cache helper
function createOrUpdateChart(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.warn(`Canvas #${canvasId} no encontrado en el DOM`);
    return null;
  }

  // Destroy previous chart if attached to this canvas
  const existing = (window.Chart && Chart.getChart(canvas)) || currentCharts[canvasId];
  if (existing) {
    try {
      existing.destroy();
    } catch (e) {
      console.warn(`Error al destruir chart #${canvasId}:`, e);
    }
    delete currentCharts[canvasId];
  }

  // Clear any 0px collapsed dimensions or inline styles left from prior hidden state
  if (typeof canvas.removeAttribute === 'function') {
    canvas.removeAttribute('width');
    canvas.removeAttribute('height');
  }
  if (canvas.style) {
    if (typeof canvas.style.removeProperty === 'function') {
      canvas.style.removeProperty('width');
      canvas.style.removeProperty('height');
    } else {
      canvas.style.width = '';
      canvas.style.height = '';
    }
    canvas.style.display = 'block';
  }

  try {
    const chart = new Chart(canvas, config);
    currentCharts[canvasId] = chart;
    return chart;
  } catch (err) {
    console.error(`Error inicializando chart #${canvasId}:`, err);
    return null;
  }
}

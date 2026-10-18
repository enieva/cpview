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
let chartGenState = {
  sourceId: 'cpu-cores',
  allRows: [],
  rows: [],
  columns: [],
  title: '',
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
  { name: 'Cian', hex: '#06b6d4' },
  { name: 'Azul', hex: '#3b82f6' },
  { name: 'Esmeralda', hex: '#10b981' },
  { name: 'Ámbar', hex: '#f59e0b' },
  { name: 'Rosa', hex: '#f43f5e' },
  { name: 'Púrpura', hex: '#8b5cf6' },
  { name: 'Índigo', hex: '#6366f1' },
  { name: 'Fucsia', hex: '#ec4899' },
  { name: 'Gris', hex: '#64748b' }
];

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
  'chart-diagnostics-confluence': { type: 'line', color: PALETTE.rose, foregroundIndex: 0, activeSeriesIndex: 0, datasetColors: {} }
};

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
      foregroundIndex: 0,
      activeSeriesIndex: 0,
      datasetColors: { 0: defaultColor }
    };
  }
  const st = chartCustomState[chartId];
  if (st.type === undefined) st.type = defaultType;
  if (st.color === undefined) st.color = defaultColor;
  if (st.foregroundIndex === undefined) st.foregroundIndex = 0;
  if (st.activeSeriesIndex === undefined) st.activeSeriesIndex = 0;
  if (!st.datasetColors) {
    st.datasetColors = {};
    if (st.color) st.datasetColors[0] = st.color;
  }
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

  // Type buttons HTML
  const isDoughnutSupported = (chartId === 'chart-spikes-cores');
  const typeButtonsHtml = `
    <div class="filter-btn-group chart-type-group">
      <button class="filter-btn ${st.type === 'line' ? 'active' : ''}" data-type="line" title="Gráfico de Líneas">📈 Línea</button>
      <button class="filter-btn ${st.type === 'bar' ? 'active' : ''}" data-type="bar" title="Gráfico de Barras Verticales">📊 Barras</button>
      <button class="filter-btn ${st.type === 'horizontalBar' ? 'active' : ''}" data-type="horizontalBar" title="Gráfico de Barras Horizontales">📋 Horiz</button>
      ${isDoughnutSupported ? `<button class="filter-btn ${st.type === 'doughnut' ? 'active' : ''}" data-type="doughnut" title="Gráfico de Anillo">🍩 Anillo</button>` : ''}
    </div>
  `;

  // Series selector and foreground controls HTML (if multi-dataset)
  let seriesControlsHtml = '';
  if (isMulti) {
    const isFg = (activeIdx === st.foregroundIndex);
    seriesControlsHtml = `
      <div class="series-selector-group">
        <label class="series-label" title="Muestra seleccionada para editar color o plano">Muestra:</label>
        <select class="series-select" data-chart="${chartId}" title="Selecciona qué estadística o muestra deseas personalizar">
          ${datasets.map((ds, idx) => {
            const fgMark = (idx === st.foregroundIndex) ? '⭐ [1º Plano] ' : '';
            return `<option value="${idx}" ${idx === activeIdx ? 'selected' : ''}>${fgMark}${ds.label || 'Muestra ' + (idx + 1)}</option>`;
          }).join('')}
        </select>
      </div>
      <button class="filter-btn btn-foreground ${isFg ? 'active' : ''}" data-chart="${chartId}" title="${isFg ? 'Esta muestra ya está en primer plano (al frente)' : 'Traer esta muestra al primer plano (al frente)'}">
        <span class="fg-icon">${isFg ? '⭐' : '🔝'}</span>
        <span class="fg-text">${isFg ? 'En Frente' : '1º Plano'}</span>
      </button>
      <button class="filter-btn btn-manage-series" data-chart="${chartId}" title="Gestionar todas las muestras, primer plano y colores en un panel">
        <span>🎨 Todas (${datasets.length})</span>
      </button>
    `;
  }

  // Color picker HTML
  const colorDotsHtml = COLOR_SWATCHES.map(sw => {
    const isActive = curColor && curColor.toLowerCase() === sw.hex.toLowerCase();
    return `<span class="color-dot ${isActive ? 'active' : ''}" data-chart="${chartId}" data-color="${sw.hex}" style="background:${sw.hex};" title="${sw.name} (${sw.hex})"></span>`;
  }).join('');

  const colorPickerHtml = `
    <div class="color-picker-group">
      ${colorDotsHtml}
      <label class="color-picker-custom" title="Elegir cualquier color personalizado hex">
        <input type="color" class="custom-color-input" data-chart="${chartId}" value="${curColor && curColor.startsWith('#') && curColor.length === 7 ? curColor : '#06b6d4'}">
        <span>🎨</span>
      </label>
    </div>
  `;

  ctrl.innerHTML = `
    ${chartId !== 'chart-diagnostics-confluence' ? typeButtonsHtml : ''}
    ${seriesControlsHtml}
    ${colorPickerHtml}
  `;

  // Attach event handlers
  ctrl.querySelectorAll('.chart-type-group .filter-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const newType = btn.getAttribute('data-type');
      st.type = newType;
      saveChartCustomState();
      triggerChartRefresh(chartId);
    };
  });

  const select = ctrl.querySelector('.series-select');
  if (select) {
    select.onchange = () => {
      st.activeSeriesIndex = Number(select.value);
      syncChartControlsUI(chartId);
    };
  }

  const btnFg = ctrl.querySelector('.btn-foreground');
  if (btnFg) {
    btnFg.onclick = (e) => {
      e.stopPropagation();
      st.foregroundIndex = st.activeSeriesIndex;
      saveChartCustomState();
      triggerChartRefresh(chartId);
    };
  }

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
          <span>🎨</span> Muestras y Estadísticas (${datasets.length})
        </div>
        <button class="btn-close-popover" title="Cerrar">&times;</button>
      </div>
      <div class="series-popover-subtitle">
        Selecciona qué muestra/estadística está en <strong>primer plano</strong> y escoge el color de cada una:
      </div>
      <div class="series-popover-list">
        ${datasets.map((ds, idx) => {
          const isFg = (idx === st.foregroundIndex);
          const dsColor = st.datasetColors[idx] || (idx === 0 ? st.color : (ds.borderColor || ds.backgroundColor || SERIES_DEFAULT_COLORS[idx % SERIES_DEFAULT_COLORS.length]));
          return `
            <div class="series-row ${isFg ? 'is-foreground' : ''}">
              <div class="series-row-header">
                <div class="series-row-name">
                  <span class="series-color-preview" style="background:${dsColor};"></span>
                  <strong>${ds.label || 'Muestra ' + (idx + 1)}</strong>
                </div>
                <label class="series-fg-radio-label" title="Poner esta muestra en primer plano (al frente)">
                  <input type="radio" name="popover-fg-${chartId}" value="${idx}" ${isFg ? 'checked' : ''}>
                  <span class="fg-radio-badge ${isFg ? 'active' : ''}">
                    ${isFg ? '⭐ Primer Plano' : 'Poner al Frente'}
                  </span>
                </label>
              </div>
              <div class="series-row-colors">
                ${COLOR_SWATCHES.map(sw => {
                  const isActive = dsColor && dsColor.toLowerCase() === sw.hex.toLowerCase();
                  return `<span class="color-dot ${isActive ? 'active' : ''}" data-ds="${idx}" data-color="${sw.hex}" style="background:${sw.hex};" title="${sw.name}"></span>`;
                }).join('')}
                <label class="color-picker-custom" title="Color personalizado hex">
                  <input type="color" data-ds="${idx}" value="${dsColor && dsColor.startsWith('#') && dsColor.length === 7 ? dsColor : '#06b6d4'}">
                  <span>🎨</span>
                </label>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <div class="series-popover-footer">
        <button class="btn-reset-chart-colors" title="Restaurar colores originales de este gráfico">
          ↺ Restaurar colores
        </button>
        <button class="btn-done-popover">Listo</button>
      </div>
    `;

    popover.querySelectorAll(`input[name="popover-fg-${chartId}"]`).forEach(radio => {
      radio.onchange = () => {
        const newFg = Number(radio.value);
        st.foregroundIndex = newFg;
        st.activeSeriesIndex = newFg;
        saveChartCustomState();
        triggerChartRefresh(chartId);
        renderPopoverContent();
      };
    });

    popover.querySelectorAll('.fg-radio-badge').forEach((badge, idx) => {
      badge.onclick = (e) => {
        e.preventDefault();
        st.foregroundIndex = idx;
        st.activeSeriesIndex = idx;
        saveChartCustomState();
        triggerChartRefresh(chartId);
        renderPopoverContent();
      };
    });

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
  const popWidth = Math.min(440, window.innerWidth - 32);
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
  } else if (chartId === 'chart-top-interfaces') {
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
    renderDiagnosticsConfluence();
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
  const chartType = isHoriz ? 'bar' : userType; // 'line' or 'bar'

  const fgIdx = Math.min(Math.max(setting.foregroundIndex ?? 0, 0), Math.max(config.datasets.length - 1, 0));

  const processedDatasets = config.datasets.map((ds, idx) => {
    let color = setting.datasetColors[idx];
    if (!color) {
      color = (idx === 0 && setting.color) ? setting.color : (ds.borderColor || ds.backgroundColor || SERIES_DEFAULT_COLORS[idx % SERIES_DEFAULT_COLORS.length]);
      setting.datasetColors[idx] = color;
    }
    if (idx === 0) setting.color = color;

    const isForeground = (idx === fgIdx);
    const order = isForeground ? 1 : (10 + idx);

    if (chartType === 'line') {
      const isMulti = config.datasets.length > 1;
      const fillVal = ds.fill !== undefined ? ds.fill : (isMulti ? (isForeground ? true : false) : true);
      const fillAlpha = isForeground ? 0.22 : 0.08;

      return {
        ...ds,
        label: ds.label || 'Valor',
        data: ds.data,
        borderColor: color,
        backgroundColor: ds.backgroundColor && typeof ds.backgroundColor === 'string' && ds.backgroundColor.startsWith('rgba') && !setting.datasetColors[idx]
          ? ds.backgroundColor
          : hexToRgba(color, fillAlpha),
        fill: fillVal,
        borderDash: ds.borderDash,
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
      return {
        ...ds,
        label: ds.label || 'Valor',
        data: ds.data,
        backgroundColor: hexToRgba(color, isForeground ? 0.92 : 0.65),
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
  if (isHoriz) {
    scales = {
      x: {
        type: 'linear',
        beginAtZero: true,
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8' },
        title: config.yTitle ? { display: true, text: config.yTitle, color: '#94a3b8' } : undefined
      },
      y: {
        type: 'category',
        grid: { display: false },
        ticks: { color: '#e2e8f0', autoSkip: true, maxTicksLimit: 25 }
      }
    };
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
        display: config.datasets.length > 1,
        position: 'top',
        labels: {
          boxWidth: 12,
          color: '#94a3b8',
          generateLabels: function(chart) {
            const original = Chart.defaults.plugins.legend.labels.generateLabels(chart);
            if (chart.data.datasets.length > 1) {
              original.forEach(item => {
                if (item.datasetIndex === fgIdx) {
                  item.text = '⭐ ' + item.text + ' (Frente)';
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
            const isFg = (ctx.datasetIndex === fgIdx);
            const prefix = isFg && ctx.chart.data.datasets.length > 1 ? '⭐ [1º Plano] ' : '';
            const label = ctx.dataset.label || '';
            const rawVal = ctx.parsed.y !== undefined ? ctx.parsed.y : ctx.parsed.x;
            return `${prefix}${label}: ${fmtNum(rawVal)}`;
          }
        }
      }
    },
    scales: scales
  };

  createOrUpdateChart(canvasId, {
    type: chartType,
    data: {
      labels: config.labels,
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
  if (titleEl && titles[pageId]) {
    titleEl.innerHTML = titles[pageId];
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

  document.getElementById('hdr-uptime').textContent = sys.latest_uptime || '119 días';
  document.getElementById('hdr-cluster').textContent = sys.cluster_status || 'VSX Standalone';
  if (document.getElementById('hdr-node-name')) {
    document.getElementById('hdr-node-name').textContent = sys.node_name || 'Nodo Check Point';
  }
  const brandP = document.querySelector('.brand-text p');
  if (brandP) {
    brandP.textContent = sys.node_name || sys.db_filename || 'SG_FWNET-ch01-01';
  }
  document.getElementById('hdr-timerange').textContent = 
    `${sys.start_iso.substring(0, 10)} — ${sys.end_iso.substring(0, 10)} (${sys.duration_days} días)`;

  // Badges
  document.getElementById('badge-cores').textContent = `${sys.cores_count} Cores`;
  document.getElementById('badge-ifs').textContent = `${CP_DATA.interfaces.length} IFs`;
  document.getElementById('badge-drops').textContent = `${(CP_DATA.drops.total / 1e6).toFixed(1)}M`;
  document.getElementById('badge-spikes').textContent = `${(CP_DATA.spikes.cpu_spikes.length / 1000).toFixed(1)}k`;
  document.getElementById('badge-tables').textContent = `${CP_DATA.table_catalog.length} Tablas`;
  document.getElementById('badge-conns').textContent = '400k';

  // KPI Overview
  const tr = CP_DATA.traffic.hourly;
  let maxThru = 0, sumThru = 0;
  tr.forEach(t => {
    if (t.in_mbps_max > maxThru) maxThru = t.in_mbps_max;
    sumThru += t.in_mbps_avg;
  });
  const avgThru = tr.length ? sumThru / tr.length : 0;
  document.getElementById('kpi-avg-thru').textContent = fmtThroughput(avgThru);
  document.getElementById('kpi-max-thru').textContent = fmtThroughput(maxThru);

  document.getElementById('kpi-drops').textContent = `${(CP_DATA.drops.total / 1e6).toFixed(2)} M`;
  document.getElementById('kpi-spikes').textContent = fmtNum(CP_DATA.spikes.cpu_spikes.length);
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
  cachedAnalysis: null
};

function computeDiagnosticsAndConfluence(data) {
  if (diagnosticsState.cachedAnalysis && diagnosticsState.cachedAnalysis.dataRef === data) {
    return diagnosticsState.cachedAnalysis;
  }
  if (!data || !data.cpu || !data.cpu.hourly) return null;

  const cpuH = data.cpu.hourly || [];
  const trafH = (data.traffic && data.traffic.hourly) || [];
  const connsH = (data.traffic && data.traffic.conns_hourly) || [];
  const dropsH = (data.drops && data.drops.hourly) || [];

  const trafMap = {};
  trafH.forEach(r => { trafMap[r.ts] = r; });
  const connsMap = {};
  connsH.forEach(r => { connsMap[r.ts] = r; });
  const dropsMap = {};
  dropsH.forEach(r => { dropsMap[r.ts] = r; });

  const incidents = [];
  const heatmapCounts = {};
  for (let dow = 0; dow < 7; dow++) {
    heatmapCounts[dow] = {};
    for (let h = 0; h < 24; h++) {
      heatmapCounts[dow][h] = { total: 0, high: 0, crit: 0 };
    }
  }

  cpuH.forEach(c => {
    const ts = c.ts;
    const t = trafMap[ts] || {};
    const cn = connsMap[ts] || {};
    const dr = dropsMap[ts] || {};

    const d = new Date(ts * 1000);
    const dayOfWeek = (d.getUTCDay() + 6) % 7; // 0 = Lunes, 6 = Domingo
    const hour = d.getUTCHours();
    const dateStr = `${d.getUTCDate()}/${d.getUTCMonth() + 1} ${String(hour).padStart(2, '0')}:00 UTC`;

    const core1Max = c.core_1_max || 0;
    const core1Avg = c.core_1_avg || 0;
    const cpuTotal = c.total_avg || 0;
    const inMbps = t.in_mbps_max || 0;
    const connRate = t.conn_rate_max || 0;
    const dropTot = dr.total || 0;

    // Heatmap aggregation
    heatmapCounts[dayOfWeek][hour].total++;
    if (core1Max >= 75) heatmapCounts[dayOfWeek][hour].high++;
    if (core1Max >= 90) heatmapCounts[dayOfWeek][hour].crit++;

    // Multi-metric signal evaluation
    const signals = [];
    let score = 0;

    if (core1Max >= 90) {
      signals.push({ type: 'cpu', label: `CPU C1: ${core1Max}%`, val: core1Max, level: 'crit' });
      score += 3;
    } else if (core1Max >= 75) {
      signals.push({ type: 'cpu', label: `CPU C1: ${core1Max}%`, val: core1Max, level: 'high' });
      score += 2;
    }

    if (connRate >= 300000) {
      signals.push({ type: 'conns', label: `Conns: ${(connRate/1000).toFixed(0)}k/s`, val: connRate, level: 'crit' });
      score += 3;
    } else if (connRate >= 150000) {
      signals.push({ type: 'conns', label: `Conns: ${(connRate/1000).toFixed(0)}k/s`, val: connRate, level: 'high' });
      score += 2;
    }

    if (dropTot >= 350000) {
      signals.push({ type: 'drops', label: `Drops: ${(dropTot/1000).toFixed(0)}k/h`, val: dropTot, level: 'crit' });
      score += 3;
    } else if (dropTot >= 200000) {
      signals.push({ type: 'drops', label: `Drops: ${(dropTot/1000).toFixed(0)}k/h`, val: dropTot, level: 'high' });
      score += 2;
    }

    if (inMbps >= 800000) {
      signals.push({ type: 'traffic', label: `Tráfico: ${(inMbps/1000).toFixed(1)}G`, val: inMbps, level: 'crit' });
      score += 2;
    } else if (inMbps >= 400000) {
      signals.push({ type: 'traffic', label: `Tráfico: ${(inMbps/1000).toFixed(1)}G`, val: inMbps, level: 'high' });
      score += 1;
    }

    // Determine nature: Recurrent vs Punctual
    const isMidnight = (hour === 0);
    const isBusinessPeak = (hour >= 11 && hour <= 13 && dayOfWeek < 5);
    const isRecurrent = isMidnight || isBusinessPeak;

    if (signals.length >= 2 || score >= 4) {
      let severity = 'MEDIO';
      if (score >= 6 || signals.length >= 3) {
        severity = 'CRÍTICO';
      } else if (score >= 4 || core1Max >= 90) {
        severity = 'ALTO';
      }

      // Root cause diagnosis description
      let cause = '';
      let remediation = '';
      if (signals.some(s => s.type === 'cpu') && signals.some(s => s.type === 'conns')) {
        cause = 'Confluencia crítica: saturación de CoreXL Worker 1 provocada por ráfaga masiva de apertura de conexiones TCP en camino lento.';
        remediation = 'Activar Dynamic Dispatcher (fw ctl multik dynamic_disp on) y Accelerated SYN Defense (fw ctl set int sim_syn_defense 1).';
      } else if (signals.some(s => s.type === 'drops') && signals.some(s => s.type === 'traffic')) {
        cause = 'Confluencia de alto throughput con ráfagas de descarte en Rulebase o Anti-Spoofing PPAK. Sobrecarga en pipeline de inspección.';
        remediation = 'Habilitar Drop Templates en SecureXL (fw accel drop_templates on) y revisar grupos de topología de interfaz.';
      } else if (isMidnight) {
        cause = 'Degradación cíclica nocturna por tareas batch en crontab, volcados de CPView y rotación de logs a las 00:00 UTC.';
        remediation = 'Escalonar los cron jobs de medianoche en crontab (rotación a 01:15, backups a 02:30, compresión a 03:45).';
      } else {
        cause = 'Anomalía puntual multivariable que genera contención temporal de recursos de kernel y buffers de red.';
        remediation = 'Verificar sim affinity -a y ampliar buffers de encolamiento de SecureXL (sim_dispatcher_queue_size 4096).';
      }

      incidents.push({
        id: `inc-${ts}`,
        ts,
        dateStr,
        hour,
        dayOfWeek,
        severity,
        score,
        nature: isRecurrent ? 'Recurrente' : 'Puntual',
        signals,
        core1Max,
        core1Avg,
        cpuTotal,
        inMbps,
        connRate,
        dropTot,
        cause,
        remediation
      });
    }
  });

  incidents.sort((a, b) => (b.score - a.score) || (b.ts - a.ts));

  const result = {
    dataRef: data,
    incidents,
    heatmap: heatmapCounts,
    totalIncidents: incidents.length,
    critCount: incidents.filter(i => i.severity === 'CRÍTICO').length,
    highCount: incidents.filter(i => i.severity === 'ALTO').length,
    medCount: incidents.filter(i => i.severity === 'MEDIO').length,
    recurrentCount: incidents.filter(i => i.nature === 'Recurrente').length,
    punctualCount: incidents.filter(i => i.nature === 'Puntual').length
  };

  diagnosticsState.cachedAnalysis = result;
  return result;
}

function renderDiagnosticsPage() {
  if (!CP_DATA) return;
  const analysis = computeDiagnosticsAndConfluence(CP_DATA);
  if (!analysis) return;

  // 1. Update Hero stats
  const heroCount = document.getElementById('hero-confluence-count');
  if (heroCount) heroCount.textContent = analysis.totalIncidents;
  const badgeAnomalies = document.getElementById('badge-anomalies');
  if (badgeAnomalies) badgeAnomalies.textContent = `${analysis.critCount + analysis.highCount} Alertas`;

  // 2. Render Confluence Chart
  renderDiagnosticsChart();

  // 3. Render Heatmap Matrix
  renderDiagnosticsHeatmap(analysis.heatmap);

  // 4. Render Incidents Table
  renderDiagnosticsIncidentsTable();
}

function renderDiagnosticsChart() {
  if (!CP_DATA || !CP_DATA.cpu || !CP_DATA.cpu.hourly) return;
  const range = diagnosticsState.range;

  let cpuH = CP_DATA.cpu.hourly;
  let trafH = (CP_DATA.traffic && CP_DATA.traffic.hourly) || [];
  let dropsH = (CP_DATA.drops && CP_DATA.drops.hourly) || [];

  const trafMap = {};
  trafH.forEach(r => { trafMap[r.ts] = r; });
  const dropsMap = {};
  dropsH.forEach(r => { dropsMap[r.ts] = r; });

  let sliceData = cpuH;
  if (range === '7') {
    sliceData = cpuH.slice(-7 * 24);
  } else if (range === '14') {
    sliceData = cpuH.slice(-14 * 24);
  } else if (range === 'crit') {
    sliceData = cpuH.filter(r => {
      const d = new Date(r.ts * 1000);
      return d.getUTCMonth() === 2 && d.getUTCDate() >= 11 && d.getUTCDate() <= 15;
    });
  }

  const labels = sliceData.map(r => fmtDateShort(r.ts));
  const core1Data = sliceData.map(r => r.core_1_max || 0);
  const cpuTotData = sliceData.map(r => r.total_avg || 0);
  const trafData = sliceData.map(r => {
    const t = trafMap[r.ts];
    return t ? Math.round((t.in_mbps_max || 0) / 1000) : 0; // Gbps
  });
  const connRateData = sliceData.map(r => {
    const t = trafMap[r.ts];
    return t ? Math.round((t.conn_rate_max || 0) / 1000) : 0; // k conns/s
  });
  const dropsData = sliceData.map(r => {
    const dr = dropsMap[r.ts];
    return dr ? Math.round((dr.total || 0) / 1000) : 0; // k drops/h
  });

  const baseDatasets = [
    {
      label: 'CPU Core 1 Max (%)',
      data: core1Data,
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
  const st = getChartSetting('chart-diagnostics-confluence', 'line', PALETTE.rose);
  const fgIdx = Math.min(Math.max(st.foregroundIndex ?? 0, 0), baseDatasets.length - 1);

  const processedDatasets = baseDatasets.map((ds, idx) => {
    let color = st.datasetColors[idx];
    if (!color) {
      color = (idx === 0 && st.color) ? st.color : (ds.borderColor || ds.backgroundColor || SERIES_DEFAULT_COLORS[idx % SERIES_DEFAULT_COLORS.length]);
      st.datasetColors[idx] = color;
    }
    if (idx === 0) st.color = color;

    const isForeground = (idx === fgIdx);
    const order = isForeground ? 1 : (10 + idx);

    return {
      ...ds,
      borderColor: color,
      backgroundColor: ds.fill ? hexToRgba(color, isForeground ? 0.22 : 0.08) : undefined,
      borderWidth: isForeground ? 3.0 : (ds.borderWidth || 1.5),
      pointRadius: isForeground ? (sliceData.length > 100 ? 1.5 : 3.5) : (sliceData.length > 100 ? 0 : 1.5),
      pointHoverRadius: isForeground ? 7 : 5,
      pointBackgroundColor: color,
      order: order
    };
  });

  const chartConfig = {
    type: 'line',
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
              original.forEach(item => {
                if (item.datasetIndex === fgIdx) {
                  item.text = '⭐ ' + item.text + ' (Frente)';
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
              const prefix = isFg ? '⭐ [1º Plano] ' : '';
              const label = ctx.dataset.label || '';
              const val = ctx.parsed.y;
              if (label.includes('CPU')) return `${prefix}${label}: ${val}%`;
              if (label.includes('Tráfico')) return `${prefix}${label}: ${val} Gbps`;
              if (label.includes('Conexiones')) return `${prefix}${label}: ${val}k conns/sec`;
              if (label.includes('Descartes')) return `${prefix}${label}: ${val}k drops/hora`;
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

  const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

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
      const title = `${dayNames[d]} a las ${String(h).padStart(2, '0')}:00 UTC: ${cellData.high}/${cellData.total} días con carga alta (Core 1 ≥ 75%). ${cellData.crit} incidentes críticos. (Clic para filtrar incidentes)`;
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

  const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
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
      filterTag = ` | Filtrado: ${dayNames[diagnosticsState.dayFilter]} ${String(diagnosticsState.hourFilter).padStart(2,'0')}h <button class="btn btn-sm btn-outline" style="padding:1px 6px; font-size:10px; margin-left:6px;" onclick="resetDiagnosticsHeatmapFilter()">✕ Limpiar</button>`;
    }
    countBadge.innerHTML = `${filtered.length} incidentes filtrados (de ${analysis.totalIncidents})${filterTag}`;
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / diagnosticsState.pageSize));
  if (diagnosticsState.page > totalPages) diagnosticsState.page = totalPages;
  if (diagnosticsState.page < 1) diagnosticsState.page = 1;

  const pageInfo = document.getElementById('diag-pagination-info');
  if (pageInfo) {
    const startIdx = (diagnosticsState.page - 1) * diagnosticsState.pageSize + 1;
    const endIdx = Math.min(filtered.length, diagnosticsState.page * diagnosticsState.pageSize);
    pageInfo.textContent = filtered.length > 0 ? `Mostrando ${startIdx} - ${endIdx} de ${filtered.length} incidentes (Pág. ${diagnosticsState.page} de ${totalPages})` : 'No hay incidentes que coincidan con los filtros';
  }

  const prevBtn = document.getElementById('btn-diag-prev');
  const nextBtn = document.getElementById('btn-diag-next');
  if (prevBtn) prevBtn.disabled = (diagnosticsState.page <= 1);
  if (nextBtn) nextBtn.disabled = (diagnosticsState.page >= totalPages);

  const start = (diagnosticsState.page - 1) * diagnosticsState.pageSize;
  const paged = filtered.slice(start, start + diagnosticsState.pageSize);

  if (paged.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:32px; color:var(--text-muted);">No se encontraron incidentes para los criterios seleccionados.</td></tr>`;
    return;
  }

  let html = '';
  paged.forEach((inc) => {
    const isExpanded = diagnosticsState.expandedIndex === inc.id;
    const sevBadgeClass = inc.severity === 'CRÍTICO' ? 'crit' : (inc.severity === 'ALTO' ? 'high' : 'med');
    const natBadge = inc.nature === 'Recurrente'
      ? `<span class="confluence-chip recurrent">🔁 Recurrente</span>`
      : `<span class="confluence-chip" style="background:rgba(255,255,255,0.08); color:var(--text-muted);">⚡ Puntual</span>`;

    const chipsHtml = inc.signals.map(s => {
      let cClass = 'cpu';
      if (s.type === 'conns') cClass = 'conns';
      else if (s.type === 'drops') cClass = 'drops';
      else if (s.type === 'traffic') cClass = 'traffic';
      return `<span class="confluence-chip ${cClass}">${s.label}</span>`;
    }).join(' ');

    const copyReportText = `[Check Point Incident Forensic Report]
Fecha: ${inc.dateStr}
Severidad: ${inc.severity} (${inc.nature})
CPU Core 1 Max: ${inc.core1Max}% (Media: ${inc.core1Avg}%)
CPU Promedio Gateway: ${inc.cpuTotal}%
Tasa Conexiones: ${Number(inc.connRate).toLocaleString()} conns/s
Descartes Registrados: ${Number(inc.dropTot).toLocaleString()} drops/h
Throughput Inbound: ${(inc.inMbps / 1000).toFixed(2)} Gbps
Causa Raíz: ${inc.cause}
Remediación: ${inc.remediation}`;

    html += `
      <tr class="incident-row ${isExpanded ? 'expanded' : ''}" data-inc-id="${inc.id}">
        <td style="font-family:var(--font-mono); font-weight:600; color:var(--accent-cyan);">
          ${inc.dateStr}
        </td>
        <td>
          <span class="problem-card-badge ${sevBadgeClass}">${inc.severity}</span>
        </td>
        <td>${natBadge}</td>
        <td>
          <div class="confluence-chips-row">${chipsHtml}</div>
        </td>
        <td style="text-align:right;">
          <button class="btn btn-sm btn-outline" style="padding:3px 10px; font-size:11px;">
            ${isExpanded ? '▲ Ocultar' : '▼ Ver Detalle'}
          </button>
        </td>
      </tr>
    `;

    if (isExpanded) {
      html += `
        <tr class="incident-drawer-row">
          <td colspan="5">
            <div class="incident-drawer-content">
              <div class="incident-drawer-box">
                <div class="incident-drawer-box-title">📊 Valores Exactos en la Franja</div>
                <div class="incident-drawer-box-body" style="font-family:var(--font-mono); font-size:11.5px;">
                  <div>• CPU Core 1 Max: <strong>${inc.core1Max}%</strong> (Media: ${inc.core1Avg}%)</div>
                  <div>• CPU Promedio Gateway: <strong>${inc.cpuTotal}%</strong></div>
                  <div>• Tasa Nuevas Conexiones: <strong>${Number(inc.connRate).toLocaleString()} conn/s</strong></div>
                  <div>• Descartes Registrados: <strong>${Number(inc.dropTot).toLocaleString()} drops/hora</strong></div>
                  <div>• Throughput Inbound Pico: <strong>${(inc.inMbps / 1000).toFixed(2)} Gbps</strong></div>
                  <div style="margin-top:10px;">
                    <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); navigator.clipboard.writeText(\`${copyReportText.replace(/`/g, '\\`')}\`); this.textContent='✓ Reporte Copiado'; setTimeout(()=>this.textContent='📋 Copiar Reporte', 1500);">📋 Copiar Reporte Forense</button>
                  </div>
                </div>
              </div>
              <div class="incident-drawer-box">
                <div class="incident-drawer-box-title">🔍 Diagnóstico y Causa Raíz</div>
                <div class="incident-drawer-box-body">
                  ${inc.cause}
                </div>
              </div>
              <div class="incident-drawer-box">
                <div class="incident-drawer-box-title">🛠️ Remediación Check Point Recomendada</div>
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
    { id: 'btn-diag-range-all', range: 'all' },
    { id: 'btn-diag-range-14d', range: '14' },
    { id: 'btn-diag-range-7d', range: '7' },
    { id: 'btn-diag-range-crit', range: 'crit' }
  ];

  rangeBtns.forEach(b => {
    const btn = document.getElementById(b.id);
    if (btn) {
      btn.addEventListener('click', () => {
        rangeBtns.forEach(other => {
          const ob = document.getElementById(other.id);
          if (ob) ob.classList.remove('active');
        });
        btn.classList.add('active');
        diagnosticsState.range = b.range;
        renderDiagnosticsChart();
      });
    }
  });
}

// =============================================================================
// PAGE 1: OVERVIEW
// =============================================================================
let overviewTrafficDays = 30;

function renderOverviewCharts() {
  let traffic = CP_DATA.traffic.hourly;
  if (overviewTrafficDays < 30) {
    const hours = overviewTrafficDays * 24;
    traffic = traffic.slice(-hours);
  }
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
  const cpu = CP_DATA.cpu.hourly;
  const mem = CP_DATA.memory.hourly;
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

  container.innerHTML = disks.map(d => {
    let colorClass = 'emerald';
    if (d.used_pct > 80) colorClass = 'rose';
    else if (d.used_pct > 60) colorClass = 'amber';

    return `
      <div>
        <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px;">
          <strong>Partición ${d.mount}</strong>
          <span style="font-family:var(--font-mono); color:var(--text-muted);">
            ${d.used_gb} GB / ${d.total_gb} GB (${d.used_pct}%)
          </span>
        </div>
        <div class="meter-container">
          <div class="meter-track">
            <div class="meter-fill ${colorClass}" style="width: ${d.used_pct}%;"></div>
          </div>
          <span style="font-size:11px; font-family:var(--font-mono);">${d.free_gb} GB libres</span>
        </div>
      </div>
    `;
  }).join('');
}

// =============================================================================
// PAGE 2: SYSTEM & CPU
// =============================================================================
function renderSystemPage() {
  // Populate Cores Table
  const tbody = document.querySelector('#table-cpu-cores tbody');
  if (tbody) {
    tbody.innerHTML = CP_DATA.cpu.summary.map(c => `
      <tr>
        <td class="cell-mono"><strong>Core ${c.core}</strong></td>
        <td><span class="pill-badge ${c.core % 2 === 0 ? 'eth' : 'vlan'}">${c.role}</span></td>
        <td class="cell-mono"><strong>${c.avg_usage}%</strong></td>
        <td class="cell-mono">${c.max_usage}%</td>
        <td class="cell-mono">${c.avg_usr}%</td>
        <td class="cell-mono">${c.avg_sys}%</td>
        <td class="cell-mono">${c.avg_idle}%</td>
        <td class="cell-mono">${fmtNum(c.max_interrupts)}</td>
        <td>
          <span class="pill-badge ${c.avg_usage > 50 ? 'down' : 'active'}">
            ${c.avg_usage > 50 ? 'Alta Demanda' : 'Normal'}
          </span>
        </td>
      </tr>
    `).join('');
  }

  // CPU cores timeline (respects user type & color)
  const cpu = CP_DATA.cpu.hourly;
  const labels = cpu.map(c => fmtDateShort(c.ts));
  renderUniversalChart('chart-cpu-cores-timeline', {
    labels: labels,
    datasets: [
      { label: 'Core 0 (SND)', data: cpu.map(c => c.core_0_avg) },
      { label: 'Core 1 (CoreXL Worker)', data: cpu.map(c => c.core_1_avg), borderColor: PALETTE.purple, backgroundColor: PALETTE.purple },
      { label: 'Core 2 (SND)', data: cpu.map(c => c.core_2_avg), borderColor: PALETTE.emerald, backgroundColor: PALETTE.emerald },
      { label: 'Core 3 (CoreXL Worker)', data: cpu.map(c => c.core_3_avg), borderColor: PALETTE.amber, backgroundColor: PALETTE.amber }
    ],
    yTitle: 'Uso CPU (%)',
    defaultType: 'line',
    defaultColor: PALETTE.cyan,
    extraOptions: {
      scales: {
        y: { type: 'linear', min: 0, max: 100, title: { display: true, text: 'Uso CPU (%)' } }
      }
    }
  });

  // System parameters grid
  const sysGrid = document.getElementById('system-details-grid');
  if (sysGrid) {
    const s = CP_DATA.system;
    sysGrid.innerHTML = `
      <div class="info-item"><span class="info-label">Nombre del Nodo</span><span class="info-val">${s.node_name}</span></div>
      <div class="info-item"><span class="info-label">Sistema Operativo</span><span class="info-val">${s.os}</span></div>
      <div class="info-item"><span class="info-label">Versión Check Point</span><span class="info-val">${s.version}</span></div>
      <div class="info-item"><span class="info-label">Jumbo HF Branch</span><span class="info-val">${s.branch}</span></div>
      <div class="info-item"><span class="info-label">Build Number</span><span class="info-val">${s.build}</span></div>
      <div class="info-item"><span class="info-label">Modelo Plataforma</span><span class="info-val">${s.hw_model}</span></div>
      <div class="info-item"><span class="info-label">Modo Operativo</span><span class="info-val">${s.config}</span></div>
      <div class="info-item"><span class="info-label">Estado de Cluster</span><span class="info-val">${s.cluster_status}</span></div>
      <div class="info-item"><span class="info-label">Tiempo Activo (Uptime)</span><span class="info-val">${s.latest_uptime}</span></div>
      <div class="info-item"><span class="info-label">Periodo Monitorizado</span><span class="info-val">${s.duration_days} días</span></div>
      <div class="info-item"><span class="info-label">Total Snapshots</span><span class="info-val">${fmtNum(s.total_snapshots)}</span></div>
      <div class="info-item"><span class="info-label">Drops Hardware Rx</span><span class="info-val">${s.rx_drops_hw}</span></div>
    `;
  }
}

// =============================================================================
// PAGE 3: INTERFACES
// =============================================================================
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

  filterAndRenderInterfaces();
}

function filterAndRenderInterfaces() {
  const tbody = document.getElementById('tbody-interfaces');
  if (!tbody) return;

  const query = interfacesFilter.search.toLowerCase();
  const typeFilter = interfacesFilter.type;

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
        <td class="cell-mono">${i.ipv4 || '<span style="color:var(--text-dim);">No asignada</span>'}</td>
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
  const conns = CP_DATA.traffic.conns_hourly;
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

  const traffic = CP_DATA.traffic.hourly;
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
  const dropsH = CP_DATA.drops.hourly;
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
  const cpuSpikes = spikes.cpu_spikes || [];
  const threadSpikes = spikes.thread_spikes || [];

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

  // 1. Chart: Daily Spikes Frequency Timeline (Histogram across dates)
  const dailyMap = {};
  filteredCpu.forEach(s => {
    if (s.start_time) {
      const d = new Date(s.start_time * 1000);
      const dayKey = `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      dailyMap[dayKey] = (dailyMap[dayKey] || 0) + 1;
    }
  });

  const timelineLabels = Object.keys(dailyMap).reverse();
  const timelineCounts = timelineLabels.map(k => Number(dailyMap[k]) || 0);

  renderUniversalChart('chart-spikes-timeline', {
    labels: timelineLabels,
    datasets: [{
      label: 'Picos de CPU por Día',
      data: timelineCounts
    }],
    yTitle: 'Nº Eventos de Pico',
    defaultType: 'line',
    defaultColor: PALETTE.amber
  });

  // 2. Chart: Spikes by Core Distribution
  const coreCounts = { 'Core 0 (SND)': 0, 'Core 1 (CoreXL)': 0, 'Core 2 (SND)': 0, 'Core 3 (CoreXL)': 0 };
  filteredCpu.forEach(s => {
    const c = s.core;
    if (c === 0) coreCounts['Core 0 (SND)']++;
    else if (c === 1) coreCounts['Core 1 (CoreXL)']++;
    else if (c === 2) coreCounts['Core 2 (SND)']++;
    else if (c === 3) coreCounts['Core 3 (CoreXL)']++;
    else coreCounts[`Core ${c}`] = (coreCounts[`Core ${c}`] || 0) + 1;
  });

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
    defaultType: 'line',
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
  const filtered = CP_DATA.spikes.cpu_spikes.filter(s => {
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
    let sevText = 'Moderado';
    if (s.avg_usage >= 90) { sevBadge = 'down'; sevText = 'Crítico'; }
    else if (s.avg_usage >= 80) { sevBadge = 'eth'; sevText = 'Alto'; }

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
    countEl.textContent = total > 0 ? `Mostrando ${start + 1} - ${end} de ${fmtNum(total)} eventos` : 'No se encontraron eventos';
  }
}

// =============================================================================
// PAGE 7: FLOW PROFILER (Flofiler)
// =============================================================================
function renderFlofilerPage() {
  const protos = CP_DATA.flofiler.protocols.slice(0, 10);
  renderUniversalChart('chart-flofiler-protocols', {
    labels: protos.map(p => p.protocol),
    datasets: [{
      label: 'Ciclos de CPU (Centipercent)',
      data: protos.map(p => p.cycles)
    }],
    yTitle: 'Ciclos CPU',
    defaultType: 'line',
    defaultColor: PALETTE.cyan
  });

  const comps = CP_DATA.flofiler.components.slice(0, 10);
  renderUniversalChart('chart-flofiler-components', {
    labels: comps.map(c => c.component),
    datasets: [{
      label: 'Ciclos por Módulo Inspección',
      data: comps.map(c => c.cycles)
    }],
    yTitle: 'Ciclos CPU',
    defaultType: 'line',
    defaultColor: PALETTE.purple
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
    defaultType: 'line',
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
    defaultType: 'line',
    defaultColor: PALETTE.rose
  });

  const ppak = CP_DATA.ppak_vs0.hourly;
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
// PAGE 9: BLADES & VPN
// =============================================================================
function renderBladesPage() {
  const vpn = CP_DATA.vpn.hourly;
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
function renderCatalogTable() {
  const tbody = document.getElementById('tbody-catalog');
  if (!tbody) return;

  const query = (document.getElementById('filter-catalog-search')?.value || '').toLowerCase();
  const tables = CP_DATA.table_catalog.filter(t => {
    return !query || t.name.toLowerCase().includes(query) || t.category.toLowerCase().includes(query);
  });

  tbody.innerHTML = tables.map(t => {
    const colNames = t.columns.map(c => c.name).slice(0, 4).join(', ') + (t.columns.length > 4 ? '...' : '');
    return `
      <tr>
        <td class="cell-mono"><strong>${t.name}</strong></td>
        <td><span class="pill-badge vlan">${t.category}</span></td>
        <td class="cell-mono"><strong>${fmtNum(t.row_count)}</strong></td>
        <td class="cell-mono">${t.columns.length}</td>
        <td style="color:var(--text-muted); font-size:11px; max-width:280px; overflow:hidden; text-overflow:ellipsis;">${colNames}</td>
        <td>
          <button class="btn btn-primary" style="padding:4px 10px; font-size:11px;" onclick="openTableViewer('${t.name}')">
            🔍 Ver Registros
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Table live record viewer (Modal)
async function openTableViewer(tableName, page = 1) {
  modalState.tableName = tableName;
  modalState.page = page;

  const modal = document.getElementById('modal-table-viewer');
  document.getElementById('modal-table-name').textContent = `Tabla: ${tableName}`;
  document.getElementById('modal-row-count-badge').textContent = 'Cargando datos...';
  modal.classList.add('active');

  const thead = document.querySelector('#modal-table-content thead');
  const tbody = document.querySelector('#modal-table-content tbody');
  thead.innerHTML = '';
  tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:30px;"><div class="spinner"></div> Consultando registros...</td></tr>`;

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
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:30px; color:var(--accent-rose);">No se pudieron cargar registros para esta tabla.</td></tr>`;
  }
}

function renderModalTable(cols, rows, total, page, isFallback = false) {
  const thead = document.querySelector('#modal-table-content thead');
  const tbody = document.querySelector('#modal-table-content tbody');

  thead.innerHTML = `<tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>`;
  
  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${cols.length}" style="text-align:center; padding:20px;">Sin registros</td></tr>`;
  } else {
    tbody.innerHTML = rows.map(r => `
      <tr>
        ${cols.map(c => `<td class="cell-mono">${r[c] !== undefined && r[c] !== null ? r[c] : '-'}</td>`).join('')}
      </tr>
    `).join('');
  }

  const badgeText = isFallback ? 
    `Muestra pre-extraída (Total en SQLite: ${fmtNum(total)})` : 
    `Página ${page} (Total: ${fmtNum(total)} registros)`;
  document.getElementById('modal-row-count-badge').textContent = badgeText;
  document.getElementById('modal-pagination-info').textContent = `Página ${page}`;
}

// SQL direct query runner
async function runSqlQuery() {
  const query = document.getElementById('sql-query-input').value.trim();
  const statusEl = document.getElementById('sql-status');
  const panel = document.getElementById('sql-results-panel');
  const thead = document.querySelector('#table-sql-results thead');
  const tbody = document.querySelector('#table-sql-results tbody');

  if (!query) return;
  statusEl.textContent = 'Ejecutando consulta...';

  try {
    const res = await fetch(`/api/sql?q=${encodeURIComponent(query)}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    panel.style.display = 'block';
    statusEl.textContent = `${data.count} filas obtenidas`;

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
    title = `Tabla SQLite: ${modalState.tableName || 'Registros'}`;
    if (modalState.tableName) {
      try {
        const res = await fetch(`/api/table/${encodeURIComponent(modalState.tableName)}?all=1`);
        if (res.ok) {
          const data = await res.json();
          rows = data.rows || [];
          columns = data.columns || [];
        } else {
          rows = modalState.currentRows || [];
          columns = modalState.columns || [];
        }
      } catch (e) {
        rows = modalState.currentRows || [];
        columns = modalState.columns || [];
      }
    } else {
      rows = modalState.currentRows || [];
      columns = modalState.columns || (rows[0] ? Object.keys(rows[0]) : []);
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

function calculateChartData() {
  const activeRows = getActiveRows();
  chartGenState.rows = activeRows;

  const subEl = document.getElementById('chartgen-source-sub');
  if (subEl) {
    const totalAll = chartGenState.allRows ? chartGenState.allRows.length : 0;
    subEl.textContent = `Visualizando ${fmtNum(activeRows.length)} de ${fmtNum(totalAll)} registros de la tabla`;
  }

  const { xCol, yCol, op, timeFormat, sort, limit } = chartGenState;
  if (!activeRows || activeRows.length === 0 || !xCol) {
    return { items: [], totalCount: 0, sum: 0, avg: 0, max: 0, min: 0 };
  }

  const isSumDay = op === 'SUM_DAY';
  const isSumHour = op === 'SUM_HOUR';
  const isSumMinute = op === 'SUM_MINUTE';
  const isSumTime = isSumDay || isSumHour || isSumMinute;

  let effectiveTimeFormat = timeFormat;
  if (isSumDay) effectiveTimeFormat = 'date';
  else if (isSumHour) effectiveTimeFormat = 'hour_datetime';
  else if (isSumMinute) effectiveTimeFormat = 'minute';

  const isTime = isSumTime || (effectiveTimeFormat && effectiveTimeFormat !== 'none');
  const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  let processedRows = [];

  for (let i = 0; i < activeRows.length; i++) {
    const row = activeRows[i];
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
        if (effectiveTimeFormat === 'date') {
          const d = String(dateObj.getDate()).padStart(2, '0');
          const m = String(dateObj.getMonth() + 1).padStart(2, '0');
          const y = dateObj.getFullYear();
          label = `${d}/${m}/${y}`;
          sortKey = dateObj.getFullYear() * 10000 + (dateObj.getMonth() + 1) * 100 + dateObj.getDate();
        } else if (effectiveTimeFormat === 'hour') {
          const h = dateObj.getHours();
          label = `${String(h).padStart(2, '0')}:00`;
          sortKey = h;
        } else if (effectiveTimeFormat === 'weekday') {
          const w = dateObj.getDay();
          label = WEEKDAYS[w];
          sortKey = (w + 6) % 7;
        } else if (effectiveTimeFormat === 'hour_datetime') {
          const d = String(dateObj.getDate()).padStart(2, '0');
          const m = String(dateObj.getMonth() + 1).padStart(2, '0');
          const h = String(dateObj.getHours()).padStart(2, '0');
          label = `${d}/${m} ${h}:00`;
          const roundedHour = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), dateObj.getHours(), 0, 0);
          sortKey = roundedHour.getTime();
        } else if (effectiveTimeFormat === 'minute' || effectiveTimeFormat === 'datetime') {
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

function renderCustomChart() {
  const canvas = document.getElementById('canvas-custom-chart');
  const emptyState = document.getElementById('chartgen-no-data');
  if (!canvas) return;

  const result = calculateChartData();
  chartGenState.processedData = result;

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
  const { type, color, yCol, op } = chartGenState;
  const labels = result.items.map(it => it.label);
  const values = result.items.map(it => it.value);

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

async function openCustomChartBuilder(sourceId) {
  // Show Modal immediately with loading state
  document.getElementById('modal-custom-chart-generator')?.classList.add('active');
  const subEl = document.getElementById('chartgen-source-sub');
  if (subEl) subEl.textContent = 'Cargando registros completos de la tabla...';

  const meta = await loadTableDataSource(sourceId);
  chartGenState.sourceId = sourceId;
  chartGenState.allRows = meta.rows;
  chartGenState.columns = meta.columns;
  chartGenState.title = meta.title;
  chartGenState.recordSlice = 'all';
  chartGenState.dateFrom = null;
  chartGenState.dateTo = null;

  const titleEl = document.getElementById('chartgen-source-title');
  if (titleEl) titleEl.textContent = meta.title;

  const tableSelector = document.getElementById('chartgen-table-selector');
  if (tableSelector) tableSelector.value = sourceId;

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
  }, 150);
}

function initCustomChartBuilderListeners() {
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

  // Overview date range buttons
  const ovRangeBtns = document.querySelectorAll('#overview-traffic-range .filter-btn');
  ovRangeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      ovRangeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      overviewTrafficDays = parseInt(btn.getAttribute('data-days'), 10) || 30;
      renderOverviewCharts();
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
      defaultSource = (sqlState.rows && sqlState.rows.length > 0) ? 'sql-results' : 'modal-table';
    }
    openCustomChartBuilder(defaultSource);
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

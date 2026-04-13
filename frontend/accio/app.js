/**
 * 亿流 Work · 智能财务中台 Agent 平台（Accio 风格 SPA）
 * 架构：数据集合 → 规则沉淀 → 智能驱动 → 场景落地；五大核心 Agent + 业务闭环模块（应收应付/资金计划/预测/付款排程/预警/驾驶舱）。
 * 约束：不替换核心 ERP、本地化部署、增量交付、AI 输出可解释可追溯。
 * 中台能力全景：后端 GET /api/meta/requirements-matrix（能力矩阵）。
 */

/* ════════════════════════════════════════════
   API & Data Layer
   ════════════════════════════════════════════ */
const API_BASE = (() => {
  try {
    const sp = new URLSearchParams(location.search);
    if (sp.get('apiBase')) return sp.get('apiBase').replace(/\/+$/, '');
    const ls = localStorage.getItem('cf_api_base');
    if (ls) return ls.replace(/\/+$/, '');
    if (location.protocol === 'file:') return 'http://127.0.0.1:8000';
    return '';
  } catch { return ''; }
})();

/** 进入门禁：DeepSeek API Key，仅存本机浏览器 */
const ACCIO_KEY_STORAGE = 'cf_accio_deepseek_key';
function getAccioApiKey() {
  try {
    return (sessionStorage.getItem(ACCIO_KEY_STORAGE) || localStorage.getItem(ACCIO_KEY_STORAGE) || '').trim();
  } catch { return ''; }
}

/** 亿流 Work 自绘极简图标（线性 · 与品牌橙统一） */
const AGENT_ICON_SVG = {
  data: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 17V7M10 17V11M15 17V9M20 17V5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" fill="none"/></svg>',
  forecast: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16l5-8 4 5 7-10" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
  plan: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M3 11h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  fx: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="12" r="5" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="15" cy="12" r="5" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M12 12h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  cashflow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 17c2-9 6-11 12-14-1 5-1 9 0 14-5-3-9-6-12-14z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/></svg>',
  alert: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l9 16H3L12 4z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/><path d="M12 10v4M12 17h.01" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>',
  scheduling: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M9 16l2 2 4-4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
  attribution: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="6" r="3" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="18" cy="6" r="3" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="12" cy="18" r="3" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M8.5 7.5l3 7M15.5 7.5l-3 7M9 9l6 2.5" stroke="currentColor" stroke-width="1.25" fill="none" stroke-linecap="round"/></svg>',
  risk: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
  advisor: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>',
};
const USER_ICON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M5 20c.3-3.5 3.2-6 7-6s6.7 2.5 7 6" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>';
const ICON_PICKER_KEYS = ['data', 'forecast', 'plan', 'fx', 'cashflow', 'alert', 'scheduling', 'attribution', 'risk', 'advisor'];

function agentIconHtml(key) {
  const k = key && AGENT_ICON_SVG[key] ? key : 'data';
  return `<span class="agent-icon-svg">${AGENT_ICON_SVG[k]}</span>`;
}
function userIconHtml() {
  return `<span class="user-icon-svg">${USER_ICON_SVG}</span>`;
}

/** 工具分类 · 线性图标（与智能体头像区分，统一橙灰） */
const TOOL_ICON_SVG = {
  fs: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M2 10h20" stroke="currentColor" stroke-width="1.5"/></svg>',
  web: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" fill="none"/><ellipse cx="12" cy="12" rx="4" ry="10" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M2 12h20" stroke="currentColor" stroke-width="1.5"/></svg>',
  product: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3m0-18H5a2 2 0 0 0-2 2v3" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>',
  code: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 18l6-6-6-6M8 6l-6 6 6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
  media: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3v18h18" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M7 16l4-4 4 4 5-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
  util: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>',
  memory: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M8 7h8M8 11h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  collab: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>',
};
function toolIconHtml(key) {
  const inner = TOOL_ICON_SVG[key] || TOOL_ICON_SVG.fs;
  return `<span class="tool-icon-svg">${inner}</span>`;
}

const WIZARD_BLANK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const SKILL_TILE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M9 12h6M9 16h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

/** 次级页面通用线性图标（任务/应用/渠道/分类） */
const UI_ICON = {
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  clipboard: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="8" y="2" width="8" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9 12h6M9 16h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m22 6-10 7L2 6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m21 21-4.35-4.35" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  activity: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bars: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V10M18 20V4M6 20v-4" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>',
  trend: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23 6l-9.5 9.5-5-5L1 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 6h6v6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  zap: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  landmark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  fileText: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  terminal: '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="4 17 10 11 4 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="19" x2="20" y2="19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  building: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 6h4M10 10h4M10 14h4M10 18h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  creditCard: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="1" y1="10" x2="23" y2="10" stroke="currentColor" stroke-width="1.5"/></svg>',
  pie: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.21 15.89A10 10 0 1 1 8 2.83" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M22 12A10 10 0 0 0 12 2v10z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  send: '<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><polygon points="22 2 15 22 11 13 2 9 22 2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  message: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  users: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="9" cy="7" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  folder: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  circle: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 2l1.2 4.2L15 7.5l-4.3 1.2L9.5 13 8.3 8.8 4 7.5l4.2-1.3L9.5 2zM19 14l.8 2.8 2.8.8-2.8.8-.8 2.8-.8-2.8-2.8-.8 2.8-.8.8-2.8z" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/></svg>',
  gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  alertTriangle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l9 16H3L12 4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 10v4M12 17h.01" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  globe: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/><ellipse cx="12" cy="12" rx="4" ry="10" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2 12h20" stroke="currentColor" stroke-width="1.5"/></svg>',
  layout: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="14" y="3" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="14" y="14" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="14" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  layers: '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><polyline points="2 17 12 22 22 17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><polyline points="2 12 12 17 22 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
};
function uiIcon(key) {
  const svg = UI_ICON[key] || UI_ICON.circle;
  return `<span class="ui-icon-wrap">${svg}</span>`;
}

const api = {
  async get(path) { const r = await fetch(API_BASE + path); if (!r.ok) throw new Error(r.status); return r.json(); },
  async post(path, body) {
    const payload = { ...(body || {}) };
    if (path === '/api/agent/chat') {
      const k = getAccioApiKey();
      if (k) payload.deepseek_api_key = k;
    }
    const r = await fetch(API_BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!r.ok) throw new Error(r.status);
    return r.json();
  },
  async put(path, body) { const r = await fetch(API_BASE + path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (!r.ok) throw new Error(r.status); return r.json(); },
  async del(path) { const r = await fetch(API_BASE + path, { method: 'DELETE' }); if (!r.ok) throw new Error(r.status); return r.json(); },
};

const Store = {
  stats: null,
  subjects: [],
  businesses: [],
  records: { items: [], total: 0 },
  plans: [],
  fxExposures: [],
  mappingRules: [],
  timePeriods: [],
  fetchTasks: [],
  subjectCategoryMap: [],
  subjectPlanMap: [],
  analysisReports: [],
  chatHistory: [],
  currentAgent: 'data',
  /** 五大核心 Agent + 业务操作型助手 */
  agents: [
    { id: 'forecast', name: '现金流预测 Agent', avatarKey: 'forecast', desc: '日/周/月滚动预测、多场景模拟、偏差追踪；输出附数据来源与假设，可解释可追溯', tools: ['文件系统','代码与终端','图表与报表'], skills: ['资金流预测','预测引擎','情景模拟'] },
    { id: 'attribution', name: '智能归因 Agent', avatarKey: 'attribution', desc: '计划偏差自动穿透归因、异常支出模式识别、生成结构化归因报告', tools: ['文件系统','记忆与规划','图表与报表'], skills: ['资金计划','经营归因'] },
    { id: 'scheduling', name: '智能排程 Agent', avatarKey: 'scheduling', desc: '动态付款优先级、成本最优调拨路径、异常支付识别与处置建议', tools: ['数据集成','代码与终端','实用工具'], skills: ['付款排程','资金调拨'] },
    { id: 'risk', name: '风险预警 Agent', avatarKey: 'risk', desc: '客商风险评分、坏账与逾期预警、差异化催收策略与函件模板', tools: ['网络与浏览','实用工具','智能体协作'], skills: ['客商风险','异常预警'] },
    { id: 'advisor', name: '决策建议 Agent', avatarKey: 'advisor', desc: '自然语言经营问答、经营分析报告草案、管理建议推送（RAG+本地模型）', tools: ['文件系统','网络与浏览','图表与报表','记忆与规划'], skills: ['经营分析','管理问答'] },
    { id: 'data', name: '数据查询助手', avatarKey: 'data', desc: '自然语言查询资金数据、头寸、流入流出，一键下钻分析', tools: ['文件系统','网络与浏览','代码与终端','实用工具'], skills: ['资金流预测','资金计划','外汇管理'] },
    { id: 'plan', name: '计划管理助手', avatarKey: 'plan', desc: '多级资金计划编制、审批流程、执行监控与刚性管控策略', tools: ['文件系统','代码与终端'], skills: ['资金计划'] },
    { id: 'cashflow', name: '资金流管理', avatarKey: 'cashflow', desc: '资金流录入确认、核销联动、跨模块数据闭环', tools: ['文件系统','代码与终端','数据集成'], skills: ['资金流预测','数据集成'] },
    { id: 'fx', name: '外汇分析师', avatarKey: 'fx', desc: '外汇敞口监控、对冲策略建议、汇率风险与波动分析', tools: ['网络与浏览','实用工具'], skills: ['外汇管理'] },
  ],
  paymentPool: [],
  paymentStrategies: [],
  receivables: [],
  payables: [],
  prepaids: [],
  fundAlerts: [],
  conversations: [],
  backendOk: false,
  rightPanelOpen: false,
  chatFiles: [],
  chatTasks: [],
  chatResults: [],
  _activeConvId: null,
  _agentDetailId: null,
  _rpTab: 'files',
  /** 业务工作台 · 用户自定义垂直场景（localStorage） */
  workbenchScenarios: [],
  /** 工作台内层级：scenarios=选场景；treasury=已进入「司库与资金」模块列表 */
  workbenchView: 'scenarios',
  /** 中台能力 · 外部系统连接态势（localStorage） */
  platformIntegration: [],
  /** 中台能力 · 规则引擎演示配置（localStorage） */
  ruleEngine: {},
};

const WORKBENCH_TREASURY_PAGES = new Set(['dashboard', 'cockpit', 'payment', 'arap', 'cashflow', 'analysis', 'plan', 'fx', 'basedata', 'integration', 'alerts']);
const WB_SCENARIOS_KEY = 'cf_workbench_scenarios';

function loadWorkbenchScenarios() {
  try {
    const raw = localStorage.getItem(WB_SCENARIOS_KEY);
    Store.workbenchScenarios = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(Store.workbenchScenarios)) Store.workbenchScenarios = [];
  } catch { Store.workbenchScenarios = []; }
}

function saveWorkbenchScenarios() {
  try { localStorage.setItem(WB_SCENARIOS_KEY, JSON.stringify(Store.workbenchScenarios)); } catch {}
}

const CF_PLATFORM_INT_KEY = 'cf_platform_integration';
const CF_RULE_ENGINE_KEY = 'cf_rule_engine';

function defaultPlatformIntegration() {
  return [
    { id: 'erp', name: 'ERP / NC / Oracle', domain: '财务主数据', connector: 'REST / DB 适配层（演示）', status: 'simulated', lastSync: null, note: '应收应付、科目余额、计划口径' },
    { id: 'fms', name: '资金管理系统', domain: '头寸与流水', connector: 'OpenAPI / 文件交换（演示）', status: 'simulated', lastSync: null, note: '银企前置、资金池归集' },
    { id: 'bank', name: '银企直连 / 银行网关', domain: '账户与回单', connector: '银企接口 / SWIFT（演示）', status: 'offline', lastSync: null, note: '余额、支付指令状态' },
    { id: 'tms', name: '票据与投融资', domain: '票据/理财/借款', connector: 'MQ / ESB（演示）', status: 'simulated', lastSync: null, note: '保证金、理财到期现金流' },
  ];
}

function defaultRuleEngine() {
  return {
    paymentPriorityMode: 'static',
    dynamicFactors: true,
    p0AlwaysFirst: true,
    liquidityWarnWan: 5000,
    budgetCheck: 'soft',
    blacklistBlock: true,
    traceRequired: true,
  };
}

function loadPlatformCapability() {
  try {
    const i = localStorage.getItem(CF_PLATFORM_INT_KEY);
    Store.platformIntegration = i ? JSON.parse(i) : defaultPlatformIntegration();
    if (!Array.isArray(Store.platformIntegration)) Store.platformIntegration = defaultPlatformIntegration();
    const r = localStorage.getItem(CF_RULE_ENGINE_KEY);
    Store.ruleEngine = r ? JSON.parse(r) : defaultRuleEngine();
    if (!Store.ruleEngine || typeof Store.ruleEngine !== 'object') Store.ruleEngine = defaultRuleEngine();
  } catch {
    Store.platformIntegration = defaultPlatformIntegration();
    Store.ruleEngine = defaultRuleEngine();
  }
}

function savePlatformIntegration() {
  try { localStorage.setItem(CF_PLATFORM_INT_KEY, JSON.stringify(Store.platformIntegration)); } catch {}
}

function saveRuleEngine() {
  try { localStorage.setItem(CF_RULE_ENGINE_KEY, JSON.stringify(Store.ruleEngine)); } catch {}
}

function wbCrumb(moduleLabel = '司库与资金') {
  return `<div class="workbench-crumb">${wbCrumbInner(moduleLabel)}</div>`;
}
function wbCrumbInner(moduleLabel) {
  return `<button type="button" class="wb-crumb-btn" onclick="navigateTo('workbench')">业务工作台</button><span class="wb-crumb-sep">/</span><span class="wb-crumb-here">${escHtml(String(moduleLabel))}</span>`;
}

async function loadAllData() {
  try {
    const [
      stats, subjects, businesses, records, plans, fx, rules, tp, tasks, catMap, planMap,
      payPool, payStrat, rec, pay, pre, fa,
    ] = await Promise.all([
      api.get('/api/dashboard/stats'),
      api.get('/api/subjects'),
      api.get('/api/businesses'),
      api.get('/api/records?page_size=200'),
      api.get('/api/plans'),
      api.get('/api/fx-exposures'),
      api.get('/api/mapping-rules'),
      api.get('/api/time-periods'),
      api.get('/api/fetch-tasks'),
      api.get('/api/subject-category-map').catch(() => []),
      api.get('/api/subject-plan-map').catch(() => []),
      api.get('/api/payment-pool').catch(() => []),
      api.get('/api/payment-strategies').catch(() => []),
      api.get('/api/receivables').catch(() => []),
      api.get('/api/payables').catch(() => []),
      api.get('/api/prepaids').catch(() => []),
      api.get('/api/fund-alerts').catch(() => []),
    ]);
    const fundAlertsNorm = (fa || []).map(a => ({
      ...a,
      time: a.time || a.alert_time || '',
      page: a.page || a.link_page || 'alerts',
    }));
    const prepaidsNorm = (pre || []).map(p => ({
      ...p,
      balance: p.balance != null ? p.balance : p.amount,
    }));
    Object.assign(Store, {
      stats, subjects, businesses, records, plans, fxExposures: fx, mappingRules: rules, timePeriods: tp, fetchTasks: tasks, subjectCategoryMap: catMap, subjectPlanMap: planMap, backendOk: true,
      paymentPool: payPool || [],
      paymentStrategies: payStrat || [],
      receivables: rec || [],
      payables: pay || [],
      prepaids: prepaidsNorm,
      fundAlerts: fundAlertsNorm,
    });
    try { Store.analysisReports = await api.get('/api/analysis/reports'); } catch {}
    seedPlatformDemoIfEmpty();
    return true;
  } catch (e) {
    console.warn('Backend unavailable, using mock data:', e);
    loadMockData();
    return false;
  }
}

/** 后端未返回智能财务中台扩展字段时，仅补全演示数据，不覆盖已有业务数据 */
function seedPlatformDemoIfEmpty() {
  if ((Store.paymentPool || []).length) return;
  const d = off => { const t = new Date(); t.setDate(t.getDate() + off); return t.toISOString().slice(0, 10); };
  Store.paymentPool = [
    { id:1, unit:'上海哈啰普惠', biz_type:'每刻报销', counterparty:'员工报销池', amount:1280000, expect_date:d(0), priority:'P0', status:'待排程', run_at:'09:00', source_doc:'FK-202604-001' },
    { id:2, unit:'华东子公司', biz_type:'供应商货款', counterparty:'核心供应商A', amount:5600000, expect_date:d(1), priority:'P1', status:'已排程', run_at:'10:30', source_doc:'AP-88421' },
  ];
  Store.paymentStrategies = [{ id:1, unit:'*', biz_type:'每刻报销', run_at:'09:00', holiday:'顺延', enabled:true }];
  Store.receivables = [{ id:1, unit:'总部', customer:'合作方X', amount:4200000, age_bucket:'0-30天', due_date:d(12), risk_score:72 }];
  Store.payables = [{ id:1, unit:'总部', vendor:'核心供应商A', amount:5600000, age_bucket:'0-30天', due_date:d(1), credit:'AAA' }];
  Store.prepaids = [{ id:1, unit:'总部', project:'设备采购预付款', balance:2400000, owner:'—', clear_deadline:d(90) }];
  Store.fundAlerts = [{ id:1, level:'中', rule:'演示', message:'后端未返回预警模块数据，已加载本地演示', time:'—', page:'alerts' }];
}

function loadMockData() {
  const d = off => { const t = new Date(); t.setDate(t.getDate() + off); return t.toISOString().slice(0, 10); };
  Store.stats = { total_inflow: 26500000, total_outflow: 17850000, net_position: 8650000, record_count: 19, confirmed: 9, predicted: 7, unconfirmed: 3, fx_exposure_count: 4, fx_total_notional: 29300000, units: ['总部', '华东子公司', '华南子公司'] };
  Store.records = { items: [
    { id:1, code:'CF001', unit:'总部', currency:'CNY', amount:5800000, trade_date:d(-25), status:'已确认', source_system:'资金管理系统' },
    { id:2, code:'CF002', unit:'总部', currency:'CNY', amount:-2300000, trade_date:d(-22), status:'已确认', source_system:'资金管理系统' },
    { id:3, code:'CF003', unit:'总部', currency:'CNY', amount:-450000, trade_date:d(-18), status:'已确认', source_system:'资金管理系统' },
    { id:4, code:'CF004', unit:'华东子公司', currency:'CNY', amount:4100000, trade_date:d(-20), status:'已确认', source_system:'资金管理系统' },
    { id:5, code:'CF005', unit:'华东子公司', currency:'CNY', amount:-1800000, trade_date:d(-12), status:'已确认', source_system:'资金管理系统' },
    { id:6, code:'CF006', unit:'华南子公司', currency:'CNY', amount:2600000, trade_date:d(-18), status:'已确认', source_system:'资金管理系统' },
    { id:7, code:'CF007', unit:'总部', currency:'CNY', amount:6200000, trade_date:d(5), status:'预测', source_system:'手工新增' },
    { id:8, code:'CF008', unit:'总部', currency:'CNY', amount:-2800000, trade_date:d(8), status:'预测', source_system:'手工新增' },
    { id:9, code:'CF009', unit:'华东子公司', currency:'CNY', amount:3800000, trade_date:d(10), status:'预测', source_system:'手工新增' },
    { id:10, code:'CF010', unit:'总部', currency:'USD', amount:850000, trade_date:d(-14), status:'已确认', source_system:'资金管理系统' },
  ], total: 10 };
  Store.plans = [
    { id:1, unit:'总部', period_type:'月', period_label:'2026年4月', status:'草稿', data_json:'{"经营性流入":5200000,"经营性流出":3800000,"投资性流入":800000,"投资性流出":400000}', data_source:'手工' },
    { id:2, unit:'华东子公司', period_type:'月', period_label:'2026年4月', status:'草稿', data_json:'{"经营性流入":3000000,"经营性流出":2200000}', data_source:'手工' },
  ];
  Store.fxExposures = [
    { id:1, currency_pair:'USD/CNY', notional:12500000, direction:'买入', maturity:d(30), hedge_ratio:0.65, instrument:'远期', pnl:185000, status:'持有' },
    { id:2, currency_pair:'USD/CNY', notional:8000000, direction:'卖出', maturity:d(60), hedge_ratio:0.40, instrument:'期权', pnl:-92000, status:'持有' },
    { id:3, currency_pair:'EUR/CNY', notional:5600000, direction:'买入', maturity:d(45), hedge_ratio:0.50, instrument:'远期', pnl:68000, status:'持有' },
    { id:4, currency_pair:'SAR/CNY', notional:3200000, direction:'买入', maturity:d(90), hedge_ratio:0, instrument:'无对冲', pnl:0, status:'未对冲' },
  ];
  Store.fetchTasks = [
    { id:1, name:'资金流自动获取', task_type:'资金流自动获取', enabled:true, cron_expr:'每日 08:00', filters_json:'{}', extra_json:'{}' },
    { id:2, name:'资金计划取预测', task_type:'资金计划自动获取资金预测', enabled:true, cron_expr:'每周一 09:00', filters_json:'{}', extra_json:'{}' },
  ];
  Store.subjects = [
    { id:1, code:'100', name:'经营性收入', direction:'流入', parent_id:null, is_period:'否', valid:true },
    { id:2, code:'100001', name:'销售收入', direction:'流入', parent_id:1, is_period:'否', valid:true },
    { id:3, code:'100002', name:'服务收入', direction:'流入', parent_id:1, is_period:'否', valid:true },
    { id:4, code:'200', name:'经营性支出', direction:'流出', parent_id:null, is_period:'否', valid:true },
    { id:5, code:'200001', name:'采购支出', direction:'流出', parent_id:4, is_period:'否', valid:true },
    { id:6, code:'300', name:'投资性收入', direction:'流入', parent_id:null, is_period:'否', valid:true },
    { id:7, code:'400', name:'投资性支出', direction:'流出', parent_id:null, is_period:'否', valid:true },
    { id:8, code:'500', name:'融资性收入', direction:'流入', parent_id:null, is_period:'否', valid:true },
    { id:9, code:'600', name:'融资性支出', direction:'流出', parent_id:null, is_period:'否', valid:true },
  ];
  Store.businesses = [
    { id:1, code:'001', name:'一般资金流', biz_type:'一般资金流', valid:true },
    { id:2, code:'002', name:'保证金收付', biz_type:'保证金/理财', valid:true },
    { id:3, code:'003', name:'理财申购/赎回', biz_type:'保证金/理财', valid:true },
    { id:4, code:'004', name:'借款收付', biz_type:'借款', valid:true },
    { id:5, code:'005', name:'外汇即期', biz_type:'外汇即远期', valid:true },
  ];
  Store.mappingRules = [
    { id:1, code:'MR000001', name:'TMS资金流映射', source_system:'资金管理系统', source_doc_type:'资金流水', valid:true, filters_json:'{}', field_map_json:'{}' },
    { id:2, code:'MR000002', name:'ERP应收映射', source_system:'ERP系统', source_doc_type:'应收单据', valid:true, filters_json:'{}', field_map_json:'{}' },
  ];
  Store.timePeriods = [
    { id:1, code:'TP0001', name:'标准复合周期', periods_json:'[{"freq":"天","length":7},{"freq":"周","length":4},{"freq":"月","length":3}]', valid:true },
  ];
  Store.paymentPool = [
    { id:1, unit:'上海哈啰普惠', biz_type:'每刻报销', counterparty:'员工报销池', amount:1280000, expect_date:d(0), priority:'P0', status:'待排程', run_at:'09:00', source_doc:'FK-202604-001' },
    { id:2, unit:'华东子公司', biz_type:'供应商货款', counterparty:'核心供应商A', amount:5600000, expect_date:d(1), priority:'P1', status:'已排程', run_at:'10:30', source_doc:'AP-88421' },
    { id:3, unit:'总部', biz_type:'税费', counterparty:'主管税务机关', amount:2100000, expect_date:d(0), priority:'P0', status:'待排程', run_at:'15:00', source_doc:'TAX-Q2' },
    { id:4, unit:'华南子公司', biz_type:'骑手薪酬', counterparty:'劳务结算', amount:920000, expect_date:d(0), priority:'P0', status:'队列中', run_at:'08:00', source_doc:'HR-PAY-03' },
    { id:5, unit:'总部', biz_type:'票据兑付', counterparty:'承兑行', amount:15000000, expect_date:d(3), priority:'P1', status:'待排程', run_at:'—', source_doc:'BILL-778' },
  ];
  Store.paymentStrategies = [
    { id:1, unit:'上海哈啰普惠', biz_type:'每刻报销', run_at:'09:00', holiday:'顺延', enabled:true },
    { id:2, unit:'*', biz_type:'每刻报销', run_at:'10:00', holiday:'顺延', enabled:true },
    { id:3, unit:'*', biz_type:'骑手薪酬', run_at:'08:00', holiday:'不调整', enabled:true },
  ];
  Store.receivables = [
    { id:1, unit:'总部', customer:'合作方X', amount:4200000, age_bucket:'0-30天', due_date:d(12), risk_score:72 },
    { id:2, unit:'华东子公司', customer:'渠道商Y', amount:1850000, age_bucket:'31-90天', due_date:d(-5), risk_score:58 },
    { id:3, unit:'华南子公司', customer:'平台结算', amount:960000, age_bucket:'90天以上', due_date:d(-40), risk_score:41 },
  ];
  Store.payables = [
    { id:1, unit:'总部', vendor:'核心供应商A', amount:5600000, age_bucket:'0-30天', due_date:d(1), credit:'AAA' },
    { id:2, unit:'华东子公司', vendor:'物流服务商', amount:320000, age_bucket:'0-30天', due_date:d(2), credit:'AA' },
  ];
  Store.prepaids = [
    { id:1, unit:'总部', project:'设备采购预付款', balance:2400000, owner:'张某', clear_deadline:d(90) },
    { id:2, unit:'华南子公司', project:'城市拓展合作', balance:800000, owner:'李某', clear_deadline:d(-10) },
  ];
  Store.fundAlerts = [
    { id:1, level:'高', rule:'流动性备付金', message:'总部基本户可用余额低于安全线 5,000 万', time:'今日 08:12', page:'payment' },
    { id:2, level:'中', rule:'重复支付嫌疑', message:'供应商A 同日两笔等额付款待复核', time:'今日 09:40', page:'payment' },
    { id:3, level:'中', rule:'应收逾期', message:'渠道商Y 应收已逾期 5 天', time:'昨日 17:05', page:'arap' },
    { id:4, level:'低', rule:'外汇敞口', message:'USD/CNY 未对冲名义超阈值', time:'今日 07:00', page:'fx' },
  ];
}

/* ════════════════════════════════════════════
   Utility
   ════════════════════════════════════════════ */
function fmtAmt(v) {
  if (v == null || isNaN(v)) return '-';
  if (Math.abs(v) >= 1e8) return (v / 1e8).toFixed(2) + '亿';
  if (Math.abs(v) >= 1e4) return (v / 1e4).toFixed(1) + '万';
  return v.toLocaleString('zh-CN');
}
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; }

const Toast = {
  show(type, msg) {
    const c = $('#toastContainer');
    const t = el('div', 'toast ' + type, `<strong>${msg}</strong>`);
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; t.style.transition = 'all .3s'; setTimeout(() => t.remove(), 300); }, 3000);
  },
  success(m) { this.show('success', m); },
  warn(m) { this.show('warn', m); },
  danger(m) { this.show('danger', m); },
  info(m) { this.show('info', m); },
};

function openModal(title, bodyHtml, footerHtml) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = bodyHtml;
  $('#modalFooter').innerHTML = footerHtml || '';
  $('#modalDialog').classList.remove('wizard-dialog');
  $('#modalOverlay').classList.add('open');
}
function openWizardModal(html) {
  $('#modalTitle').textContent = '';
  $('#modalBody').innerHTML = html;
  $('#modalFooter').innerHTML = '';
  $('#modalDialog').classList.add('wizard-dialog');
  $('#modalOverlay').classList.add('open');
}
function closeModal() { $('#modalOverlay').classList.remove('open'); }

/* ════════════════════════════════════════════
   Router
   ════════════════════════════════════════════ */
let currentPage = 'chat';

const DIGITAL_EMPLOYEE_PAGES = new Set(['agents']);

function navigateTo(pageId) {
  if (DIGITAL_EMPLOYEE_PAGES.has(currentPage) && !DIGITAL_EMPLOYEE_PAGES.has(pageId)) {
    Store._agentDetailId = null;
  }
  currentPage = pageId;
  $$('.page').forEach(p => p.classList.remove('active'));
  const pg = $(`#page-${pageId}`);
  if (pg) pg.classList.add('active');
  $$('.nav-btn').forEach(b => {
    const p = b.dataset.page;
    if (!p) return;
    const active = p === pageId
      || (p === 'workbench' && WORKBENCH_TREASURY_PAGES.has(pageId));
    b.classList.toggle('active', active);
  });

  const showRP = (pageId === 'chat' && Store.rightPanelOpen) || (DIGITAL_EMPLOYEE_PAGES.has(pageId) && Store._agentDetailId);
  document.getElementById('accioApp').classList.toggle('right-open', showRP);

  switch (pageId) {
    case 'chat': renderChat(); break;
    case 'agents': renderAgents(); break;
    case 'tasks': renderTasks(); break;
    case 'apps': renderApps(); break;
    case 'skills': renderSkills(); break;
    case 'channels': renderChannels(); break;
    case 'pairing': renderPairing(); break;
    case 'workbench':
      Store.workbenchView = 'scenarios';
      renderWorkbench();
      break;
    case 'dashboard': renderDashboard(); break;
    case 'cashflow': renderCashflow(); break;
    case 'analysis': renderAnalysis(); break;
    case 'plan': renderPlan(); break;
    case 'fx': renderFx(); break;
    case 'basedata': renderBaseData(); break;
    case 'integration': renderIntegration(); break;
    case 'platform': renderPlatform(); break;
    case 'payment': renderPaymentSchedule(); break;
    case 'arap': renderArap(); break;
    case 'alerts': renderAlertCenter(); break;
    case 'cockpit': renderCockpit(); break;
    case 'settings': renderSettings(); break;
  }
}

/* ════════════════════════════════════════════
   Chat Page
   ════════════════════════════════════════════ */
function renderChat() {
  const hasMessages = Store.chatHistory.length > 0;
  const agent = !hasMessages
    ? (Store.agents.find(a => a.id === Store.currentAgent) || Store.agents[0])
    : null;
  const pg = $('#page-chat');
  document.getElementById('accioApp').classList.toggle('right-open', Store.rightPanelOpen);
  const taskBadge = Store.chatTasks.length
    ? `<span class="chat-task-pill" id="chatTaskPill"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> 任务 <b>${Store.chatTasks.filter(t=>t.done).length}/${Store.chatTasks.length}</b></span>`
    : '';

  if (hasMessages) {
    pg.innerHTML = `
      <div class="chat-header-bar chat-header-bar--minimal">
        <div class="chat-header-right">
          ${taskBadge}
          <button class="icon-btn-sm" id="btnToggleMembers" title="成员"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></button>
          <button class="icon-btn-sm" id="btnToggleRP" title="${Store.rightPanelOpen ? '收起' : '展开'}面板"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="15" y1="3" x2="15" y2="21"/></svg></button>
        </div>
      </div>
      <div class="chat-container has-messages">
        <div class="chat-messages" id="chatMessages">
          ${Store.chatHistory.map(renderChatMsg).join('')}
        </div>
        ${renderComposer()}
      </div>
    `;
    renderRightPanel();
  } else {
    pg.innerHTML = `
      <div class="chat-header-bar chat-header-bar--minimal">
        <div class="chat-header-right">
          <button class="icon-btn-sm" id="btnToggleRP" title="${Store.rightPanelOpen ? '收起' : '展开'}面板"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="15" y1="3" x2="15" y2="21"/></svg></button>
        </div>
      </div>
      <div class="chat-container">
        <div class="chat-welcome-area chat-welcome-area--minimal">
          <div class="chat-agent-avatar chat-agent-avatar--minimal">${agentIconHtml(agent.avatarKey || agent.id)}</div>
          <p class="chat-welcome-line">已接入主台数据，在下方输入问题即可。</p>
        </div>
        ${renderComposer()}
      </div>
    `;
    renderRightPanel();
  }

  const input = $('#chatInput');
  const sendBtn = $('#chatSendBtn');
  if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } });
  if (sendBtn) sendBtn.addEventListener('click', () => sendChat());
  $$('.quick-card').forEach(c => {
    c.addEventListener('click', () => { if (input) { input.value = c.dataset.prompt; input.focus(); } });
  });
  $('#btnToggleRP')?.addEventListener('click', () => toggleRightPanel());
  $('#chatTaskPill')?.addEventListener('click', () => { if (!Store.rightPanelOpen) toggleRightPanel(); });

  const msgArea = $('#chatMessages');
  if (msgArea) {
    msgArea.addEventListener('click', e => {
      const actBtn = e.target.closest('.msg-cf-btn[data-cf-action]');
      if (actBtn && actBtn.dataset.cfAction) {
        const name = actBtn.dataset.cfAction;
        if (CF_ACTION_KEYS.has(name)) {
          e.preventDefault();
          executeToolCall(name, {});
          Toast.success(name === 'run_analysis' ? '分析已在右侧面板更新' : '已执行');
        }
        return;
      }
      const navEl = e.target.closest('.msg-link[data-nav], .msg-action-btn[data-nav], .msg-cf-btn[data-nav]');
      if (navEl && navEl.dataset.nav) {
        e.preventDefault();
        navigateTo(navEl.dataset.nav);
        Toast.info('已打开 ' + (pageLabels[navEl.dataset.nav] || navEl.dataset.nav));
      }
    });
  }

  if (hasMessages) scrollChatBottom();
}

function toggleRightPanel() {
  if (Store._agentDetailId) {
    Store._agentDetailId = null;
    document.getElementById('accioApp').classList.remove('right-open');
    $$('.agent-card.selected').forEach(c => c.classList.remove('selected'));
    return;
  }
  Store.rightPanelOpen = !Store.rightPanelOpen;
  document.getElementById('accioApp').classList.toggle('right-open', Store.rightPanelOpen);
  const btn = $('#btnToggleRP');
  if (btn) btn.title = Store.rightPanelOpen ? '收起面板' : '展开面板';
}

function addChatFile(name, type, badge) {
  if (!Store.chatFiles.find(f => f.name === name)) {
    Store.chatFiles.push({ name, type: type || 'file', badge: badge || '' });
    renderRightPanel();
  }
}
function addChatTask(text, done) {
  Store.chatTasks.push({ text, done: !!done });
}

function renderRightPanel() {
  const body = $('#rightPanelBody');
  if (!body) return;

  $$('.rp-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.rptab === Store._rpTab);
    t.onclick = () => { Store._rpTab = t.dataset.rptab; renderRightPanel(); };
  });

  const resultBadge = Store.chatResults.length;
  const resTab = document.querySelector('.rp-tab[data-rptab="results"]');
  if (resTab) resTab.innerHTML = `执行结果${resultBadge ? ` <span class="rp-tab-badge">${resultBadge}</span>` : ''}`;

  if (Store._rpTab === 'results') {
    renderRightPanelResults(body);
  } else {
    renderRightPanelFiles(body);
  }
}

function renderRightPanelFiles(body) {
  const folderIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
  const fileIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
  const csvIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>`;

  if (Store.chatHistory.length > 0 && Store.chatFiles.length === 0) {
    addChatFile('工作区', 'folder', '');
    const lastA = [...Store.chatHistory].reverse().find(m => m.role === 'assistant');
    if (lastA) {
      const c = lastA.content || '';
      if (/资金|头寸|流入|流出/.test(c)) addChatFile('资金流报告.csv', 'csv', '新');
      if (/预测|模型|趋势/.test(c)) addChatFile('预测结果.json', 'file', '新');
      if (/计划|偏差|待办/.test(c)) addChatFile('计划摘要.md', 'file', '');
      if (/外汇|敞口|对冲/.test(c)) addChatFile('外汇敞口报告.csv', 'csv', '');
    }
  }

  const defaultFiles = [{ name: '工作区', type: 'folder', badge: '' }];
  const fileHtml = (Store.chatFiles.length ? Store.chatFiles : defaultFiles).map(f => {
    const icon = f.type === 'folder' ? folderIcon : f.name.endsWith('.csv') ? csvIcon : fileIcon;
    const cls = f.type === 'folder' ? 'is-folder' : '';
    const badge = f.badge ? `<span class="file-badge">${f.badge}</span>` : '';
    return `<div class="file-item ${cls}">${icon}<span class="file-name">${f.name}</span>${badge}</div>`;
  }).join('');

  const taskHtml = Store.chatTasks.length ? `
    <div class="rp-section">
      <div class="rp-task-section">
        <div class="rp-task-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> 任务 ${Store.chatTasks.filter(t=>t.done).length}/${Store.chatTasks.length}</div>
        <div class="rp-task-list">${Store.chatTasks.map(t => `<div class="rp-task-item"><div class="rp-task-check ${t.done?'done':'running'}"></div><span class="rp-task-text ${t.done?'done':''}">${t.text}</span></div>`).join('')}</div>
      </div>
    </div>` : '';

  body.innerHTML = `${taskHtml}<div class="rp-section"><div class="rp-section-label">名称</div><div class="file-list">${fileHtml}</div></div>`;

  $$('.file-item').forEach(el => {
    el.addEventListener('click', () => Toast.info(`打开: ${el.querySelector('.file-name')?.textContent || ''}`));
  });
}

const pageLabels = { workbench:'业务工作台', dashboard:'总览看板', cashflow:'资金流管理', analysis:'预测引擎', plan:'资金计划', fx:'外汇敞口', basedata:'基础数据', integration:'数据集成', platform:'中台能力', payment:'付款排程', arap:'往来款管理', alerts:'资金预警中心', cockpit:'管理驾驶舱', chat:'对话' };
/** 助手回复里 [文案](cf-page:xxx) / [文案](cf-action:xxx) 白名单 */
const CF_PAGE_KEYS = new Set(['workbench', 'dashboard', 'cashflow', 'analysis', 'plan', 'fx', 'basedata', 'integration', 'platform', 'payment', 'arap', 'alerts', 'cockpit', 'chat']);
const CF_ACTION_KEYS = new Set(['run_analysis', 'query_cashflow', 'query_fx', 'query_plans']);

function addChatResult(result) {
  Store.chatResults.unshift(result);
  if (Store.chatResults.length > 20) Store.chatResults.pop();
  Store._rpTab = 'results';
  Store.rightPanelOpen = true;
  document.getElementById('accioApp').classList.add('right-open');
  renderRightPanel();
}

function renderRightPanelResults(body) {
  if (!Store.chatResults.length) {
    body.innerHTML = `<div class="rp-results-empty"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--gray-300)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg><div>暂无执行结果</div><div style="font-size:11px;color:var(--gray-400);margin-top:4px;">智能体执行操作后，结果将在此处展示</div></div>`;
    return;
  }

  body.innerHTML = Store.chatResults.map((r, i) => {
    const time = r.time || '';
    if (r.type === 'navigate') {
      return `<div class="rp-result-card" data-idx="${i}">
        <div class="rp-result-header"><span class="rp-result-type nav">跳转</span><span class="rp-result-time">${time}</span></div>
        <div class="rp-result-title">${pageLabels[r.page] || r.page}</div>
        <div class="rp-result-preview" id="rpResultPreview${i}"></div>
        <button class="rp-result-open" data-page="${r.page}">在工作台中打开 →</button>
      </div>`;
    } else if (r.type === 'analysis') {
      return `<div class="rp-result-card" data-idx="${i}">
        <div class="rp-result-header"><span class="rp-result-type analysis">分析</span><span class="rp-result-time">${time}</span></div>
        <div class="rp-result-title">资金分析与预测</div>
        <div class="rp-result-chart" id="rpResultChart${i}" style="height:180px;"></div>
        <button class="rp-result-open" data-page="analysis">在工作台中打开 →</button>
      </div>`;
    } else if (r.type === 'data') {
      return `<div class="rp-result-card" data-idx="${i}">
        <div class="rp-result-header"><span class="rp-result-type data">数据</span><span class="rp-result-time">${time}</span></div>
        <div class="rp-result-title">${r.title || '查询结果'}</div>
        <div class="rp-result-data">${r.html || ''}</div>
      </div>`;
    }
    return '';
  }).join('');

  $$('.rp-result-open').forEach(btn => btn.addEventListener('click', () => navigateTo(btn.dataset.page)));

  setTimeout(() => {
    Store.chatResults.forEach((r, i) => {
      if (r.type === 'navigate') renderResultPreview(i, r);
      if (r.type === 'analysis' && r.data) renderResultChart(i, r.data);
    });
  }, 100);
}

function renderResultPreview(idx, r) {
  const el = $(`#rpResultPreview${idx}`);
  if (!el) return;
  const s = Store.stats || {};
  const previews = {
    workbench: `<div class="rp-mini-stat">垂直场景 <strong>${(Store.workbenchScenarios||[]).length}</strong> 个 · 内置司库与资金</div>`,
    platform: `<div class="rp-mini-stat">外部系统 <strong>${(Store.platformIntegration||[]).length}</strong> 个 · 规则引擎已配置</div>`,
    dashboard: `<div class="rp-mini-kpis"><div class="rp-mini-kpi"><div class="rp-mini-val">${((s.net_position||0)/1e4).toFixed(0)}万</div><div class="rp-mini-lbl">净头寸</div></div><div class="rp-mini-kpi"><div class="rp-mini-val">${((s.total_inflow||0)/1e4).toFixed(0)}万</div><div class="rp-mini-lbl">流入</div></div><div class="rp-mini-kpi"><div class="rp-mini-val">${((s.total_outflow||0)/1e4).toFixed(0)}万</div><div class="rp-mini-lbl">流出</div></div></div>`,
    cashflow: `<div class="rp-mini-stat">资金流单据 <strong>${(Store.records?.items||[]).length}</strong> 条</div>`,
    analysis: `<div class="rp-mini-stat">时段方案 <strong>${Store.timePeriods?.length||0}</strong> 个 · 科目映射 <strong>${Object.keys(Store.categoryMap||{}).length}</strong></div>`,
    plan: `<div class="rp-mini-stat">资金计划 <strong>${Store.plans?.length||0}</strong> 条 · 草稿 <strong>${Store.plans?.filter(p=>p.status==='草稿').length||0}</strong></div>`,
    fx: `<div class="rp-mini-stat">外汇敞口 <strong>${Store.fxExposures?.length||0}</strong> 笔 · 总名义 <strong>${((Store.fxExposures||[]).reduce((a,e)=>a+e.notional,0)/1e4).toFixed(0)}万</strong></div>`,
    basedata: `<div class="rp-mini-stat">科目 <strong>${Store.subjects?.length||0}</strong> · 业务类型 <strong>${Store.businesses?.length||0}</strong></div>`,
    integration: `<div class="rp-mini-stat">映射规则 <strong>${(Store.mappingRules||Store.rules||[]).length||0}</strong> 条</div>`,
    payment: `<div class="rp-mini-stat">待付款池 <strong>${(Store.paymentPool||[]).length}</strong> 笔 · P0 <strong>${(Store.paymentPool||[]).filter(p=>p.priority==='P0').length}</strong></div>`,
    arap: `<div class="rp-mini-stat">应收 <strong>${(Store.receivables||[]).length}</strong> · 应付 <strong>${(Store.payables||[]).length}</strong> · 预付 <strong>${(Store.prepaids||[]).length}</strong></div>`,
    alerts: `<div class="rp-mini-stat">未处理预警 <strong>${(Store.fundAlerts||[]).length}</strong> 条</div>`,
    cockpit: `<div class="rp-mini-stat">净头寸 <strong>${fmtAmt(Store.stats?.net_position)}</strong> · 预警 <strong>${(Store.fundAlerts||[]).length}</strong></div>`,
  };
  el.innerHTML = previews[r.page] || '<div class="rp-mini-stat">加载中...</div>';
}

function renderResultChart(idx, data) {
  const dom = $(`#rpResultChart${idx}`);
  if (!dom || typeof echarts === 'undefined' || !data.periods) return;
  const chart = echarts.init(dom);
  const labels = data.periods.map(p => p.label);
  const pos = data.position || {};
  chart.setOption({
    tooltip: { trigger: 'axis', textStyle: { fontSize: 11 } },
    legend: { data: ['期末余额','流入','流出'], top: 0, textStyle: { fontSize: 10 } },
    grid: { top: 28, right: 8, bottom: 24, left: 8, containLabel: true },
    xAxis: { type: 'category', data: labels, axisLabel: { fontSize: 9, color: '#a3a3a3', rotate: labels.length > 6 ? 30 : 0 } },
    yAxis: { type: 'value', axisLabel: { formatter: v => (v/1e4).toFixed(0)+'万', fontSize: 9, color: '#a3a3a3' }, splitLine: { lineStyle: { color: '#f0f0f0' } } },
    series: [
      { name: '期末余额', type: 'line', data: pos.closing||[], itemStyle: { color: '#F26522' }, smooth: true, lineStyle: { width: 2 }, symbol: 'none', areaStyle: { color: { type:'linear',x:0,y:0,x2:0,y2:1,colorStops:[{offset:0,color:'rgba(242,101,34,.15)'},{offset:1,color:'rgba(242,101,34,0)'}] } } },
      { name: '流入', type: 'bar', data: pos.inflow||[], itemStyle: { color: '#22C55E' }, barMaxWidth: 10 },
      { name: '流出', type: 'bar', data: (pos.outflow||[]).map(v=>-v), itemStyle: { color: '#EF4444' }, barMaxWidth: 10 },
    ],
  });
}

function renderComposer() {
  return `
    <div class="chat-composer">
      <div class="composer-box">
        <textarea class="composer-textarea" id="chatInput" rows="2" placeholder="输入问题… (@ 引用文件)"></textarea>
        <div class="composer-toolbar">
          <div class="composer-left">
            <button class="composer-attach-btn" title="附件">+</button>
            <span class="composer-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> 工作区</span>
          </div>
          <div class="composer-spacer"></div>
          <div class="composer-right">
            <select class="composer-select" id="permSelect" title="权限"><option value="ro">默认权限</option><option value="draft">受限写</option><option value="full">完全</option></select>
            <select class="composer-select" id="modelSelect" title="模型"><option>自动</option><option>DeepSeek</option></select>
            <button class="composer-send-btn" id="chatSendBtn" title="发送">↑</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderQuickCards() {
  return `
    <div class="chat-quick-cards chat-quick-cards--wide">
      <div class="quick-card" data-prompt="帮我看看当前资金头寸和资金流概况">
        <div class="quick-card-header"><span class="qc-mini-ico">${agentIconHtml('data')}</span><span class="qc-agent-label">数据查询</span></div>
        <div class="quick-card-title">资金概况</div>
        <div class="quick-card-desc">头寸、流入流出、外汇敞口</div>
      </div>
      <div class="quick-card" data-prompt="基于当前数据做未来4周现金流滚动预测，并说明假设与不确定性">
        <div class="quick-card-header"><span class="qc-mini-ico">${agentIconHtml('forecast')}</span><span class="qc-agent-label">现金流预测</span></div>
        <div class="quick-card-title">滚动预测</div>
        <div class="quick-card-desc">日/周/月预测与情景模拟</div>
      </div>
      <div class="quick-card" data-prompt="分析本月资金计划相对执行的偏差，从费用类型和主体维度归因">
        <div class="quick-card-header"><span class="qc-mini-ico">${agentIconHtml('attribution')}</span><span class="qc-agent-label">智能归因</span></div>
        <div class="quick-card-title">偏差归因</div>
        <div class="quick-card-desc">穿透下钻与结构化报告</div>
      </div>
      <div class="quick-card" data-prompt="待付款池按优先级排序，并给出调拨路径成本比较（演示数据即可）">
        <div class="quick-card-header"><span class="qc-mini-ico">${agentIconHtml('scheduling')}</span><span class="qc-agent-label">智能排程</span></div>
        <div class="quick-card-title">付款与调拨</div>
        <div class="quick-card-desc">优先级、调拨路径、异常支付</div>
      </div>
      <div class="quick-card" data-prompt="列出当前高风险应收与建议催收动作">
        <div class="quick-card-header"><span class="qc-mini-ico">${agentIconHtml('risk')}</span><span class="qc-agent-label">风险预警</span></div>
        <div class="quick-card-title">客商与催收</div>
        <div class="quick-card-desc">评分、逾期、催收策略</div>
      </div>
      <div class="quick-card" data-prompt="本月集团层面资金缺口主要由哪些业务线造成？请结合数据说明">
        <div class="quick-card-header"><span class="qc-mini-ico">${agentIconHtml('advisor')}</span><span class="qc-agent-label">决策建议</span></div>
        <div class="quick-card-title">经营问答</div>
        <div class="quick-card-desc">NL 查询与管理建议</div>
      </div>
    </div>
  `;
}

function openAgentPicker() {
  const html = Store.agents.map(a => `
    <div class="agent-pick-item" data-id="${a.id}">
      <div class="agent-pick-avatar">${agentIconHtml(a.avatarKey || a.id)}</div>
      <div class="agent-pick-info"><div class="agent-pick-name">${a.name}</div><div class="agent-pick-desc">${a.desc}</div></div>
    </div>
  `).join('');
  openModal('新消息', `<div class="agent-pick-subtitle">选择一个智能体开始对话。已有的会话将直接打开。</div>${html}`);
  setTimeout(() => {
    $$('.agent-pick-item').forEach(item => {
      item.addEventListener('click', () => { Store.currentAgent = item.dataset.id; Store.chatHistory = []; closeModal(); navigateTo('chat'); });
    });
  }, 50);
}

function renderChatMsg(msg) {
  const isUser = msg.role === 'user';
  const agent = Store.agents.find(a => a.id === Store.currentAgent) || Store.agents[0];
  const time = msg.time || new Date().toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'});
  return `
    <div class="chat-msg ${msg.role}">
      <div class="chat-msg-avatar">${isUser ? userIconHtml() : agentIconHtml(agent.avatarKey || agent.id)}</div>
      <div>
        <div class="chat-msg-bubble">${isUser ? escHtml(msg.content) : renderMarkdown(msg.content)}</div>
        <div class="chat-msg-meta">
          <span>${time}</span>
          ${!isUser ? `<div class="chat-msg-actions"><button type="button" class="msg-act-btn" title="重试"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></button><button type="button" class="msg-act-btn" title="复制" onclick="navigator.clipboard.writeText(this.closest('.chat-msg').querySelector('.chat-msg-bubble').innerText);Toast.success('已复制')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button></div>` : ''}
        </div>
      </div>
    </div>
  `;
}

function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function renderMarkdown(text) {
  _linkifiedPages.clear();
  let clean = text.replace(/```json[\s\S]*?```/g, '').trim();
  if (!clean) clean = text;
  clean = clean.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const lines = clean.split('\n');
  let html = '';
  let inList = false;
  let listItems = [];
  let tableRows = [];

  const flushList = () => {
    if (listItems.length) {
      html += '<div class="msg-list">' + listItems.map(li => '<div class="msg-list-item">' + li + '</div>').join('') + '</div>';
      listItems = [];
    }
    inList = false;
  };

  const flushTable = () => {
    if (tableRows.length < 2) { tableRows = []; return; }
    const headerCells = tableRows[0];
    const dataRows = tableRows.slice(1).filter(r => !r.every(c => /^[-:]+$/.test(c.trim())));
    html += '<div class="msg-table-wrap"><table class="msg-table"><thead><tr>' +
      headerCells.map(c => '<th>' + inlineFmt(c.trim()) + '</th>').join('') +
      '</tr></thead><tbody>' +
      dataRows.map(r => '<tr>' + r.map(c => '<td>' + inlineFmt(c.trim()) + '</td>').join('') + '</tr>').join('') +
      '</tbody></table></div>';
    tableRows = [];
  };

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    if (line.startsWith('|') && line.endsWith('|')) {
      flushList();
      const cells = line.slice(1, -1).split('|');
      tableRows.push(cells);
      continue;
    } else if (tableRows.length) {
      flushTable();
    }

    if (!line) { flushList(); continue; }

    if (/^#{1,6}\s/.test(line) || /^#{1,6}[\u3000]/.test(line) || /^#{1,6}$/.test(line)) {
      flushList();
      const title = line.replace(/^#{1,6}\s*/, '').trim();
      if (title) html += '<div class="msg-section-title">' + inlineFmt(title) + '</div>';
      continue;
    }

    if (/^---+$/.test(line) || /^\*\*\*+$/.test(line)) { flushList(); html += '<div class="msg-divider"></div>'; continue; }

    const numbered = line.match(/^(\d+)\.\s+(.+)/);
    if (numbered) {
      if (!inList) { flushList(); inList = true; }
      listItems.push('<span class="msg-num">' + numbered[1] + '</span>' + inlineFmt(numbered[2]));
      continue;
    }

    if (/^[-•]\s+/.test(line)) {
      if (!inList) { flushList(); inList = true; }
      listItems.push(inlineFmt(line.replace(/^[-•]\s+/, '')));
      continue;
    }

    flushList();
    html += '<p class="msg-p">' + inlineFmt(line) + '</p>';
  }
  flushList();
  flushTable();

  html = addVisualCards(html);
  html += buildActionButtons(clean);
  return html;
}

/** 检测助手是否使用了 cf-page / cf-action 链接语法（含全角标点变体） */
function hasCfMarkdownInText(text) {
  return /[\[\uff3b]\s*[^\]\uff3d]+\s*[\]\uff3d]\s*[\(\uff08]\s*cf-(page|action)\s*[:：]/i.test(text);
}

const linkablePages = {
  '业务工作台': 'workbench', '垂直场景': 'workbench', '场景中心': 'workbench',
  '总览看板': 'dashboard', '仪表盘': 'dashboard',
  '资金流管理': 'cashflow', '详细资金流': 'cashflow', '资金流水': 'cashflow',
  '分析预测': 'analysis', '预测分析': 'analysis', '预测引擎': 'analysis',
  '资金计划': 'plan', '计划管理': 'plan',
  '外汇敞口': 'fx',
  '基础数据': 'basedata',
  '数据集成': 'integration',
  '中台能力': 'platform', '集成态势': 'platform', '能力全景': 'platform',
  '付款排程': 'payment', '待付款池': 'payment', '智能排程': 'payment',
  '往来款': 'arap', '应收应付': 'arap', '往来款管理': 'arap',
  '预警中心': 'alerts', '资金预警': 'alerts',
  '管理驾驶舱': 'cockpit', '驾驶舱': 'cockpit',
};

const _linkifiedPages = new Set();

function inlineFmt(s) {
  s = s.replace(/^#{1,6}\s*/, '');

  // [文案](cf-page:xxx) / 全角［］（）、冒号：、两侧空格 — 模型常混用，需统一成按钮
  const cfPageRe = /[\[\uff3b]\s*([^\]\uff3d]+?)\s*[\]\uff3d]\s*[\(\uff08]\s*cf-page\s*[:：]\s*([a-z0-9_-]+)\s*[\)\uff09]/gi;
  s = s.replace(cfPageRe, (_, label, page) => {
    const lb = String(label).trim();
    const p = String(page).toLowerCase();
    if (!CF_PAGE_KEYS.has(p)) return '[' + lb + '](cf-page:' + page + ')';
    return '<button type="button" class="msg-cf-btn msg-cf-btn--page" data-nav="' + p + '">' + lb + '</button>';
  });
  const cfActionRe = /[\[\uff3b]\s*([^\]\uff3d]+?)\s*[\]\uff3d]\s*[\(\uff08]\s*cf-action\s*[:：]\s*([a-z0-9_-]+)\s*[\)\uff09]/gi;
  s = s.replace(cfActionRe, (_, label, action) => {
    const lb = String(label).trim();
    const a = String(action).toLowerCase();
    if (!CF_ACTION_KEYS.has(a)) return '[' + lb + '](cf-action:' + action + ')';
    return '<button type="button" class="msg-cf-btn msg-cf-btn--action" data-cf-action="' + a + '">' + lb + '</button>';
  });

  // 标准 Markdown 外链 [标题](https://...) — 高对比蓝色下划线
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s<>&]+)\)/gi, (_, label, url) => {
    return '<a href="' + escHtml(url) + '" target="_blank" rel="noopener noreferrer" class="msg-link msg-link--external">' + label + '</a>';
  });

  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');

  for (const [label, page] of Object.entries(linkablePages)) {
    if (_linkifiedPages.has(page)) continue;
    const re = new RegExp('(?<![\\w">])(' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?![\\w<])');
    if (re.test(s)) {
      s = s.replace(re, '<a class="msg-link" data-nav="' + page + '">$1</a>');
      _linkifiedPages.add(page);
    }
  }
  return s;
}

function buildActionButtons(text) {
  // 正文中已有 […](cf-page:…) / 全角变体时，由 inlineFmt 渲染行内按钮，避免底部重复一排
  if (hasCfMarkdownInText(text)) return '';

  const detected = new Map();
  // 先从正文里的 cf-page 显式链接提取（防止关键词对不齐，如「查看详细资金流」）
  const cfExtract = /[\[\uff3b]\s*[^\]\uff3d]+\s*[\]\uff3d]\s*[\(\uff08]\s*cf-page\s*[:：]\s*([a-z0-9_-]+)\s*[\)\uff09]/gi;
  let cm;
  while ((cm = cfExtract.exec(text)) !== null) {
    const p = String(cm[1]).toLowerCase();
    if (CF_PAGE_KEYS.has(p) && !detected.has(p)) detected.set(p, p);
  }
  const pageNames = { workbench:'业务工作台', dashboard:'查看看板', cashflow:'资金流管理', analysis:'运行分析', plan:'资金计划', fx:'外汇敞口', basedata:'基础数据', integration:'数据集成', platform:'中台能力', payment:'付款排程', arap:'往来款', alerts:'预警中心', cockpit:'管理驾驶舱' };
  for (const [label, page] of Object.entries(linkablePages)) {
    if (text.includes(label) && !detected.has(page)) {
      detected.set(page, label);
    }
  }
  if (detected.size === 0) return '';
  const pageIcons = {
    workbench: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>',
    cashflow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    analysis: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
    plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    fx: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    basedata: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
    integration: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>',
    payment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    arap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    alerts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 4l9 16H3L12 4z"/><path d="M12 10v4M12 17h.01"/></svg>',
    cockpit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>',
    platform: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>'
  };
  const btns = [...detected.entries()].slice(0, 6).map(([page]) =>
    '<button class="msg-action-btn" data-nav="' + page + '">' + (pageIcons[page]||'') + ' ' + (pageNames[page]||page) + '</button>'
  ).join('');
  return '<div class="msg-action-row">' + btns + '</div>';
}

function addVisualCards(html) {
  const kpiRe = /(?:<p class="msg-p">)?(?:<strong>)?([^<：:]+?)(?:<\/strong>)?[：:]\s*([+-]?[\d,.]+(?:万元|亿元|万|亿|%|笔|个|条)?)(?:\s*[（(]([^)）]+)[)）])?(?:<\/p>)?/g;
  const kpis = [];
  let m;
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const paras = tempDiv.querySelectorAll('.msg-p');

  paras.forEach(p => {
    const t = p.textContent;
    const kpiMatch = t.match(/^(.+?)[：:]\s*([+-]?[\d,.]+(?:万元|亿元|万|亿|%|笔|个|条))(?:\s*[（(]([^)）]+)[)）])?$/);
    if (kpiMatch) {
      kpis.push({ label: kpiMatch[1].replace(/^\*\*|\*\*$/g,''), value: kpiMatch[2], note: kpiMatch[3] || '', el: p });
    }
  });

  if (kpis.length >= 3) {
    const cardHtml = '<div class="msg-kpi-row">' + kpis.slice(0, 4).map(k =>
      '<div class="msg-kpi-card"><div class="msg-kpi-val">' + k.value + '</div><div class="msg-kpi-label">' + k.label + '</div>' + (k.note ? '<div class="msg-kpi-note">' + k.note + '</div>' : '') + '</div>'
    ).join('') + '</div>';
    kpis.slice(0, 4).forEach(k => k.el.remove());
    return cardHtml + tempDiv.innerHTML;
  }

  return html;
}

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

const agentTools = [
  { type: 'function', function: { name: 'query_cashflow', description: '查询资金流数据（头寸、流入、流出、记录明细）', parameters: { type: 'object', properties: { unit: { type: 'string', description: '查询单位，如 总部/华东子公司/华南子公司，留空查全部' }, date_range: { type: 'string', description: '日期范围，如 近7天/本月/2026-04' } }, required: [] } } },
  { type: 'function', function: { name: 'run_analysis', description: '运行资金预测分析引擎，生成预测报告和图表', parameters: { type: 'object', properties: { period_code: { type: 'string', description: '时段方案代码' }, opening_balance: { type: 'number', description: '期初余额' } }, required: [] } } },
  { type: 'function', function: { name: 'query_fx', description: '查询外汇敞口数据、对冲率和汇率风险', parameters: { type: 'object', properties: { currency: { type: 'string', description: '币种对，如 USD/CNY' } }, required: [] } } },
  { type: 'function', function: { name: 'query_plans', description: '查询资金计划状态、审批流程和偏差分析', parameters: { type: 'object', properties: { status: { type: 'string', description: '筛选状态：草稿/已提交/已审批' } }, required: [] } } },
  { type: 'function', function: { name: 'navigate_page', description: '导航到工作台的指定页面', parameters: { type: 'object', properties: { page: { type: 'string', enum: ['workbench','dashboard','cashflow','analysis','plan','fx','basedata','integration','platform','payment','arap','alerts','cockpit'], description: '目标页面' } }, required: ['page'] } } },
  { type: 'function', function: { name: 'query_payment_pool', description: '查询待付款池、排程状态与支付策略摘要', parameters: { type: 'object', properties: { unit: { type: 'string' } }, required: [] } } },
  { type: 'function', function: { name: 'query_fund_alerts', description: '查询资金预警中心条目', parameters: { type: 'object', properties: { level: { type: 'string', description: '高/中/低，留空查全部' } }, required: [] } } },
];

function buildDataSnapshotBlock() {
  const s = Store.stats || {};
  const payN = (Store.paymentPool || []).length;
  const arN = (Store.receivables || []).length + (Store.payables || []).length;
  const alN = (Store.fundAlerts || []).length;
  return [
    '净头寸 ' + fmtAmt(s.net_position) + '，总流入 ' + fmtAmt(s.total_inflow) + '，总流出 ' + fmtAmt(s.total_outflow) + '，记录 ' + (s.record_count || 0) + ' 笔。',
    '外汇敞口：' + (s.fx_exposure_count || 0) + ' 笔，名义总额 ' + fmtAmt(s.fx_total_notional) + '。',
    '单位：' + ((s.units || []).join('、') || '总部') + '。',
    Store.plans.length ? '资金计划：' + Store.plans.map(p => p.unit + ' ' + p.period_label + '（' + p.status + '）').join('；') : '',
    '待付款池单据 ' + payN + ' 条；往来款样本 ' + arN + ' 条；预警 ' + alN + ' 条。',
  ].filter(Boolean).join('\n');
}

function buildSystemPrompt() {
  const agent = Store.agents.find(a => a.id === Store.currentAgent) || Store.agents[0];
  const context = buildDataSnapshotBlock();
  const re = Store.ruleEngine || {};
  const platConstraints = [
    '',
    '中台业务约束（本机「中台能力」演示配置，须遵守）：',
    '- 付款优先级模式：' + (re.paymentPriorityMode || 'static') + '；动态因子：' + (re.dynamicFactors !== false ? '开' : '关') + '；P0 始终优先：' + (re.p0AlwaysFirst !== false ? '是' : '否'),
    '- 流动性预警阈值（万元）：' + (re.liquidityWarnWan ?? 5000) + '；预算校验：' + (re.budgetCheck || 'soft') + '；黑名单硬阻断：' + (re.blacklistBlock !== false ? '是' : '否'),
    '- 涉及排程/预警/计划时须说明规则依据与数据来源（traceRequired=' + (re.traceRequired !== false) + '）。',
  ].join('\n');
  const rules = [
    '你的性格：极简、专业、高效。不使用表情符号。',
    '当用户聊天时就正常聊天；涉及业务数据时优先调用工具，输出必须可解释、可追溯（引用数据来源或规则）。',
    '',
    '当前数据快照：',
    context,
    platConstraints,
    '',
    '工具：query_cashflow、run_analysis、query_fx、query_plans、query_payment_pool、query_fund_alerts、navigate_page。',
    '',
    '回复规范：',
    '- 快捷跳转：[按钮文案](cf-page:页面id)，id 含 dashboard、cashflow、analysis、plan、fx、basedata、integration、platform、payment、arap、alerts、cockpit、chat',
    '- 工具按钮：[文案](cf-action:run_analysis) 等',
    '- 勿用 # 标题；用 **粗体** 与 --- 分段；金额用万元/亿元',
  ];

  const roleIntro = {
    forecast: '你是「现金流预测 Agent」。负责滚动预测、情景模拟与偏差说明；区分已确认/预测数据，说明模型假设。',
    attribution: '你是「智能归因 Agent」。负责计划偏差归因、异常支出模式识别；下钻到科目/部门/供应商时需给出证据链。',
    scheduling: '你是「智能排程 Agent」。负责付款优先级逻辑、调拨路径成本比较、异常支付建议；禁止黑盒决策，需列出规则与因子权重。',
    risk: '你是「风险预警 Agent」。负责客商风险、逾期与催收建议；高风险动作需提示人工复核。',
    advisor: '你是「决策建议 Agent」。负责 NL 经营问答与报告草案；采用 RAG 思路，引用数据快照与模块结果，区分事实与推断。',
    data: '你是「数据查询助手」。自然语言查询头寸与流水，可导航至各业务页。',
    plan: '你是「计划管理助手」。聚焦多级计划编制、审批与偏差，可联动归因 Agent 能力描述。',
    cashflow: '你是「资金流管理」助手。聚焦资金流确认、核销与数据来源映射。',
    fx: '你是「外汇分析师」。聚焦敞口、对冲与波动分析。',
  };

  const head = roleIntro[agent.id] || roleIntro.data;
  return [head, '', ...rules].join('\n');
}

function executeToolCall(name, args) {
  const s = Store.stats || {};
  const t = new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});

  if (name === 'query_cashflow') {
    const records = Store.records?.items || [];
    const unit = args.unit;
    const filtered = unit ? records.filter(r => r.unit === unit) : records;
    const inflow = filtered.filter(r => r.amount > 0).reduce((a,r) => a + r.amount, 0);
    const outflow = filtered.filter(r => r.amount < 0).reduce((a,r) => a + Math.abs(r.amount), 0);
    addChatResult({ type: 'data', title: (unit || '全部') + ' 资金头寸', time: t, html: '<div class="rp-mini-kpis"><div class="rp-mini-kpi"><div class="rp-mini-val">' + fmtAmt(inflow - outflow) + '</div><div class="rp-mini-lbl">净头寸</div></div><div class="rp-mini-kpi"><div class="rp-mini-val">' + fmtAmt(inflow) + '</div><div class="rp-mini-lbl">流入</div></div><div class="rp-mini-kpi"><div class="rp-mini-val">' + fmtAmt(outflow) + '</div><div class="rp-mini-lbl">流出</div></div></div>' });
    return JSON.stringify({ net: fmtAmt(inflow-outflow), inflow: fmtAmt(inflow), outflow: fmtAmt(outflow), count: filtered.length, unit: unit || '全部' });
  }

  if (name === 'run_analysis') {
    const mock = typeof mockAnalysis === 'function' ? mockAnalysis() : null;
    if (mock) {
      Store.analysisResult = mock;
      addChatResult({ type: 'analysis', data: mock, time: t });
    }
    return JSON.stringify({ status: 'success', periods: mock?.periods?.length || 14, message: '分析完成，图表已在右侧面板展示' });
  }

  if (name === 'query_fx') {
    const exps = Store.fxExposures || [];
    const filtered = args.currency ? exps.filter(e => e.currency_pair === args.currency) : exps;
    addChatResult({ type: 'data', title: '外汇敞口', time: t, html: '<div class="rp-mini-kpis"><div class="rp-mini-kpi"><div class="rp-mini-val">' + filtered.length + '笔</div><div class="rp-mini-lbl">敞口数</div></div><div class="rp-mini-kpi"><div class="rp-mini-val">' + fmtAmt(filtered.reduce((a,e)=>a+e.notional,0)) + '</div><div class="rp-mini-lbl">名义总额</div></div></div>' });
    return JSON.stringify({ count: filtered.length, total_notional: fmtAmt(filtered.reduce((a,e)=>a+e.notional,0)), details: filtered.slice(0,5).map(e => e.currency_pair + ' ' + e.direction + ' ' + fmtAmt(e.notional)) });
  }

  if (name === 'query_plans') {
    const plans = Store.plans || [];
    const filtered = args.status ? plans.filter(p => p.status === args.status) : plans;
    return JSON.stringify({ count: filtered.length, plans: filtered.slice(0,5).map(p => p.unit + ' ' + p.period_label + '（' + p.status + '）') });
  }

  if (name === 'navigate_page') {
    addChatResult({ type: 'navigate', page: args.page, time: t });
    return JSON.stringify({ status: 'ok', page: args.page, message: '已在右侧面板展示 ' + (pageLabels[args.page] || args.page) });
  }

  if (name === 'query_payment_pool') {
    const pool = Store.paymentPool || [];
    const filtered = args.unit ? pool.filter(p => p.unit === args.unit) : pool;
    const sum = filtered.reduce((a, p) => a + (p.amount || 0), 0);
    addChatResult({ type: 'data', title: '待付款池', time: t, html: '<div class="rp-mini-stat">待处理 <strong>' + filtered.length + '</strong> 笔 · 合计 <strong>' + fmtAmt(sum) + '</strong></div>' });
    return JSON.stringify({ count: filtered.length, total: fmtAmt(sum), items: filtered.slice(0, 8).map(p => p.unit + ' ' + p.biz_type + ' ' + fmtAmt(p.amount) + ' ' + p.status) });
  }

  if (name === 'query_fund_alerts') {
    let alerts = Store.fundAlerts || [];
    if (args.level) alerts = alerts.filter(a => a.level === args.level);
    addChatResult({ type: 'data', title: '资金预警', time: t, html: '<div class="rp-mini-stat">预警 <strong>' + alerts.length + '</strong> 条</div>' });
    return JSON.stringify({ count: alerts.length, alerts: alerts.map(a => a.level + ' ' + a.message) });
  }

  return JSON.stringify({ error: 'unknown tool' });
}

async function callDeepSeekDirect(msg) {
  const DEEPSEEK_KEY = getAccioApiKey();
  if (!DEEPSEEK_KEY) {
    throw new Error('未配置 API Key');
  }
  const messages = [{ role: 'system', content: buildSystemPrompt() }];
  for (const h of Store.chatHistory.slice(-12)) {
    if ((h.role === 'user' || h.role === 'assistant') && h.content) messages.push({ role: h.role, content: h.content });
  }
  messages.push({ role: 'user', content: msg });

  const body = { model: 'deepseek-chat', messages, temperature: 0.6, max_tokens: 2048, stream: false, tools: agentTools, tool_choice: 'auto' };
  const resp = await fetch(DEEPSEEK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DEEPSEEK_KEY }, body: JSON.stringify(body) });
  if (!resp.ok) throw new Error('DeepSeek API ' + resp.status);
  const data = await resp.json();
  const choice = data.choices?.[0];

  if (choice?.message?.tool_calls?.length) {
    const toolResults = [];
    for (const tc of choice.message.tool_calls) {
      const fn = tc.function;
      let args = {};
      try { args = JSON.parse(fn.arguments || '{}'); } catch {}
      const result = executeToolCall(fn.name, args);
      toolResults.push({ role: 'tool', tool_call_id: tc.id, content: result });
      messages.push(choice.message);
      messages.push({ role: 'tool', tool_call_id: tc.id, content: result });
    }

    const resp2 = await fetch(DEEPSEEK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DEEPSEEK_KEY }, body: JSON.stringify({ model: 'deepseek-chat', messages, temperature: 0.6, max_tokens: 2048, stream: false }) });
    if (resp2.ok) {
      const data2 = await resp2.json();
      return data2.choices?.[0]?.message?.content || '任务已执行，结果在右侧面板中展示。';
    }
    return '任务已执行完成，结果在右侧面板中展示。';
  }

  return choice?.message?.content || '（无回复）';
}

async function sendChat() {
  const input = $('#chatInput');
  const msg = (input.value || '').trim();
  if (!msg) return;
  input.value = '';
  const now = () => new Date().toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'});
  Store.chatHistory.push({ role: 'user', content: msg, time: now() });

  if (!Store.rightPanelOpen) {
    Store.rightPanelOpen = true;
    document.getElementById('accioApp').classList.add('right-open');
  }
  renderChat();
  scrollChatBottom();
  addTypingIndicator();

  const modelSel = $('#modelSelect');
  const useDirectDeepSeek = modelSel && modelSel.value === 'DeepSeek';

  try {
    let reply;
    if (useDirectDeepSeek) {
      reply = await callDeepSeekDirect(msg);
    } else {
      try {
        const resp = await api.post('/api/agent/chat', { message: msg, role: 'treasurer', history: Store.chatHistory.slice(0, -1) });
        reply = resp.reply || '(无回复)';
      } catch { reply = await callDeepSeekDirect(msg); }
    }
    removeTypingIndicator();
    Store.chatHistory.push({ role: 'assistant', content: reply, time: now() });
    extractFilesFromReply(reply, msg);
    parseAndExecCommands(reply);
  } catch (e) {
    removeTypingIndicator();
    const reply = localFallback(msg);
    Store.chatHistory.push({ role: 'assistant', content: reply, time: now() });
    extractFilesFromReply(reply, msg);
    parseAndExecCommands(reply);
  }
  saveChatToHistory();
  renderChat();
  scrollChatBottom();
}

function extractFilesFromReply(reply, userMsg) {
  addChatFile('工作区', 'folder', '');
  const lm = (reply + ' ' + userMsg).toLowerCase();
  const t = new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
  if (/资金|头寸|流入|流出|余额/.test(lm)) {
    addChatFile('资金流汇总.csv', 'csv', '新');
    const s = Store.stats || {};
    if (s.net_position) addChatResult({ type: 'data', title: '资金头寸概览', time: t, html: `<div class="rp-mini-kpis"><div class="rp-mini-kpi"><div class="rp-mini-val">${(s.net_position/1e4).toFixed(2)}万</div><div class="rp-mini-lbl">净头寸</div></div><div class="rp-mini-kpi"><div class="rp-mini-val">${(s.total_inflow/1e4).toFixed(2)}万</div><div class="rp-mini-lbl">总流入</div></div><div class="rp-mini-kpi"><div class="rp-mini-val">${(Math.abs(s.total_outflow||0)/1e4).toFixed(2)}万</div><div class="rp-mini-lbl">总流出</div></div></div>` });
  }
  if (/预测|趋势|模型|forecast/.test(lm)) addChatFile('预测结果.json', 'file', '新');
  if (/计划|plan|待办/.test(lm)) addChatFile('计划状态.md', 'file', '');
  if (/外汇|敞口|hedge|fx/.test(lm)) addChatFile('外汇敞口报告.csv', 'csv', '');
  if (/分析|报告|report|analysis/.test(lm)) addChatFile('分析报告.md', 'file', '新');
  if (/看板|dashboard|kpi/.test(lm)) addChatFile('看板快照.png', 'file', '');

  if (Store.chatTasks.length === 0 && Store.chatHistory.length >= 2) {
    const kw = lm;
    if (/查询|查看|获取/.test(kw)) addChatTask('获取数据快照', false);
    if (/分析|预测|运行/.test(kw)) addChatTask('运行分析引擎', false);
    if (/报告|导出|生成/.test(kw)) addChatTask('生成报告文件', false);
    if (/计划|审批/.test(kw)) addChatTask('更新计划状态', false);
    if (Store.chatTasks.length > 0) {
      Store.chatTasks[0].done = true;
      if (Store.chatTasks.length > 1) Store.chatTasks[1].done = true;
    }
  }
}

function addTypingIndicator() {
  const msgs = $('#chatMessages'); if (!msgs) return;
  const agent = Store.agents.find(a => a.id === Store.currentAgent) || Store.agents[0];
  const typing = el('div', 'chat-msg assistant', `<div class="chat-msg-avatar">${agentIconHtml(agent.avatarKey || agent.id)}</div><div><div class="chat-msg-bubble chat-typing"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div></div>`);
  typing.id = 'typingIndicator';
  msgs.appendChild(typing);
  scrollChatBottom();
}
function removeTypingIndicator() { const t = $('#typingIndicator'); if (t) t.remove(); }
function scrollChatBottom() { const m = $('#chatMessages'); if (m) m.scrollTop = m.scrollHeight; }

function localFallback(msg) {
  const s = Store.stats || {};
  const lm = msg.toLowerCase();
  const navCmd = (page) => '\n\n' + '`' + '`' + '`' + 'json\n{"action":"navigate","page":"' + page + '"}\n' + '`' + '`' + '`';

  if (lm.includes('头寸') || lm.includes('余额') || lm.includes('概况') || lm.includes('资金')) {
    const units = s.units || ['总部'];
    let reply = '**当前资金概况**\n\n';
    reply += '**总流入**：' + fmtAmt(s.total_inflow) + '\n';
    reply += '**总流出**：' + fmtAmt(s.total_outflow) + '\n';
    reply += '**净头寸**：' + fmtAmt(s.net_position) + '（净流入）\n';
    reply += '**记录数**：' + (s.record_count || 0) + '笔\n\n';
    reply += '---\n\n';
    reply += '**各单位头寸分布**\n\n';
    const records = Store.records?.items || [];
    units.forEach((u, i) => {
      const inf = records.filter(r => r.unit === u && r.amount > 0).reduce((a,r) => a + r.amount, 0);
      const out = records.filter(r => r.unit === u && r.amount < 0).reduce((a,r) => a + Math.abs(r.amount), 0);
      reply += (i+1) + '. **' + u + '**：流入' + fmtAmt(inf) + '，流出' + fmtAmt(out) + '，净流入' + fmtAmt(inf - out) + '\n';
    });
    reply += '\n---\n\n';
    reply += '**分析洞察**：资金流整体为净流入态势，建议关注大额流出项目的资金安排，优化闲置资金的收益管理。';
    return reply + navCmd('dashboard');
  }

  if (lm.includes('外汇') || lm.includes('敞口'))
    return '**外汇敞口概览**\n\n**敞口笔数**：' + Store.fxExposures.length + '笔\n**名义总额**：' + fmtAmt(s.fx_total_notional) + '\n**未对冲**：' + Store.fxExposures.filter(e => e.hedge_ratio === 0).length + '笔\n\n---\n\n' + Store.fxExposures.slice(0,5).map((e,i) => (i+1) + '. **' + e.currency_pair + '** ' + e.direction + ' ' + fmtAmt(e.notional) + '，对冲率 ' + (e.hedge_ratio*100).toFixed(0) + '%').join('\n') + '\n\n**建议**：关注未对冲敞口的汇率波动风险，适时锁定远期汇率。' + navCmd('fx');

  if (lm.includes('看板') || lm.includes('总览'))
    return '**总览看板**已为您准备好，包含净头寸趋势、流入流出分布和关键预警信息。' + navCmd('dashboard');

  if (lm.includes('资金流') || lm.includes('单据'))
    return '**资金流管理**\n\n**总记录**：' + (Store.records?.items||[]).length + '笔\n\n可在资金流管理页面查看详细的流入、流出明细和确认状态。' + navCmd('cashflow');

  if (lm.includes('分析') || lm.includes('预测')) {
    const mock = typeof mockAnalysis === 'function' ? mockAnalysis() : null;
    if (mock) { Store.analysisResult = mock; }
    return '正在为您在**预测引擎**中运行分析…\n\n分析基于当前资金流数据，使用复合周期引擎（天/周/月/季）生成报告。\n\n---\n\n**预测范围**：未来14个时段\n**模型类型**：复合周期引擎\n**数据基础**：' + (s.record_count||0) + '条资金流记录\n\n结果将在右侧面板中展示。' + navCmd('analysis');
  }

  if (lm.includes('计划'))
    return '**资金计划**（共 ' + Store.plans.length + ' 个）\n\n' + Store.plans.slice(0, 5).map((p,i) => (i+1) + '. **' + p.unit + '** ' + p.period_label + '（' + p.status + '）').join('\n') + '\n\n---\n\n可在资金计划页面进行编制、审批和偏差分析。' + navCmd('plan');

  if (/付款|排程|待付|调拨/.test(lm)) {
    const pool = Store.paymentPool || [];
    return '**待付款池**（' + pool.length + ' 笔）\n\n' + pool.slice(0, 5).map((p,i) => (i+1) + '. **' + p.unit + '** ' + p.biz_type + ' ' + fmtAmt(p.amount) + ' · ' + p.status).join('\n') + '\n\n---\n\n可在付款排程页配置「单位主体+业务类型」策略与队列。' + navCmd('payment');
  }

  if (/往来|应收|应付|预付/.test(lm))
    return '**往来款概览**\n\n**应收样本**：' + (Store.receivables || []).length + ' 条\n**应付样本**：' + (Store.payables || []).length + ' 条\n**预付**：' + (Store.prepaids || []).length + ' 条\n\n---\n\n账龄与客商风险在往来款管理页查看。' + navCmd('arap');

  if (/预警|告警|风险/.test(lm) && !lm.includes('外汇'))
    return '**资金预警中心**\n\n' + (Store.fundAlerts || []).slice(0, 5).map((a,i) => (i+1) + '. **' + a.level + '** ' + a.message).join('\n') + '\n\n---\n\n支持流动性、重复支付、大额等规则配置。' + navCmd('alerts');

  if (/驾驶舱|大屏|管理层/.test(lm))
    return '**管理驾驶舱**已就绪：可查看 KPI、待付款池、预警汇总，并从能力矩阵一键进入五大 Agent 对话。' + navCmd('cockpit');

  const casual = [
    { re: /你好|嗨|hi|hello/i, reply: '您好，我是数据查询助手。请问有什么我可以帮您的？' },
    { re: /吊|厉害|牛|6|棒|不错|nb/i, reply: '谢谢您的认可。作为专业的资金管理助手，我随时为您提供准确的数据支持。\n\n需要我为您查询最新的资金头寸或运行预测分析吗？' },
    { re: /开玩笑|搞笑|讲个笑话|笑/i, reply: '抱歉，作为专业的资金管理助手，我更擅长处理数据和分析。\n\n如果您需要，我可以为您生成一份最新的资金流报告。' },
    { re: /无聊|闲|没事/i, reply: '如果您现在有空，建议您可以查看一下最新的资金状况：\n\n- 查询今日资金头寸\n- 运行资金预测分析\n- 检查外汇敞口风险\n\n请告诉我您的选择。' },
    { re: /谢|感谢|thanks/i, reply: '不客气，随时为您服务。' },
    { re: /再见|拜|bye/i, reply: '再见。有任何资金管理问题，随时找我。' },
    { re: /你是谁|介绍|你能做什么/i, reply: '我是亿流 Work 上的 AI 助手，当前角色为「' + ((Store.agents.find(a => a.id === Store.currentAgent) || {}).name || '数据查询助手') + '」。平台定位为智能财务中台：数据集合 + 规则沉淀 + 智能驱动 + 场景落地。\n\n五大核心能力：现金流预测、智能归因、智能排程、风险预警、决策建议；并配套付款排程、往来款、资金预警与管理驾驶舱等模块。\n\n所有建议均可追溯数据来源与业务规则。请问需要哪项操作？' },
  ];

  for (const c of casual) {
    if (c.re.test(lm)) return c.reply;
  }

  return '作为专业的资金管理助手，我随时为您提供数据支持。\n\n您可以尝试向我提问：\n\n- 当前资金头寸是多少？\n- 帮我运行一次资金预测分析\n- 查看目前的外汇敞口情况\n- 资金计划的审批进展如何？';
}

function parseAndExecCommands(text) {
  const re = /```json\s*\n?([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    try {
      const cmd = JSON.parse(m[1]);
      if (cmd.action === 'navigate' && cmd.page) {
        addChatResult({ type: 'navigate', page: cmd.page, time: new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}) });
      }
      if (cmd.action === 'toast') Toast.show(cmd.type || 'info', cmd.message || '');
    } catch {}
  }

  if (/预测|分析/.test(text) && Store.analysisResult) {
    addChatResult({ type: 'analysis', data: Store.analysisResult, time: new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}) });
  }
}

/* ════════════════════════════════════════════
   Agents Page + 4-Step Creation Wizard
   ════════════════════════════════════════════ */
function buildAgentGridHtml(opts = {}) {
  const createBtnId = opts.createBtnId || 'btnCreateAgent';
  const gridId = opts.gridId || 'agentGrid';
  const createLabel = opts.createLabel || '新建智能体';
  return `
    <div class="agent-grid" id="${gridId}">
      <div class="agent-card create-new" id="${createBtnId}">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <div style="font-size:14px;font-weight:600;">${createLabel}</div>
      </div>
      ${Store.agents.map(a => `
        <div class="agent-card" data-agent="${a.id}">
          <div class="agent-card-avatar">${agentIconHtml(a.avatarKey || a.id)}</div>
          <div class="agent-card-name">${a.name}</div>
          <div class="agent-card-desc">${a.desc}</div>
          <button type="button" class="agent-card-action primary">+ 对话</button>
        </div>
      `).join('')}
    </div>`;
}

function attachAgentGridListeners(rootEl, { searchId, createBtnId }) {
  if (!rootEl) return;
  rootEl.querySelectorAll('.agent-card[data-agent]').forEach(c => {
    c.addEventListener('click', () => openAgentEditor(c.dataset.agent));
    const act = c.querySelector('.agent-card-action');
    if (act) {
      act.addEventListener('click', e => {
        e.stopPropagation();
        Store.currentAgent = c.dataset.agent;
        Store.chatHistory = [];
        navigateTo('chat');
        Toast.success(`已切换到 ${Store.agents.find(a => a.id === c.dataset.agent)?.name}`);
      });
    }
  });
  $('#' + createBtnId)?.addEventListener('click', () => openAgentWizard());
  $('#' + searchId)?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    rootEl.querySelectorAll('.agent-card[data-agent]').forEach(c => {
      const name = c.querySelector('.agent-card-name').textContent.toLowerCase();
      c.style.display = name.includes(q) ? '' : 'none';
    });
  });
}

const WB_TREASURY_TILES = [
  { page: 'dashboard', label: '总览看板', icon: 'layout' },
  { page: 'cockpit', label: '管理驾驶舱', icon: 'pie' },
  { page: 'payment', label: '付款排程', icon: 'creditCard' },
  { page: 'arap', label: '往来款', icon: 'users' },
  { page: 'cashflow', label: '资金流管理', icon: 'wallet' },
  { page: 'analysis', label: '预测引擎', icon: 'trend' },
  { page: 'plan', label: '资金计划', icon: 'clipboard' },
  { page: 'fx', label: '外汇敞口', icon: 'globe' },
  { page: 'basedata', label: '基础数据', icon: 'landmark' },
  { page: 'integration', label: '数据集成', icon: 'zap' },
  { page: 'alerts', label: '资金预警', icon: 'alertTriangle' },
];

function openWorkbenchCreateDialog() {
  openModal('创建垂直场景', `
    <div class="form-group"><div class="form-label">场景名称</div><input class="form-input form-input-full" id="wbNewName" placeholder="例如：集团司库 · 华东试点" /></div>
    <div class="form-group"><div class="form-label">说明（可选）</div><textarea class="form-textarea form-input-full" id="wbNewNote" rows="3" placeholder="业务域、数据范围或 Agent 组合…"></textarea></div>
    <p class="form-help" style="margin:0;">演示：自定义场景保存在本机；进入后默认打开总览看板，后续可对接编排与发布。</p>
  `, `<button class="btn" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="submitWorkbenchScenario()">创建</button>`);
}

window.submitWorkbenchScenario = function submitWorkbenchScenario() {
  const name = $('#wbNewName')?.value?.trim();
  const note = $('#wbNewNote')?.value?.trim() || '';
  if (!name) { Toast.warn('请输入场景名称'); return; }
  Store.workbenchScenarios.push({ id: Date.now(), name, note, createdAt: Date.now() });
  saveWorkbenchScenarios();
  closeModal();
  renderWorkbench();
  Toast.success('场景已创建');
};

window.enterWorkbenchScenario = function enterWorkbenchScenario(id) {
  const s = Store.workbenchScenarios.find(x => String(x.id) === String(id));
  Toast.info(`已打开自定义场景「${s?.name || ''}」演示入口（总览看板）`);
  navigateTo('dashboard');
};

window.deleteWorkbenchScenario = function deleteWorkbenchScenario(id) {
  Store.workbenchScenarios = Store.workbenchScenarios.filter(x => String(x.id) !== String(id));
  saveWorkbenchScenarios();
  renderWorkbench();
  Toast.success('已删除场景');
};

function renderWorkbench() {
  const pg = $('#page-workbench');
  const view = Store.workbenchView === 'treasury' ? 'treasury' : 'scenarios';

  function bindTreasuryTiles() {
    $$('#page-workbench .workbench-tile[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => navigateTo(btn.dataset.nav));
    });
  }

  if (view === 'treasury') {
    pg.innerHTML = `
      <div class="page-header-bar">
        <div><div class="page-title">业务工作台</div><div class="page-subtitle">模块 · 司库与资金</div></div>
        <div class="page-actions">
          <button type="button" class="btn" id="wbBtnBackScenes">← 返回场景中心</button>
        </div>
      </div>
      <div class="page-scroll">
        <p class="workbench-hint">您已进入「司库与资金」场景，以下为该场景下的业务能力入口。</p>
        <div class="workbench-feature-grid workbench-feature-grid--treasury">
          ${WB_TREASURY_TILES.map(t => `
            <button type="button" class="workbench-tile" data-nav="${t.page}">
              <span class="workbench-tile-ico">${uiIcon(t.icon)}</span>
              <span class="workbench-tile-label">${t.label}</span>
            </button>`).join('')}
        </div>
      </div>`;
    $('#wbBtnBackScenes')?.addEventListener('click', () => {
      Store.workbenchView = 'scenarios';
      renderWorkbench();
    });
    bindTreasuryTiles();
    return;
  }

  const custom = (Store.workbenchScenarios || []).map(s => `
    <div class="scene-card scene-card--custom">
      <div class="scene-card-ico">${uiIcon('layers')}</div>
      <div class="scene-card-title">${escHtml(s.name)}</div>
      <div class="scene-card-desc">${escHtml(s.note || '自定义垂直场景')}</div>
      <div class="scene-card-actions">
        <button type="button" class="btn btn-sm btn-primary" onclick="enterWorkbenchScenario(${s.id})">进入</button>
        <button type="button" class="btn btn-sm" onclick="deleteWorkbenchScenario(${s.id})">删除</button>
      </div>
    </div>
  `).join('');

  pg.innerHTML = `
    <div class="page-header-bar">
      <div><div class="page-title">业务工作台</div><div class="page-subtitle">垂直场景中心：先选择场景，进入后再展开「司库与资金」等业务模块。</div></div>
      <div class="page-actions">
        <button class="btn btn-primary" type="button" id="wbBtnCreateScene">+ 垂直场景</button>
      </div>
    </div>
    <div class="page-scroll">
      <div class="workbench-section">
        <div class="workbench-section-title">内置场景</div>
        <div class="scene-card-grid">
          <div class="scene-card scene-card--primary" role="button" tabindex="0" id="wbCardTreasury">
            <div class="scene-card-ico">${uiIcon('layout')}</div>
            <div class="scene-card-title">司库与资金</div>
            <div class="scene-card-desc">含总览、驾驶舱、付款排程、往来款、资金流、预测引擎、计划、外汇、基础数据、集成与预警等完整能力。</div>
            <div class="scene-card-cta">进入模块 →</div>
          </div>
        </div>
      </div>
      <div class="workbench-section">
        <div class="workbench-section-title">我的垂直场景</div>
        ${custom ? `<div class="scene-card-grid">${custom}</div>` : '<p class="workbench-empty">暂无：点击「+ 垂直场景」创建；创建后可从卡片进入演示总览。</p>'}
      </div>
      <div class="workbench-section">
        <div class="workbench-section-title">中台能力</div>
        <p class="workbench-hint">集成态势、规则引擎、数据分层与能力全景，统一在「中台能力」配置与查看（本机持久化）。</p>
        <button type="button" class="btn btn-primary" id="wbBtnPlatform">打开中台能力</button>
      </div>
    </div>`;

  const card = $('#wbCardTreasury');
  const enterTreasury = () => {
    Store.workbenchView = 'treasury';
    renderWorkbench();
  };
  card?.addEventListener('click', enterTreasury);
  card?.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enterTreasury(); } });
  $('#wbBtnCreateScene')?.addEventListener('click', openWorkbenchCreateDialog);
  $('#wbBtnPlatform')?.addEventListener('click', () => navigateTo('platform'));
}

window.renderWorkbench = renderWorkbench;

function renderAgents() {
  const pg = $('#page-agents');
  pg.innerHTML = `
    <div class="page-header-bar">
      <div><div class="page-title">智能体</div><div class="page-subtitle">管理你的个性化助手，创建新角色并开始对话。</div></div>
      <div class="page-actions">
        <div class="tabs-row" style="border:none;padding:0;">
          <button type="button" class="tab-btn active">我的智能体 ${Store.agents.length}</button>
          <button type="button" class="tab-btn" id="agentsTabTasks">任务衍生</button>
        </div>
        <input class="search-input" placeholder="搜索智能体..." id="agentSearch">
      </div>
    </div>
    <div class="page-scroll">
      ${buildAgentGridHtml({ createBtnId: 'btnCreateAgent', gridId: 'agentGrid', createLabel: '新建智能体' })}
    </div>
  `;
  attachAgentGridListeners(pg, { searchId: 'agentSearch', createBtnId: 'btnCreateAgent' });
  $('#agentsTabTasks')?.addEventListener('click', () => { navigateTo('tasks'); Toast.info('查看由对话衍生的定时任务'); });
}

let _aeTab = 'identity';
let _aeState = {};

function openAgentEditor(agentId) {
  const agent = Store.agents.find(a => a.id === agentId);
  if (!agent) return;
  _aeTab = 'identity';
  const toolMap = {};
  toolCategories.forEach(t => { toolMap[t.key] = (agent.tools || []).includes(t.name); });
  const skillMap = {};
  (agent.skills || []).forEach(s => { skillMap[s] = true; });
  _aeState = { id: agent.id, name: agent.name, avatarKey: agent.avatarKey || agent.id, desc: agent.desc, vibe: '专业', model: '自动', tools: toolMap, skills: skillMap };
  renderAgentEditor();
}

function renderAgentEditor() {
  const s = _aeState;
  const tabs = [
    { key: 'identity', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>', label: '身份' },
    { key: 'tools',    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>', label: '工具' },
    { key: 'skills',   icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>', label: '技能' },
    { key: 'files',    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>', label: '核心文件' },
  ];

  const tabHtml = tabs.map(t =>
    `<button class="ae-tab ${_aeTab===t.key?'active':''}" data-tab="${t.key}">${t.icon}<span>${t.label}</span></button>`
  ).join('');

  let content = '';
  if (_aeTab === 'identity') {
    const vibes = ['专业','友好','创意','简洁','随意','专家'];
    const models = ['自动','DeepSeek','Gemini','Qwen','OpenAI','Claude','Moonshot','智谱','MiniMax'];
    content = `
      <div class="ae-identity-layout">
        <div class="ae-identity-form">
          <div class="form-group"><div class="form-label">智能体名称 <span style="color:var(--orange-500);">*</span></div><input class="form-input form-input-full" id="aeName" value="${escHtml(s.name)}" placeholder="输入智能体名称"></div>
          <div class="form-group"><div class="form-label">智能体头像 <a href="#" style="float:right;font-size:12px;color:var(--orange-500);">上传自定义图片</a></div>
            <div class="avatar-style-tabs"><button class="avatar-style-tab active">极简</button><button class="avatar-style-tab">线性</button><button class="avatar-style-tab">品牌</button><button class="avatar-style-tab">自定义</button></div>
            <div class="avatar-picker">${ICON_PICKER_KEYS.map(k => `<div class="avatar-chip ${s.avatarKey===k?'selected':''}" data-avatar-key="${k}">${agentIconHtml(k)}</div>`).join('')}</div>
          </div>
          <div class="form-group"><div class="form-label">智能体描述</div><textarea class="form-textarea form-input-full" id="aeDesc" rows="3" placeholder="描述智能体的功能和职责...">${escHtml(s.desc)}</textarea></div>
          <div class="form-group"><div class="form-label">风格</div>
            <div class="ae-chip-group">${vibes.map(v => `<button class="ae-chip ${s.vibe===v?'active':''}" data-vibe="${v}">${v}</button>`).join('')}</div>
          </div>
          <div class="form-group"><div class="form-label">模型供应商</div>
            <div class="ae-chip-group">${models.map(m => `<button class="ae-chip ${s.model===m?'active':''}" data-model="${m}">${m}</button>`).join('')}</div>
          </div>
        </div>
        <div class="ae-preview-card">
          <div class="ae-preview-dot">● 实时预览</div>
          <div class="ae-preview-sub">预览智能体效果</div>
          <div class="ae-preview-avatar" id="aePreviewIcon">${agentIconHtml(s.avatarKey || 'data')}</div>
          <div class="ae-preview-name" id="aePreviewName">${s.name || '新智能体'}</div>
          <div class="ae-preview-badge">身份已验证</div>
          <div class="ae-preview-desc" id="aePreviewDesc">"${s.desc || '描述将显示在此处...'}"</div>
          <div class="ae-preview-vibe-label">风格</div>
          <div class="ae-preview-vibe" id="aePreviewVibe">${s.vibe}</div>
        </div>
      </div>`;
  } else if (_aeTab === 'tools') {
    content = `
      <div class="ae-tool-grid">${toolCategories.map(t => `
        <div class="ae-tool-card">
          <div class="ae-tool-icon">${toolIconHtml(t.key)}</div>
          <div class="ae-tool-info"><div class="ae-tool-name">${t.name}</div><div class="ae-tool-desc">${t.desc}</div></div>
          <button class="toggle-switch ${s.tools[t.key]?'on':''}" data-tool="${t.key}"></button>
        </div>`).join('')}
      </div>
      <div class="form-group" style="margin-top:20px;">
        <div class="form-label">默认工作区 <span style="color:var(--gray-400);font-weight:400;">(可选)</span></div>
        <div style="display:flex;gap:8px;align-items:center;">
          <input class="form-input" style="flex:1;" value="C:\\Users\\workspace\\agents\\${s.id}" readonly>
          <button class="btn btn-sm" title="选择文件夹"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></button>
        </div>
      </div>`;
  } else if (_aeTab === 'skills') {
    const allSkills = [
      { key:'cashflow-forecast', name:'资金流预测', desc:'复合周期预测引擎，天/周/月/季/年自动切换' },
      { key:'fund-plan', name:'资金计划', desc:'滚动编制、多级审批、偏差分析' },
      { key:'fx-mgmt', name:'外汇管理', desc:'敞口监控、对冲策略、VaR 计量' },
      { key:'data-integration', name:'数据集成', desc:'取数映射引擎、ERP/银企/BI 对接' },
      { key:'anomaly', name:'异常预警', desc:'统计模型检测异常资金流模式' },
      { key:'deviation', name:'偏差分析', desc:'计划 vs 实际自动对比、分级响应' },
      { key:'report-gen', name:'报表生成', desc:'日报/周报/月报自动汇总与导出' },
      { key:'pay-sched', name:'付款排程', desc:'待付款池、策略日历、调拨与支付联动' },
      { key:'scenario', name:'情景模拟', desc:'自然语言配置假设，联动现金流预测' },
      { key:'counterparty', name:'客商风险', desc:'评分、坏账预估、催收策略' },
      { key:'attribution-skill', name:'经营归因', desc:'偏差穿透与结构化归因报告' },
      { key:'nl-bi', name:'管理问答', desc:'RAG + 本地模型，可解释经营分析' },
    ];
    const installed = allSkills.filter(sk => s.skills[sk.name]);
    const catalog = allSkills.filter(sk => !s.skills[sk.name]);
    content = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <span style="font-size:14px;font-weight:600;">${installed.length} 个技能</span>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-sm" id="aeRefreshSkills"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg></button>
          <button class="btn btn-sm">上传技能</button>
        </div>
      </div>
      ${installed.length ? `<div class="ae-skill-list">${installed.map(sk => `
        <div class="ae-skill-item installed">
          <div class="ae-skill-icon"><span class="skill-tile-svg">${SKILL_TILE_SVG}</span></div>
          <div class="ae-skill-info"><div class="ae-skill-name">${sk.name}</div><div class="ae-skill-desc">${sk.desc}</div></div>
          <button class="ae-skill-remove" data-sk="${sk.name}" title="移除">×</button>
        </div>`).join('')}</div>` : `
        <div class="ae-skills-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--gray-300)" stroke-width="1"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
          <div>暂无自有技能</div>
        </div>`}
      <div style="margin-top:20px;border-top:1px solid var(--gray-200);padding-top:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <span style="font-size:13px;color:var(--gray-500);">从技能目录中选择额外的技能一起安装到此智能体</span>
          <button class="btn btn-sm" style="font-size:11px;" id="aeCatalogClose">×</button>
        </div>
        <input class="form-input form-input-full" placeholder="搜索技能..." id="aeSkillSearch" style="margin-bottom:10px;">
        <div class="ae-skill-list" id="aeCatalogList">${catalog.map(sk => `
          <div class="ae-skill-item catalog">
            <div class="ae-skill-icon">${uiIcon('gear')}</div>
            <div class="ae-skill-info"><div class="ae-skill-name">${sk.name}</div><div class="ae-skill-desc">${sk.desc}</div></div>
            <button class="ae-skill-add" data-sk="${sk.name}">添加技能</button>
          </div>`).join('')}
        </div>
      </div>`;
  } else if (_aeTab === 'files') {
    content = `
      <div class="ae-files-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--gray-300)" stroke-width="1"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <div style="font-size:14px;color:var(--gray-500);margin-top:8px;">暂无核心文件</div>
        <div style="font-size:12px;color:var(--gray-400);margin-top:4px;">上传文件供智能体在对话中引用和分析</div>
        <button class="btn btn-primary btn-sm" style="margin-top:12px;">上传文件</button>
      </div>`;
  }

  openWizardModal(`
    <div class="ae-editor">
      <div class="ae-header">
        <div class="ae-header-left">
          <div class="ae-header-icon">${agentIconHtml(s.avatarKey || 'data')}</div>
          <div><div class="ae-header-name">${s.name}</div><div class="ae-header-id">● ID: ${s.id}</div></div>
        </div>
        <button class="wizard-close" onclick="closeModal()">×</button>
      </div>
      <div class="ae-body">
        <div class="ae-sidebar">${tabHtml}</div>
        <div class="ae-content">${content}</div>
      </div>
      <div class="ae-footer">
        <button class="btn btn-primary ae-save-btn" id="aeSave">保存</button>
      </div>
    </div>
  `);

  setTimeout(() => bindAgentEditorEvents(), 50);
}

function bindAgentEditorEvents() {
  const s = _aeState;
  $$('.ae-tab').forEach(t => t.addEventListener('click', () => { _aeTab = t.dataset.tab; renderAgentEditor(); }));

  if (_aeTab === 'identity') {
    $('#aeName')?.addEventListener('input', e => {
      s.name = e.target.value;
      const pn = $('#aePreviewName'); if (pn) pn.textContent = s.name || '新智能体';
    });
    $('#aeDesc')?.addEventListener('input', e => {
      s.desc = e.target.value;
      const pd = $('#aePreviewDesc'); if (pd) pd.textContent = `"${s.desc || '...'}"`;
    });
    $$('.avatar-chip').forEach(c => c.addEventListener('click', () => {
      $$('.avatar-chip').forEach(x => x.classList.remove('selected'));
      c.classList.add('selected');
      s.avatarKey = c.dataset.avatarKey;
      const pi = $('#aePreviewIcon'); if (pi) pi.innerHTML = agentIconHtml(s.avatarKey);
    }));
    $$('.ae-chip[data-vibe]').forEach(c => c.addEventListener('click', () => {
      $$('.ae-chip[data-vibe]').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      s.vibe = c.dataset.vibe;
      const pv = $('#aePreviewVibe'); if (pv) pv.textContent = s.vibe;
    }));
    $$('.ae-chip[data-model]').forEach(c => c.addEventListener('click', () => {
      $$('.ae-chip[data-model]').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      s.model = c.dataset.model;
    }));
  } else if (_aeTab === 'tools') {
    $$('.toggle-switch[data-tool]').forEach(btn => btn.addEventListener('click', () => {
      btn.classList.toggle('on');
      s.tools[btn.dataset.tool] = btn.classList.contains('on');
    }));
  } else if (_aeTab === 'skills') {
    $$('.ae-skill-add').forEach(btn => btn.addEventListener('click', () => {
      s.skills[btn.dataset.sk] = true;
      renderAgentEditor();
    }));
    $$('.ae-skill-remove').forEach(btn => btn.addEventListener('click', () => {
      delete s.skills[btn.dataset.sk];
      renderAgentEditor();
    }));
    $('#aeSkillSearch')?.addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      $$('#aeCatalogList .ae-skill-item').forEach(el => {
        el.style.display = el.textContent.toLowerCase().includes(q) || !q ? '' : 'none';
      });
    });
  }

  $('#aeSave')?.addEventListener('click', () => {
    if (!s.name) { Toast.warn('请输入智能体名称'); return; }
    const agent = Store.agents.find(a => a.id === s.id);
    if (agent) {
      agent.name = s.name;
      agent.avatarKey = s.avatarKey || agent.id;
      agent.desc = s.desc;
      agent.tools = toolCategories.filter(t => s.tools[t.key]).map(t => t.name);
      agent.skills = Object.keys(s.skills).filter(k => s.skills[k]);
    }
    closeModal();
    Store._agentDetailId = null;
    document.getElementById('accioApp').classList.remove('right-open');
    renderAgents();
    Toast.success(`智能体「${s.name}」已保存`);
  });
}

let wizardState = { step: 0, template: null, name: '', desc: '', avatarKey: 'data', vibe: '专业', tools: {}, skills: {}, userName: '', lang: '中文', notes: '', background: '' };

const agentTemplates = [
  { id: 'blank', name: '空白智能体', desc: '从一个完全空白的画布开始，自定义你的专属助手。', isBlank: true },
  { id: 'forecast', avatarKey: 'forecast', name: '现金流预测 Agent', desc: '滚动预测、情景模拟、偏差追踪；输出附假设与数据来源。' },
  { id: 'attribution', avatarKey: 'attribution', name: '智能归因 Agent', desc: '计划偏差穿透归因、异常支出模式识别、结构化报告。' },
  { id: 'scheduling', avatarKey: 'scheduling', name: '智能排程 Agent', desc: '动态优先级、成本最优调拨路径、异常支付识别与建议。' },
  { id: 'risk', avatarKey: 'risk', name: '风险预警 Agent', desc: '客商风险评分、逾期预警、催收策略与函件模板。' },
  { id: 'advisor', avatarKey: 'advisor', name: '决策建议 Agent', desc: '自然语言经营问答、报告草案、管理建议推送（RAG）。' },
  { id: 'data', avatarKey: 'data', name: '数据查询助手', desc: '自然语言查询资金数据、头寸、流入流出，一键下钻分析。' },
  { id: 'plan', avatarKey: 'plan', name: '计划管理助手', desc: '资金计划编制、审批流程跟踪、执行偏差分析与复盘。' },
  { id: 'fx', avatarKey: 'fx', name: '外汇分析师', desc: '外汇敞口监控、对冲策略建议、汇率风险 VaR 计量。' },
];

const toolCategories = [
  { name: '文件系统', desc: '读取、搜索、写入、编辑文件与目录', key: 'fs' },
  { name: '网络与浏览', desc: '网页搜索、网页抓取、API 调用', key: 'web' },
  { name: '数据集成', desc: 'ERP / 银企 / TMS 数据接入与映射', key: 'product' },
  { name: '代码与终端', desc: '脚本执行、定时任务、系统进程管理', key: 'code' },
  { name: '图表与报表', desc: '生成图表、导出报表、可视化分析', key: 'media' },
  { name: '实用工具', desc: '日期计算、汇率查询、MCP 工具调用', key: 'util' },
  { name: '记忆与规划', desc: '上下文记忆、任务创建、规划追踪', key: 'memory' },
  { name: '智能体协作', desc: '多智能体会话、任务分发、历史记录', key: 'collab' },
];

function openAgentWizard() {
  wizardState = { step: 0, template: 'data', name: '', desc: '', avatarKey: 'data', vibe: '专业', tools: { fs:true, web:true, code:true, util:true, media:true, memory:true, collab:true, product:true }, skills: {}, userName: '', lang: '中文', notes: '', background: '' };
  renderWizardStep();
}

function renderWizardStep() {
  const steps = ['选择模板', '身份与模型', '工具', '技能', '用户信息'];
  const stepNames = ['选择起点', '身份与模型', '工具配置', '技能配置', '用户信息'];
  const s = wizardState;
  const pct = ((s.step + 1) / 5 * 100).toFixed(0);

  let body = '';
  if (s.step === 0) {
    body = `<h3 style="font-size:20px;font-weight:700;margin-bottom:4px;">选择起点</h3>
      <p style="color:var(--gray-500);font-size:13px;margin-bottom:20px;">选择一个模板以快速开始，或者从头开始构建你的智能体。</p>
      <div class="template-grid">${agentTemplates.map(t => `
        <div class="template-card ${s.template === t.id ? 'selected' : ''}" data-tpl="${t.id}">
          <div class="template-card-icon">${t.isBlank ? `<span class="template-card-icon-blank">${WIZARD_BLANK_ICON}</span>` : agentIconHtml(t.avatarKey)}</div>
          <div class="template-card-name">${t.name}</div>
          <div class="template-card-desc">${t.desc}</div>
        </div>`).join('')}</div>`;
  } else if (s.step === 1) {
    body = `<div class="wizard-step-indicator">步骤 1 / 4</div>
      <h3 style="font-size:20px;font-weight:700;margin-bottom:4px;">身份与模型</h3>
      <div style="display:flex;justify-content:flex-end;font-size:12px;color:var(--gray-500);margin-bottom:16px;">已完成 ${pct}%</div>
      <p style="color:var(--gray-500);font-size:13px;margin-bottom:20px;">定义智能体的基本信息、头像与对话风格</p>
      <div class="identity-layout">
        <div class="identity-form">
          <div class="form-group"><div class="form-label">名称 *</div><input class="form-input form-input-full" id="wizName" value="${escHtml(s.name)}" placeholder="例如：资金分析助手"></div>
          <div class="form-group"><div class="form-label">智能体头像 <a href="#" style="float:right;font-size:12px;color:var(--orange-500);">上传自定义图片</a></div>
            <div class="avatar-style-tabs"><button class="avatar-style-tab active">像素风</button><button class="avatar-style-tab">冒险家</button><button class="avatar-style-tab">机器人</button><button class="avatar-style-tab">洛蕾莱</button></div>
            <div class="avatar-picker">${ICON_PICKER_KEYS.map(k => `<div class="avatar-chip ${s.avatarKey === k ? 'selected' : ''}" data-avatar-key="${k}">${agentIconHtml(k)}</div>`).join('')}</div>
          </div>
          <div class="form-group"><div class="form-label">描述</div><textarea class="form-textarea form-input-full" id="wizDesc" rows="3" placeholder="描述智能体的功能和职责...">${escHtml(s.desc)}</textarea></div>
          <div class="form-group"><div class="form-label">对话风格</div>
            <select class="form-select form-input-full" id="wizVibe"><option ${s.vibe==='专业'?'selected':''}>专业</option><option ${s.vibe==='友好'?'selected':''}>友好</option><option ${s.vibe==='简洁'?'selected':''}>简洁</option></select>
          </div>
        </div>
        <div class="live-preview-card">
          <div style="font-size:11px;color:var(--orange-500);margin-bottom:8px;">● 实时预览</div>
          <div style="font-size:12px;color:var(--gray-500);margin-bottom:12px;">预览智能体效果</div>
          <div class="preview-avatar" id="wizPreviewIcon">${agentIconHtml(s.avatarKey || 'data')}</div>
          <div class="preview-name" id="wizPreviewName">${s.name || '新智能体'}</div>
          <div class="preview-badge">身份已验证</div>
          <div class="preview-desc" id="wizPreviewDesc">"${s.desc || '描述将显示在此处...'}"</div>
          <div class="preview-vibe">风格</div>
          <div style="font-size:14px;font-weight:600;" id="wizPreviewVibe">${s.vibe}</div>
        </div>
      </div>`;
  } else if (s.step === 2) {
    body = `<div class="wizard-step-indicator">步骤 2 / 4</div>
      <h3 style="font-size:20px;font-weight:700;margin-bottom:4px;">工具配置</h3>
      <div style="display:flex;justify-content:flex-end;font-size:12px;color:var(--gray-500);margin-bottom:16px;">已完成 ${pct}%</div>
      <p style="color:var(--gray-500);font-size:13px;margin-bottom:20px;">选择智能体可调用的工具分类</p>
      <div class="tool-grid">${toolCategories.map(t => `
        <div class="tool-card">
          <div class="tool-card-icon">${toolIconHtml(t.key)}</div>
          <div class="tool-card-info"><div class="tool-card-name">${t.name}</div><div class="tool-card-desc">${t.desc}</div></div>
          <button class="toggle-switch ${s.tools[t.key] ? 'on' : ''}" data-tool="${t.key}"></button>
        </div>`).join('')}</div>`;
  } else if (s.step === 3) {
    const skills = [
      { key:'cashflow-forecast', name:'资金流预测', desc:'复合周期预测引擎，天/周/月/季/年自动切换' },
      { key:'fund-plan', name:'资金计划', desc:'滚动编制、多级审批、偏差分析' },
      { key:'fx-mgmt', name:'外汇管理', desc:'敞口监控、对冲策略、VaR 计量' },
      { key:'data-integration', name:'数据集成', desc:'取数映射引擎、ERP/银企/BI 对接' },
      { key:'anomaly', name:'异常预警', desc:'统计模型检测异常资金流模式' },
    ];
    body = `<div class="wizard-step-indicator">步骤 3 / 4</div>
      <h3 style="font-size:20px;font-weight:700;margin-bottom:4px;">技能配置</h3>
      <div style="display:flex;justify-content:flex-end;font-size:12px;color:var(--gray-500);margin-bottom:16px;">已完成 ${pct}%</div>
      <p style="color:var(--gray-500);font-size:13px;margin-bottom:8px;">配置预装业务技能</p>
      <p style="color:var(--gray-400);font-size:12px;margin-bottom:20px;">基于所选模板推荐的预装技能，创建时自动安装。可用开关控制是否启用。</p>
      <div style="display:grid;gap:10px;">${skills.map(sk => `
        <div class="skill-card" style="border-color:var(--orange-200);">
          <div class="skill-card-icon"><span class="skill-tile-svg">${SKILL_TILE_SVG}</span></div>
          <div class="skill-card-info"><div class="skill-card-name">${sk.name}</div><div class="skill-card-desc">${sk.desc}</div></div>
          <button class="toggle-switch ${s.skills[sk.key] !== false ? 'on' : ''}" data-skill="${sk.key}"></button>
        </div>`).join('')}</div>`;
  } else if (s.step === 4) {
    body = `<div class="wizard-step-indicator">步骤 4 / 4</div>
      <h3 style="font-size:20px;font-weight:700;margin-bottom:4px;">用户信息</h3>
      <div style="display:flex;justify-content:flex-end;font-size:12px;color:var(--gray-500);margin-bottom:16px;">已完成 ${pct}%</div>
      <p style="color:var(--gray-500);font-size:13px;margin-bottom:20px;">告诉智能体关于你的信息，包括称呼、偏好语言和业务背景</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
        <div class="form-group"><div class="form-label">如何称呼你</div><input class="form-input form-input-full" id="wizUserName" value="${escHtml(s.userName)}" placeholder="例如：张经理"></div>
        <div class="form-group"><div class="form-label">偏好语言</div><select class="form-select form-input-full" id="wizLang"><option ${s.lang==='中文'?'selected':''}>中文</option><option ${s.lang==='English'?'selected':''}>English</option></select></div>
      </div>
      <div class="form-group" style="margin-bottom:16px;"><div class="form-label">备注</div><input class="form-input form-input-full" id="wizNotes" value="${escHtml(s.notes)}" placeholder="例如：关注华东子公司资金流"></div>
      <div class="form-group"><div class="form-label">业务背景</div><textarea class="form-textarea form-input-full" id="wizBg" rows="4" placeholder="描述你的角色、负责业务范围等信息，帮助智能体更好地理解你的需求...">${escHtml(s.background)}</textarea></div>`;
  }

  const nextLabels = ['下一步：身份配置 >', '下一步：工具配置 >', '下一步：技能配置 >', '下一步：用户信息 >', '完成并启动'];

  openWizardModal(`
    <div style="position:relative;">
      <button class="wizard-close" onclick="closeModal()">×</button>
      <div class="wizard-header">
        <div class="wizard-icon">◇</div>
        <div class="wizard-header-info"><h3>${stepNames[s.step]}</h3><div class="wizard-step-label">第 ${s.step + 1} 步 > ${stepNames[s.step]}</div></div>
      </div>
      <div class="wizard-progress"><div class="wizard-progress-bar" style="width:${pct}%"></div></div>
      <div class="wizard-body">${body}</div>
      <div class="wizard-footer">
        ${s.step > 0 ? '<button class="btn" id="wizBack">上一步</button>' : '<div></div>'}
        <button class="btn btn-primary btn-lg" id="wizNext" style="background:var(--green-500);border-color:var(--green-500);">${nextLabels[s.step]}</button>
      </div>
    </div>
  `);

  setTimeout(() => {
    $$('.template-card').forEach(c => c.addEventListener('click', () => {
      $$('.template-card').forEach(x => x.classList.remove('selected'));
      c.classList.add('selected');
      wizardState.template = c.dataset.tpl;
      const tpl = agentTemplates.find(t => t.id === c.dataset.tpl);
      if (tpl && tpl.id !== 'blank') {
        wizardState.name = tpl.name;
        wizardState.avatarKey = tpl.avatarKey;
        wizardState.desc = tpl.desc;
      } else if (tpl && tpl.id === 'blank') {
        wizardState.name = '';
        wizardState.desc = '';
        wizardState.avatarKey = 'data';
      }
    }));

    $$('.avatar-chip[data-avatar-key]').forEach(c => c.addEventListener('click', () => {
      $$('.avatar-chip').forEach(x => x.classList.remove('selected'));
      c.classList.add('selected');
      wizardState.avatarKey = c.dataset.avatarKey;
      const pi = $('#wizPreviewIcon'); if (pi) pi.innerHTML = agentIconHtml(wizardState.avatarKey);
    }));

    $$('.toggle-switch[data-tool]').forEach(btn => btn.addEventListener('click', () => {
      btn.classList.toggle('on');
      wizardState.tools[btn.dataset.tool] = btn.classList.contains('on');
    }));
    $$('.toggle-switch[data-skill]').forEach(btn => btn.addEventListener('click', () => {
      btn.classList.toggle('on');
      wizardState.skills[btn.dataset.skill] = btn.classList.contains('on');
    }));

    ['wizName','wizDesc','wizVibe'].forEach(id => {
      const el = $(`#${id}`);
      if (el) el.addEventListener('input', () => {
        if (id === 'wizName') { wizardState.name = el.value; const pn = $('#wizPreviewName'); if (pn) pn.textContent = el.value || '新智能体'; }
        if (id === 'wizDesc') { wizardState.desc = el.value; const pd = $('#wizPreviewDesc'); if (pd) pd.textContent = `"${el.value || '...'}"`; }
        if (id === 'wizVibe') { wizardState.vibe = el.value; const pv = $('#wizPreviewVibe'); if (pv) pv.textContent = el.value; }
      });
    });

    $('#wizBack')?.addEventListener('click', () => { saveWizardFields(); wizardState.step--; renderWizardStep(); });
    $('#wizNext')?.addEventListener('click', () => {
      saveWizardFields();
      if (wizardState.step >= 4) { finishAgentWizard(); return; }
      wizardState.step++;
      renderWizardStep();
    });
  }, 50);
}

function saveWizardFields() {
  const s = wizardState;
  if ($('#wizName')) s.name = $('#wizName').value;
  if ($('#wizDesc')) s.desc = $('#wizDesc').value;
  if ($('#wizVibe')) s.vibe = $('#wizVibe').value;
  if ($('#wizUserName')) s.userName = $('#wizUserName').value;
  if ($('#wizLang')) s.lang = $('#wizLang').value;
  if ($('#wizNotes')) s.notes = $('#wizNotes').value;
  if ($('#wizBg')) s.background = $('#wizBg').value;
}

function finishAgentWizard() {
  const s = wizardState;
  if (!s.name) { Toast.warn('请输入智能体名称'); wizardState.step = 1; renderWizardStep(); return; }
  Store.agents.push({
    id: 'custom_' + Date.now(),
    name: s.name,
    avatarKey: s.avatarKey || 'data',
    desc: s.desc || '自定义智能体',
    tools: toolCategories.filter(t => s.tools[t.key]).map(t => t.name),
    skills: Object.keys(s.skills).filter(k => s.skills[k]),
  });
  closeModal();
  renderAgents();
  Toast.success(`智能体「${s.name}」创建成功`);
}

/* ════════════════════════════════════════════
   Tasks Page + Create Task Dialog
   ════════════════════════════════════════════ */
function renderTasks() {
  const pg = $('#page-tasks');
  const taskData = {
    daily: { title: '日常', cards: [
      { iconKey: 'sun', bg: '#FEF3C7', name: '晨间简报', desc: '汇总今日天气、要闻和优先事项' },
      { iconKey: 'clipboard', bg: 'var(--blue-50)', name: '站会准备', desc: '基于近期活动和文件变更生成汇报' },
      { iconKey: 'moon', bg: '#EDE9FE', name: '日终总结', desc: '汇总今日进展、未完成事项和明日建议' },
      { iconKey: 'mail', bg: 'var(--orange-100)', name: '邮件分拣', desc: '筛查未读邮件，浮出紧急事项' },
    ]},
    monitor: { title: '监控', cards: [
      { iconKey: 'search', bg: 'var(--blue-50)', name: '竞品动态', desc: '搜索竞品最新资讯、产品更新和价格变化' },
      { iconKey: 'activity', bg: 'var(--green-50)', name: '资金异常监控', desc: '实时监测资金流异常模式并预警' },
    ]},
    report: { title: '报告', cards: [
      { iconKey: 'bars', bg: 'var(--orange-100)', name: '资金日报', desc: '每日资金流入流出汇总与头寸变化分析' },
      { iconKey: 'trend', bg: 'var(--green-50)', name: '周度分析', desc: '按周汇总预测偏差与计划执行情况' },
    ]},
    auto: { title: '自动化', cards: Store.fetchTasks.map(t => ({
      iconKey: 'zap', bg: 'var(--blue-50)', name: t.name, desc: `类型: ${t.task_type} · 调度: ${t.cron_expr}`
    }))},
  };

  pg.innerHTML = `
    <div class="page-header-bar">
      <div><div class="page-title">定时任务</div><div class="page-subtitle">这里汇总当前账号下的任务：包括你手动新建的，以及在聊天中由智能体创建的定时任务。</div></div>
      <div class="page-actions"><button class="btn btn-primary" id="btnCreateTask">+ 新建任务</button></div>
    </div>
    <div class="page-scroll">
      <div class="tasks-layout">
        <div class="tasks-sidebar">
          ${Object.entries(taskData).map(([k,v]) => `<button class="tasks-sidebar-btn ${k==='daily'?'active':''}" data-cat="${k}">${v.title}</button>`).join('')}
        </div>
        <div class="tasks-content" id="tasksContent"></div>
      </div>
    </div>
  `;

  function showCat(cat) {
    const data = taskData[cat]; if (!data) return;
    $('#tasksContent').innerHTML = `
      <div class="task-section-title">${data.title}</div>
      <div class="task-grid">${data.cards.map(c => `
        <div class="task-card"><div class="task-card-icon" style="background:${c.bg};">${uiIcon(c.iconKey)}</div><div class="task-card-info"><div class="task-card-name">${c.name}</div><div class="task-card-desc">${c.desc}</div></div></div>
      `).join('')}</div>`;
  }
  showCat('daily');

  $$('.tasks-sidebar-btn').forEach(btn => btn.addEventListener('click', () => {
    $$('.tasks-sidebar-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    showCat(btn.dataset.cat);
  }));

  $('#btnCreateTask')?.addEventListener('click', () => openCreateTaskDialog());
}

function openCreateTaskDialog() {
  let sendTo = 'agent';
  const agentOptions = Store.agents.map(a => `<option value="${a.id}">${a.name}</option>`).join('');

  openModal('创建任务', `
    <div class="task-create-form">
      <div style="display:flex;justify-content:flex-end;"><button class="btn btn-sm" id="taskUseTemplate">使用模板</button></div>
      <div class="form-group"><div class="form-label">名称</div><input class="form-input form-input-full" id="taskName" placeholder="站会总结"></div>
      <div class="form-group">
        <div class="form-label">发送到</div>
        <div class="tab-toggle" id="taskSendTo">
          <button class="tab-toggle-btn active" data-val="agent">智能体</button>
          <button class="tab-toggle-btn" data-val="session">指定会话</button>
        </div>
        <div class="form-help" id="taskSendHelp">首次运行时将自动创建一个专属会话，后续运行将在该会话中持续积累上下文。</div>
      </div>
      <div class="form-group" id="taskAgentGroup"><div class="form-label">智能体</div><select class="form-select form-input-full" id="taskAgent">${agentOptions}</select></div>
      <div class="form-group" id="taskSessionGroup" style="display:none;"><div class="form-label">会话</div><select class="form-select form-input-full" id="taskSession"><option>资金概况查询</option><option>总部资金流分析</option></select></div>
      <div class="form-group"><div class="form-label">提示词</div><textarea class="form-textarea form-input-full" id="taskPrompt" rows="4" placeholder="总结昨天的 Git 活动以供站会使用。"></textarea></div>
      <div class="form-group">
        <div class="form-label">调度</div>
        <div class="schedule-row" style="margin-bottom:8px;">
          <button class="schedule-type-btn" data-stype="once">单次</button>
          <button class="schedule-type-btn active" data-stype="daily">每天</button>
          <button class="schedule-type-btn" data-stype="interval">间隔</button>
        </div>
        <div id="scheduleConfig">
          <div style="display:flex;gap:12px;align-items:center;">
            <input class="form-input" type="time" id="taskTime" value="09:00" style="width:140px;">
            <div class="day-picker">
              ${['Mo','Tu','We','Th','Fr','Sa','Su'].map((d,i) => `<div class="day-chip ${[0,2,4].includes(i)?'active':''}" data-day="${i}">${d}</div>`).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
  `, `<button class="btn" onclick="closeModal()">取消</button><button class="btn btn-primary" style="background:var(--gray-900);border-color:var(--gray-900);" onclick="createScheduledTask()">创建</button>`);

  setTimeout(() => {
    $$('#taskSendTo .tab-toggle-btn').forEach(btn => btn.addEventListener('click', () => {
      $$('#taskSendTo .tab-toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      sendTo = btn.dataset.val;
      $('#taskAgentGroup').style.display = sendTo === 'agent' ? '' : 'none';
      $('#taskSessionGroup').style.display = sendTo === 'session' ? '' : 'none';
      $('#taskSendHelp').textContent = sendTo === 'agent' ? '首次运行时将自动创建一个专属会话，后续运行将在该会话中持续积累上下文。' : '后续运行将始终在此会话中进行。';
    }));
    $$('.schedule-type-btn').forEach(btn => btn.addEventListener('click', () => {
      $$('.schedule-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }));
    $$('.day-chip').forEach(chip => chip.addEventListener('click', () => chip.classList.toggle('active')));
  }, 50);
}

window.createScheduledTask = async function() {
  const name = $('#taskName')?.value?.trim();
  const prompt = $('#taskPrompt')?.value?.trim();
  if (!name) { Toast.warn('请输入任务名称'); return; }
  const days = [...$$('.day-chip.active')].map(c => c.dataset.day);
  const time = $('#taskTime')?.value || '09:00';
  const cron = `${time} ${days.length ? days.join(',') : '每天'}`;

  const body = { name, task_type: '自定义任务', enabled: true, cron_expr: cron, filters_json: JSON.stringify({ prompt }), extra_json: '{}' };
  try {
    const res = await api.post('/api/fetch-tasks', body);
    Store.fetchTasks.push(res);
  } catch {
    Store.fetchTasks.push({ id: Date.now(), ...body });
  }
  closeModal();
  renderTasks();
  Toast.success(`任务「${name}」创建成功`);
};

/* ════════════════════════════════════════════
   Apps Page
   ════════════════════════════════════════════ */
function renderApps() {
  const apps = [
    { iconKey: 'building', bg: 'var(--orange-100)', name: '资金管理系统', desc: '对接 TMS 获取资金流数据', status: 'connected' },
    { iconKey: 'book', bg: '#FEF3C7', name: 'ERP 系统', desc: '应收/应付自动同步', status: 'disconnected' },
    { iconKey: 'creditCard', bg: '#DBEAFE', name: '银企直连', desc: '银行余额与流水实时对接', status: 'disconnected' },
    { iconKey: 'pie', bg: '#F0FDF4', name: 'BI 系统', desc: '推送分析报告与可视化仪表盘', status: 'coming' },
    { iconKey: 'mail', bg: '#FEE2E2', name: 'Outlook', desc: '高效管理邮件与日程', status: 'coming' },
    { iconKey: 'clipboard', bg: '#EDE9FE', name: 'Airtable', desc: '以协作方式组织与管理数据', status: 'coming' },
    { iconKey: 'folder', bg: '#DBEAFE', name: 'Dropbox', desc: '管理文件、文件夹和共享权限', status: 'coming' },
    { iconKey: 'message', bg: '#FCE7F3', name: 'Slack', desc: '读写 Slack 会话消息', status: 'coming' },
    { iconKey: 'edit', bg: '#F3F4F6', name: 'Notion', desc: '通过 Integration Token 读写工作区内容', status: 'coming' },
    { iconKey: 'zap', bg: '#FEF3C7', name: 'Zapier', desc: '连接数千应用开启自动化工作流', status: 'coming' },
  ];
  const pg = $('#page-apps');
  pg.innerHTML = `
    <div class="page-header-bar">
      <div><div class="page-title">应用授权</div><div class="page-subtitle">授权第三方平台，让亿流 Work 代表你访问数据。</div></div>
      <div class="page-actions"><input class="search-input" placeholder="搜索应用..."><span style="font-size:12px;color:var(--gray-500);white-space:nowrap;">${apps.length} 个应用</span></div>
    </div>
    <div class="page-scroll">
      <div class="app-grid">${apps.map(a => `
        <div class="app-card">
          <div class="app-card-icon" style="background:${a.bg};">${uiIcon(a.iconKey)}</div>
          <div class="app-card-info"><div class="app-card-name">${a.name}</div><div class="app-card-desc">${a.desc}</div></div>
          <div class="app-card-status">
            <span class="status-dot ${a.status}">${a.status === 'connected' ? '已连接' : a.status === 'coming' ? '即将推出' : '未连接'}</span>
            ${a.status === 'connected' ? `<button class="connect-btn" onclick="Toast.success('已连接，点击进入配置')">配置</button>` : 
              a.status === 'disconnected' ? `<button class="connect-btn" onclick="Toast.info('连接配置开发中')">连接</button>` : 
              `<button class="connect-btn disabled" onclick="Toast.info('敬请期待')">敬请期待</button>`}
          </div>
        </div>`).join('')}</div>
    </div>`;
}

/* ════════════════════════════════════════════
   Skills Page
   ════════════════════════════════════════════ */
function renderSkills() {
  const categories = [
    { name: '金融与财务', catIcon: 'landmark', count: 2, skills: [
      { name: '财务建模', desc: '构建 DCF 分析、敏感性测试和蒙特卡洛模拟等…', on: false },
      { name: 'DCF 估值', desc: '通过现金流折现分析估算每股内在价值。', on: false },
    ]},
    { name: '资金管理', catIcon: 'wallet', count: 10, skills: [
      { name: '资金流预测', desc: '复合周期预测引擎，天/周/月/季/年自动切换', on: true },
      { name: '资金计划', desc: '滚动编制、多级审批、偏差分析', on: true },
      { name: '外汇管理', desc: '敞口监控、对冲策略、VaR 计量', on: true },
      { name: '付款排程', desc: '待付款池、策略日历、调拨与银企支付联动', on: true },
      { name: '情景模拟', desc: '业务假设驱动的现金流压力测试', on: true },
      { name: '数据集成', desc: '取数映射引擎、ERP/银企/BI 对接', on: false },
      { name: '预测引擎', desc: '头寸递推、科目×时间段矩阵', on: true },
      { name: '客商风险', desc: '评分、坏账预估、催收策略', on: true },
      { name: '经营归因', desc: '偏差穿透与结构化归因报告', on: true },
      { name: '异常预警', desc: '统计模型检测异常资金流', on: false },
    ]},
    { name: '文档处理', catIcon: 'fileText', count: 4, skills: [
      { name: '电子表格', desc: '创建和编辑 Excel 电子表格，支持公式、格式…', on: false },
      { name: '演示文稿', desc: '创建、编辑和分析 PowerPoint 演示文稿。', on: false },
      { name: 'PDF 工具', desc: '提取文本和表格，创建、合并、拆分 PDF，处…', on: false },
      { name: 'Word 文档', desc: '创建、编辑和分析 Word 文档，支持修订、批…', on: false },
    ]},
    { name: '开发工具', catIcon: 'terminal', count: 2, skills: [
      { name: 'MCP 工具', desc: '通过 MCP 网关发现和调用远程工具（Google…', on: false },
      { name: 'GraphQL 指南', desc: '编写 GraphQL 查询、变更和片段的最佳实践。', on: false },
    ]},
  ];
  const pg = $('#page-skills');
  pg.innerHTML = `
    <div class="page-header-bar">
      <div><div class="page-title">技能</div><div class="page-subtitle">管理技能库，安装并启用你需要的能力。</div></div>
      <div class="page-actions"><input class="search-input" placeholder="搜索技能..." id="skillSearch"><button class="btn btn-icon-only" style="margin-left:4px;" type="button" title="更多">${uiIcon('circle')}</button><button class="btn btn-primary">↑ 上传</button></div>
    </div>
    <div class="page-scroll">
      ${categories.map(cat => `
        <div class="skill-category">
          <div class="skill-category-title"><span class="skill-cat-ico">${uiIcon(cat.catIcon)}</span> ${cat.name} <span class="skill-category-count">${cat.count}</span></div>
          <div class="skill-grid">${cat.skills.map(sk => `
            <div class="skill-card" data-sname="${sk.name}">
              <div class="skill-card-icon"><span class="skill-tile-svg">${SKILL_TILE_SVG}</span></div>
              <div class="skill-card-info"><div class="skill-card-name">${sk.name}</div><div class="skill-card-desc">${sk.desc}</div></div>
              <div class="skill-card-toggle"><button class="toggle-switch ${sk.on ? 'on' : ''}"></button></div>
            </div>`).join('')}</div>
        </div>`).join('')}
    </div>`;

  $$('.toggle-switch').forEach(btn => btn.addEventListener('click', () => { btn.classList.toggle('on'); Toast.info(btn.classList.contains('on') ? '技能已启用' : '技能已停用'); }));
  $('#skillSearch')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    $$('.skill-card').forEach(c => { c.style.display = c.dataset.sname.toLowerCase().includes(q) ? '' : 'none'; });
  });
}

/* ════════════════════════════════════════════
   Channels Page
   ════════════════════════════════════════════ */
function renderChannels() {
  const channels = [
    { iconKey: 'message', bg: '#DBEAFE', name: '钉钉', type: '钉钉机器人', status: '未关联', link: true },
    { iconKey: 'users', bg: '#DCFCE7', name: '微信', type: '微信 ClawBot', status: '未关联', link: false, note: '不支持群聊配对' },
    { iconKey: 'send', bg: '#DBEAFE', name: '飞书', type: '飞书机器人', status: '未关联', link: true },
    { iconKey: 'send', bg: '#DBEAFE', name: 'Telegram', type: 'Telegram Bot', status: '未关联', link: true },
    { iconKey: 'users', bg: '#EDE9FE', name: 'Discord', type: 'Discord Bot', status: '未关联', link: true },
  ];
  const pg = $('#page-channels');
  pg.innerHTML = `
    <div class="page-header-bar">
      <div><div class="page-title">消息渠道</div><div class="page-subtitle">配置 AI 智能体与用户交互的消息平台。所有连接数据储存在本地——无需云端。</div></div>
    </div>
    <div class="page-scroll">
      <p style="font-size:13px;color:var(--gray-500);margin-bottom:16px;">${channels.length} 个渠道</p>
      <div class="channel-grid">${channels.map(ch => `
        <div class="channel-card">
          <div class="channel-card-header">
            <div class="channel-card-icon" style="background:${ch.bg};">${uiIcon(ch.iconKey)}</div>
            <div><div class="channel-card-name">${ch.name}</div><div class="channel-card-type">${ch.type} ${ch.link ? `<a href="#" style="color:var(--blue-500);font-size:11px;">如何接入？</a>` : ''}</div></div>
            <span class="channel-card-status-tag" style="color:var(--gray-500);margin-left:auto;">${ch.status}</span>
          </div>
          <div class="channel-card-stats">
            <div class="channel-stat"><div class="channel-stat-label">已配对用户</div><div class="channel-stat-value">0</div></div>
            <div class="channel-stat"><div class="channel-stat-label">${ch.note || '已配对群聊'}</div><div class="channel-stat-value">0</div></div>
            <div class="channel-stat"><div class="channel-stat-label">待处理请求</div><div class="channel-stat-value">0</div></div>
          </div>
          <div class="channel-card-actions">
            <button class="btn btn-sm" style="flex:1;" onclick="Toast.info('请先配置智能体')">+ 请配置智能体</button>
            <button class="btn btn-sm btn-outline-primary" style="flex:1;">${ch.name === '微信' ? '绑定微信账号' : '◇ 设置机器人'}</button>
          </div>
        </div>`).join('')}</div>
    </div>`;
}

/* ════════════════════════════════════════════
   Pairing Page
   ════════════════════════════════════════════ */
function renderPairing() {
  const pg = $('#page-pairing');
  pg.innerHTML = `
    <div class="page-header-bar"><div><div class="page-title">配对授权</div><div class="page-subtitle">管理谁可以通过 IM 渠道与你的智能体互动，指挥智能体工作</div></div></div>
    <div class="page-scroll">
      <div class="pairing-section"><div class="pairing-section-title">待审核</div><div class="pairing-section-desc">仅展示 24 小时内有效的配对请求</div><div class="pairing-empty"><p>无待审核请求</p><p style="font-size:12px;margin-top:4px;">当用户尝试与你的智能体互动时，配对请求将显示在此处</p></div></div>
      <div class="pairing-section"><div class="pairing-section-title">已授权</div><div class="pairing-section-desc">已授权用户可通过 IM 渠道与智能体互动，并触发及审批智能体的敏感操作</div><div class="pairing-empty"><p>无已授权用户</p><p style="font-size:12px;margin-top:4px;">你授权配对请求后，用户将显示在此处</p></div></div>
    </div>`;
}

/* ════════════════════════════════════════════
   智能财务中台 · 付款排程 / 往来款 / 预警 / 驾驶舱
   ════════════════════════════════════════════ */
function renderPaymentSchedule() {
  const pool = Store.paymentPool || [];
  const strategies = Store.paymentStrategies || [];
  const pg = $('#page-payment');
  pg.innerHTML = `
    <div class="page-header-bar">
      <div><div class="page-title">付款排程</div><div class="page-subtitle">待付款池 · 单位主体+业务类型策略 · 排程-调拨-支付闭环（智能排程 Agent）</div></div>
      <div class="page-actions">
        <button class="btn" type="button" id="payBtnRank">服务端排程评分</button>
        <button class="btn" type="button" id="payBtnBank">模拟银企批量提交</button>
        <button class="btn btn-primary" type="button" onclick="Toast.info('演示环境：已同步 ERP/OA 模拟数据')">同步待付</button>
      </div>
    </div>
    <div class="page-scroll">
      ${wbCrumb()}
      <div class="agent-platform-banner">
        <div class="apb-title"><span class="apb-ico">${agentIconHtml('scheduling')}</span> 智能排程 Agent 嵌入点</div>
        <p class="apb-desc">动态优先级 · 成本最优调拨路径试算 · 异常支付模式识别；所有建议附带规则因子与数据来源，需人工确认后执行。</p>
      </div>
      <div class="card" style="margin-bottom:14px;"><div class="card-header"><div class="card-title">支付策略（单位主体 + 业务类型）</div></div>
        <div class="card-body" style="padding:0;"><table class="data-table"><thead><tr><th>主体</th><th>业务类型</th><th>自动支付时刻</th><th>节假日</th><th>启用</th></tr></thead><tbody>
          ${strategies.map(s => `<tr><td>${s.unit}</td><td>${s.biz_type}</td><td>${s.run_at}</td><td>${s.holiday}</td><td><span class="badge badge-green">${s.enabled ? '是' : '否'}</span></td></tr>`).join('')}
        </tbody></table></div>
      </div>
      <div class="card"><div class="card-header"><div class="card-title">待付款池</div></div>
        <div class="card-body" style="padding:0;"><table class="data-table"><thead><tr><th>优先级</th><th>主体</th><th>业务类型</th><th>对手方</th><th class="num">金额</th><th>期望日</th><th>状态</th><th>来源单号</th></tr></thead><tbody>
          ${pool.map(p => `<tr><td><span class="prio-tag prio-${p.priority==='P0'?'p0':'p1'}">${p.priority}</span></td><td>${p.unit}</td><td>${p.biz_type}</td><td>${p.counterparty}</td><td class="num">${fmtAmt(p.amount)}</td><td>${p.expect_date}</td><td><span class="badge badge-orange">${p.status}</span></td><td style="font-size:12px;color:var(--gray-500);">${p.source_doc}</td></tr>`).join('')}
        </tbody></table></div></div>
    </div>`;
  $('#payBtnRank')?.addEventListener('click', async () => {
    try {
      const r = await api.post('/api/ml/scheduling', {});
      console.info('scheduling', r);
      Toast.success('已返回排程评分（详见浏览器控制台）');
    } catch { Toast.warn('排程接口不可用，请启动后端'); }
  });
  $('#payBtnBank')?.addEventListener('click', async () => {
    const ids = (Store.paymentPool || []).filter(p => p.status === '待排程' || p.status === '队列中').map(p => p.id);
    if (!ids.length) { Toast.warn('无待提交单据'); return; }
    try {
      const r = await api.post('/api/bank/payments/submit', { pool_ids: ids.slice(0, 8) });
      Toast.success(`银企模拟受理 ${r.accepted || 0} 笔 · 批次 ${r.batch_id || ''}`);
    } catch { Toast.warn('银企接口不可用'); }
  });
}

function renderArap() {
  const ar = Store.receivables || [];
  const ap = Store.payables || [];
  const pr = Store.prepaids || [];
  const pg = $('#page-arap');
  pg.innerHTML = `
    <div class="page-header-bar">
      <div><div class="page-title">往来款管理</div><div class="page-subtitle">应收 / 应付 / 预付 · 账龄与客商风险（风险预警 Agent）</div></div>
    </div>
    <div class="page-scroll">
      ${wbCrumb()}
      <div class="agent-platform-banner apb-risk">
        <div class="apb-title"><span class="apb-ico">${agentIconHtml('risk')}</span> 风险预警 Agent 嵌入点</div>
        <p class="apb-desc">客商风险评分 · 坏账预估 · 催收策略与函件模板；付款排程前可触发前置校验。</p>
      </div>
      <div class="tabs-row" style="margin-bottom:12px;">
        <button class="tab-btn active" data-arap="ar">应收</button>
        <button class="tab-btn" data-arap="ap">应付</button>
        <button class="tab-btn" data-arap="pre">预付</button>
      </div>
      <div id="arapPanelAr" class="arap-panel">
        <div class="card"><div class="card-header"><div class="card-title">应收账款</div></div><div class="card-body" style="padding:0;">
          <table class="data-table"><thead><tr><th>主体</th><th>客户</th><th class="num">余额</th><th>账龄</th><th>到期日</th><th>风险分</th></tr></thead><tbody>
            ${ar.map(r => `<tr><td>${r.unit}</td><td>${r.customer}</td><td class="num">${fmtAmt(r.amount)}</td><td>${r.age_bucket}</td><td>${r.due_date}</td><td>${r.risk_score}</td></tr>`).join('')}
          </tbody></table>
        </div></div>
      </div>
      <div id="arapPanelAp" class="arap-panel" style="display:none;">
        <div class="card"><div class="card-header"><div class="card-title">应付账款</div></div><div class="card-body" style="padding:0;">
          <table class="data-table"><thead><tr><th>主体</th><th>供应商</th><th class="num">余额</th><th>账龄</th><th>到期日</th><th>信用</th></tr></thead><tbody>
            ${ap.map(r => `<tr><td>${r.unit}</td><td>${r.vendor}</td><td class="num">${fmtAmt(r.amount)}</td><td>${r.age_bucket}</td><td>${r.due_date}</td><td>${r.credit}</td></tr>`).join('')}
          </tbody></table>
        </div></div>
      </div>
      <div id="arapPanelPre" class="arap-panel" style="display:none;">
        <div class="card"><div class="card-header"><div class="card-title">预付清理</div></div><div class="card-body" style="padding:0;">
          <table class="data-table"><thead><tr><th>主体</th><th>项目</th><th class="num">余额</th><th>责任人</th><th>核销时限</th></tr></thead><tbody>
            ${pr.map(r => `<tr><td>${r.unit}</td><td>${r.project}</td><td class="num">${fmtAmt(r.balance)}</td><td>${r.owner}</td><td>${r.clear_deadline}</td></tr>`).join('')}
          </tbody></table>
        </div></div>
      </div>
    </div>`;
  $$('#page-arap .tab-btn[data-arap]').forEach(btn => btn.addEventListener('click', () => {
    $$('#page-arap .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const k = btn.dataset.arap;
    $('#arapPanelAr').style.display = k === 'ar' ? '' : 'none';
    $('#arapPanelAp').style.display = k === 'ap' ? '' : 'none';
    $('#arapPanelPre').style.display = k === 'pre' ? '' : 'none';
  }));
}

function renderAlertCenter() {
  const list = Store.fundAlerts || [];
  const pg = $('#page-alerts');
  pg.innerHTML = `
    <div class="page-header-bar">
      <div><div class="page-title">资金预警中心</div><div class="page-subtitle">流动性 / 支付异常 / 重复支付 / 大额管控 · 可配置规则与级别</div></div>
      <div class="page-actions"><button class="btn" type="button" onclick="navigateTo('cockpit')">打开驾驶舱</button></div>
    </div>
    <div class="page-scroll">
      ${wbCrumb()}
      <div class="card"><div class="card-header"><div class="card-title">实时预警</div></div><div class="card-body" style="padding:0;">
        <table class="data-table"><thead><tr><th>级别</th><th>规则</th><th>内容</th><th>时间</th><th>处置</th></tr></thead><tbody>
          ${list.map(a => `<tr><td><span class="badge ${a.level==='高'?'badge-red':a.level==='中'?'badge-orange':'badge-gray'}">${a.level}</span></td><td>${a.rule}</td><td>${a.message}</td><td style="font-size:12px;">${a.time}</td><td><button class="btn btn-sm" type="button" onclick="navigateTo('${a.page}')">查看</button></td></tr>`).join('')}
        </tbody></table>
      </div></div>
    </div>`;
}

function renderCockpit() {
  const s = Store.stats || {};
  const agents = [
    { id:'forecast', name:'现金流预测', pr:'P0', desc:'滚动预测 + 情景模拟' },
    { id:'attribution', name:'智能归因', pr:'P1', desc:'偏差穿透 · 结构化报告' },
    { id:'scheduling', name:'智能排程', pr:'P1', desc:'优先级 · 调拨路径' },
    { id:'risk', name:'风险预警', pr:'P1', desc:'客商评分 · 催收' },
    { id:'advisor', name:'决策建议', pr:'P1', desc:'NL 问答 · 经营报告' },
  ];
  const pg = $('#page-cockpit');
  pg.innerHTML = `
    <div class="page-header-bar">
      <div><div class="page-title">管理驾驶舱</div><div class="page-subtitle">资金总量 / 流向 / 项目集中度 · 决策建议 Agent 解读与推送</div></div>
      <div class="page-actions"><button class="btn" onclick="navigateTo('dashboard')">返回总览</button></div>
    </div>
    <div class="page-scroll">
      ${wbCrumb()}
      <div class="kpi-row">
        <div class="kpi-card" onclick="navigateTo('cashflow')"><div class="kpi-label">净头寸</div><div class="kpi-value">${fmtAmt(s.net_position)}</div><div class="kpi-sub">集团 CNY 口径</div></div>
        <div class="kpi-card" onclick="navigateTo('payment')"><div class="kpi-label">待付款池</div><div class="kpi-value">${(Store.paymentPool||[]).length} 笔</div><div class="kpi-sub">含 P0 刚性付款</div></div>
        <div class="kpi-card" onclick="navigateTo('alerts')"><div class="kpi-label">活跃预警</div><div class="kpi-value">${(Store.fundAlerts||[]).length}</div><div class="kpi-sub">待跟进</div></div>
        <div class="kpi-card" onclick="navigateTo('analysis')"><div class="kpi-label">预测偏差</div><div class="kpi-value">—</div><div class="kpi-sub">联动预测引擎</div></div>
      </div>
      <div class="card"><div class="card-header"><div class="card-title">AI Agent 能力矩阵</div></div>
        <div class="card-body"><div class="agent-matrix">
          ${agents.map(a => `<div class="agent-matrix-cell" role="button" tabindex="0" data-cockpit-agent="${a.id}">
            <div class="am-ico">${agentIconHtml(a.id)}</div>
            <div class="am-name">${a.name}<span class="am-pr">${a.pr}</span></div>
            <div class="am-desc">${a.desc}</div>
          </div>`).join('')}
        </div>
        <p style="font-size:12px;color:var(--gray-500);margin-top:12px;">本地化部署：DeepSeek / Qwen 等开源模型 + RAG；统计与深度学习预测模型可在私网 GPU 上运行。</p>
      </div>
    </div>`;
  $$('#page-cockpit .agent-matrix-cell[data-cockpit-agent]').forEach(el => {
    const go = () => { Store.currentAgent = el.dataset.cockpitAgent; navigateTo('chat'); Toast.info('已切换至对应 Agent 对话'); };
    el.addEventListener('click', go);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
}

/* ════════════════════════════════════════════
   Dashboard Page — 总览看板
   ════════════════════════════════════════════ */
function renderDashboard() {
  const s = Store.stats || {};
  const pg = $('#page-dashboard');
  pg.innerHTML = `
    <div class="page-header-bar">
      <div><div class="page-title">总览看板</div><div class="page-subtitle">智能财务中台 · 司库与资金 · 实时全景 · CNY 口径</div></div>
      <div class="page-actions"><button class="btn" id="dashRefreshBtn">↻ 刷新数据</button></div>
    </div>
    <div class="page-scroll">
      ${wbCrumb()}
      <div class="kpi-row">
        <div class="kpi-card" onclick="navigateTo('cashflow')"><div class="kpi-label">净头寸 (CNY)</div><div class="kpi-value">${fmtAmt(s.net_position)}</div><div class="kpi-sub">${s.record_count || 0} 笔记录</div></div>
        <div class="kpi-card" onclick="navigateTo('analysis')"><div class="kpi-label">总流入</div><div class="kpi-value positive">${fmtAmt(s.total_inflow)}</div><div class="kpi-sub">已确认 ${s.confirmed || 0} 笔</div></div>
        <div class="kpi-card" onclick="navigateTo('analysis')"><div class="kpi-label">总流出</div><div class="kpi-value negative">${fmtAmt(s.total_outflow)}</div><div class="kpi-sub">预测 ${s.predicted || 0} 笔</div></div>
        <div class="kpi-card" onclick="navigateTo('fx')"><div class="kpi-label">外汇敞口</div><div class="kpi-value">${s.fx_exposure_count || 0} 笔</div><div class="kpi-sub">名义 ${fmtAmt(s.fx_total_notional)}</div></div>
      </div>
      <div class="grid-2col">
        <div class="chart-card"><div class="chart-card-title">头寸趋势（近 30 天）</div><div id="chartPositionTrend" style="height:340px;"></div></div>
        <div class="chart-card"><div class="chart-card-title">流入 / 流出构成</div><div id="chartFlowPie" style="height:340px;"></div></div>
      </div>
      <div class="card"><div class="card-header"><div class="card-title">智能提醒</div></div><div class="card-body" id="dashAlerts"></div></div>
      <div class="card"><div class="card-header"><div class="card-title">业务闭环快捷入口</div></div>
        <div class="card-body dash-quick-actions">
          <button type="button" class="btn dash-quick-btn" onclick="navigateTo('payment')"><span class="dash-quick-ico">${uiIcon('creditCard')}</span>付款排程</button>
          <button type="button" class="btn dash-quick-btn" onclick="navigateTo('arap')"><span class="dash-quick-ico">${uiIcon('users')}</span>往来款</button>
          <button type="button" class="btn dash-quick-btn" onclick="navigateTo('alerts')"><span class="dash-quick-ico">${uiIcon('alertTriangle')}</span>资金预警</button>
          <button type="button" class="btn dash-quick-btn" onclick="navigateTo('cockpit')"><span class="dash-quick-ico">${uiIcon('pie')}</span>管理驾驶舱</button>
          <button type="button" class="btn dash-quick-btn" onclick="navigateTo('cashflow')"><span class="dash-quick-ico">${uiIcon('wallet')}</span>资金流管理</button>
          <button type="button" class="btn dash-quick-btn" onclick="navigateTo('analysis')"><span class="dash-quick-ico">${uiIcon('trend')}</span>预测引擎</button>
          <button type="button" class="btn dash-quick-btn" onclick="navigateTo('plan')"><span class="dash-quick-ico">${uiIcon('clipboard')}</span>资金计划</button>
          <button type="button" class="btn dash-quick-btn" onclick="navigateTo('fx')"><span class="dash-quick-ico">${uiIcon('activity')}</span>外汇敞口</button>
          <button type="button" class="btn dash-quick-btn" onclick="navigateTo('basedata')"><span class="dash-quick-ico">${uiIcon('building')}</span>基础数据</button>
          <button type="button" class="btn dash-quick-btn" onclick="navigateTo('integration')"><span class="dash-quick-ico">${uiIcon('spark')}</span>数据集成</button>
        </div>
      </div>
    </div>`;
  renderDashCharts();
  renderDashAlerts();
  $('#dashRefreshBtn')?.addEventListener('click', async () => { Toast.info('正在刷新数据...'); await loadAllData(); renderDashboard(); Toast.success('数据已刷新'); });
}

function renderDashCharts() {
  if (typeof echarts === 'undefined') return;
  const records = Store.records.items || [];
  const trendDom = document.getElementById('chartPositionTrend');
  if (trendDom) {
    const chart = echarts.init(trendDom);
    const byDate = {};
    records.forEach(r => {
      if (!r.trade_date || (r.currency && r.currency !== 'CNY')) return;
      const d = r.trade_date.slice(0, 10);
      if (!byDate[d]) byDate[d] = { i: 0, o: 0 };
      if (r.amount > 0) byDate[d].i += r.amount; else byDate[d].o += Math.abs(r.amount);
    });
    const dates = Object.keys(byDate).sort();
    if (dates.length) {
      chart.setOption({
        tooltip: { trigger: 'axis' },
        legend: { data: ['流入', '流出', '净额'], bottom: 4, textStyle: { fontSize: 11, color: '#737373' } },
        grid: { top: 20, right: 20, bottom: 46, left: 12, containLabel: true },
        xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 10, color: '#a3a3a3', formatter: v => v.slice(5) } },
        yAxis: { type: 'value', axisLabel: { formatter: v => (v/1e4).toFixed(0) + '万', fontSize: 10, color: '#a3a3a3' }, splitLine: { lineStyle: { color: '#e5e5e5', type: 'dashed' } } },
        series: [
          { name: '流入', type: 'bar', data: dates.map(d => byDate[d].i), itemStyle: { color: '#22C55E', borderRadius: [3,3,0,0] }, barMaxWidth: 20 },
          { name: '流出', type: 'bar', data: dates.map(d => byDate[d].o), itemStyle: { color: '#EF4444', borderRadius: [3,3,0,0] }, barMaxWidth: 20 },
          { name: '净额', type: 'line', data: dates.map(d => byDate[d].i - byDate[d].o), itemStyle: { color: '#F26522' }, smooth: true, lineStyle: { width: 2 }, symbol: 'circle', symbolSize: 5 },
        ],
      });
    }
    window.addEventListener('resize', () => chart.resize());
  }

  const pieDom = document.getElementById('chartFlowPie');
  if (pieDom) {
    const chart = echarts.init(pieDom);
    const flowByType = { '经营性流入': 0, '投资性流入': 0, '融资性流入': 0, '经营性流出': 0, '投资性流出': 0, '融资性流出': 0 };
    records.forEach(r => {
      if (r.currency && r.currency !== 'CNY') return;
      const sub = Store.subjects.find(s => s.id === r.biz_id);
      const cat = sub ? sub.name : (r.amount > 0 ? '经营性流入' : '经营性流出');
      if (flowByType[cat] !== undefined) flowByType[cat] += Math.abs(r.amount);
      else if (r.amount > 0) flowByType['经营性流入'] += r.amount;
      else flowByType['经营性流出'] += Math.abs(r.amount);
    });
    const s = Store.stats || {};
    if (!Object.values(flowByType).some(v => v > 0)) {
      flowByType['经营性流入'] = (s.total_inflow || 0) * 0.6;
      flowByType['投资性流入'] = (s.total_inflow || 0) * 0.15;
      flowByType['融资性流入'] = (s.total_inflow || 0) * 0.25;
      flowByType['经营性流出'] = (s.total_outflow || 0) * 0.55;
      flowByType['投资性流出'] = (s.total_outflow || 0) * 0.2;
      flowByType['融资性流出'] = (s.total_outflow || 0) * 0.25;
    }
    chart.setOption({
      tooltip: { trigger: 'item', formatter: '{b}<br/>{c} ({d}%)' },
      legend: { bottom: 4, textStyle: { fontSize: 11, color: '#737373' } },
      color: ['#22C55E', '#F26522', '#3B82F6', '#EF4444', '#EA580C', '#737373'],
      series: [{ type: 'pie', radius: ['38%', '66%'], center: ['50%', '44%'], label: { formatter: '{b}\n{d}%', fontSize: 11, color: '#737373' },
        data: Object.entries(flowByType).filter(([,v]) => v > 0).map(([k,v]) => ({ name: k, value: Math.round(v) })),
      }],
    });
    window.addEventListener('resize', () => chart.resize());
  }
}

function renderDashAlerts() {
  const s = Store.stats || {};
  const alerts = [];
  const row = (cls, onclick, iconKey, text) =>
    `<div class="insight-card ${cls}"${onclick ? ` onclick="${onclick}"` : ''}><span class="insight-card-ico">${uiIcon(iconKey)}</span><span class="insight-card-txt">${text}</span></div>`;
  if ((s.unconfirmed || 0) > 0) alerts.push(row('warn', "navigateTo('cashflow')", 'alertTriangle', `${s.unconfirmed} 笔未确认资金流待处理`));
  if ((s.predicted || 0) > 0) alerts.push(row('info', "navigateTo('cashflow')", 'bars', `${s.predicted} 笔预测数据待确认`));
  const unh = Store.fxExposures.filter(e => e.hedge_ratio === 0).length;
  if (unh > 0) alerts.push(row('danger', "navigateTo('fx')", 'activity', `${unh} 笔外汇敞口未对冲`));
  const drafts = Store.plans.filter(p => p.status === '草稿').length;
  if (drafts > 0) alerts.push(row('warn', "navigateTo('plan')", 'clipboard', `${drafts} 个计划待提交`));
  const payWait = (Store.paymentPool || []).filter(p => p.status === '待排程' || p.status === '队列中').length;
  if (payWait > 0) alerts.push(row('warn', "navigateTo('payment')", 'zap', `${payWait} 笔付款待排程或队列中`));
  const fa = (Store.fundAlerts || []).filter(a => a.level === '高').length;
  if (fa > 0) alerts.push(row('danger', "navigateTo('alerts')", 'alertTriangle', `${fa} 条高优先级资金预警`));
  if (!alerts.length) alerts.push(row('success', null, 'check', '暂无告警'));
  $('#dashAlerts').innerHTML = alerts.join('');
}

/* ════════════════════════════════════════════
   Cashflow Page — 资金流管理 — Full CRUD + Filters
   ════════════════════════════════════════════ */
function renderCashflow() {
  let recs = Store.records.items || [];
  const pg = $('#page-cashflow');
  pg.innerHTML = `
    <div class="page-header-bar">
      <div><div class="page-title">资金流管理</div><div class="page-subtitle">集合 · 单据 · 多币种 · 状态流转</div></div>
      <div class="page-actions">
        <button class="btn" id="cfBtnFetch">获取数据</button>
        <button class="btn" id="cfBtnBatchConfirm">批量确认</button>
        <button class="btn" id="cfBtnExport">↗ 导出 CSV</button>
        <button class="btn btn-primary" id="cfBtnAdd">+ 新增单据</button>
      </div>
    </div>
    <div class="page-scroll">
      ${wbCrumb()}
      <div class="filter-bar">
        <label>单位</label><select class="form-select" id="cfFilterUnit"><option value="">全部</option>${(Store.stats?.units || ['总部','华东子公司','华南子公司']).map(u => `<option>${u}</option>`).join('')}</select>
        <label>状态</label><select class="form-select" id="cfFilterStatus"><option value="">全部</option><option>已确认</option><option>未确认</option><option>预测</option></select>
        <label>币种</label><select class="form-select" id="cfFilterCurrency"><option value="">全部</option><option>CNY</option><option>USD</option><option>EUR</option></select>
        <label>日期</label><input class="form-input" type="date" id="cfDateFrom" style="width:130px;"><span>~</span><input class="form-input" type="date" id="cfDateTo" style="width:130px;">
        <button class="btn btn-sm btn-primary" id="cfBtnQuery">查询</button>
        <button class="btn btn-sm" id="cfBtnReset">重置</button>
      </div>
      <div class="card"><div class="card-body-flush">
        <table class="data-table"><thead><tr><th><input type="checkbox" id="cfCheckAll"></th><th>编号</th><th>单位</th><th>币种</th><th>金额</th><th>交易日期</th><th>状态</th><th>来源</th><th>操作</th></tr></thead>
        <tbody id="cfTableBody"></tbody></table>
      </div></div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
        <span style="font-size:12px;color:var(--gray-500);">共 <strong id="cfTotal">0</strong> 条</span>
      </div>
    </div>`;

  function renderTable(data) {
    const tbody = $('#cfTableBody');
    tbody.innerHTML = data.map(r => `<tr data-id="${r.id}">
      <td><input type="checkbox" class="cf-check" data-id="${r.id}"></td>
      <td>${r.code || '-'}</td><td>${r.unit}</td><td>${r.currency}</td>
      <td class="num ${r.amount > 0 ? 'positive' : 'negative'}">${fmtAmt(r.amount)}</td>
      <td>${r.trade_date || '-'}</td>
      <td><span class="badge ${r.status === '已确认' ? 'badge-green' : r.status === '预测' ? 'badge-orange' : 'badge-gray'}">${r.status}</span></td>
      <td>${r.source_system || '-'}</td>
      <td class="row-actions">
        ${r.status !== '已确认' ? `<button class="row-action-btn" onclick="confirmRecord(${r.id})">确认</button>` : ''}
        <button class="row-action-btn danger" onclick="deleteRecord(${r.id})">删除</button>
      </td>
    </tr>`).join('');
    $('#cfTotal').textContent = data.length;
  }

  function applyFilters() {
    let data = Store.records.items || [];
    const unit = $('#cfFilterUnit').value;
    const status = $('#cfFilterStatus').value;
    const currency = $('#cfFilterCurrency').value;
    const from = $('#cfDateFrom').value;
    const to = $('#cfDateTo').value;
    if (unit) data = data.filter(r => r.unit === unit);
    if (status) data = data.filter(r => r.status === status);
    if (currency) data = data.filter(r => r.currency === currency);
    if (from) data = data.filter(r => r.trade_date >= from);
    if (to) data = data.filter(r => r.trade_date <= to);
    renderTable(data);
  }

  renderTable(recs);

  $('#cfBtnQuery')?.addEventListener('click', applyFilters);
  $('#cfBtnReset')?.addEventListener('click', () => {
    ['cfFilterUnit','cfFilterStatus','cfFilterCurrency'].forEach(id => { const el = $(`#${id}`); if (el) el.value = ''; });
    ['cfDateFrom','cfDateTo'].forEach(id => { const el = $(`#${id}`); if (el) el.value = ''; });
    renderTable(Store.records.items || []);
  });

  $('#cfCheckAll')?.addEventListener('change', e => {
    $$('.cf-check').forEach(cb => cb.checked = e.target.checked);
  });

  $('#cfBtnBatchConfirm')?.addEventListener('click', async () => {
    const ids = [...$$('.cf-check:checked')].map(cb => parseInt(cb.dataset.id));
    if (!ids.length) { Toast.warn('请先勾选要确认的单据'); return; }
    for (const id of ids) {
      const r = (Store.records.items || []).find(x => x.id === id);
      if (r) {
        r.status = '已确认';
        try { await api.put(`/api/records/${id}`, { ...r }); } catch {}
      }
    }
    renderCashflow();
    Toast.success(`已确认 ${ids.length} 笔单据`);
  });

  $('#cfBtnFetch')?.addEventListener('click', async () => {
    Toast.info('正在从集成系统获取数据...');
    try {
      const res = await api.post('/api/integrations/fetch', { units: [], source_system: '资金管理系统' });
      Toast.success(`获取成功：${res.records_created} 条记录`);
      await loadAllData(); renderCashflow();
    } catch { Toast.warn('获取数据失败（离线模式）'); }
  });

  $('#cfBtnExport')?.addEventListener('click', () => {
    const data = Store.records.items || [];
    const csv = '编号,单位,币种,金额,日期,状态,来源\n' + data.map(r => `${r.code},${r.unit},${r.currency},${r.amount},${r.trade_date},${r.status},${r.source_system}`).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'cashflow_export.csv'; a.click();
    Toast.success('导出成功');
  });

  $('#cfBtnAdd')?.addEventListener('click', () => {
    openModal('新增资金流单据', `
      <div style="display:grid;gap:12px;">
        <div class="form-group"><div class="form-label">单位 *</div><select class="form-select form-input-full" id="newRecUnit"><option>总部</option><option>华东子公司</option><option>华南子公司</option></select></div>
        <div class="form-group"><div class="form-label">币种</div><select class="form-select form-input-full" id="newRecCurrency"><option>CNY</option><option>USD</option><option>EUR</option></select></div>
        <div class="form-group"><div class="form-label">金额 *</div><input class="form-input form-input-full" id="newRecAmount" type="number" placeholder="正数=流入，负数=流出"></div>
        <div class="form-group"><div class="form-label">交易日期 *</div><input class="form-input form-input-full" id="newRecDate" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
        <div class="form-group"><div class="form-label">状态</div><select class="form-select form-input-full" id="newRecStatus"><option>预测</option><option>未确认</option><option>已确认</option></select></div>
      </div>`, `<button class="btn" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="submitNewRecord()">创建</button>`);
  });
}

window.confirmRecord = async function(id) {
  const r = (Store.records.items || []).find(x => x.id === id);
  if (r) { r.status = '已确认'; try { await api.put(`/api/records/${id}`, r); } catch {} }
  renderCashflow();
  Toast.success('已确认');
};

window.deleteRecord = async function(id) {
  if (!confirm('确认删除该单据？')) return;
  try { await api.del(`/api/records/${id}`); } catch {}
  Store.records.items = (Store.records.items || []).filter(x => x.id !== id);
  renderCashflow();
  Toast.success('已删除');
};

window.submitNewRecord = async function() {
  const body = { unit: $('#newRecUnit').value, currency: $('#newRecCurrency').value, amount: parseFloat($('#newRecAmount').value) || 0, trade_date: $('#newRecDate').value, status: $('#newRecStatus').value, source_system: '手工新增' };
  if (!body.amount) { Toast.warn('请输入金额'); return; }
  try { const res = await api.post('/api/records', body); Store.records.items.unshift(res); } catch { Store.records.items.unshift({ id: Date.now(), code: 'CF-NEW-' + Date.now(), ...body }); }
  Store.records.total++;
  closeModal(); renderCashflow(); Toast.success('单据创建成功');
};

/* ════════════════════════════════════════════
   Analysis Page — 分析预测 — Full Results + Export
   ════════════════════════════════════════════ */
function renderAnalysis() {
  const pg = $('#page-analysis');
  const tpOptions = Store.timePeriods.map(t => `<option value="${t.code}">${t.name}</option>`).join('') || '<option value="TP0001">标准复合周期</option>';
  pg.innerHTML = `
    <div class="page-header-bar">
      <div><div class="page-title">资金分析与预测</div><div class="page-subtitle">复合区间 · 头寸递推 · 科目矩阵</div></div>
      <div class="page-actions">
        <button class="btn" id="anBtnExport">↗ 导出报告</button>
        <button class="btn btn-primary" id="anBtnSendPlan">下发至计划</button>
      </div>
    </div>
    <div class="page-scroll">
      ${wbCrumb()}
      <div class="filter-bar">
        <label>单位</label><select class="form-select" id="anUnit"><option value="">全部</option>${(Store.stats?.units || []).map(u => `<option>${u}</option>`).join('')}</select>
        <label>期初余额</label><input class="form-input" id="anOpening" type="number" value="10000000" style="width:130px;">
        <label>时段配置</label><select class="form-select" id="anPeriodCode">${tpOptions}</select>
        <button class="btn btn-primary" id="anBtnRun">▶ 运行分析</button>
        <button class="btn" type="button" id="anBtnMlTs" title="调用后端 /api/ml/timeseries/from-records">Prophet+LSTM 日净额</button>
      </div>
      <div class="chart-card"><div class="chart-card-title">头寸走势预测</div><div id="chartAnalysis" style="height:400px;"></div></div>
      <div class="card" id="mlForecastCard"><div class="card-header"><div class="card-title">ML 时序预测（后端 Prophet / LSTM）</div></div><div class="card-body" id="mlForecastBody"><p class="empty-state" style="margin:0;">基于资金流日净额聚合；点击上方按钮拉取。不可用时自动降级为统计基线 / sklearn MLP。</p></div></div>
      <div class="card" id="analysisResult"><div class="card-header"><div class="card-title">分析结果</div></div><div class="card-body"><div class="empty-state">点击「运行分析」生成预测报告</div></div></div>
      ${Store.analysisReports.length ? `<div class="card"><div class="card-header"><div class="card-title">历史报告</div></div><div class="card-body-flush">
        <table class="data-table"><thead><tr><th>编号</th><th>创建时间</th><th>操作</th></tr></thead><tbody>
        ${Store.analysisReports.slice(0,10).map(r => `<tr><td>${r.code || r.id}</td><td>${r.created_at || '-'}</td><td><button class="row-action-btn" onclick="loadAnalysisReport(${r.id})">查看</button></td></tr>`).join('')}
        </tbody></table></div></div>` : ''}
    </div>`;

  let lastResult = null;

  $('#anBtnRun')?.addEventListener('click', async () => {
    Toast.info('正在运行分析...');
    try {
      const body = { unit: $('#anUnit').value || null, opening_balance: parseFloat($('#anOpening').value) || 10000000, period_config_code: $('#anPeriodCode').value || 'TP0001' };
      const result = await api.post('/api/analysis/run', body);
      lastResult = result; Store.analysisResult = result; Toast.success('分析完成');
      renderAnalysisResult(result);
      showAnalysisDetail(result);
    } catch {
      Toast.warn('分析引擎离线，使用模拟数据');
      lastResult = mockAnalysis(); Store.analysisResult = lastResult;
      renderAnalysisResult(lastResult);
      showAnalysisDetail(lastResult);
    }
  });

  $('#anBtnMlTs')?.addEventListener('click', async () => {
    const u = $('#anUnit')?.value || '';
    Toast.info('正在请求 Prophet / LSTM …');
    try {
      const q = u ? `?unit=${encodeURIComponent(u)}&horizon=14` : '?horizon=14';
      const res = await api.get('/api/ml/timeseries/from-records' + q);
      const body = $('#mlForecastBody');
      if (body) {
        const fc = res.forecast || {};
        const pm = fc.prophet?.meta || {};
        const lm = fc.lstm?.meta || {};
        body.innerHTML = `<p style="font-size:12px;color:var(--gray-500);margin:0 0 8px;">单位：<strong>${escHtml(String(res.unit || ''))}</strong> · 历史点 ${res.series?.dates?.length || 0}</p>
          <div style="font-size:11px;color:var(--gray-600);margin-bottom:8px;">Prophet：${escHtml(JSON.stringify(pm))} · LSTM：${escHtml(JSON.stringify(lm))}</div>
          <pre style="font-size:11px;white-space:pre-wrap;max-height:280px;overflow:auto;margin:0;">${escHtml(JSON.stringify(fc, null, 2))}</pre>`;
      }
      Toast.success('ML 预测已返回');
    } catch (e) {
      Toast.warn('ML 接口不可用（请确认后端已启动且已安装 numpy/sklearn 等）');
    }
  });

  $('#anBtnExport')?.addEventListener('click', () => {
    if (!lastResult) { Toast.warn('请先运行分析'); return; }
    const periods = lastResult.periods || [];
    const pos = lastResult.position || {};
    let csv = '时段,期初余额,流入,流出,期末余额\n';
    periods.forEach((p, i) => { csv += `${p.label},${pos.opening?.[i]||0},${pos.inflow?.[i]||0},${pos.outflow?.[i]||0},${pos.closing?.[i]||0}\n`; });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'analysis_report.csv'; a.click();
    Toast.success('报告已导出');
  });

  $('#anBtnSendPlan')?.addEventListener('click', async () => {
    if (!lastResult) { Toast.warn('请先运行分析'); return; }
    Toast.info('正在下发至资金计划...');
    try {
      const body = { unit: $('#anUnit').value || '总部', period_type: '月', period_label: '分析下发-' + new Date().toISOString().slice(0,7), data_json: JSON.stringify(lastResult.position || {}), status: '草稿', data_source: '分析下发' };
      const res = await api.post('/api/plans', body);
      Store.plans.push(res);
    } catch {
      Store.plans.push({ id: Date.now(), unit: '总部', period_type: '月', period_label: '分析下发', status: '草稿', data_json: '{}', data_source: '分析下发' });
    }
    Toast.success('已下发至资金计划');
  });
}

function showAnalysisDetail(result) {
  if (!result || !result.periods) return;
  const pos = result.position || {};
  const card = $('#analysisResult');
  if (!card) return;
  card.innerHTML = `<div class="card-header"><div class="card-title">分析结果 · 科目×时间段矩阵</div></div>
    <div class="card-body-flush"><table class="data-table"><thead><tr><th>时段</th><th>期初余额</th><th>流入</th><th>流出</th><th>净额</th><th>期末余额</th></tr></thead><tbody>
    ${result.periods.map((p, i) => `<tr>
      <td>${p.label}</td>
      <td class="num">${fmtAmt(pos.opening?.[i])}</td>
      <td class="num positive">${fmtAmt(pos.inflow?.[i])}</td>
      <td class="num negative">${fmtAmt(pos.outflow?.[i])}</td>
      <td class="num">${fmtAmt((pos.inflow?.[i]||0) - (pos.outflow?.[i]||0))}</td>
      <td class="num" style="font-weight:600;">${fmtAmt(pos.closing?.[i])}</td>
    </tr>`).join('')}
    </tbody></table></div>`;
}

window.loadAnalysisReport = async function(id) {
  try {
    const result = await api.get(`/api/analysis/reports/${id}`);
    const parsed = result.result || (result.result_json ? JSON.parse(result.result_json) : null);
    if (parsed) { renderAnalysisResult(parsed); showAnalysisDetail(parsed); Toast.success('报告已加载'); }
  } catch { Toast.danger('加载失败'); }
};

function mockAnalysis() {
  const periods = []; const pos = { opening: [], closing: [], inflow: [], outflow: [] };
  const labels = ['D1','D2','D3','D4','D5','D6','D7','W1','W2','W3','W4','M1','M2','M3'];
  let bal = 10000000;
  labels.forEach(l => {
    periods.push({ label: l }); pos.opening.push(bal);
    const inf = Math.random() * 3000000 + 500000, out = Math.random() * 2500000 + 400000;
    pos.inflow.push(Math.round(inf)); pos.outflow.push(Math.round(out));
    bal = bal + inf - out; pos.closing.push(Math.round(bal));
  });
  return { periods, position: pos };
}

function renderAnalysisResult(result) {
  if (!result || !result.periods) return;
  const dom = document.getElementById('chartAnalysis');
  if (dom && typeof echarts !== 'undefined') {
    const chart = echarts.init(dom);
    const labels = result.periods.map(p => p.label);
    const pos = result.position || {};
    chart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['期末余额', '流入', '流出'], top: 4, textStyle: { fontSize: 11, color: '#737373' } },
      grid: { top: 36, right: 20, bottom: 46, left: 14, containLabel: true },
      xAxis: { type: 'category', data: labels, axisLabel: { fontSize: 10, color: '#a3a3a3', rotate: labels.length > 10 ? 35 : 0 } },
      yAxis: { type: 'value', axisLabel: { formatter: v => (v/1e4).toFixed(0) + '万', fontSize: 10, color: '#a3a3a3' }, splitLine: { lineStyle: { color: '#e5e5e5', type: 'dashed' } } },
      series: [
        { name: '期末余额', type: 'line', data: pos.closing || [], itemStyle: { color: '#F26522' }, smooth: true, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{offset:0,color:'rgba(242,101,34,.18)'},{offset:1,color:'rgba(242,101,34,.01)'}] } }, lineStyle: { width: 2.5 }, symbol: 'circle', symbolSize: 5 },
        { name: '流入', type: 'bar', data: pos.inflow || [], itemStyle: { color: '#22C55E', borderRadius: [2,2,0,0] }, barMaxWidth: 16 },
        { name: '流出', type: 'bar', data: (pos.outflow || []).map(v => -v), itemStyle: { color: '#EF4444', borderRadius: [0,0,2,2] }, barMaxWidth: 16 },
      ],
    });
    window.addEventListener('resize', () => chart.resize());
  }
}

/* ════════════════════════════════════════════
   Plan Page — 资金计划 — Full Features
   ════════════════════════════════════════════ */
function renderPlan() {
  const pg = $('#page-plan');
  pg.innerHTML = `
    <div class="page-header-bar">
      <div><div class="page-title">资金计划</div><div class="page-subtitle">编制 · 审批 · 执行对比 · 偏差分析</div></div>
      <div class="page-actions"><button class="btn" id="planBtnFillCf">从资金流取数</button><button class="btn btn-primary" id="planBtnNew">+ 新建计划</button></div>
    </div>
    <div class="page-scroll">
      ${wbCrumb()}
      <div class="card"><div class="card-header"><div class="card-title">计划明细</div></div><div class="card-body-flush">
        <table class="data-table"><thead><tr><th>单位</th><th>周期</th><th>期间</th><th>数据来源</th><th>状态</th><th>操作</th></tr></thead><tbody>
        ${Store.plans.map(p => `<tr>
          <td>${p.unit}</td><td>${p.period_type}</td><td>${p.period_label}</td><td>${p.data_source || '手工'}</td>
          <td><span class="badge ${p.status === '草稿' ? 'badge-gray' : p.status === '已提交' ? 'badge-orange' : p.status === '已审批' ? 'badge-green' : 'badge-orange'}">${p.status}</span></td>
          <td class="row-actions">
            ${p.status === '草稿' ? `<button class="row-action-btn" onclick="submitPlan(${p.id})">提交</button>` : ''}
            ${p.status === '已提交' ? `<button class="row-action-btn" onclick="approvePlan(${p.id})">审批</button>` : ''}
            ${p.status === '草稿' ? `<button class="row-action-btn" onclick="editPlanData(${p.id})">编辑</button>` : ''}
            <button class="row-action-btn" onclick="viewPlanDetail(${p.id})">详情</button>
            <button class="row-action-btn danger" onclick="deletePlan(${p.id})">删除</button>
          </td>
        </tr>`).join('')}</tbody></table>
      </div></div>
      <div class="chart-card"><div class="chart-card-title">计划 vs 实际对比</div><div id="chartPlanCompare" style="height:340px;"></div></div>
    </div>`;
  renderPlanChart();

  $('#planBtnNew')?.addEventListener('click', () => {
    openModal('新建资金计划', `
      <div style="display:grid;gap:12px;">
        <div class="form-group"><div class="form-label">单位</div><select class="form-select form-input-full" id="newPlanUnit"><option>总部</option><option>华东子公司</option><option>华南子公司</option></select></div>
        <div class="form-group"><div class="form-label">周期</div><select class="form-select form-input-full" id="newPlanType"><option>月</option><option>周</option><option>季</option></select></div>
        <div class="form-group"><div class="form-label">期间</div><input class="form-input form-input-full" id="newPlanLabel" value="2026年5月"></div>
      </div>`, `<button class="btn" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="createPlan()">创建</button>`);
  });

  $('#planBtnFillCf')?.addEventListener('click', async () => {
    const draftPlans = Store.plans.filter(p => p.status === '草稿');
    if (!draftPlans.length) { Toast.warn('没有草稿计划可以填充'); return; }
    Toast.info('正在从资金流数据填充计划...');
    for (const p of draftPlans) {
      try { const res = await api.post(`/api/plans/${p.id}/fill-from-cashflow`); if (res.data) p.data_json = JSON.stringify(res.data); } catch {}
    }
    renderPlan();
    Toast.success(`已填充 ${draftPlans.length} 个草稿计划`);
  });
}

window.submitPlan = async function(pid) {
  const p = Store.plans.find(x => x.id === pid);
  if (p) { p.status = '已提交'; try { await api.put(`/api/plans/${pid}`, { ...p }); } catch {} }
  renderPlan(); Toast.success('计划已提交');
};

window.approvePlan = async function(pid) {
  const p = Store.plans.find(x => x.id === pid);
  if (p) { p.status = '已审批'; try { await api.put(`/api/plans/${pid}`, { ...p }); } catch {} }
  renderPlan(); Toast.success('计划已审批');
};

window.deletePlan = async function(pid) {
  if (!confirm('确认删除该计划？')) return;
  try { await api.del(`/api/plans/${pid}`); } catch {}
  Store.plans = Store.plans.filter(x => x.id !== pid);
  renderPlan(); Toast.success('已删除');
};

window.viewPlanDetail = function(pid) {
  const p = Store.plans.find(x => x.id === pid);
  if (!p) return;
  let data = {}; try { data = JSON.parse(p.data_json || '{}'); } catch {}
  const rows = Object.entries(data).map(([k,v]) => `<tr><td>${k}</td><td class="num">${fmtAmt(Math.abs(v))}</td></tr>`).join('');
  openModal(`计划详情 · ${p.unit} ${p.period_label}`, `
    <div style="margin-bottom:12px;"><span class="badge ${p.status === '草稿' ? 'badge-gray' : 'badge-green'}">${p.status}</span> <span style="font-size:12px;color:var(--gray-500);margin-left:8px;">来源: ${p.data_source || '手工'}</span></div>
    <table class="data-table"><thead><tr><th>科目</th><th>金额</th></tr></thead><tbody>${rows || '<tr><td colspan="2" class="empty-state">暂无数据</td></tr>'}</tbody></table>
  `);
};

window.editPlanData = function(pid) {
  const p = Store.plans.find(x => x.id === pid);
  if (!p) return;
  let data = {}; try { data = JSON.parse(p.data_json || '{}'); } catch {}
  const fields = ['经营性流入','经营性流出','投资性流入','投资性流出','融资性流入','融资性流出'];
  const inputs = fields.map(f => `<div class="form-group"><div class="form-label">${f}</div><input class="form-input form-input-full" id="pe_${f.replace(/\//g,'_')}" type="number" value="${Math.abs(data[f] || 0)}"></div>`).join('');
  openModal(`编辑计划 · ${p.unit} ${p.period_label}`, `<div style="display:grid;gap:12px;">${inputs}</div>`,
    `<button class="btn" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="savePlanEdit(${pid})">保存</button>`);
};

window.savePlanEdit = async function(pid) {
  const p = Store.plans.find(x => x.id === pid);
  if (!p) return;
  const fields = ['经营性流入','经营性流出','投资性流入','投资性流出','融资性流入','融资性流出'];
  const data = {};
  fields.forEach(f => { const el = $(`#pe_${f.replace(/\//g,'_')}`); if (el) data[f] = parseFloat(el.value) || 0; });
  p.data_json = JSON.stringify(data);
  try { await api.put(`/api/plans/${pid}`, { ...p }); } catch {}
  closeModal(); renderPlan(); Toast.success('计划已保存');
};

window.createPlan = async function() {
  const body = { unit: $('#newPlanUnit').value, period_type: $('#newPlanType').value, period_label: $('#newPlanLabel').value, data_json: '{}', status: '草稿', data_source: '手工' };
  try { const res = await api.post('/api/plans', body); Store.plans.push(res); } catch { Store.plans.push({ id: Date.now(), ...body }); }
  closeModal(); renderPlan(); Toast.success('计划创建成功');
};

function renderPlanChart() {
  const dom = document.getElementById('chartPlanCompare');
  if (!dom || typeof echarts === 'undefined') return;
  const chart = echarts.init(dom);
  const units = [...new Set(Store.plans.map(p => p.unit))];
  const records = Store.records.items || [];

  const planIn = units.map(u => { const p = Store.plans.find(x => x.unit === u); if (!p) return 0; try { const d = JSON.parse(p.data_json); return Math.abs(d['经营性流入'] || 0) + Math.abs(d['投资性流入'] || 0) + Math.abs(d['融资性流入'] || 0); } catch { return 0; } });
  const planOut = units.map(u => { const p = Store.plans.find(x => x.unit === u); if (!p) return 0; try { const d = JSON.parse(p.data_json); return Math.abs(d['经营性流出'] || 0) + Math.abs(d['投资性流出'] || 0) + Math.abs(d['融资性流出'] || 0); } catch { return 0; } });
  const actualIn = units.map(u => records.filter(r => r.unit === u && r.amount > 0 && r.status === '已确认').reduce((s, r) => s + r.amount, 0));
  const actualOut = units.map(u => records.filter(r => r.unit === u && r.amount < 0 && r.status === '已确认').reduce((s, r) => s + Math.abs(r.amount), 0));

  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['计划流入', '实际流入', '计划流出', '实际流出'], top: 4, textStyle: { fontSize: 11 } },
    grid: { top: 36, right: 20, bottom: 12, left: 14, containLabel: true },
    xAxis: { type: 'category', data: units },
    yAxis: { type: 'value', axisLabel: { formatter: v => (v/1e4).toFixed(0) + '万', fontSize: 10 }, splitLine: { lineStyle: { color: '#e5e5e5', type: 'dashed' } } },
    series: [
      { name: '计划流入', type: 'bar', data: planIn, itemStyle: { color: 'rgba(34,197,94,0.4)', borderRadius: [4,4,0,0] }, barMaxWidth: 20 },
      { name: '实际流入', type: 'bar', data: actualIn, itemStyle: { color: '#22C55E', borderRadius: [4,4,0,0] }, barMaxWidth: 20 },
      { name: '计划流出', type: 'bar', data: planOut, itemStyle: { color: 'rgba(239,68,68,0.4)', borderRadius: [4,4,0,0] }, barMaxWidth: 20 },
      { name: '实际流出', type: 'bar', data: actualOut, itemStyle: { color: '#EF4444', borderRadius: [4,4,0,0] }, barMaxWidth: 20 },
    ],
  });
  window.addEventListener('resize', () => chart.resize());
}

/* ════════════════════════════════════════════
   FX Page — 外汇敞口 — Full CRUD
   ════════════════════════════════════════════ */
function renderFx() {
  const fx = Store.fxExposures || [];
  const pg = $('#page-fx');
  pg.innerHTML = `
    <div class="page-header-bar">
      <div><div class="page-title">外汇敞口</div><div class="page-subtitle">台账 · 对冲 · 损益追踪</div></div>
      <div class="page-actions"><button class="btn btn-primary" id="fxBtnAdd">+ 新增敞口</button></div>
    </div>
    <div class="page-scroll">
      ${wbCrumb()}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="chart-card"><div class="chart-card-title">敞口分布（按币对）</div><div id="chartFxDist" style="height:300px;"></div></div>
        <div class="chart-card"><div class="chart-card-title">对冲比率</div><div id="chartFxHedge" style="height:300px;"></div></div>
      </div>
      <div class="card"><div class="card-header"><div class="card-title">敞口明细</div></div><div class="card-body-flush">
        <table class="data-table"><thead><tr><th>币对</th><th>名义金额</th><th>方向</th><th>到期日</th><th>对冲比率</th><th>工具</th><th>损益</th><th>状态</th><th>操作</th></tr></thead><tbody>
        ${fx.map(e => `<tr>
          <td>${e.currency_pair}</td><td class="num">${fmtAmt(e.notional)}</td><td>${e.direction}</td><td>${e.maturity || '-'}</td>
          <td><div style="display:flex;align-items:center;gap:6px;"><div style="flex:1;height:6px;background:var(--gray-200);border-radius:3px;"><div style="height:100%;width:${(e.hedge_ratio*100).toFixed(0)}%;background:${e.hedge_ratio >= 0.6 ? 'var(--green-500)' : e.hedge_ratio >= 0.3 ? 'var(--orange-500)' : 'var(--red-500)'};border-radius:3px;"></div></div><span style="font-size:12px;">${(e.hedge_ratio*100).toFixed(0)}%</span></div></td>
          <td>${e.instrument}</td>
          <td class="num ${e.pnl > 0 ? 'positive' : e.pnl < 0 ? 'negative' : ''}">${fmtAmt(e.pnl)}</td>
          <td><span class="badge ${e.status === '持有' ? 'badge-green' : 'badge-red'}">${e.status}</span></td>
          <td class="row-actions"><button class="row-action-btn" onclick="editFxExposure(${e.id})">编辑</button></td>
        </tr>`).join('')}</tbody></table>
      </div></div>
    </div>`;
  renderFxCharts();

  $('#fxBtnAdd')?.addEventListener('click', () => {
    openModal('新增外汇敞口', `
      <div style="display:grid;gap:12px;">
        <div class="form-group"><div class="form-label">币对</div><select class="form-select form-input-full" id="fxPair"><option>USD/CNY</option><option>EUR/CNY</option><option>GBP/CNY</option><option>JPY/CNY</option><option>SAR/CNY</option></select></div>
        <div class="form-group"><div class="form-label">名义金额</div><input class="form-input form-input-full" id="fxNotional" type="number" placeholder="名义金额"></div>
        <div class="form-group"><div class="form-label">方向</div><select class="form-select form-input-full" id="fxDir"><option>买入</option><option>卖出</option></select></div>
        <div class="form-group"><div class="form-label">到期日</div><input class="form-input form-input-full" id="fxMaturity" type="date"></div>
        <div class="form-group"><div class="form-label">对冲工具</div><select class="form-select form-input-full" id="fxInstr"><option>远期</option><option>期权</option><option>掉期</option><option>无对冲</option></select></div>
        <div class="form-group"><div class="form-label">对冲比率 (0-1)</div><input class="form-input form-input-full" id="fxHedge" type="number" step="0.01" value="0" min="0" max="1"></div>
      </div>`, `<button class="btn" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="createFxExposure()">创建</button>`);
  });
}

window.createFxExposure = async function() {
  const body = {
    currency_pair: $('#fxPair').value, notional: parseFloat($('#fxNotional').value) || 0,
    direction: $('#fxDir').value, maturity: $('#fxMaturity').value, instrument: $('#fxInstr').value,
    hedge_ratio: parseFloat($('#fxHedge').value) || 0, pnl: 0, status: parseFloat($('#fxHedge').value) > 0 ? '持有' : '未对冲',
  };
  if (!body.notional) { Toast.warn('请输入名义金额'); return; }
  try { const res = await api.post('/api/fx-exposures', body); Store.fxExposures.push(res); } catch { Store.fxExposures.push({ id: Date.now(), ...body }); }
  closeModal(); renderFx(); Toast.success('敞口创建成功');
};

window.editFxExposure = function(id) {
  const e = Store.fxExposures.find(x => x.id === id);
  if (!e) return;
  openModal(`编辑敞口 · ${e.currency_pair}`, `
    <div style="display:grid;gap:12px;">
      <div class="form-group"><div class="form-label">对冲比率</div><input class="form-input form-input-full" id="editFxHedge" type="number" step="0.01" value="${e.hedge_ratio}" min="0" max="1"></div>
      <div class="form-group"><div class="form-label">对冲工具</div><select class="form-select form-input-full" id="editFxInstr"><option ${e.instrument==='远期'?'selected':''}>远期</option><option ${e.instrument==='期权'?'selected':''}>期权</option><option ${e.instrument==='掉期'?'selected':''}>掉期</option><option ${e.instrument==='无对冲'?'selected':''}>无对冲</option></select></div>
      <div class="form-group"><div class="form-label">损益</div><input class="form-input form-input-full" id="editFxPnl" type="number" value="${e.pnl}"></div>
    </div>`, `<button class="btn" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="saveFxEdit(${id})">保存</button>`);
};

window.saveFxEdit = function(id) {
  const e = Store.fxExposures.find(x => x.id === id);
  if (!e) return;
  e.hedge_ratio = parseFloat($('#editFxHedge').value) || 0;
  e.instrument = $('#editFxInstr').value;
  e.pnl = parseFloat($('#editFxPnl').value) || 0;
  e.status = e.hedge_ratio > 0 ? '持有' : '未对冲';
  closeModal(); renderFx(); Toast.success('敞口已更新');
};

function renderFxCharts() {
  if (typeof echarts === 'undefined') return;
  const fx = Store.fxExposures || [];
  const distDom = document.getElementById('chartFxDist');
  if (distDom) {
    const chart = echarts.init(distDom);
    const byPair = {}; fx.forEach(e => { byPair[e.currency_pair] = (byPair[e.currency_pair] || 0) + e.notional; });
    chart.setOption({
      tooltip: { trigger: 'item' }, color: ['#F26522', '#EA580C', '#FB923C', '#22C55E', '#737373'],
      series: [{ type: 'pie', radius: ['38%', '66%'], center: ['50%', '50%'], label: { formatter: '{b}\n{d}%', fontSize: 11 },
        data: Object.entries(byPair).map(([k, v]) => ({ name: k, value: v })) }],
    });
    window.addEventListener('resize', () => chart.resize());
  }
  const hedgeDom = document.getElementById('chartFxHedge');
  if (hedgeDom) {
    const chart = echarts.init(hedgeDom);
    chart.setOption({
      grid: { top: 12, right: 40, bottom: 16, left: 14, containLabel: true },
      xAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%', fontSize: 10, color: '#a3a3a3' } },
      yAxis: { type: 'category', data: fx.map(e => e.currency_pair + ' ' + e.direction), axisLabel: { fontSize: 11, fontWeight: 500 } },
      series: [{ type: 'bar', data: fx.map(e => ({ value: e.hedge_ratio * 100, itemStyle: { color: e.hedge_ratio >= 0.6 ? '#22C55E' : e.hedge_ratio >= 0.3 ? '#F26522' : '#EF4444', borderRadius: [0,4,4,0] }, label: { show: true, position: 'right', formatter: '{c}%', fontSize: 11 } })), barMaxWidth: 18 }],
    });
    window.addEventListener('resize', () => chart.resize());
  }
}

/* ════════════════════════════════════════════
   Base Data Page — 基础数据 — 5 Tabs
   ════════════════════════════════════════════ */
let bdActiveTab = 'subjects';

function renderBaseData() {
  const pg = $('#page-basedata');
  pg.innerHTML = `
    <div class="page-header-bar"><div><div class="page-title">基础数据</div><div class="page-subtitle">科目 · 业务 · 时间段 · 映射配置</div></div></div>
    <div class="bd-tabs">
      <button class="bd-tab ${bdActiveTab==='subjects'?'active':''}" data-tab="subjects">资金流科目</button>
      <button class="bd-tab ${bdActiveTab==='businesses'?'active':''}" data-tab="businesses">资金业务</button>
      <button class="bd-tab ${bdActiveTab==='timeperiods'?'active':''}" data-tab="timeperiods">时间段配置</button>
      <button class="bd-tab ${bdActiveTab==='catmap'?'active':''}" data-tab="catmap">科目↔业务映射</button>
      <button class="bd-tab ${bdActiveTab==='planmap'?'active':''}" data-tab="planmap">科目↔计划映射</button>
    </div>
    <div class="page-scroll">
      ${wbCrumb()}
      <div id="bdContent"></div>
    </div>`;

  $$('.bd-tab').forEach(t => t.addEventListener('click', () => {
    bdActiveTab = t.dataset.tab;
    $$('.bd-tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    renderBdTab();
  }));
  renderBdTab();
}

function renderBdTab() {
  const c = $('#bdContent');
  switch (bdActiveTab) {
    case 'subjects': renderBdSubjects(c); break;
    case 'businesses': renderBdBusinesses(c); break;
    case 'timeperiods': renderBdTimePeriods(c); break;
    case 'catmap': renderBdCatMap(c); break;
    case 'planmap': renderBdPlanMap(c); break;
  }
}

function renderBdSubjects(c) {
  const roots = Store.subjects.filter(s => !s.parent_id);
  function renderNode(s) {
    const children = Store.subjects.filter(x => x.parent_id === s.id);
    return `<div class="tree-node">
      <button class="tree-expand">${children.length ? '▸' : '·'}</button>
      <span class="tree-code">${s.code}</span>
      <span class="tree-name">${s.name}</span>
      <span class="tree-direction">${s.direction}</span>
      <span class="badge ${s.valid ? 'badge-green' : 'badge-gray'}" style="font-size:10px;">${s.valid ? '有效' : '无效'}</span>
    </div>${children.length ? `<div class="tree-children">${children.map(renderNode).join('')}</div>` : ''}`;
  }
  c.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px;"><button class="btn btn-primary btn-sm" id="bdAddSubject">+ 新增科目</button></div>
    ${roots.map(renderNode).join('') || '<div class="empty-state">暂无科目数据</div>'}`;
  $('#bdAddSubject')?.addEventListener('click', () => {
    openModal('新增资金流科目', `
      <div style="display:grid;gap:12px;">
        <div class="form-group"><div class="form-label">科目编码</div><input class="form-input form-input-full" id="newSubCode" placeholder="如 100001"></div>
        <div class="form-group"><div class="form-label">科目名称</div><input class="form-input form-input-full" id="newSubName" placeholder="如 销售收入"></div>
        <div class="form-group"><div class="form-label">流向</div><select class="form-select form-input-full" id="newSubDir"><option>流入</option><option>流出</option></select></div>
        <div class="form-group"><div class="form-label">上级科目</div><select class="form-select form-input-full" id="newSubParent"><option value="">无（一级科目）</option>${Store.subjects.filter(s => !s.parent_id).map(s => `<option value="${s.id}">${s.code} ${s.name}</option>`).join('')}</select></div>
      </div>`, `<button class="btn" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="createSubject()">创建</button>`);
  });
}

window.createSubject = async function() {
  const body = { code: $('#newSubCode').value, name: $('#newSubName').value, direction: $('#newSubDir').value, parent_id: parseInt($('#newSubParent').value) || null, valid: true };
  if (!body.code || !body.name) { Toast.warn('请填写编码和名称'); return; }
  try { const res = await api.post('/api/subjects', body); Store.subjects.push(res); } catch { Store.subjects.push({ id: Date.now(), ...body }); }
  closeModal(); renderBdTab(); Toast.success('科目创建成功');
};

function renderBdBusinesses(c) {
  c.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px;"><button class="btn btn-primary btn-sm" id="bdAddBiz">+ 新增业务</button></div>
    <div class="card"><div class="card-body-flush"><table class="data-table"><thead><tr><th>编码</th><th>名称</th><th>类型</th><th>状态</th></tr></thead><tbody>
    ${Store.businesses.map(b => `<tr><td class="num">${b.code}</td><td>${b.name}</td><td>${b.biz_type}</td><td><span class="badge ${b.valid ? 'badge-green' : 'badge-gray'}">${b.valid ? '有效' : '无效'}</span></td></tr>`).join('')}
    </tbody></table></div></div>`;
  $('#bdAddBiz')?.addEventListener('click', () => {
    openModal('新增资金业务', `
      <div style="display:grid;gap:12px;">
        <div class="form-group"><div class="form-label">编码</div><input class="form-input form-input-full" id="newBizCode" placeholder="如 006"></div>
        <div class="form-group"><div class="form-label">名称</div><input class="form-input form-input-full" id="newBizName"></div>
        <div class="form-group"><div class="form-label">类型</div><select class="form-select form-input-full" id="newBizType"><option>一般资金流</option><option>保证金/理财</option><option>借款</option><option>外汇即远期</option><option>对外借款</option></select></div>
      </div>`, `<button class="btn" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="createBusiness()">创建</button>`);
  });
}

window.createBusiness = async function() {
  const body = { code: $('#newBizCode').value, name: $('#newBizName').value, biz_type: $('#newBizType').value, valid: true };
  if (!body.code || !body.name) { Toast.warn('请填写编码和名称'); return; }
  try { const res = await api.post('/api/businesses', body); Store.businesses.push(res); } catch { Store.businesses.push({ id: Date.now(), ...body }); }
  closeModal(); renderBdTab(); Toast.success('业务创建成功');
};

function renderBdTimePeriods(c) {
  c.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px;"><button class="btn btn-primary btn-sm" id="bdAddTP">+ 新增配置</button></div>
    <div class="card"><div class="card-body-flush"><table class="data-table"><thead><tr><th>编号</th><th>名称</th><th>配置</th><th>状态</th></tr></thead><tbody>
    ${Store.timePeriods.map(t => {
      let periods = []; try { periods = JSON.parse(t.periods_json); } catch {}
      return `<tr><td class="num">${t.code}</td><td>${t.name}</td><td>${periods.map(p => `${p.freq}×${p.length}`).join(' + ')}</td><td><span class="badge badge-green">有效</span></td></tr>`;
    }).join('')}
    </tbody></table></div></div>`;
  $('#bdAddTP')?.addEventListener('click', () => {
    openModal('新增时间段配置', `
      <div style="display:grid;gap:12px;">
        <div class="form-group"><div class="form-label">编号</div><input class="form-input form-input-full" id="newTPCode" placeholder="如 TP0002"></div>
        <div class="form-group"><div class="form-label">名称</div><input class="form-input form-input-full" id="newTPName" placeholder="如 标准周期"></div>
        <div class="form-group"><div class="form-label">配置 JSON</div><textarea class="form-textarea form-input-full" id="newTPJson" rows="3" placeholder='[{"freq":"天","length":7},{"freq":"周","length":4}]'></textarea></div>
      </div>`, `<button class="btn" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="createTimePeriod()">创建</button>`);
  });
}

window.createTimePeriod = async function() {
  const body = { code: $('#newTPCode').value, name: $('#newTPName').value, periods_json: $('#newTPJson').value, valid: true };
  if (!body.code || !body.name) { Toast.warn('请填写编号和名称'); return; }
  try { const res = await api.post('/api/time-periods', body); Store.timePeriods.push(res); } catch { Store.timePeriods.push({ id: Date.now(), ...body }); }
  closeModal(); renderBdTab(); Toast.success('时间段配置创建成功');
};

function renderBdCatMap(c) {
  c.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px;"><button class="btn btn-primary btn-sm" id="bdAddCatMap">+ 新增映射</button></div>
    <div class="card"><div class="card-body-flush"><table class="data-table"><thead><tr><th>科目</th><th>流向</th><th>业务类别</th><th>操作</th></tr></thead><tbody>
    ${Store.subjectCategoryMap.map(m => `<tr>
      <td>${m.subject_name || m.subject_code || m.subject_id}</td>
      <td>${m.direction || '-'}</td>
      <td>${(m.biz_codes || []).join(', ')}</td>
      <td class="row-actions"><button class="row-action-btn danger" onclick="deleteCatMap(${m.id})">删除</button></td>
    </tr>`).join('') || '<tr><td colspan="4" class="empty-state">暂无映射</td></tr>'}
    </tbody></table></div></div>`;
  $('#bdAddCatMap')?.addEventListener('click', () => Toast.info('科目↔业务映射添加功能开发中'));
}

window.deleteCatMap = async function(id) {
  try { await api.del(`/api/subject-category-map/${id}`); } catch {}
  Store.subjectCategoryMap = Store.subjectCategoryMap.filter(x => x.id !== id);
  renderBdTab(); Toast.success('已删除');
};

function renderBdPlanMap(c) {
  c.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px;"><button class="btn btn-primary btn-sm" id="bdAddPlanMap">+ 新增映射</button></div>
    <div class="card"><div class="card-body-flush"><table class="data-table"><thead><tr><th>科目</th><th>流向</th><th>计划科目</th><th>操作</th></tr></thead><tbody>
    ${Store.subjectPlanMap.map(m => `<tr>
      <td>${m._names || (m.subject_ids || []).join(',')}</td>
      <td>${m.direction || '-'}</td>
      <td>${m.plan_subject_name || '-'}</td>
      <td class="row-actions"><button class="row-action-btn danger" onclick="deletePlanMap(${m.id})">删除</button></td>
    </tr>`).join('') || '<tr><td colspan="4" class="empty-state">暂无映射</td></tr>'}
    </tbody></table></div></div>`;
  $('#bdAddPlanMap')?.addEventListener('click', () => Toast.info('科目↔计划映射添加功能开发中'));
}

window.deletePlanMap = async function(id) {
  try { await api.del(`/api/subject-plan-map/${id}`); } catch {}
  Store.subjectPlanMap = Store.subjectPlanMap.filter(x => x.id !== id);
  renderBdTab(); Toast.success('已删除');
};

/* ════════════════════════════════════════════
   Integration Page — 数据集成
   ════════════════════════════════════════════ */
let intActiveTab = 'rules';

function renderIntegration() {
  const pg = $('#page-integration');
  pg.innerHTML = `
    <div class="page-header-bar"><div><div class="page-title">数据集成</div><div class="page-subtitle">映射规则 · 定时任务 · 同步日志</div></div><div class="page-actions"><button type="button" class="btn btn-sm" id="intBtnPlatform">中台能力全景</button></div></div>
    <div class="bd-tabs">
      <button class="bd-tab ${intActiveTab==='rules'?'active':''}" data-tab="rules">映射规则</button>
      <button class="bd-tab ${intActiveTab==='tasks'?'active':''}" data-tab="tasks">定时任务</button>
      <button class="bd-tab ${intActiveTab==='logs'?'active':''}" data-tab="logs">同步日志</button>
    </div>
    <div class="page-scroll">
      ${wbCrumb()}
      <div id="intContent"></div>
    </div>`;

  $$('.bd-tab').forEach(t => t.addEventListener('click', () => {
    intActiveTab = t.dataset.tab;
    $$('.bd-tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    renderIntTab();
  }));
  $('#intBtnPlatform')?.addEventListener('click', () => navigateTo('platform'));
  renderIntTab();
}

function renderIntTab() {
  const c = $('#intContent');
  switch (intActiveTab) {
    case 'rules': renderIntRules(c); break;
    case 'tasks': renderIntTasks(c); break;
    case 'logs': renderIntLogs(c); break;
  }
}

function renderIntRules(c) {
  c.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
      <button class="btn" id="intSyncBtn">↻ 手动同步</button>
      <button class="btn btn-primary" id="intAddRule" style="margin-left:8px;">+ 新增规则</button>
    </div>
    ${Store.mappingRules.map(r => `
      <div class="rule-card">
        <div class="rule-card-code">${r.code}</div>
        <div class="rule-card-info">
          <div class="rule-card-name">${r.name || '未命名规则'}</div>
          <div class="rule-card-meta">来源: ${r.source_system} · 单据类型: ${r.source_doc_type || '-'}</div>
        </div>
        <span class="badge ${r.valid ? 'badge-green' : 'badge-gray'}">${r.valid ? '启用' : '停用'}</span>
        <div class="rule-card-actions">
          <button class="btn btn-sm" onclick="Toast.info('编辑规则功能开发中')">编辑</button>
          <button class="btn btn-sm" onclick="deleteRule(${r.id})">删除</button>
        </div>
      </div>`).join('') || '<div class="empty-state">暂无映射规则</div>'}`;

  $('#intSyncBtn')?.addEventListener('click', async () => {
    Toast.info('正在执行手动同步...');
    try {
      const res = await api.post('/api/integrations/fetch', { units: [], source_system: '资金管理系统' });
      Toast.success(`同步完成：${res.records_created} 条记录`);
      await loadAllData();
    } catch { Toast.warn('同步失败（离线模式）'); }
  });

  $('#intAddRule')?.addEventListener('click', () => {
    openModal('新增映射规则', `
      <div style="display:grid;gap:12px;">
        <div class="form-group"><div class="form-label">规则名称</div><input class="form-input form-input-full" id="newRuleName" placeholder="如 TMS资金流映射"></div>
        <div class="form-group"><div class="form-label">来源系统</div><select class="form-select form-input-full" id="newRuleSource"><option>资金管理系统</option><option>ERP系统</option><option>银企直连</option></select></div>
        <div class="form-group"><div class="form-label">单据类型</div><input class="form-input form-input-full" id="newRuleDocType" placeholder="如 资金流水"></div>
        <div class="form-group"><div class="form-label">筛选条件 (JSON)</div><textarea class="form-textarea form-input-full" id="newRuleFilters" rows="2" placeholder='{}'>{}</textarea></div>
        <div class="form-group"><div class="form-label">字段映射 (JSON)</div><textarea class="form-textarea form-input-full" id="newRuleFieldMap" rows="2" placeholder='{}'>{}</textarea></div>
      </div>`, `<button class="btn" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="createMappingRule()">创建</button>`);
  });
}

window.createMappingRule = async function() {
  const body = { name: $('#newRuleName').value, source_system: $('#newRuleSource').value, source_doc_type: $('#newRuleDocType').value, filters_json: $('#newRuleFilters').value || '{}', field_map_json: $('#newRuleFieldMap').value || '{}', valid: true };
  if (!body.name) { Toast.warn('请输入规则名称'); return; }
  try { const res = await api.post('/api/mapping-rules', body); Store.mappingRules.push(res); } catch { Store.mappingRules.push({ id: Date.now(), code: 'MR-NEW', ...body }); }
  closeModal(); renderIntTab(); Toast.success('规则创建成功');
};

window.deleteRule = async function(id) {
  if (!confirm('确认删除该规则？')) return;
  try { await api.del(`/api/mapping-rules/${id}`); } catch {}
  Store.mappingRules = Store.mappingRules.filter(x => x.id !== id);
  renderIntTab(); Toast.success('已删除');
};

function renderIntTasks(c) {
  c.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:16px;"><button class="btn btn-primary" id="intAddTask">+ 新增任务</button></div>
    <div class="card"><div class="card-body-flush"><table class="data-table"><thead><tr><th>名称</th><th>类型</th><th>调度</th><th>状态</th><th>操作</th></tr></thead><tbody>
    ${Store.fetchTasks.map(t => `<tr>
      <td>${t.name}</td><td>${t.task_type}</td><td>${t.cron_expr}</td>
      <td><button class="toggle-switch ${t.enabled ? 'on' : ''}" data-ftid="${t.id}" style="display:inline-block;"></button></td>
      <td class="row-actions">
        <button class="row-action-btn" onclick="runFetchTask(${t.id})">立即执行</button>
        <button class="row-action-btn danger" onclick="deleteFetchTask(${t.id})">删除</button>
      </td>
    </tr>`).join('')}
    </tbody></table></div></div>`;

  $$('.toggle-switch[data-ftid]').forEach(btn => btn.addEventListener('click', () => {
    const tid = parseInt(btn.dataset.ftid);
    const task = Store.fetchTasks.find(t => t.id === tid);
    if (task) { task.enabled = !task.enabled; btn.classList.toggle('on'); Toast.info(task.enabled ? '任务已启用' : '任务已停用'); }
  }));

  $('#intAddTask')?.addEventListener('click', () => {
    openModal('新增定时任务', `
      <div style="display:grid;gap:12px;">
        <div class="form-group"><div class="form-label">名称</div><input class="form-input form-input-full" id="newFTName"></div>
        <div class="form-group"><div class="form-label">类型</div><select class="form-select form-input-full" id="newFTType"><option>资金流自动获取</option><option>资金计划自动获取资金预测</option></select></div>
        <div class="form-group"><div class="form-label">调度表达式</div><input class="form-input form-input-full" id="newFTCron" placeholder="每日 08:00"></div>
      </div>`, `<button class="btn" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="createFetchTask()">创建</button>`);
  });
}

window.createFetchTask = async function() {
  const body = { name: $('#newFTName').value, task_type: $('#newFTType').value, enabled: true, cron_expr: $('#newFTCron').value, filters_json: '{}', extra_json: '{}' };
  if (!body.name) { Toast.warn('请输入名称'); return; }
  try { const res = await api.post('/api/fetch-tasks', body); Store.fetchTasks.push(res); } catch { Store.fetchTasks.push({ id: Date.now(), ...body }); }
  closeModal(); renderIntTab(); Toast.success('任务创建成功');
};

window.runFetchTask = async function(id) {
  Toast.info('正在执行任务...');
  try {
    const res = await api.post(`/api/fetch-tasks/${id}/run`);
    Toast.success(`执行完成：${JSON.stringify(res.result || res.message || 'OK').slice(0, 80)}`);
    await loadAllData();
  } catch { Toast.warn('执行失败（离线模式）'); }
};

window.deleteFetchTask = async function(id) {
  if (!confirm('确认删除该任务？')) return;
  try { await api.del(`/api/fetch-tasks/${id}`); } catch {}
  Store.fetchTasks = Store.fetchTasks.filter(x => x.id !== id);
  renderIntTab(); Toast.success('已删除');
};

function renderIntLogs(c) {
  c.innerHTML = `
    <div class="card"><div class="card-header"><div class="card-title">同步日志</div></div><div class="card-body">
      <div class="sync-log-item"><div class="sync-log-time">${new Date().toISOString().slice(0,16).replace('T',' ')}</div><div style="flex:1;">系统初始化 · 加载 ${Store.records.total || 0} 条记录</div><div class="sync-log-status" style="color:var(--green-500);">成功</div></div>
      <div class="sync-log-item"><div class="sync-log-time">${new Date(Date.now() - 3600000).toISOString().slice(0,16).replace('T',' ')}</div><div style="flex:1;">映射规则检查 · ${Store.mappingRules.length} 条规则有效</div><div class="sync-log-status" style="color:var(--green-500);">成功</div></div>
      <div class="sync-log-item"><div class="sync-log-time">${new Date(Date.now() - 7200000).toISOString().slice(0,16).replace('T',' ')}</div><div style="flex:1;">资金管理系统同步 · 获取数据</div><div class="sync-log-status" style="color:var(--orange-500);">等待</div></div>
    </div></div>`;
}

/* ════════════════════════════════════════════
   Platform capability（外部集成 / 规则 / 数据分层 / 能力全景）
   ════════════════════════════════════════════ */
let platformUiTab = 'integration';

function platStatusBadge(status) {
  if (status === 'online') return '<span class="badge badge-green">在线</span>';
  if (status === 'offline') return '<span class="badge badge-gray">未连接</span>';
  return '<span class="badge badge-orange">模拟</span>';
}

function formatPlatSync(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false });
  } catch { return '—'; }
}

function renderPlatform() {
  const pg = $('#page-platform');
  const tabs = [
    { id: 'integration', label: '外部集成' },
    { id: 'rules', label: '规则引擎' },
    { id: 'data', label: '数据分层' },
    { id: 'capability', label: '能力全景' },
  ];
  pg.innerHTML = `
    <div class="page-header-bar">
      <div>
        <div class="page-title">中台能力</div>
        <div class="page-subtitle">集成态势 · 规则引擎 · 数据工程 · 本机演示配置可持久化</div>
      </div>
      <div class="page-actions">
        <button type="button" class="btn" id="platBtnIntegration">数据集成</button>
      </div>
    </div>
    <div class="bd-tabs platform-tabs">
      ${tabs.map(t => `<button type="button" class="bd-tab ${platformUiTab === t.id ? 'active' : ''}" data-plat-tab="${t.id}">${t.label}</button>`).join('')}
    </div>
    <div class="page-scroll platform-page-scroll">
      <div id="platContent"></div>
    </div>`;

  $('#platBtnIntegration')?.addEventListener('click', () => navigateTo('integration'));

  $$('#page-platform .bd-tab[data-plat-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      platformUiTab = btn.dataset.platTab;
      renderPlatform();
    });
  });

  const c = $('#platContent');
  switch (platformUiTab) {
    case 'integration': renderPlatIntegration(c); break;
    case 'rules': renderPlatRules(c); break;
    case 'data': renderPlatDataLayers(c); break;
    case 'capability': renderPlatCapability(c); break;
    default: renderPlatIntegration(c);
  }
}

function renderPlatIntegration(c) {
  const rows = (Store.platformIntegration || []).map(row => `
    <tr>
      <td><strong>${escHtml(row.name)}</strong><div class="plat-muted">${escHtml(row.note || '')}</div></td>
      <td>${escHtml(row.domain || '')}</td>
      <td class="plat-muted">${escHtml(row.connector || '')}</td>
      <td>${platStatusBadge(row.status)}</td>
      <td class="num">${formatPlatSync(row.lastSync)}</td>
      <td class="row-actions"><button type="button" class="row-action-btn" onclick="syncPlatformRow('${row.id}')">记录同步</button></td>
    </tr>`).join('');

  c.innerHTML = `
    <p class="workbench-hint">演示：外部系统连接状态与最近同步时间；生产环境应对接真实网关与健康检查。</p>
    <div class="card"><div class="card-body-flush"><table class="data-table plat-table">
      <thead><tr><th>系统</th><th>业务域</th><th>连接器</th><th>状态</th><th>最近同步</th><th>操作</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6" class="empty-state">暂无</td></tr>'}</tbody>
    </table></div></div>`;
}

window.syncPlatformRow = function(id) {
  const row = (Store.platformIntegration || []).find(x => String(x.id) === String(id));
  if (!row) return;
  row.lastSync = new Date().toISOString();
  if (row.status === 'offline') row.status = 'simulated';
  savePlatformIntegration();
  renderPlatform();
  Toast.success('已记录同步时间（演示）');
};

function renderPlatRules(c) {
  const re = Store.ruleEngine || defaultRuleEngine();
  c.innerHTML = `
    <p class="workbench-hint">演示：付款排程与预警相关策略；保存后写入本机并合并进对话系统提示。</p>
    <div class="card"><div class="card-body plat-rules-card">
      <div class="form-group"><div class="form-label">付款优先级模式</div>
        <select class="form-select form-input-full" id="platRulePriority">
          <option value="static" ${re.paymentPriorityMode === 'static' ? 'selected' : ''}>静态规则</option>
          <option value="dynamic_ml" ${re.paymentPriorityMode === 'dynamic_ml' ? 'selected' : ''}>动态 + 模型辅助</option>
        </select>
      </div>
      <div class="form-group"><div class="form-label">预算校验</div>
        <select class="form-select form-input-full" id="platRuleBudget">
          <option value="soft" ${re.budgetCheck === 'soft' ? 'selected' : ''}>软校验（提示）</option>
          <option value="hard" ${re.budgetCheck === 'hard' ? 'selected' : ''}>硬阻断</option>
          <option value="off" ${re.budgetCheck === 'off' ? 'selected' : ''}>关闭</option>
        </select>
      </div>
      <div class="form-group"><div class="form-label">流动性预警阈值（万元）</div>
        <input class="form-input form-input-full" type="number" id="platRuleLiq" min="0" step="100" value="${re.liquidityWarnWan ?? 5000}" />
      </div>
      <div class="form-group plat-check-row">
        <label><input type="checkbox" id="platRuleDyn" ${re.dynamicFactors !== false ? 'checked' : ''} /> 启用动态因子（供应商评分、到期日等）</label>
      </div>
      <div class="form-group plat-check-row">
        <label><input type="checkbox" id="platRuleP0" ${re.p0AlwaysFirst !== false ? 'checked' : ''} /> P0 始终优先</label>
      </div>
      <div class="form-group plat-check-row">
        <label><input type="checkbox" id="platRuleBlk" ${re.blacklistBlock !== false ? 'checked' : ''} /> 黑名单硬阻断</label>
      </div>
      <div class="form-group plat-check-row">
        <label><input type="checkbox" id="platRuleTrace" ${re.traceRequired !== false ? 'checked' : ''} /> AI 输出须引用规则 / 数据来源</label>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:16px;">
        <button type="button" class="btn btn-primary" id="platRuleSave">保存规则</button>
      </div>
    </div></div>`;
  $('#platRuleSave')?.addEventListener('click', () => savePlatformRulesFromForm());
}

window.savePlatformRulesFromForm = function() {
  const raw = $('#platRuleLiq')?.value;
  const liq = raw === '' || raw === undefined ? NaN : Number(raw);
  Store.ruleEngine = {
    paymentPriorityMode: $('#platRulePriority')?.value || 'static',
    budgetCheck: $('#platRuleBudget')?.value || 'soft',
    liquidityWarnWan: Number.isFinite(liq) ? liq : 5000,
    dynamicFactors: !!$('#platRuleDyn')?.checked,
    p0AlwaysFirst: !!$('#platRuleP0')?.checked,
    blacklistBlock: !!$('#platRuleBlk')?.checked,
    traceRequired: !!$('#platRuleTrace')?.checked,
  };
  saveRuleEngine();
  Toast.success('规则已保存');
  renderPlatform();
};

function renderPlatDataLayers(c) {
  c.innerHTML = `
    <p class="workbench-hint">数据分层：ODS → DWD → DWS → ADS → 模型特征。</p>
    <div class="plat-layer-grid">
      <div class="card plat-layer-card"><div class="plat-layer-tag">ODS</div><div class="card-title">操作数据层</div><div class="plat-layer-desc">银企/ERP/TMS 原始流水、回单、状态快照；保留全量与变更历史。</div></div>
      <div class="card plat-layer-card"><div class="plat-layer-tag">DWD</div><div class="card-title">明细数据层</div><div class="plat-layer-desc">清洗、标准化科目与单位、客商主数据对齐；支持血缘与追溯。</div></div>
      <div class="card plat-layer-card"><div class="plat-layer-tag">DWS</div><div class="card-title">汇总数据层</div><div class="plat-layer-desc">按主体/科目/周期的汇总与指标，服务报表与主题域分析。</div></div>
      <div class="card plat-layer-card"><div class="plat-layer-tag">ADS</div><div class="card-title">应用数据层</div><div class="plat-layer-desc">头寸、计划执行率、敞口聚合、待付款池等司库主题指标。</div></div>
      <div class="card plat-layer-card"><div class="plat-layer-tag">ML / XAI</div><div class="card-title">特征与可解释输出</div><div class="plat-layer-desc">预测特征、情景偏差、因子贡献；配合对话中的规则引用与图表。</div></div>
    </div>`;
}

function platDevStatusLabel(st) {
  const s = String(st || '').toLowerCase();
  if (s === 'implemented') return { text: '已实现', cls: 'badge-green' };
  if (s === 'planned') return { text: '规划中', cls: 'badge-gray' };
  if (s === 'external') return { text: '依赖客户环境', cls: 'badge-gray' };
  return { text: '部分', cls: 'badge-orange' };
}

/** 表格单元格：避免非字符串被渲染成 [object Object] */
function platPlain(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'string') return escHtml(v);
  if (typeof v === 'number' || typeof v === 'boolean') return escHtml(String(v));
  try { return escHtml(JSON.stringify(v)); } catch { return ''; }
}

function renderPlatMatrixTable(title, rows, cols) {
  const head = cols.map(h => `<th>${escHtml(h.label)}</th>`).join('');
  const body = (rows || []).map(r => {
    if (!r || typeof r !== 'object' || Array.isArray(r)) return '';
    const cells = cols.map(c => {
      if (c.key === 'status') {
        const { text, cls } = platDevStatusLabel(r.status);
        return `<td><span class="badge ${cls}">${escHtml(text)}</span></td>`;
      }
      return `<td class="${c.muted ? 'plat-muted' : ''}">${platPlain(r[c.key])}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');
  return `<div class="plat-cap-section"><h3 class="plat-cap-h3">${escHtml(title)}</h3><div class="card"><div class="card-body-flush"><table class="data-table plat-cap-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div></div></div>`;
}

function renderPlatCapabilityMatrix(c, data) {
  const summary = data.summary
    ? `<p class="workbench-hint plat-cap-summary">${platPlain(data.summary)}</p><p class="plat-meta-line">能力矩阵 v${escHtml(String(data.version || ''))} · ${escHtml((data.generated_at || '').slice(0, 19))}</p>`
    : '';

  const layers = data.layers || data.prd_layers || [];
  const modules = data.modules || data.prd_modules || [];
  const cashflow = data.cashflow_suite || data.urs_sections || [];
  const constraints = data.constraints || data.prd_constraints || [];

  const layerRows = renderPlatMatrixTable('四层能力架构', layers, [
    { key: 'dimension', label: '层级' },
    { key: 'status', label: '状态' },
    { key: 'note', label: '说明', muted: true },
    { key: 'backend_surface', label: '实现锚点', muted: true },
  ]);

  const consHtml = constraints.length
    ? renderPlatMatrixTable('建设约束', constraints, [
      { key: 'dimension', label: '约束' },
      { key: 'status', label: '状态' },
      { key: 'note', label: '说明', muted: true },
    ])
    : '';

  const modRows = renderPlatMatrixTable('业务模块能力', modules, [
    { key: 'dimension', label: '模块' },
    { key: 'status', label: '状态' },
    { key: 'note', label: '说明', muted: true },
    { key: 'backend_surface', label: '接口 / 代码', muted: true },
  ]);

  const cfRows = renderPlatMatrixTable('资金预测子系统', cashflow, [
    { key: 'dimension', label: '子域' },
    { key: 'status', label: '状态' },
    { key: 'note', label: '说明', muted: true },
    { key: 'backend_surface', label: '接口', muted: true },
  ]);

  const phases = (data.roadmap || []).map(p => {
    const items = (p.items || []).map(t => `<li>${platPlain(t)}</li>`).join('');
    const ph = platPlain(p.phase);
    const ti = platPlain(p.title);
    return `<div class="plat-roadmap-phase"><div class="plat-roadmap-title">${ph} · ${ti}</div><ul class="plat-roadmap-list">${items}</ul></div>`;
  }).join('');

  const roadmapHtml = phases
    ? `<div class="plat-cap-section"><h3 class="plat-cap-h3">迭代计划</h3><div class="card"><div class="card-body plat-roadmap-body">${phases}</div></div></div>`
    : '';

  c.innerHTML = `${summary}${layerRows}${consHtml}${modRows}${cfRows}${roadmapHtml}`;
}

function renderPlatCapabilityFallback(c) {
  const rows = [
    ['数据集成', '部分', '数据集成页与本页外部系统态势；生产环境需对接真实网关'],
    ['规则引擎', '部分', '本机可配置策略；可与后端排程引擎联动扩展'],
    ['数据工程', '部分', '见「数据分层」；血缘与质量稽核可持续建设'],
    ['外部数据源', '部分', '银企等演示数据；生产需专线与证书'],
    ['智能能力', '部分', '对话与工具；本地推理与知识库可按部署接入'],
  ];
  c.innerHTML = `
    <p class="workbench-hint">无法连接后端 <code>/api/meta/requirements-matrix</code>，已显示本地摘要。请启动全栈 API（默认 <code>http://127.0.0.1:8000</code>）或设置 <code>cf_api_base</code> / URL 参数 <code>apiBase</code>。</p>
    <div class="card"><div class="card-body-flush"><table class="data-table plat-cap-table">
      <thead><tr><th>维度</th><th>状态</th><th>说明</th></tr></thead>
      <tbody>${rows.map(([dim, st, note]) => `<tr><td>${escHtml(dim)}</td><td><span class="badge badge-orange">${escHtml(st)}</span></td><td class="plat-muted">${escHtml(note)}</td></tr>`).join('')}</tbody>
    </table></div></div>`;
}

function renderPlatCapability(c) {
  c.innerHTML = `<p class="workbench-hint">正在加载能力矩阵…</p>`;
  api.get('/api/meta/requirements-matrix').then(data => {
    const layers = data && (data.layers || data.prd_layers);
    if (!layers || !layers.length) { renderPlatCapabilityFallback(c); return; }
    renderPlatCapabilityMatrix(c, data);
  }).catch(() => renderPlatCapabilityFallback(c));
}

window.renderPlatform = renderPlatform;

/* ════════════════════════════════════════════
   User Menu & Settings
   ════════════════════════════════════════════ */
function initUserMenu() {
  const user = $('#sidebarUser');
  const menu = $('#userMenu');
  if (!user || !menu) return;

  user.addEventListener('click', (e) => {
    if (e.target.closest('.user-upgrade-btn')) return;
    e.stopPropagation();
    const isOpen = menu.classList.toggle('open');
    user.classList.toggle('menu-open', isOpen);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-menu') && !e.target.closest('#sidebarUser')) {
      menu.classList.remove('open');
      user.classList.remove('menu-open');
    }
  });

  $('#menuSettings')?.addEventListener('click', () => {
    menu.classList.remove('open');
    user.classList.remove('menu-open');
    navigateTo('settings');
  });

  $('#menuApiKey')?.addEventListener('click', () => {
    menu.classList.remove('open');
    user.classList.remove('menu-open');
    try {
      sessionStorage.removeItem(ACCIO_KEY_STORAGE);
      localStorage.removeItem(ACCIO_KEY_STORAGE);
    } catch (e) {}
    Toast.info('已清除密钥，将重新进入门禁');
    setTimeout(() => { location.reload(); }, 400);
  });

  $('#menuAbout')?.addEventListener('click', () => {
    menu.classList.remove('open');
    user.classList.remove('menu-open');
    openModal('关于', `
      <div style="text-align:center;padding:20px 0;">
        <div class="about-brand-ico">${uiIcon('building')}</div>
        <div style="font-size:18px;font-weight:700;margin-bottom:4px;">亿流 Work</div>
        <div style="color:var(--gray-500);font-size:13px;">智能财务中台 Agent 平台 v0.7.0</div>
        <div style="color:var(--gray-400);font-size:12px;margin-top:12px;">五大核心 Agent · 付款排程/往来/预警/驾驶舱 · DeepSeek · ECharts</div>
      </div>`, '');
  });

  $('#menuLogout')?.addEventListener('click', () => {
    menu.classList.remove('open');
    user.classList.remove('menu-open');
    Toast.info('已退出登录（演示模式）');
  });

  $$('#langSubmenu .submenu-item').forEach(item => {
    item.addEventListener('click', () => {
      $$('#langSubmenu .submenu-item').forEach(x => x.classList.remove('active'));
      item.classList.add('active');
      Toast.success('语言已切换为 ' + item.textContent.trim());
    });
  });

  $$('#themeSubmenu .submenu-item').forEach(item => {
    item.addEventListener('click', () => {
      $$('#themeSubmenu .submenu-item').forEach(x => { x.classList.remove('active'); x.querySelector('.submenu-dot')?.remove(); });
      item.classList.add('active');
      if (!item.querySelector('.submenu-dot')) {
        const dot = document.createElement('span');
        dot.className = 'submenu-dot';
        item.appendChild(dot);
      }
      Toast.success('主题已切换为 ' + item.textContent.trim());
    });
  });
}

let settingsTab = 'prefs';

function renderSettings() {
  const pg = $('#page-settings');
  pg.innerHTML = `
    <div class="settings-layout">
      <div class="settings-sidebar">
        <button class="settings-nav-item ${settingsTab==='prefs'?'active':''}" data-stab="prefs">偏好</button>
        <button class="settings-nav-item ${settingsTab==='system'?'active':''}" data-stab="system">系统</button>
        <button class="settings-nav-item ${settingsTab==='browser'?'active':''}" data-stab="browser">浏览器</button>
        <button class="settings-nav-item ${settingsTab==='lab'?'active':''}" data-stab="lab">实验室</button>
      </div>
      <div class="settings-content" id="settingsContent"></div>
    </div>`;

  $$('.settings-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      settingsTab = btn.dataset.stab;
      $$('.settings-nav-item').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      renderSettingsTab();
    });
  });
  renderSettingsTab();
}

function renderSettingsTab() {
  const c = $('#settingsContent');
  if (!c) return;
  switch (settingsTab) {
    case 'prefs': renderSettingsPrefs(c); break;
    case 'system': renderSettingsSystem(c); break;
    case 'browser': renderSettingsBrowser(c); break;
    case 'lab': renderSettingsLab(c); break;
  }
}

function renderSettingsPrefs(c) {
  c.innerHTML = `
    <div class="settings-section-title">偏好</div>
    <div class="settings-card">
      <div class="settings-card-header">
        <div><div class="settings-card-label">语言</div><div class="settings-card-desc">选择界面显示语言。</div></div>
        <select class="settings-select" id="settingsLang">
          <option value="zh" selected>中文</option>
          <option value="en">English</option>
          <option value="es">Español</option>
          <option value="pt">Português</option>
          <option value="fr">Français</option>
          <option value="de">Deutsch</option>
        </select>
      </div>
    </div>
    <div class="settings-card">
      <div class="settings-card-header">
        <div><div class="settings-card-label">外观</div><div class="settings-card-desc">选择亿流 Work 的外观风格，可选主题或跟随系统设置。</div></div>
        <div class="segment-control">
          <button class="segment-btn active" data-appearance="light">浅色</button>
          <button class="segment-btn" data-appearance="dark">深色</button>
          <button class="segment-btn" data-appearance="system">跟随系统</button>
        </div>
      </div>
    </div>
    <div class="settings-card">
      <div class="settings-card-header">
        <div><div class="settings-card-label">聊天背景</div><div class="settings-card-desc">选择对话区域的背景样式。</div></div>
        <div class="pattern-selector">
          <div style="text-align:center"><div class="pattern-option active" data-pattern="solid"><div class="pattern-solid"></div></div><div class="pattern-option-label">纯色</div></div>
          <div style="text-align:center"><div class="pattern-option" data-pattern="dots"><div class="pattern-dots"></div></div><div class="pattern-option-label">圆点</div></div>
          <div style="text-align:center"><div class="pattern-option" data-pattern="grid"><div class="pattern-grid"></div></div><div class="pattern-option-label">网格</div></div>
        </div>
      </div>
    </div>
    <div class="settings-card">
      <div class="settings-card-header">
        <div><div class="settings-card-label">输入框随滚动缩小</div><div class="settings-card-desc">开启后，浏览历史消息时输入框会逐步缩小；聚焦输入框时会恢复展开。</div></div>
        <label class="toggle-switch"><input type="checkbox" id="toggleShrink"><span class="toggle-slider"></span></label>
      </div>
    </div>`;

  $$('.segment-btn[data-appearance]').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.segment-btn[data-appearance]').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      Toast.success('外观已切换为 ' + btn.textContent);
    });
  });
  $$('.pattern-option').forEach(opt => {
    opt.addEventListener('click', () => {
      $$('.pattern-option').forEach(x => x.classList.remove('active'));
      opt.classList.add('active');
    });
  });
}

function renderSettingsSystem(c) {
  c.innerHTML = `
    <div class="settings-section-title">系统</div>
    <div class="settings-card">
      <div class="settings-card-header">
        <div><div class="settings-card-label">软件更新</div><div class="settings-card-desc">当前版本：0.5.2</div></div>
        <button class="btn btn-outline" onclick="Toast.info('已是最新版本')">检查更新</button>
      </div>
    </div>
    <div class="settings-card">
      <div class="settings-card-header">
        <div><div class="settings-card-label">保持系统唤醒</div><div class="settings-card-desc">开启后，亿流 Work 运行期间系统将保持唤醒，避免自动休眠。</div></div>
        <label class="toggle-switch"><input type="checkbox"><span class="toggle-slider"></span></label>
      </div>
    </div>
    <div class="settings-card">
      <div class="settings-card-header">
        <div><div class="settings-card-label">桌面通知</div><div class="settings-card-desc">允许亿流 Work 发送桌面通知提醒。</div></div>
        <label class="toggle-switch"><input type="checkbox" checked><span class="toggle-slider"></span></label>
      </div>
    </div>`;
}

function renderSettingsBrowser(c) {
  c.innerHTML = `
    <div class="settings-section-title">浏览器</div>
    <div class="settings-card">
      <div class="settings-card-header"><div><div class="settings-card-label">系统环境</div></div></div>
      <div class="settings-card-body settings-env-row">
        <span class="settings-env-ico">${uiIcon('terminal')}</span> <strong>Windows</strong> 10.0.26200 &nbsp;|&nbsp; 系统架构 x64
      </div>
    </div>
    <div class="settings-card">
      <div class="settings-card-header">
        <div><div class="settings-card-label">浏览器列表</div></div>
        <button class="btn btn-outline" onclick="Toast.info('扫描完成')">重新扫描</button>
      </div>
      <div class="settings-card-body">
        <div class="browser-card">
          <div class="browser-icon" style="background:#fef3c7;">${uiIcon('globe')}</div>
          <div class="browser-info">
            <div class="browser-name">Google Chrome <span class="browser-badge not-installed">未安装</span></div>
            <div class="browser-detail">Chromium</div>
          </div>
        </div>
        <div class="browser-card">
          <div class="browser-icon" style="background:#dbeafe;">${uiIcon('circle')}</div>
          <div class="browser-info">
            <div class="browser-name">内置 Chromium <span class="browser-badge not-installed">未安装</span> <span class="browser-badge not-installed">尚未支持，敬请期待</span></div>
            <div class="browser-detail">Chromium</div>
          </div>
        </div>
        <div class="browser-card">
          <div class="browser-icon" style="background:#dbeafe;">${uiIcon('spark')}</div>
          <div class="browser-info">
            <div class="browser-name">Microsoft Edge <span class="browser-badge installed">M146</span> 146.0.3856.84</div>
            <div class="browser-detail">Chromium</div>
          </div>
        </div>
      </div>
    </div>
    <div class="settings-card">
      <div class="settings-card-header">
        <div><div class="settings-card-label">最大打开页面数量</div><div class="settings-card-desc">限制智能体通过浏览器工具同时打开的最大标签页数量。达到上限后需先关闭已有标签页才能打开新的。</div></div>
        <input type="number" class="settings-number" value="20" min="1" max="50">
      </div>
    </div>
    <div class="settings-card">
      <div class="settings-card-header">
        <div><div class="settings-card-label">最大保留页面数量</div><div class="settings-card-desc">限制智能体退出时可保留的标签页数量。使用 retain=true 打开的页面在子任务结束时不会被自动关闭。</div></div>
        <input type="number" class="settings-number" value="10" min="1" max="50">
      </div>
    </div>`;
}

function renderSettingsLab(c) {
  c.innerHTML = `
    <div class="settings-section-title">实验室</div>
    <div class="settings-card">
      <div class="settings-card-header">
        <div><div class="settings-card-label">实验性功能</div><div class="settings-card-desc">这些功能正在开发中，可能不稳定。启用后可体验最新能力。</div></div>
      </div>
    </div>
    <div class="settings-card">
      <div class="settings-card-header">
        <div><div class="settings-card-label">多模态输入</div><div class="settings-card-desc">允许智能体处理图片、音频等多模态输入。</div></div>
        <label class="toggle-switch"><input type="checkbox"><span class="toggle-slider"></span></label>
      </div>
    </div>
    <div class="settings-card">
      <div class="settings-card-header">
        <div><div class="settings-card-label">思维链展示</div><div class="settings-card-desc">在聊天界面展示 AI 的思考过程（Chain of Thought）。</div></div>
        <label class="toggle-switch"><input type="checkbox" checked><span class="toggle-slider"></span></label>
      </div>
    </div>
    <div class="settings-card">
      <div class="settings-card-header">
        <div><div class="settings-card-label">自动备份</div><div class="settings-card-desc">自动将对话历史和配置备份到云端。</div></div>
        <label class="toggle-switch"><input type="checkbox"><span class="toggle-slider"></span></label>
      </div>
    </div>`;
}

/* ════════════════════════════════════════════
   Sidebar Conversations
   ════════════════════════════════════════════ */
/* ════════════════════════════════════════════
   Sidebar Tree & Chat History
   ════════════════════════════════════════════ */
function initSidebarTree() {
  $$('.nav-tree-header[data-toggle]').forEach(hdr => {
    hdr.addEventListener('click', () => {
      hdr.closest('.nav-tree').classList.toggle('collapsed');
    });
  });

  $('#historyToggle')?.addEventListener('click', () => {
    $('#sidebarHistory')?.classList.toggle('collapsed');
  });
}

function saveChatToHistory() {
  if (Store.chatHistory.length < 2) return;
  const agent = Store.agents.find(a => a.id === Store.currentAgent) || Store.agents[0];
  const firstUserMsg = Store.chatHistory.find(m => m.role === 'user');
  const title = firstUserMsg ? firstUserMsg.content.slice(0, 30) : '新对话';
  const existing = Store.conversations.find(c => c.id === Store._activeConvId);
  if (existing) {
    existing.title = title;
    existing.messages = [...Store.chatHistory];
    existing.updatedAt = Date.now();
    existing.agentId = Store.currentAgent;
  } else {
    const conv = {
      id: 'conv_' + Date.now(),
      agentId: Store.currentAgent,
      agentName: agent.name,
      title,
      messages: [...Store.chatHistory],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    Store.conversations.unshift(conv);
    Store._activeConvId = conv.id;
  }
  renderChatHistory();
}

function renderChatHistory() {
  const list = $('#historyList');
  const count = $('#historyCount');
  if (!list) return;
  if (count) count.textContent = Store.conversations.length;

  if (Store.conversations.length === 0) {
    list.innerHTML = '<div class="history-empty">暂无历史对话</div>';
    return;
  }

  const now = Date.now();
  const DAY = 86400000;
  const today = [], yesterday = [], earlier = [];
  Store.conversations.forEach(c => {
    const age = now - c.updatedAt;
    if (age < DAY) today.push(c);
    else if (age < 2 * DAY) yesterday.push(c);
    else earlier.push(c);
  });

  let html = '';
  const renderGroup = (label, items) => {
    if (!items.length) return '';
    let h = `<div class="history-group-label">${label}</div>`;
    h += items.map(c => {
      const ag = Store.agents.find(a => a.id === c.agentId);
      const avKey = ag?.avatarKey || c.agentId || 'data';
      return `
      <div class="history-item ${c.id === Store._activeConvId ? 'active' : ''}" data-conv-id="${c.id}">
        <div class="history-item-icon">${agentIconHtml(avKey)}</div>
        <div class="history-item-text">${c.title}</div>
        <button class="history-item-del" data-del="${c.id}" title="删除">×</button>
      </div>`;
    }).join('');
    return h;
  };

  html += renderGroup('今天', today);
  html += renderGroup('昨天', yesterday);
  html += renderGroup('更早', earlier);
  list.innerHTML = html;

  $$('.history-item[data-conv-id]').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('.history-item-del')) return;
      const conv = Store.conversations.find(c => c.id === el.dataset.convId);
      if (conv) {
        Store._activeConvId = conv.id;
        Store.currentAgent = conv.agentId;
        Store.chatHistory = [...conv.messages];
        Store.chatFiles = [];
        Store.chatTasks = [];
        Store.rightPanelOpen = false;
        navigateTo('chat');
        renderChatHistory();
      }
    });
  });
  $$('.history-item-del[data-del]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.del;
      Store.conversations = Store.conversations.filter(c => c.id !== id);
      if (Store._activeConvId === id) {
        Store._activeConvId = null;
        Store.chatHistory = [];
        Store.chatFiles = [];
        Store.chatTasks = [];
        navigateTo('chat');
      }
      renderChatHistory();
      Toast.info('对话已删除');
    });
  });
}

function startNewChat() {
  if (Store.chatHistory.length >= 2) saveChatToHistory();
  Store._activeConvId = null;
  Store.chatHistory = [];
  Store.chatFiles = [];
  Store.chatTasks = [];
  Store.chatResults = [];
  Store.rightPanelOpen = false;
  Store._rpTab = 'files';
  navigateTo('chat');
  renderChatHistory();
}

function seedDemoHistory() {
  if (Store.conversations.length > 0) return;
  const now = Date.now();
  const demos = [
    { id: 'demo1', agentId: 'data', agentName: '数据查询助手', title: '查看当前头寸情况', messages: [{role:'user',content:'查看当前头寸情况',time:'09:15'},{role:'assistant',content:'当前净头寸1,984.89万元',time:'09:15'}], createdAt: now - 3600000, updatedAt: now - 3600000 },
    { id: 'demo2', agentId: 'advisor', agentName: '决策建议 Agent', title: '本月资金缺口归因', messages: [{role:'user',content:'本月集团资金缺口主要由谁造成？',time:'14:20'},{role:'assistant',content:'结合演示数据，华东子公司与总部大额流出占比较高，建议打开 [管理驾驶舱](cf-page:cockpit) 下钻。',time:'14:21'}], createdAt: now - 7200000, updatedAt: now - 7200000 },
    { id: 'demo3', agentId: 'plan', agentName: '计划管理助手', title: '月度计划复盘', messages: [{role:'user',content:'月度计划复盘',time:'10:00'},{role:'assistant',content:'本月共3个计划',time:'10:01'}], createdAt: now - 86400000 * 1.5, updatedAt: now - 86400000 * 1.5 },
    { id: 'demo4', agentId: 'scheduling', agentName: '智能排程 Agent', title: '待付款优先级', messages: [{role:'user',content:'待付款池 P0 有哪些？',time:'16:30'},{role:'assistant',content:'演示数据中每刻报销、税费、骑手薪酬为 P0，详见 [付款排程](cf-page:payment)。',time:'16:31'}], createdAt: now - 86400000 * 3, updatedAt: now - 86400000 * 3 },
    { id: 'demo5', agentId: 'cashflow', agentName: '资金流管理', title: '华东子公司资金流导出', messages: [{role:'user',content:'华东子公司资金流导出',time:'11:00'},{role:'assistant',content:'已导出CSV文件',time:'11:01'}], createdAt: now - 86400000 * 5, updatedAt: now - 86400000 * 5 },
  ];
  Store.conversations = demos;
  renderChatHistory();
}

/* ════════════════════════════════════════════
   Init
   ════════════════════════════════════════════ */
async function bootAccioApp() {
  await loadAllData();
  loadWorkbenchScenarios();
  loadPlatformCapability();

  $$('.nav-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });

  $('#btnNewChat')?.addEventListener('click', () => startNewChat());
  $('#modalClose')?.addEventListener('click', closeModal);
  $('#modalOverlay')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });

  $('#rpToggleTab')?.addEventListener('click', () => toggleRightPanel());
  $('#rpBtnClose')?.addEventListener('click', () => toggleRightPanel());

  initSidebarTree();
  renderChatHistory();
  initUserMenu();

  Store._activeConvId = null;
  seedDemoHistory();
  navigateTo('chat');
}

document.addEventListener('DOMContentLoaded', () => {
  const gate = document.getElementById('apiKeyGate');
  const errEl = document.getElementById('apiKeyError');
  const submit = document.getElementById('apiKeySubmit');
  const input = document.getElementById('apiKeyInput');
  const remember = document.getElementById('apiKeyRemember');

  function showGateError(msg) {
    if (errEl) errEl.textContent = msg || '';
  }

  if (getAccioApiKey()) {
    if (gate) gate.classList.add('hidden');
    bootAccioApp();
    return;
  }

  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit?.click();
    });
  }

  submit?.addEventListener('click', () => {
    showGateError('');
    const key = (input?.value || '').trim();
    if (!key) {
      showGateError('请输入 API Key');
      return;
    }
    if (key.length < 8) {
      showGateError('密钥过短，请检查是否粘贴完整');
      return;
    }
    try {
      sessionStorage.setItem(ACCIO_KEY_STORAGE, key);
      if (remember?.checked) {
        localStorage.setItem(ACCIO_KEY_STORAGE, key);
      } else {
        localStorage.removeItem(ACCIO_KEY_STORAGE);
      }
    } catch (e) {
      showGateError('无法写入浏览器存储');
      return;
    }
    if (gate) gate.classList.add('hidden');
    bootAccioApp();
  });
});

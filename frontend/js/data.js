/**
 * data.js — 全局数据 + 角色 + 导航 + 后端加载 + Mock 回退
 */

window.AppData = {
  /** 登录页 / 顶栏：单色线型图标（避免 emoji 的「模板感」） */
  roleSvg: {
    treasurer:
      '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12V7H5a2 2 0 0 1 0-4h10l4 4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 1 0 0 4h4v-4Z"/></svg>',
    cfo:
      '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>',
    analyst:
      '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
    bizfin:
      '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h6"/></svg>',
    admin:
      '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
  },

  roles: {
    treasurer: {
      id: 'treasurer', name: '司库经理',
      desc: '流动性安全与经营协同 · 预测 + 决策 + 执行闭环',
      pages: ['workbench','dashboard','cashflow','analysis','liquidity','basedata','integration'],
    },
    cfo: {
      id: 'cfo', name: '财务总监',
      desc: '总览价值四象限 · 审批与战略决策',
      pages: ['workbench','dashboard','cashflow','analysis','liquidity'],
    },
    analyst: {
      id: 'analyst', name: '资金分析师',
      desc: '现金流预测 · 风险识别 · 模型与报告',
      pages: ['workbench','dashboard','cashflow','analysis','liquidity'],
    },
    bizfin: {
      id: 'bizfin', name: '业务财务',
      desc: '现金流事件维护 · 计划编报 · 执行跟踪',
      pages: ['workbench','dashboard','cashflow','analysis','liquidity'],
    },
    admin: {
      id: 'admin', name: '系统管理员',
      desc: '数据整合层配置 · 主数据与映射 · 排障可阅',
      pages: ['workbench','dashboard','cashflow','analysis','liquidity','basedata','integration'],
    },
  },

  navItems: [
    { group: 'Agent 执行', items: [
      { id: 'workbench', icon: '🤖', text: '亿流 Work' },
    ]},
    { group: '预测与闭环', items: [
      { id: 'dashboard',   icon: '📈', text: '总览看板' },
      { id: 'cashflow',    icon: '💸', text: '现金流事件' },
      { id: 'analysis',    icon: '🔬', text: '现金流分析' },
      { id: 'liquidity',   icon: '📈', text: '现金流预测' },
    ]},
    { group: '数据与基础', items: [
      { id: 'basedata',    icon: '🗂️', text: '基础数据' },
      { id: 'integration', icon: '🔗', text: '数据整合' },
    ]},
  ],

  stats: null,
  subjects: [],
  businesses: [],
  records: { items: [], total: 0 },
  collections: [],
  plans: [],
  fxExposures: [],
  mappingRules: [],
  pieDrillCategory: null,
  serverSyncLogs: [],
  timePeriods: [],
  analysisResult: null,
  subjectBizMapping: [],
  subjectPlanMapping: [],
  syncLogs: [],
  fetchTasks: [],
  latestReportId: null,

  deviationLogs: [],
  alertQueue: [],
  closedLoopKPI: null,
  actualExecution: [],

  systemHealth: {
    bank: { name: '银行接口', status: 'ok', lastCheck: null },
    erp:  { name: 'ERP 系统', status: 'ok', lastCheck: null },
    ai:   { name: 'AI 服务',  status: 'ok', lastCheck: null },
    fx:   { name: '汇率服务', status: 'ok', lastCheck: null },
    db:   { name: '数据库',   status: 'ok', lastCheck: null },
  },
};

/** file:// 打开 HTML 时，相对路径 /api 会变成 file:///C:/api…；此处解析为可连后端的绝对基址 */
function _resolveCfApiBase() {
  try {
    if (typeof window === 'undefined') return '';
    var sp = new URLSearchParams(window.location.search || '');
    var fromQuery = sp.get('apiBase');
    if (fromQuery) {
      var u = String(fromQuery).replace(/\/+$/, '');
      try { localStorage.setItem('cf_api_base', u); } catch (e) {}
      return u;
    }
    try {
      var ls = localStorage.getItem('cf_api_base');
      if (ls) return String(ls).replace(/\/+$/, '');
    } catch (e) {}
    if (window.location.protocol === 'file:') {
      return 'http://127.0.0.1:8000';
    }
  } catch (e) {}
  return '';
}

/** 避免 fetch 返回空/HTML/截断时 res.json() 抛出 Uncaught SyntaxError: Unexpected end of input */
function _parseJsonResponse(text, method, path) {
  var t = (text == null) ? '' : String(text).trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch (e) {
    console.warn(method + ' ' + path + ' JSON 解析失败', e);
    throw new Error(method + ' ' + path + ': 响应不是有效 JSON（可能为代理页或截断）');
  }
}

window.API = {
  base: _resolveCfApiBase(),

  async get(path) {
    var res = await fetch(this.base + path);
    if (!res.ok) throw new Error('GET ' + path + ': ' + res.status);
    return _parseJsonResponse(await res.text(), 'GET', path);
  },

  async post(path, body) {
    var res = await fetch(this.base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('POST ' + path + ': ' + res.status);
    return _parseJsonResponse(await res.text(), 'POST', path);
  },

  /** multipart/form-data（如 Excel 上传） */
  async postForm(path, formData) {
    var res = await fetch(this.base + path, { method: 'POST', body: formData });
    var data;
    var ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct.indexOf('application/json') !== -1) {
      try { data = await res.json(); } catch (e) { data = {}; }
    } else {
      try { data = { detail: await res.text() }; } catch (e) { data = { detail: '' }; }
    }
    if (!res.ok) {
      var d = data && data.detail;
      var msg = typeof d === 'string' ? d : (d ? JSON.stringify(d) : ('HTTP ' + res.status));
      throw new Error(msg);
    }
    return data;
  },

  async put(path, body) {
    var res = await fetch(this.base + path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('PUT ' + path + ': ' + res.status);
    return _parseJsonResponse(await res.text(), 'PUT', path);
  },

  async del(path) {
    var res = await fetch(this.base + path, { method: 'DELETE' });
    if (!res.ok) throw new Error('DELETE ' + path + ': ' + res.status);
    return _parseJsonResponse(await res.text(), 'DELETE', path);
  },
};


window.loadFromBackend = async function () {
  try {
    var results = await Promise.all([
      API.get('/api/dashboard/stats'),
      API.get('/api/subjects'),
      API.get('/api/businesses'),
      API.get('/api/records?page_size=200'),
      API.get('/api/plans'),
      API.get('/api/fx-exposures'),
      API.get('/api/mapping-rules'),
      API.get('/api/time-periods'),
      API.get('/api/subject-category-map'),
      API.get('/api/subject-plan-map'),
      API.get('/api/fetch-tasks'),
      API.get('/api/sync-logs?limit=100'),
      API.get('/api/collections'),
    ]);
    AppData.stats = results[0] || {};
    AppData.subjects = results[1] || [];
    AppData.businesses = results[2] || [];
    AppData.records = results[3] || { items: [], total: 0 };
    AppData.plans = results[4] || [];
    AppData.fxExposures = results[5] || [];
    AppData.mappingRules = results[6] || [];
    AppData.timePeriods = results[7] || [];
    AppData.subjectBizMapping = (results[8] || []).map(function (m) {
      return {
        id: m.id,
        subject_id: m.subject_id,
        subject_code: m.subject_code,
        subject_name: m.subject_name,
        direction: m.direction,
        biz_codes: m.biz_codes || [],
      };
    });
    AppData.subjectPlanMapping = (results[9] || []).map(function (m) {
      return {
        id: m.id,
        subject_ids: m.subject_ids || [],
        direction: m.direction,
        plan_subject: m.plan_subject || m.plan_subject_name || '',
      };
    });
    AppData.serverSyncLogs = results[11] || [];
    AppData.collections = results[12] || [];
    AppData.fetchTasks = (results[10] || []).map(function (t) {
      return {
        id: t.id,
        name: t.name,
        type: t.task_type,
        cron: t.cron_expr,
        enabled: t.enabled,
        filters_json: t.filters_json || '[]',
        extra_json: t.extra_json || '{}',
        system: '资金管理系统',
        last_run: '-',
        status: '正常',
      };
    });
    return true;
  } catch (e) {
    console.warn('Backend unavailable, loading mock data.', e);
    _loadMockData();
    return false;
  }
};


window.cfReloadCoreData = async function () {
  if (!API.base) return false;
  try {
    AppData.records = (await API.get('/api/records?page_size=200')) || { items: [], total: 0 };
    AppData.collections = (await API.get('/api/collections')) || [];
    AppData.plans = (await API.get('/api/plans')) || [];
    AppData.mappingRules = (await API.get('/api/mapping-rules')) || [];
    AppData.stats = (await API.get('/api/dashboard/stats')) || {};
    AppData.fetchTasks = ((await API.get('/api/fetch-tasks')) || []).map(function (t) {
      return {
        id: t.id, name: t.name, type: t.task_type, cron: t.cron_expr, enabled: t.enabled,
        filters_json: t.filters_json || '[]',
        extra_json: t.extra_json || '{}',
        system: '资金管理系统', last_run: '-', status: '正常',
      };
    });
    AppData.serverSyncLogs = (await API.get('/api/sync-logs?limit=100')) || [];
    return true;
  } catch (e) {
    return false;
  }
};

/** 基础数据 Tab：科目 / 业务 / 时间段 / 两类映射（与 loadFromBackend 字段一致） */
window.cfReloadBaseData = async function () {
  if (!API.base) return false;
  try {
    var results = await Promise.all([
      API.get('/api/subjects'),
      API.get('/api/businesses'),
      API.get('/api/time-periods'),
      API.get('/api/subject-category-map'),
      API.get('/api/subject-plan-map'),
    ]);
    AppData.subjects = results[0] || [];
    AppData.businesses = results[1] || [];
    AppData.timePeriods = results[2] || [];
    AppData.subjectBizMapping = (results[3] || []).map(function (m) {
      return {
        id: m.id,
        subject_id: m.subject_id,
        subject_code: m.subject_code,
        subject_name: m.subject_name,
        direction: m.direction,
        biz_codes: m.biz_codes || [],
      };
    });
    AppData.subjectPlanMapping = (results[4] || []).map(function (m) {
      return {
        id: m.id,
        subject_ids: m.subject_ids || [],
        direction: m.direction,
        plan_subject: m.plan_subject || m.plan_subject_name || '',
      };
    });
    return true;
  } catch (e) {
    console.warn('cfReloadBaseData', e);
    return false;
  }
};


function _loadMockData() {
  var today = new Date();
  function d(off) { var t = new Date(today); t.setDate(t.getDate() + off); return t.toISOString().slice(0, 10); }

  AppData.stats = {
    total_inflow: 26500000, total_outflow: 17850000, net_position: 8650000,
    record_count: 23, confirmed: 12, predicted: 7, unconfirmed: 2,
    fx_exposure_count: 4, fx_total_notional: 29300000,
    units: ['总部', '华东子公司', '华南子公司'],
  };

  AppData.subjects = [
    { id: 1, code: '100', name: '期初余额', direction: '流入', is_period: '期初', parent_id: null, valid: true },
    { id: 2, code: '900', name: '期末余额', direction: '流入', is_period: '期末', parent_id: null, valid: true },
    { id: 3, code: '200', name: '经营性流入', direction: '流入', is_period: '否', parent_id: null, valid: true },
    { id: 4, code: '200001', name: '销售回款', direction: '流入', is_period: '否', parent_id: 3, valid: true },
    { id: 5, code: '200002', name: '其他经营收入', direction: '流入', is_period: '否', parent_id: 3, valid: true },
    { id: 6, code: '300', name: '投资性流入', direction: '流入', is_period: '否', parent_id: null, valid: true },
    { id: 7, code: '300001', name: '利息收入', direction: '流入', is_period: '否', parent_id: 6, valid: true },
    { id: 8, code: '300002', name: '理财赎回', direction: '流入', is_period: '否', parent_id: 6, valid: true },
    { id: 9, code: '400', name: '融资性流入', direction: '流入', is_period: '否', parent_id: null, valid: true },
    { id: 10, code: '400001', name: '借款流入', direction: '流入', is_period: '否', parent_id: 9, valid: true },
    { id: 11, code: '500', name: '经营性流出', direction: '流出', is_period: '否', parent_id: null, valid: true },
    { id: 12, code: '500001', name: '采购付款', direction: '流出', is_period: '否', parent_id: 11, valid: true },
    { id: 13, code: '500002', name: '应付职工薪酬', direction: '流出', is_period: '否', parent_id: 11, valid: true },
    { id: 14, code: '500003', name: '费用报销', direction: '流出', is_period: '否', parent_id: 11, valid: true },
    { id: 15, code: '500004', name: '税费支出', direction: '流出', is_period: '否', parent_id: 11, valid: true },
    { id: 16, code: '600', name: '投资性流出', direction: '流出', is_period: '否', parent_id: null, valid: true },
    { id: 17, code: '600001', name: '理财购入', direction: '流出', is_period: '否', parent_id: 16, valid: true },
    { id: 18, code: '700', name: '融资性流出', direction: '流出', is_period: '否', parent_id: null, valid: true },
    { id: 19, code: '700001', name: '还款本金', direction: '流出', is_period: '否', parent_id: 18, valid: true },
    { id: 20, code: '700002', name: '利息支出', direction: '流出', is_period: '否', parent_id: 18, valid: true },
  ];

  AppData.businesses = [
    { id: 1, code: '001', name: '付款', biz_type: '一般资金流', valid: true },
    { id: 2, code: '002', name: '收款', biz_type: '一般资金流', valid: true },
    { id: 3, code: '003', name: '费用报销', biz_type: '一般资金流', valid: true },
    { id: 4, code: '004', name: '代发工资', biz_type: '一般资金流', valid: true },
    { id: 5, code: '005', name: '资金调拨付款', biz_type: '一般资金流', valid: true },
    { id: 6, code: '006', name: '资金调拨收款', biz_type: '一般资金流', valid: true },
    { id: 7, code: '007', name: '保证金', biz_type: '保证金', valid: true },
    { id: 8, code: '008', name: '应付票据', biz_type: '一般资金流', valid: true },
    { id: 9, code: '009', name: '应收票据', biz_type: '一般资金流', valid: true },
    { id: 10, code: '010', name: '银行借款', biz_type: '借款', valid: true },
    { id: 11, code: '016', name: '定期存款', biz_type: '定期存款', valid: true },
    { id: 12, code: '018', name: '协定存款', biz_type: '协定存款', valid: true },
    { id: 13, code: '019', name: '金额理财', biz_type: '金额理财', valid: true },
    { id: 14, code: '027', name: '外汇即期', biz_type: '外汇即远期', valid: true },
    { id: 15, code: '028', name: '外汇远期', biz_type: '外汇即远期', valid: true },
    { id: 16, code: '030', name: '外汇期权', biz_type: '外汇期权', valid: true },
    { id: 17, code: '031', name: '社保缴纳', biz_type: '一般资金流', valid: true },
    { id: 18, code: '032', name: '公积金缴纳', biz_type: '一般资金流', valid: true },
  ];

  AppData.collections = [
    { id: 1, code: 'BATCH1740000000000', created_at: '2026-03-01T10:00:00', source_system: '资金管理系统' },
    { id: 2, code: 'BATCH1741000000000', created_at: '2026-03-15T14:30:00', source_system: '手工新增' },
  ];

  /* 演示库：同一组织维度（总部/华东/华南）+ 科目↔业务映射可追溯；银行流水字段尽量完整 */
  var mockRecords = [
    { id:1, code:'CF202603010001', unit:'总部', currency:'CNY', amount:5800000, trade_date:d(-25), status:'已确认', source_system:'资金管理系统', biz_id: 2, collection_id: 1, source_ref: 'N2404280000001',
      self_account_no: '6222000000123456', self_account_name: '总部-基本户', counterparty_account: '6440****9912', counterparty_name: '某客户股份有限公司', bank_name: '招商银行上海分行', summary: '销售回款' },
    { id:2, code:'CF202603020002', unit:'总部', currency:'CNY', amount:-2300000, trade_date:d(-22), status:'已确认', source_system:'资金管理系统', biz_id: 1, collection_id: 1,
      self_account_no: '6222000000123456', self_account_name: '总部-基本户', counterparty_account: '3100****7788', counterparty_name: '某供应商有限公司', bank_name: '工商银行深圳分行', summary: '采购付款' },
    { id:3, code:'CF202603030003', unit:'总部', currency:'CNY', amount:-450000, trade_date:d(-18), status:'已确认', source_system:'资金管理系统', biz_id: 1, collection_id: 1,
      self_account_no: '6222000000123456', self_account_name: '总部-基本户', counterparty_account: '4401****6620', counterparty_name: '某材料有限公司', bank_name: '建设银行深圳分行', summary: '采购付款' },
    { id:4, code:'CF202603040004', unit:'总部', currency:'CNY', amount:-1200000, trade_date:d(-15), status:'已确认', source_system:'资金管理系统', biz_id: 4, collection_id: 1,
      self_account_no: '6222000000123456', self_account_name: '总部-基本户', counterparty_account: '6214****8890', counterparty_name: '代发薪酬账户', bank_name: '中国银行深圳分行', summary: '代发工资' },
    { id:5, code:'CF202603050005', unit:'总部', currency:'CNY', amount:3200000, trade_date:d(-8), status:'已确认', source_system:'资金管理系统', biz_id: 2, collection_id: 1,
      self_account_no: '6222000000123456', self_account_name: '总部-基本户', counterparty_account: '6225****1100', counterparty_name: '某贸易公司', bank_name: '农业银行深圳分行', summary: '销售回款' },
    { id:6, code:'CF202603060006', unit:'华东子公司', currency:'CNY', amount:4100000, trade_date:d(-20), status:'已确认', source_system:'资金管理系统', biz_id: 2, collection_id: 1,
      self_account_no: '6222000000210001', self_account_name: '华东-基本户', counterparty_account: '6228****3344', counterparty_name: '华东销售客户A', bank_name: '浦发银行上海分行', summary: '销售回款' },
    { id:7, code:'CF202603070007', unit:'华东子公司', currency:'CNY', amount:-1800000, trade_date:d(-12), status:'已确认', source_system:'资金管理系统', biz_id: 1, collection_id: 1,
      self_account_no: '6222000000210001', self_account_name: '华东-基本户', counterparty_account: '6228****5566', counterparty_name: '华东供应商B', bank_name: '交通银行上海分行', summary: '采购付款' },
    { id:8, code:'CF202603080008', unit:'华东子公司', currency:'CNY', amount:-280000, trade_date:d(-6), status:'未确认', source_system:'手工新增', biz_id: 3, collection_id: 2,
      self_account_no: '6222000000210001', self_account_name: '华东-基本户', counterparty_account: '—', counterparty_name: '费用报销待核对', bank_name: '—', summary: '费用报销' },
    { id:9, code:'CF202603090009', unit:'华南子公司', currency:'CNY', amount:2600000, trade_date:d(-18), status:'已确认', source_system:'资金管理系统', biz_id: 2, collection_id: 1,
      self_account_no: '6222000000310002', self_account_name: '华南-基本户', counterparty_account: '6225****9900', counterparty_name: '华南客户C', bank_name: '招商银行广州分行', summary: '销售回款' },
    { id:10, code:'CF202603100010', unit:'华南子公司', currency:'CNY', amount:-1500000, trade_date:d(-10), status:'未确认', source_system:'手工新增', biz_id: 1, collection_id: 2,
      self_account_no: '6222000000310002', self_account_name: '华南-基本户', counterparty_account: '6225****7711', counterparty_name: '华南供应商D', bank_name: '建设银行广州分行', summary: '采购付款' },
    { id:11, code:'CF202603110011', unit:'总部', currency:'CNY', amount:6200000, trade_date:d(5), status:'预测', source_system:'手工新增', biz_id: 2,
      self_account_no: '6222000000123456', self_account_name: '总部-基本户', counterparty_account: '—', counterparty_name: '预测回款', bank_name: '—', summary: '预测-销售回款' },
    { id:12, code:'CF202603120012', unit:'总部', currency:'CNY', amount:-2800000, trade_date:d(8), status:'预测', source_system:'手工新增', biz_id: 1,
      self_account_no: '6222000000123456', self_account_name: '总部-基本户', counterparty_account: '—', counterparty_name: '预测付款', bank_name: '—', summary: '预测-采购付款' },
    { id:13, code:'CF202603130013', unit:'总部', currency:'CNY', amount:-1200000, trade_date:d(12), status:'预测', source_system:'手工新增', biz_id: 4,
      self_account_no: '6222000000123456', self_account_name: '总部-基本户', counterparty_account: '—', counterparty_name: '预测薪酬', bank_name: '—', summary: '预测-代发工资' },
    { id:14, code:'CF202603140014', unit:'华东子公司', currency:'CNY', amount:3800000, trade_date:d(10), status:'预测', source_system:'手工新增', biz_id: 2,
      self_account_no: '6222000000210001', self_account_name: '华东-基本户', counterparty_account: '—', counterparty_name: '预测回款', bank_name: '—', summary: '预测-销售回款' },
    { id:15, code:'CF202603150015', unit:'华东子公司', currency:'CNY', amount:-2100000, trade_date:d(15), status:'预测', source_system:'手工新增', biz_id: 1,
      self_account_no: '6222000000210001', self_account_name: '华东-基本户', counterparty_account: '—', counterparty_name: '预测付款', bank_name: '—', summary: '预测-采购付款' },
    { id:16, code:'CF202603160016', unit:'华南子公司', currency:'CNY', amount:2900000, trade_date:d(7), status:'预测', source_system:'手工新增', biz_id: 2,
      self_account_no: '6222000000310002', self_account_name: '华南-基本户', counterparty_account: '—', counterparty_name: '预测回款', bank_name: '—', summary: '预测-销售回款' },
    { id:17, code:'CF202603170017', unit:'华南子公司', currency:'CNY', amount:-1200000, trade_date:d(18), status:'预测', source_system:'手工新增', biz_id: 3,
      self_account_no: '6222000000310002', self_account_name: '华南-基本户', counterparty_account: '—', counterparty_name: '预测费用', bank_name: '—', summary: '预测-费用报销' },
    { id:18, code:'CF202603180018', unit:'总部', currency:'USD', amount:850000, trade_date:d(-14), status:'已确认', source_system:'资金管理系统', biz_id: 2, collection_id: 1,
      self_account_no: '6222000000123456', self_account_name: '总部-美元户', counterparty_account: 'NRA****9012', counterparty_name: '某境外客户', bank_name: '中国银行深圳分行', summary: '出口收汇' },
    { id:19, code:'CF202603190019', unit:'总部', currency:'USD', amount:-620000, trade_date:d(3), status:'预测', source_system:'手工新增', biz_id: 3,
      self_account_no: '6222000000123456', self_account_name: '总部-美元户', counterparty_account: '—', counterparty_name: '预测费用', bank_name: '—', summary: '预测-费用' },
    { id:20, code:'CF202604010020', unit:'华南子公司', currency:'CNY', amount:-50000, trade_date:d(-2), status:'暂存', source_system:'手工新增', biz_id: 4, source_ref: '',
      self_account_no: '6222000000310002', self_account_name: '华南-基本户', counterparty_account: '—', counterparty_name: '—', bank_name: '—', summary: '代发工资（暂存）' },
    { id:21, code:'CF202604020021', unit:'总部', currency:'CNY', amount:120000, trade_date:d(-1), status:'打回', source_system:'手工新增', biz_id: 2, source_ref: 'TMP001',
      self_account_no: '6222000000123456', self_account_name: '总部-基本户', counterparty_account: '6225****0001', counterparty_name: '小额客户', bank_name: '招商银行深圳分行', summary: '销售回款（打回）' },
    { id:22, code:'CF202604030022', unit:'华东子公司', currency:'CNY', amount:3000000, trade_date:d(-3), status:'已确认', source_system:'银企直连', biz_id: 9, collection_id: 1,
      self_account_no: '3100****7788', self_account_name: '华东-票据托管户', counterparty_account: '3100****2001', counterparty_name: '承兑银行（演示）', bank_name: '工商银行票据中心', summary: '应收票据到期托收' },
    { id:23, code:'CF202604050023', unit:'总部', currency:'CNY', amount:-800000, trade_date:d(-1), status:'已确认', source_system:'资金管理系统', biz_id: 8, collection_id: 1, source_ref: 'BP202604001',
      self_account_no: '6222000000123456', self_account_name: '总部-基本户', counterparty_account: '4402****3300', counterparty_name: '某纸业集团', bank_name: '中信银行票据中心', summary: '应付票据到期兑付' },
  ];
  AppData.records = { items: mockRecords, total: mockRecords.length };

  AppData.plans = [
    { id:1, unit:'总部', period_type:'月', period_label:'2026年4月', status:'草稿', data_json:'{"经营性流入":5200000,"经营性流出":-3800000,"投资性流入":200000,"投资性流出":-500000,"融资性流入":1000000,"融资性流出":-800000}' },
    { id:2, unit:'华东子公司', period_type:'月', period_label:'2026年4月', status:'草稿', data_json:'{"经营性流入":3000000,"经营性流出":-2200000,"投资性流入":200000,"投资性流出":-500000,"融资性流入":1000000,"融资性流出":-800000}' },
    { id:3, unit:'华南子公司', period_type:'月', period_label:'2026年4月', status:'草稿', data_json:'{"经营性流入":3000000,"经营性流出":-2200000,"投资性流入":200000,"投资性流出":-500000,"融资性流入":1000000,"融资性流出":-800000}' },
  ];

  AppData.fxExposures = [
    { id:1, currency_pair:'USD/CNY', notional:12500000, direction:'买入', maturity:d(30), hedge_ratio:0.65, instrument:'远期', pnl:185000, status:'持有' },
    { id:2, currency_pair:'USD/CNY', notional:8000000, direction:'卖出', maturity:d(60), hedge_ratio:0.40, instrument:'期权', pnl:-92000, status:'持有' },
    { id:3, currency_pair:'EUR/CNY', notional:5600000, direction:'买入', maturity:d(45), hedge_ratio:0.50, instrument:'远期', pnl:68000, status:'持有' },
    { id:4, currency_pair:'SAR/CNY', notional:3200000, direction:'买入', maturity:d(90), hedge_ratio:0, instrument:'无对冲', pnl:0, status:'未对冲' },
  ];

  AppData.mappingRules = [
    { id:1, code:'MR000001', name:'应付票据取数规则', source_system:'资金管理系统', source_doc_type:'应付票据', valid:true },
    { id:2, code:'MR000002', name:'应收票据取数规则', source_system:'资金管理系统', source_doc_type:'应收票据', valid:true },
    { id:3, code:'MR000003', name:'银行借款取数规则', source_system:'资金管理系统', source_doc_type:'银行借款', valid:true },
    { id:4, code:'MR000004', name:'保证金取数规则', source_system:'资金管理系统', source_doc_type:'保证金', valid:true },
    { id:5, code:'MR000005', name:'协定存款取数规则', source_system:'资金管理系统', source_doc_type:'协定存款', valid:true },
    { id:6, code:'MR000006', name:'开出信用证取数规则', source_system:'资金管理系统', source_doc_type:'开出信用证', valid:true },
  ];

  AppData.timePeriods = [
    { id:1, code:'TP0001', name:'标准预测周期（天7+周4+月3+季2+年1）', periods_json:'[{"freq":"天","length":7},{"freq":"周","length":4},{"freq":"月","length":3},{"freq":"季","length":2},{"freq":"年","length":1}]', valid:true },
    { id:2, code:'TP0002', name:'短期滚动（天14+月2）', periods_json:'[{"freq":"天","length":14},{"freq":"月","length":2}]', valid:true },
  ];

  AppData.subjectBizMapping = [
    { id:1, subject_id:4, subject_code:'200001', subject_name:'销售回款', direction:'流入', biz_codes:['002','006','009'] },
    { id:2, subject_id:5, subject_code:'200002', subject_name:'其他经营收入', direction:'流入', biz_codes:['006'] },
    { id:3, subject_id:7, subject_code:'300001', subject_name:'利息收入', direction:'流入', biz_codes:['018'] },
    { id:4, subject_id:10, subject_code:'400001', subject_name:'借款流入', direction:'流入', biz_codes:['010'] },
    { id:5, subject_id:12, subject_code:'500001', subject_name:'采购付款', direction:'流出', biz_codes:['001','003','008'] },
    { id:6, subject_id:13, subject_code:'500002', subject_name:'应付职工薪酬', direction:'流出', biz_codes:['004','017','018'] },
    { id:7, subject_id:14, subject_code:'500003', subject_name:'费用报销', direction:'流出', biz_codes:['003'] },
    { id:8, subject_id:17, subject_code:'600001', subject_name:'理财购入', direction:'流出', biz_codes:['019'] },
    { id:9, subject_id:19, subject_code:'700001', subject_name:'还款本金', direction:'流出', biz_codes:['010'] },
  ];

  AppData.subjectPlanMapping = [
    { id:1, subject_ids:[4,5], plan_subject:'经营性流入', direction:'流入' },
    { id:2, subject_ids:[7,8], plan_subject:'投资性流入', direction:'流入' },
    { id:3, subject_ids:[10], plan_subject:'融资性流入', direction:'流入' },
    { id:4, subject_ids:[12,13,14,15], plan_subject:'经营性流出', direction:'流出' },
    { id:5, subject_ids:[17], plan_subject:'投资性流出', direction:'流出' },
    { id:6, subject_ids:[19,20], plan_subject:'融资性流出', direction:'流出' },
  ];

  AppData.syncLogs = [
    { id:1, time: d(-2) + ' 09:30', system:'资金管理系统', action:'自动取数', records_count:5, status:'成功' },
    { id:2, time: d(-1) + ' 14:15', system:'资金管理系统', action:'自动取数', records_count:3, status:'成功' },
    { id:3, time: d(0) + ' 08:00', system:'资金管理系统', action:'手动同步', records_count:2, status:'成功' },
  ];

  AppData.fetchTasks = [
    { id:1, name:'资金流自动获取', type:'资金流自动获取', system:'资金管理系统', cron:'每日 08:00', enabled:true, last_run: d(0) + ' 08:00', status:'正常' },
    { id:2, name:'资金计划取预测数据', type:'资金计划自动获取资金预测', system:'资金分析预测', cron:'每周一 09:00', enabled:true, last_run: d(-1) + ' 09:00', status:'正常' },
  ];

  AppData.actualExecution = [
    { id:1, plan_id:1, unit:'总部', period_label:'2026年3月', actual_json:'{"经营性流入":4800000,"经营性流出":-3500000,"投资性流入":180000,"投资性流出":-550000,"融资性流入":900000,"融资性流出":-750000}', plan_json:'{"经营性流入":5200000,"经营性流出":-3800000,"投资性流入":200000,"投资性流出":-500000,"融资性流入":1000000,"融资性流出":-800000}' },
    { id:2, plan_id:2, unit:'华东子公司', period_label:'2026年3月', actual_json:'{"经营性流入":2400000,"经营性流出":-2600000,"投资性流入":150000,"投资性流出":-400000,"融资性流入":800000,"融资性流出":-700000}', plan_json:'{"经营性流入":3000000,"经营性流出":-2200000,"投资性流入":200000,"投资性流出":-500000,"融资性流入":1000000,"融资性流出":-800000}' },
    { id:3, plan_id:3, unit:'华南子公司', period_label:'2026年3月', actual_json:'{"经营性流入":3200000,"经营性流出":-2000000,"投资性流入":250000,"投资性流出":-480000,"融资性流入":1100000,"融资性流出":-850000}', plan_json:'{"经营性流入":3000000,"经营性流出":-2200000,"投资性流入":200000,"投资性流出":-500000,"融资性流入":1000000,"融资性流出":-800000}' },
  ];

  AppData.deviationLogs = [
    { id:1, plan_id:1, unit:'总部', period_label:'2026年2月', deviation_rate:0.08, level:'正常', subject:'经营性流入', created_at: d(-30), handled:true, action:'记录' },
    { id:2, plan_id:2, unit:'华东子公司', period_label:'2026年2月', deviation_rate:0.15, level:'关注', subject:'经营性流出', created_at: d(-30), handled:true, action:'分析师已复核' },
    { id:3, plan_id:1, unit:'总部', period_label:'2026年3月', deviation_rate:0.07, level:'正常', subject:'经营性流入', created_at: d(-2), handled:true, action:'记录' },
    { id:4, plan_id:2, unit:'华东子公司', period_label:'2026年3月', deviation_rate:0.20, level:'关注', subject:'经营性流入', created_at: d(-1), handled:false, action:null },
    { id:5, plan_id:2, unit:'华东子公司', period_label:'2026年3月', deviation_rate:0.18, level:'关注', subject:'经营性流出', created_at: d(-1), handled:false, action:null },
  ];

  AppData.alertQueue = [
    { id:1, type:'偏差预警', level:'关注', title:'华东子公司经营性流入偏差 20%', desc:'2026年3月实际流入低于计划，建议分析师复核预测参数', target_page:'analysis', created_at: d(-1), status:'待处理', ai_suggestion:'建议下调华东子公司下期经营性流入预测至 260 万', handled_at:null, handle_action:null },
    { id:2, type:'偏差预警', level:'关注', title:'华东子公司经营性流出偏差 18%', desc:'2026年3月实际流出高于计划', target_page:'analysis', created_at: d(-1), status:'待处理', ai_suggestion:'流出增加主要由临时采购导致，建议提高下期流出预估 15%', handled_at:null, handle_action:null },
  ];

  AppData.closedLoopKPI = {
    deviation_converge_months: 2.1,
    alert_handle_avg_hours: 1.5,
    plan_execution_deviation: 0.12,
    sync_timeliness: 0.995,
    ai_adopt_rate: 0.65,
  };

  var now = new Date().toISOString().slice(0, 16).replace('T', ' ');
  Object.keys(AppData.systemHealth).forEach(function (k) {
    AppData.systemHealth[k].lastCheck = now;
  });
}


window.calcDeviationLevel = function (rate) {
  var abs = Math.abs(rate);
  if (abs <= 0.10) return { level: '正常', color: '#34C759' };
  if (abs <= 0.20) return { level: '关注', color: '#F26522' };
  if (abs <= 0.50) return { level: '预警', color: '#F26522' };
  return { level: '严重', color: '#FF3B30' };
};

window.calcDeviationForExec = function (exec) {
  var plan = {}, actual = {};
  try { plan = JSON.parse(exec.plan_json || '{}'); } catch (e) {}
  try { actual = JSON.parse(exec.actual_json || '{}'); } catch (e) {}
  var items = [];
  Object.keys(plan).forEach(function (k) {
    var pv = Math.abs(plan[k] || 0);
    var av = Math.abs(actual[k] || 0);
    var rate = pv > 0 ? (av - pv) / pv : 0;
    var info = calcDeviationLevel(rate);
    items.push({ subject: k, planned: plan[k] || 0, actual: actual[k] || 0, rate: rate, level: info.level, color: info.color });
  });
  return items;
};

window.refreshClosedLoopKPI = function () {
  var logs = AppData.deviationLogs || [];
  var alerts = AppData.alertQueue || [];
  var syncLogs = AppData.syncLogs || [];
  var tasks = AppData.fetchTasks || [];

  var handled = alerts.filter(function (a) { return a.status === '已处理'; });
  var adopted = handled.filter(function (a) { return a.handle_action === '采纳'; });

  var devRates = logs.map(function (l) { return Math.abs(l.deviation_rate); });
  var avgDev = devRates.length ? devRates.reduce(function (a, b) { return a + b; }, 0) / devRates.length : 0;

  AppData.closedLoopKPI = {
    deviation_converge_months: Math.max(1, 3 - (handled.length * 0.3)).toFixed(1),
    alert_handle_avg_hours: handled.length ? 1.5 : 0,
    plan_execution_deviation: avgDev,
    sync_timeliness: syncLogs.length ? 0.99 + Math.random() * 0.01 : 1.0,
    ai_adopt_rate: handled.length ? adopted.length / handled.length : 0,
    total_alerts: alerts.length,
    pending_alerts: alerts.filter(function (a) { return a.status === '待处理'; }).length,
    handled_alerts: handled.length,
    total_deviations: logs.length,
  };
};

window.validateRecord = function (rec) {
  var errors = [];
  if (!rec.unit || !rec.unit.trim()) errors.push('单位为必填项');
  if (!rec.currency || !rec.currency.trim()) errors.push('币种为必填项');
  if (rec.amount == null || isNaN(rec.amount) || rec.amount === 0) errors.push('金额不能为空或零');
  if (!rec.trade_date) errors.push('交易日期为必填项');
  if (Math.abs(rec.amount || 0) > 50000000) errors.push('单笔金额超过 5000 万阈值，需人工复核');
  var dupes = (AppData.records.items || []).filter(function (r) {
    return r.code === rec.code && r.trade_date === rec.trade_date && r.id !== rec.id;
  });
  if (dupes.length > 0) errors.push('存在相同编号+日期的重复记录');
  return errors;
};

window.toggleServiceHealth = function (serviceKey) {
  var svc = AppData.systemHealth[serviceKey];
  if (!svc) return;
  var states = ['ok', 'degraded', 'offline'];
  var idx = states.indexOf(svc.status);
  svc.status = states[(idx + 1) % states.length];
  svc.lastCheck = new Date().toISOString().slice(0, 16).replace('T', ' ');
};

window.refreshStats = function () {
  var recs = AppData.records.items || [];
  var inflow = 0, outflow = 0, confirmed = 0, predicted = 0, unconfirmed = 0, pendingReview = 0;
  recs.forEach(function (r) {
    if (r.currency && r.currency !== 'CNY') return;
    if (r.amount > 0) inflow += r.amount; else outflow += Math.abs(r.amount);
    if (r.status === '已确认') confirmed++;
    else if (r.status === '预测') predicted++;
    else if (r.status === '未确认' || r.status === '待确认') unconfirmed++;
    else if (r.status === '待审核') pendingReview++;
  });
  var fx = AppData.fxExposures || [];
  AppData.stats = {
    total_inflow: inflow,
    total_outflow: outflow,
    net_position: inflow - outflow,
    record_count: recs.length,
    confirmed: confirmed,
    predicted: predicted,
    unconfirmed: unconfirmed,
    pending_review: pendingReview,
    fx_exposure_count: fx.length,
    fx_total_notional: fx.reduce(function (a, e) { return a + (e.notional || 0); }, 0),
    units: ['总部', '华东子公司', '华南子公司'],
  };
};

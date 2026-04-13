/**
 * app.js — 启动入口 + 8 页渲染 + 全模块交互打通
 */

/** PRD / iframe 内嵌：URL 含 ?embed=1 时跳过角色选择页，未选角色则默认司库经理（全模块可见） */
(function () {
  try {
    var q = window.location.search || '';
    if (/[?&]embed=1(?:&|$)/.test(q)) {
      if (!sessionStorage.getItem('cf_role')) {
        sessionStorage.setItem('cf_role', 'treasurer');
      }
      document.documentElement.classList.add('embed');
      if (document.body) document.body.classList.add('embed');
    }
  } catch (e) {}
})();

(async function () {
  /** 仅当节点存在时绑定，避免部分壳页/缓存旧 HTML 时 null.addEventListener */
  function _domOn(id, evt, handler) {
    var el = document.getElementById(id);
    if (el) el.addEventListener(evt, handler);
  }

  var role = Auth.getCurrentRole();
  if (!role) { window.location.href = 'index.html'; return; }

  var avatar = document.getElementById('topbar-avatar');
  var username = document.getElementById('topbar-username');
  if (avatar) {
    var svg = (window.AppData.roleSvg && window.AppData.roleSvg[role.id]) || '';
    avatar.innerHTML = svg;
  }
  if (username) username.textContent = role.name;
  var _topLogout = document.getElementById('topbar-logout');
  if (_topLogout) _topLogout.addEventListener('click', function () { Auth.logout(); });

  var tbb = document.getElementById('topbar-bell');
  var tbbBadge = document.getElementById('topbar-bell-badge');
  if (tbbBadge) tbbBadge.textContent = '4';
  if (tbb) {
    tbb.addEventListener('click', function () {
      Toast.info('当前 4 条预警：超期应收/应付、头寸警戒线等（演示）');
    });
  }
  var intAiBtn = document.getElementById('int-btn-ai-parse');
  if (intAiBtn) {
    intAiBtn.addEventListener('click', function () { Toast.info('AI 智能解析：功能规划中'); });
  }

  // 在 await 之前挂载 openModal / 模态关闭 / ⚙，避免首屏未加载完或 Toast 遮挡时点击无响应
  window.openModal = openModal;
  window.closeModal = closeModal;
  var _cfModalClose = document.getElementById('modal-close-btn');
  if (_cfModalClose) _cfModalClose.addEventListener('click', closeModal);
  var _cfModalMask = document.getElementById('modal-mask');
  if (_cfModalMask) _cfModalMask.addEventListener('click', function (e) { if (e.target === e.currentTarget) closeModal(); });
  var backendOk = await loadFromBackend();
  window.__cfBackendOk = backendOk;
  /** Agent：切换基础数据子 Tab（bd-subjects / bd-businesses / bd-timeperiods / bd-sbmap） */
  window.__cfSwitchBdTab = function (tabId) {
    var allow = { 'bd-subjects': 1, 'bd-businesses': 1, 'bd-timeperiods': 1, 'bd-sbmap': 1 };
    if (!tabId || !allow[tabId]) return;
    var tabs = document.querySelectorAll('#bd-tabs .content-tab');
    if (!tabs || !tabs.length) return;
    tabs.forEach(function (t) {
      t.classList.toggle('active', t.dataset.tab === tabId);
    });
    ['bd-subjects', 'bd-businesses', 'bd-timeperiods', 'bd-sbmap'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.display = id === tabId ? '' : 'none';
    });
  };
  refreshStats();

  async function syncPlanRemote(p) {
    if (!backendOk || !p || !p.id) return;
    var dj = typeof p.data_json === 'string' ? p.data_json : JSON.stringify(p.data_json || {});
    try {
      await API.put('/api/plans/' + p.id, {
        unit: p.unit,
        period_type: p.period_type,
        period_label: p.period_label,
        data_json: dj,
        status: p.status || '草稿',
        data_source: p.data_source || '资金流数据',
      });
    } catch (e) { console.warn('syncPlanRemote', e); }
  }

  Router.onNavigate(onNavigate);
  Router.init();
  if (!window.location.hash) Router.navigate(role.pages[0] || 'dashboard');

  function onNavigate(page) {
    _updateDegradationUI();
    switch (page) {
      case 'dashboard':   renderDashboard(); break;
      case 'cashflow':    renderCashflow(); break;
      case 'analysis':    renderAnalysis(); break;
      case 'basedata':    renderBaseData(); break;
      case 'liquidity':   renderLiquidityMvp(); break;
      case 'integration': renderIntegration(); break;
    }
  }

  // ═══════════════════════════════════════════════
  // 1. DASHBOARD — KPI可点击 + 告警可跳转
  // ═══════════════════════════════════════════════

  function renderDashboard() {
    refreshStats();
    refreshClosedLoopKPI();
    var updateEl = document.getElementById('dash-last-update');
    if (updateEl) {
      var now = new Date();
      updateEl.textContent = '更新于 ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ':' + String(now.getSeconds()).padStart(2, '0');
    }
    var s = AppData.stats || {};
    var rc = s.record_count || 0;
    var conf = s.confirmed || 0;
    var pred = s.predicted || 0;
    var unc = s.unconfirmed || 0;

    document.getElementById('dash-kpi').innerHTML =
      kpi('净头寸(CNY)', fmtAmt(s.net_position), rc + ' 笔记录', null, 'cashflow') +
      kpi('总流入', fmtAmt(s.total_inflow), '已确认 ' + conf + ' 笔', 'up', 'analysis') +
      kpi('总流出', fmtAmt(s.total_outflow), '预测 ' + pred + ' 笔', 'down', 'analysis') +
      kpi('现金流预测', 'MVP', '滚动与关键节点', null, 'liquidity');

    Charts.positionTrend('chart-position-trend', AppData.records.items || []);
    Charts.flowPie('chart-flow-pie', s);
    window.onFlowPieSectorClick = function (name) {
      AppData.pieDrillCategory = name;
      try { sessionStorage.setItem('cf_pie_drill', name); } catch (e) {}
      Router.navigate('cashflow');
    };

    var pr = s.pending_review || 0;
    var alerts = [];
    if (pr > 0) alerts.push(insightHTML('danger', '🔴 ' + pr + ' 笔大额资金流待审核', 'cashflow'));
    if (unc > 0) alerts.push(insightHTML('warn', '⚠️ ' + unc + ' 笔待确认资金流待处理', 'cashflow'));
    if (pred > 0) alerts.push(insightHTML('info', '📊 ' + pred + ' 笔预测数据待确认', 'cashflow'));
    var draftPlans = (AppData.plans || []).filter(function (p) { return p.status === '草稿'; }).length;
    if (draftPlans > 0) alerts.push(insightHTML('warn', '📋 ' + draftPlans + ' 个计划草稿（后台仍存在，入口已合并至分析/预测）', 'analysis'));
    var pendingAlerts = (AppData.alertQueue || []).filter(function (a) { return a.status === '待处理'; }).length;
    if (pendingAlerts > 0) alerts.push(insightHTML('danger', '🔔 ' + pendingAlerts + ' 条偏差预警待处理', 'analysis'));
    if (!alerts.length) alerts.push(insightHTML('success', '✅ 暂无告警'));
    document.getElementById('dash-alerts').innerHTML = alerts.join('');

    _renderClosedLoopKPI();
    _renderAlertQueue();
    _renderSystemHealth();
    _bindDashClickable();
  }

  function kpi(label, value, sub, delta, navPage) {
    var colorStyle = '';
    if (delta === 'up')   colorStyle = ' style="color:#34C759;"';
    if (delta === 'down') colorStyle = ' style="color:#FF3B30;"';
    var navAttr = navPage ? ' data-nav="' + navPage + '"' : '';
    return '<div class="kpi"' + navAttr + '><div class="kpi-label">' + label + '</div>' +
      '<div class="kpi-value"' + colorStyle + '>' + value + '</div>' +
      '<div class="kpi-sub">' + (sub || '') + '</div></div>';
  }

  function insightHTML(type, text, navPage) {
    var navAttr = navPage ? ' data-nav="' + navPage + '"' : '';
    return '<div class="insight-card ' + type + '"' + navAttr + '>' + text + '</div>';
  }

  function _bindDashClickable() {
    document.querySelectorAll('#dash-kpi .kpi[data-nav]').forEach(function (el) {
      el.style.cursor = 'pointer';
      el.onclick = function () { Router.navigate(el.dataset.nav); };
    });
    document.querySelectorAll('#dash-alerts .insight-card[data-nav]').forEach(function (el) {
      el.onclick = function () { Router.navigate(el.dataset.nav); };
    });
  }

  function _renderClosedLoopKPI() {
    var kpiData = AppData.closedLoopKPI || {};
    var container = document.getElementById('dash-loop-kpi');
    if (!container) return;

    function bar(label, value, max, unit, thresholdGood, thresholdBad, invert) {
      var pct = Math.min((value / max) * 100, 100);
      var cls = 'ok';
      if (invert) { cls = value <= thresholdGood ? 'ok' : value <= thresholdBad ? 'warn' : 'bad'; }
      else { cls = value >= thresholdGood ? 'ok' : value >= thresholdBad ? 'warn' : 'bad'; }
      return '<div class="loop-kpi-bar"><span class="loop-kpi-label">' + label + '</span>' +
        '<div class="loop-kpi-track"><div class="loop-kpi-fill ' + cls + '" style="width:' + pct + '%;"></div></div>' +
        '<span class="loop-kpi-val">' + value + unit + '</span></div>';
    }

    container.innerHTML =
      '<div style="width:100%;">' +
      bar('偏差收敛周期', parseFloat(kpiData.deviation_converge_months || 0).toFixed(1), 6, ' 月', 3, 5, true) +
      bar('预警处理时长', parseFloat(kpiData.alert_handle_avg_hours || 0).toFixed(1), 8, ' 时', 2, 4, true) +
      bar('计划执行偏差', (parseFloat(kpiData.plan_execution_deviation || 0) * 100).toFixed(1), 50, '%', 10, 20, true) +
      bar('数据同步及时率', (parseFloat(kpiData.sync_timeliness || 0) * 100).toFixed(1), 100, '%', 99, 95, false) +
      bar('AI建议采纳率', (parseFloat(kpiData.ai_adopt_rate || 0) * 100).toFixed(0), 100, '%', 60, 40, false) +
      '</div>';
  }

  function _renderAlertQueue() {
    var queue = AppData.alertQueue || [];
    var container = document.getElementById('dash-alert-queue');
    var badge = document.getElementById('dash-alert-badge');
    if (!container) return;

    var pending = queue.filter(function (a) { return a.status === '待处理'; });
    if (badge) {
      if (pending.length > 0) { badge.style.display = ''; badge.textContent = pending.length + ' 条待处理'; }
      else { badge.style.display = 'none'; }
    }

    if (!queue.length) { container.innerHTML = '<div class="empty-state">暂无预警</div>'; return; }

    container.innerHTML = queue.map(function (a) {
      var icon = a.level === '严重' ? '🔴' : a.level === '预警' ? '🟠' : a.level === '关注' ? '🟡' : '🟢';
      var badgeCls = a.status === '待处理' ? 'pending' : 'handled';
      var handledInfo = a.status === '已处理' ? '<div class="alert-q-time">处理方式: ' + (a.handle_action || '-') + ' · ' + (a.handled_at || '') + '</div>' : '';
      return '<div class="alert-q-item' + (a.status === '已处理' ? ' is-handled' : '') + '">' +
        '<span class="alert-q-icon">' + icon + '</span>' +
        '<div class="alert-q-body">' +
          '<div class="alert-q-title">' + a.title + ' <span class="alert-q-badge ' + badgeCls + '">' + a.status + '</span></div>' +
          '<div class="alert-q-desc">' + a.desc + '</div>' +
          (a.ai_suggestion ? '<div class="alert-q-ai">' + a.ai_suggestion + '</div>' : '') +
          (a.status === '待处理' ?
            '<div class="alert-q-actions">' +
              '<button class="btn btn-sm btn-primary" onclick="handleAlert(' + a.id + ',\'采纳\')">✓ 采纳建议</button>' +
              '<button class="btn btn-sm" onclick="handleAlert(' + a.id + ',\'拒绝\')">✗ 拒绝</button>' +
            '</div>' : handledInfo) +
          '<div class="alert-q-time">' + (a.created_at || '') + '</div>' +
        '</div></div>';
    }).join('');
  }

  function _renderSystemHealth() {
    var container = document.getElementById('dash-sys-health');
    if (!container) return;
    var health = AppData.systemHealth || {};
    var statusLabels = { ok: '正常', degraded: '降级', offline: '离线' };
    container.innerHTML = Object.keys(health).map(function (key) {
      var svc = health[key];
      return '<div class="health-item" onclick="toggleServiceHealth(\'' + key + '\');this.closest(\'.page-panel\')&&renderDashboardHealth()">' +
        '<span class="health-dot ' + svc.status + '"></span>' +
        '<div><div class="health-name">' + svc.name + '</div>' +
        '<div class="health-status ' + svc.status + '">' + statusLabels[svc.status] +
        (svc.lastCheck ? ' · ' + svc.lastCheck : '') + '</div></div></div>';
    }).join('');
  }

  window.renderDashboardHealth = function () {
    _renderSystemHealth();
    _updateDegradationUI();
  };

  function _updateDegradationUI() {
    var aiStatus = AppData.systemHealth.ai ? AppData.systemHealth.ai.status : 'ok';
    var aiBtns = document.querySelectorAll('#ai-float-toggle, #ai-send-btn');
    aiBtns.forEach(function (btn) {
      if (aiStatus !== 'ok') {
        btn.style.opacity = '0.4';
        btn.style.pointerEvents = 'none';
        btn.title = 'AI 服务暂时不可用';
      } else {
        btn.style.opacity = '';
        btn.style.pointerEvents = '';
        btn.title = btn.id === 'ai-float-toggle' ? 'DataAgent 数据智能体' : '';
      }
    });

    var fetchQuick = document.getElementById('cf-btn-fetch-quick');
    var fetchOpts = document.getElementById('cf-btn-fetch-options');
    var bankStatus = AppData.systemHealth.bank ? AppData.systemHealth.bank.status : 'ok';
    if (fetchQuick) {
      if (bankStatus !== 'ok') {
        fetchQuick.textContent = '⬇ 一键获取 (降级)';
        fetchQuick.title =
          '银行接口' +
          (bankStatus === 'degraded' ? '降级' : '离线') +
          '；仍可按默认口径拉取（演示缓存）';
        if (fetchOpts) {
          fetchOpts.title =
            '自选条件拉取；银行接口' + (bankStatus === 'degraded' ? '降级' : '离线') + '时结果可能为缓存';
        }
      } else {
        fetchQuick.textContent = '⬇ 一键获取';
        fetchQuick.title = '默认：全部单位、不限日期、资金管理系统';
        if (fetchOpts) {
          fetchOpts.title = '自选单位、日期区间、来源系统、是否强制覆盖';
        }
      }
    }
  }

  window.handleAlert = function (id, action) {
    var alert = (AppData.alertQueue || []).find(function (a) { return a.id === id; });
    if (!alert) return;
    alert.status = '已处理';
    alert.handle_action = action;
    alert.handled_at = new Date().toISOString().slice(0, 16).replace('T', ' ');
    refreshClosedLoopKPI();

    if (action === '采纳') {
      Toast.success('已采纳 AI 建议，系统将自动调整下期预测参数');
    } else {
      openModal('记录拒绝原因',
        '<div class="form-group"><label>拒绝原因</label><textarea class="form-input" id="m-alert-reason" rows="3" style="width:100%;" placeholder="请简述拒绝原因..."></textarea></div>',
        function () {
          var reason = document.getElementById('m-alert-reason').value.trim();
          alert.reject_reason = reason || '未填写';
          Toast.info('已记录拒绝原因');
          closeModal();
          _renderAlertQueue();
        });
      return;
    }
    _renderAlertQueue();
  };

  _domOn('dash-btn-refresh', 'click', function () {
    refreshStats();
    refreshClosedLoopKPI();
    renderDashboard();
    _updateDegradationUI();
    Toast.success('数据已刷新');
  });

  // ═══════════════════════════════════════════════
  // 2. CASHFLOW — 获取数据 + 批量确认 + 导出
  // ═══════════════════════════════════════════════

  var cfPage = 1;
  var cfSubTab = 'records';
  var cfManualToggle = false;

  function cfDisplayStatus(s) {
    if (s === '未确认') return '待确认';
    return s || '';
  }

  function recordPutPayload(rec, status) {
    var td = rec.trade_date || null;
    var st = status || rec.status || '待确认';
    if (st === '待确认') st = '未确认';
    return {
      unit: rec.unit,
      currency: rec.currency || 'CNY',
      amount: rec.amount,
      biz_id: rec.biz_id != null ? rec.biz_id : null,
      trade_date: td,
      settle_date: rec.settle_date || td,
      status: st,
      source_system: rec.source_system || '手工新增',
      source_ref: rec.source_ref != null ? rec.source_ref : null,
      collection_id: rec.collection_id != null ? rec.collection_id : null,
      flows_json: rec.flows_json || '[]',
      self_account_no: rec.self_account_no != null ? rec.self_account_no : null,
      self_account_name: rec.self_account_name != null ? rec.self_account_name : null,
      counterparty_account: rec.counterparty_account != null ? rec.counterparty_account : null,
      counterparty_name: rec.counterparty_name != null ? rec.counterparty_name : null,
      bank_name: rec.bank_name != null ? rec.bank_name : null,
      summary: rec.summary != null ? rec.summary : null,
    };
  }

  function _cfCell(v) {
    if (v == null || v === '') return '—';
    return String(v);
  }

  function _cfBizName(bizId) {
    if (bizId == null || bizId === '') return '—';
    var b = (AppData.businesses || []).find(function (x) { return x.id === bizId; });
    return b ? (b.name || '—') : '—';
  }

  function _cfCollectionCode(cid) {
    if (cid == null || cid === '') return '—';
    var c = (AppData.collections || []).find(function (x) { return x.id === cid; });
    return c ? (c.code || '—') : '—';
  }

  function populateCollectionFilter() {
    var sel = document.getElementById('cf-filter-collection');
    if (!sel) return;
    var cur = sel.value;
    var opts = '<option value="">全部批次</option>';
    (AppData.collections || []).forEach(function (c) {
      opts += '<option value="' + c.id + '">' + (c.code || ('#' + c.id)) + '</option>';
    });
    sel.innerHTML = opts;
    if (cur) sel.value = cur;
  }

  /** 取数完成后留在资金流单据并可选选中本批批次 */
  function cfAfterFetchGoToRecords(res) {
    cfSubTab = 'records';
    cfApplySubTabUi();
    populateCollectionFilter();
    if (res && res.collection_id != null) {
      var sel = document.getElementById('cf-filter-collection');
      if (sel) sel.value = String(res.collection_id);
    }
    cfPage = 1;
  }

  function populateBizSelect(id) {
    var sel = document.getElementById(id);
    if (!sel) return;
    var businesses = AppData.businesses || [];
    var cur = sel.value;
    sel.innerHTML = '<option value="">全部</option>' + businesses.map(function (b) {
      return '<option value="' + b.id + '">' + (b.name || '') + '</option>';
    }).join('');
    if (cur) sel.value = cur;
  }

  function cfApplySubTabUi() {
    var panelR = document.getElementById('cf-panel-records');
    if (panelR) panelR.style.display = '';
  }

  function _applyCfClientFilters(items) {
    var code = (document.getElementById('cf-filter-code') && document.getElementById('cf-filter-code').value || '').trim().toLowerCase();
    var biz = document.getElementById('cf-filter-biz') && document.getElementById('cf-filter-biz').value;
    var amtMin = parseFloat(document.getElementById('cf-filter-amt-min') && document.getElementById('cf-filter-amt-min').value);
    var amtMax = parseFloat(document.getElementById('cf-filter-amt-max') && document.getElementById('cf-filter-amt-max').value);
    var df = document.getElementById('cf-filter-date-from') && document.getElementById('cf-filter-date-from').value;
    var dt = document.getElementById('cf-filter-date-to') && document.getElementById('cf-filter-date-to').value;
    var src = document.getElementById('cf-filter-source') && document.getElementById('cf-filter-source').value;
    var col = document.getElementById('cf-filter-collection') && document.getElementById('cf-filter-collection').value;

    return items.filter(function (r) {
      if (col && String(r.collection_id || '') !== String(col)) return false;
      if (code && String(r.code || '').toLowerCase().indexOf(code) === -1) return false;
      if (biz && String(r.biz_id || '') !== String(biz)) return false;
      if (!isNaN(amtMin) && r.amount < amtMin) return false;
      if (!isNaN(amtMax) && r.amount > amtMax) return false;
      if (df && r.trade_date && String(r.trade_date) < df) return false;
      if (dt && r.trade_date && String(r.trade_date) > dt) return false;
      if (src && r.source_system !== src) return false;
      return true;
    });
  }

  function updateCfManualBar() {
    var row = document.getElementById('cf-manual-actions');
    var srcEl = document.getElementById('cf-filter-source');
    var src = srcEl && srcEl.value;
    var show = cfManualToggle || !src || src === '手工新增';
    if (row) row.style.display = show ? '' : 'none';
  }

  window.cfOpenRecordsForCollection = function (cid) {
    try { closeModal(); } catch (e) {}
    cfSubTab = 'records';
    cfApplySubTabUi();
    var sel = document.getElementById('cf-filter-collection');
    if (sel) sel.value = String(cid);
    cfPage = 1;
    loadCfTable();
    try {
      var wrap = document.querySelector('.copilot-chat-scroll') || document.querySelector('.content');
      if (wrap) wrap.scrollTop = 0;
    } catch (e) {}
    Toast.info('已筛选该取数批次');
  };

  function renderCashflow() {
    populateUnitSelect('cf-filter-unit');
    populateBizSelect('cf-filter-biz');
    populateCollectionFilter();
    /* 分析页 / AI 标签 / 图表下钻：统一经 sessionStorage 写入，在此先读后清 */
    cfSubTab = 'records';
    try {
      var _cst = sessionStorage.getItem('cf_subtab');
      sessionStorage.removeItem('cf_subtab');
      if (_cst === 'records') cfSubTab = 'records';
    } catch (e) {}
    try {
      var fu = sessionStorage.getItem('cf_filter_unit');
      if (fu) {
        var selU = document.getElementById('cf-filter-unit');
        if (selU) selU.value = fu;
        sessionStorage.removeItem('cf_filter_unit');
        cfPage = 1;
      }
    } catch (e) {}
    try {
      var fst = sessionStorage.getItem('cf_filter_status');
      if (fst) {
        var selS = document.getElementById('cf-filter-status');
        if (selS) selS.value = fst;
        sessionStorage.removeItem('cf_filter_status');
        cfPage = 1;
      }
    } catch (e) {}
    try {
      var fb = sessionStorage.getItem('cf_filter_biz');
      if (fb) {
        cfSubTab = 'records';
        var sel = document.getElementById('cf-filter-biz');
        if (sel) sel.value = fb;
        sessionStorage.removeItem('cf_filter_biz');
        cfPage = 1;
      }
    } catch (e) {}
    try {
      var fd0 = sessionStorage.getItem('cf_filter_date_from');
      var fd1 = sessionStorage.getItem('cf_filter_date_to');
      if (fd0) {
        var elDf = document.getElementById('cf-filter-date-from');
        if (elDf) elDf.value = fd0;
        sessionStorage.removeItem('cf_filter_date_from');
        cfPage = 1;
      }
      if (fd1) {
        var elDt = document.getElementById('cf-filter-date-to');
        if (elDt) elDt.value = fd1;
        sessionStorage.removeItem('cf_filter_date_to');
        cfPage = 1;
      }
    } catch (e) {}
    cfApplySubTabUi();
    updateCfManualBar();
    try {
      var pd = sessionStorage.getItem('cf_pie_drill');
      if (pd && !AppData.pieDrillCategory) AppData.pieDrillCategory = pd;
    } catch (e) {}
    var banner = document.getElementById('cf-pie-drill-banner');
    if (banner) {
      if (AppData.pieDrillCategory) {
        banner.style.display = '';
        banner.innerHTML = '📊 来自看板「流入/流出构成」：<strong>' + AppData.pieDrillCategory + '</strong> ' +
          '<button type="button" class="btn btn-sm btn-ghost" onclick="clearPieDrill()">清除筛选</button>';
      } else {
        banner.style.display = 'none';
        banner.innerHTML = '';
      }
    }
    loadCfTable();
  }

  window.clearPieDrill = function () {
    AppData.pieDrillCategory = null;
    try { sessionStorage.removeItem('cf_pie_drill'); } catch (e) {}
    renderCashflow();
  };

  /** 预测/预算下钻 → 资金流：按自然月 + 单位 + 已确认 对齐后端 only_confirmed 口径 */
  window.cfDrillToRecordsFromMonth = function (unit, yearMonth) {
    try {
      var ym = String(yearMonth || '').trim();
      if (!ym || ym.indexOf('-') === -1) {
        if (typeof Toast !== 'undefined') Toast.warn('月份格式无效');
        return;
      }
      var parts = ym.split('-');
      var y = parseInt(parts[0], 10);
      var mo = parseInt(parts[1], 10);
      if (isNaN(y) || isNaN(mo) || mo < 1 || mo > 12) {
        if (typeof Toast !== 'undefined') Toast.warn('月份格式无效');
        return;
      }
      var d0 = y + '-' + String(mo).padStart(2, '0') + '-01';
      var last = new Date(y, mo, 0);
      var d1 = y + '-' + String(mo).padStart(2, '0') + '-' + String(last.getDate()).padStart(2, '0');
      try { sessionStorage.setItem('cf_filter_status', '已确认'); } catch (e1) {}
      try { sessionStorage.setItem('cf_filter_date_from', d0); } catch (e2) {}
      try { sessionStorage.setItem('cf_filter_date_to', d1); } catch (e3) {}
      var u = unit && String(unit).trim();
      if (u) {
        try { sessionStorage.setItem('cf_filter_unit', u); } catch (e4) {}
      } else {
        try { sessionStorage.removeItem('cf_filter_unit'); } catch (e5) {}
      }
      if (typeof Router !== 'undefined' && Router.navigate) Router.navigate('cashflow');
      if (typeof Toast !== 'undefined') Toast.success('已按月份与单位筛选已确认单据');
    } catch (e) {
      console.warn(e);
      if (typeof Toast !== 'undefined') Toast.warn('跳转失败');
    }
  };

  function _matchCfStatusFilter(r, st) {
    if (!st) return true;
    if (st === '待确认') return r.status === '待确认' || r.status === '未确认';
    return r.status === st;
  }

  function _matchPieDrill(r, pieName) {
    if (!pieName) return true;
    var businesses = AppData.businesses || [];
    var biz = businesses.find(function (b) { return b.id === r.biz_id; });
    var bizName = biz ? (biz.name || '') : '';
    var bizType = biz ? (biz.biz_type || '') : '';
    var isIn = pieName.indexOf('流入') !== -1;
    if (isIn && r.amount <= 0) return false;
    if (pieName.indexOf('流出') !== -1 && !isIn && r.amount >= 0) return false;
    if (pieName.indexOf('经营') !== -1) {
      if (/一般资金流|保证金|应付|应收|票据|信用证|资金调|外汇收|外汇付|外汇调/.test(bizType)) return true;
      return /采购|销售|费用|工资|税费|保证金|票据|调拨|信用证|外汇/.test(bizName);
    }
    if (pieName.indexOf('投资') !== -1) {
      return /投资|理财|存款|利息|通知|协定|份额|金额理财/.test(bizType) || /理财|存款|利息|投资/.test(bizName);
    }
    if (pieName.indexOf('融资') !== -1) {
      return /借款|对外借款|融资/.test(bizType) || /借款|还款|拆借/.test(bizName);
    }
    return true;
  }

  async function loadCfTable() {
    var uEl = document.getElementById('cf-filter-unit');
    var stEl = document.getElementById('cf-filter-status');
    var cEl = document.getElementById('cf-filter-currency');
    if (!uEl || !stEl || !cEl) return;
    var u = uEl.value;
    var st = stEl.value;
    var c = cEl.value;
    var pieName = AppData.pieDrillCategory || null;

    function _pipeFilters(rawItems) {
      var items = rawItems.filter(function (r) {
        if (u && r.unit !== u) return false;
        if (!_matchCfStatusFilter(r, st)) return false;
        if (c && r.currency !== c) return false;
        if (pieName && !_matchPieDrill(r, pieName)) return false;
        return true;
      });
      items = _applyCfClientFilters(items);
      return items;
    }

    if (backendOk) {
      try {
        var url = (API.base || '') + '/api/records?page=1&page_size=500';
        if (u) url += '&unit=' + encodeURIComponent(u);
        if (st) url += '&status=' + encodeURIComponent(st);
        if (c) url += '&currency=' + encodeURIComponent(c);
        var data = await API.get(url);
        AppData.records = data;
        var items = _pipeFilters(data.items || []);
          var start = (cfPage - 1) * 20;
          renderCfTableData({ items: items.slice(start, start + 20), total: items.length });
        return;
      } catch (e) {}
    }

    var all = AppData.records.items || [];
    var filtered = _pipeFilters(all);
    var start = (cfPage - 1) * 20;
    renderCfTableData({ items: filtered.slice(start, start + 20), total: filtered.length });
  }

  function renderCfTableData(data) {
    var body = document.getElementById('cf-table-body');
    if (!body) return;
    if (!data.items || !data.items.length) { body.innerHTML = '<tr><td colspan="12" class="empty-state">暂无数据</td></tr>'; return; }
    body.innerHTML = data.items.map(function (r, idx) {
      var dotCls = r.status === '已确认' ? 'confirmed' : r.status === '预测' ? 'predicted' : r.status === '待审核' ? 'pending-review' : 'unconfirmed';
      var amtCls = r.amount >= 0 ? 'positive' : 'negative';
      var ds = cfDisplayStatus(r.status);
      var canEdit = r.status === '已确认';
      var canDel = r.status === '暂存' || r.status === '打回';
      return '<tr><td><input type="checkbox" class="cf-row-sel" data-id="' + r.id + '" /></td><td>' + _cfCell(r.trade_date) +
        '</td><td class="mono" style="font-size:11px;">' + _cfCell(r.self_account_no) + '</td><td style="font-size:12px;max-width:120px;">' + _cfCell(r.self_account_name) +
        '</td><td class="mono" style="font-size:11px;">' + _cfCell(r.counterparty_account) + '</td><td style="font-size:12px;max-width:100px;">' + _cfCell(r.counterparty_name) +
        '</td><td class="num ' + amtCls + '">' + fmtNum(r.amount) +
        '</td><td>' + (r.currency || 'CNY') +
        '</td><td class="muted" style="font-size:11px;max-width:160px;">' + _cfCell(r.summary) +
        '</td><td>' + _cfBizName(r.biz_id) +
        '</td><td><span class="status-dot ' + dotCls + '"></span>' + ds +
        '</td><td class="cf-col-actions">' +
        '<button class="btn btn-sm btn-ghost" onclick="viewRecord(' + r.id + ')">查看</button>' +
        (canEdit ? ' <button class="btn btn-sm btn-ghost" onclick="editRecord(' + r.id + ')">编辑</button>' : '') +
        (canDel ? ' <button class="btn btn-sm btn-ghost" style="color:var(--danger);" onclick="deleteRecord(' + r.id + ')">删除</button>' : '') +
        (r.status === '待审核' ? ' <button class="btn btn-sm btn-ghost" style="color:var(--danger);" onclick="reviewRecord(' + r.id + ')">审核</button>' : '') +
        (r.status !== '已确认' && r.status !== '待审核' ? ' <button class="btn btn-sm btn-ghost" onclick="confirmRecord(' + r.id + ')">确认</button>' : '') +
        '</td></tr>';
    }).join('');

    var total = data.total || data.items.length;
    var totalPages = Math.ceil(total / 20) || 1;
    var pg = document.getElementById('cf-pagination');
    var html = '<span class="page-info">共 ' + total + ' 条 · 第 ' + cfPage + '/' + totalPages + ' 页</span>';
    if (cfPage > 1) html += '<button class="page-btn" onclick="setCfPage(' + (cfPage - 1) + ')">‹</button>';
    var start = Math.max(1, cfPage - 3);
    var end = Math.min(totalPages, cfPage + 3);
    if (start > 1) { html += '<button class="page-btn" onclick="setCfPage(1)">1</button>'; if (start > 2) html += '<span class="page-info">…</span>'; }
    for (var i = start; i <= end; i++) {
      html += '<button class="page-btn' + (i === cfPage ? ' active' : '') + '" onclick="setCfPage(' + i + ')">' + i + '</button>';
    }
    if (end < totalPages) { if (end < totalPages - 1) html += '<span class="page-info">…</span>'; html += '<button class="page-btn" onclick="setCfPage(' + totalPages + ')">' + totalPages + '</button>'; }
    if (cfPage < totalPages) html += '<button class="page-btn" onclick="setCfPage(' + (cfPage + 1) + ')">›</button>';
    if (pg) pg.innerHTML = html;

    var selAll = document.getElementById('cf-select-all');
    if (selAll) selAll.checked = false;
    updateCfBulkHint();
    document.querySelectorAll('.cf-row-sel').forEach(function (cb) {
      cb.addEventListener('change', updateCfBulkHint);
    });
  }

  function updateCfBulkHint() {
    var bar = document.getElementById('cf-bulk-hint');
    var txt = document.getElementById('cf-bulk-hint-text');
    if (!bar || !txt) return;
    var n = document.querySelectorAll('.cf-row-sel:checked').length;
    if (n < 1) {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    txt.textContent = '已选 ' + n + ' 条，可进行「改状态」或「智能批量确认」。';
  }

  window.setCfPage = function (p) { cfPage = p; loadCfTable(); };

  window.viewRecord = function (id) {
    var rec = (AppData.records.items || []).find(function (r) { return r.id === id; });
    if (!rec) { Toast.info('查看记录 #' + id); return; }
    openModal('资金流单据 #' + id,
      '<table class="data-table" style="font-size:13px;"><tbody>' +
      '<tr><td style="font-weight:600;width:100px;">编号</td><td>' + (rec.code || '-') + '</td></tr>' +
      '<tr><td style="font-weight:600;">单位</td><td>' + (rec.unit || '-') + '</td></tr>' +
      '<tr><td style="font-weight:600;">本方账号</td><td class="mono">' + _cfCell(rec.self_account_no) + '</td></tr>' +
      '<tr><td style="font-weight:600;">本方账户名</td><td>' + _cfCell(rec.self_account_name) + '</td></tr>' +
      '<tr><td style="font-weight:600;">对方账号</td><td class="mono">' + (rec.counterparty_account || '—') + '</td></tr>' +
      '<tr><td style="font-weight:600;">对方账户名</td><td>' + _cfCell(rec.counterparty_name) + '</td></tr>' +
      '<tr><td style="font-weight:600;">交易行名</td><td>' + (rec.bank_name || '—') + '</td></tr>' +
      '<tr><td style="font-weight:600;">币种</td><td>' + (rec.currency || 'CNY') + '</td></tr>' +
      '<tr><td style="font-weight:600;">金额</td><td style="color:' + (rec.amount >= 0 ? 'var(--success)' : 'var(--danger)') + ';font-weight:700;">' + fmtNum(rec.amount) + '</td></tr>' +
      '<tr><td style="font-weight:600;">摘要</td><td>' + (rec.summary || '—') + '</td></tr>' +
      '<tr><td style="font-weight:600;">交易日期</td><td>' + (rec.trade_date || '-') + '</td></tr>' +
      '<tr><td style="font-weight:600;">批次号</td><td>' + _cfCollectionCode(rec.collection_id) + '</td></tr>' +
      '<tr><td style="font-weight:600;">状态</td><td>' + cfDisplayStatus(rec.status) + '</td></tr>' +
      '<tr><td style="font-weight:600;">来源</td><td>' + (rec.source_system || '-') + '</td></tr>' +
      '</tbody></table>', null, true);
  };

  window.editRecord = function (id) {
    var rec = (AppData.records.items || []).find(function (r) { return r.id === id; });
    if (!rec || rec.status !== '已确认') { Toast.warn('仅「已确认」单据可编辑（PRD：审批通过后）'); return; }
    var bizOpts = (AppData.businesses || []).map(function (b) {
      return '<option value="' + b.id + '"' + (rec.biz_id === b.id ? ' selected' : '') + '>' + (b.name || '') + '</option>';
    }).join('');
    if (!bizOpts) bizOpts = '<option value="">—</option>';
    openModal('编辑资金流单据',
      '<div class="form-group"><label>单位</label><select class="form-select" id="m-ed-unit">' +
      ['总部', '华东子公司', '华南子公司'].map(function (u) {
        return '<option' + (rec.unit === u ? ' selected' : '') + '>' + u + '</option>';
      }).join('') + '</select></div>' +
      '<div class="form-group"><label>资金业务</label><select class="form-select" id="m-ed-biz">' + bizOpts + '</select></div>' +
      '<div class="form-group"><label>金额</label><input class="form-input" id="m-ed-amt" type="number" value="' + rec.amount + '" /></div>' +
      '<div class="form-group"><label>交易日期</label><input class="form-input" id="m-ed-date" type="date" value="' + (rec.trade_date || '') + '" /></div>' +
      '<div class="form-group"><label>来源系统单号</label><input class="form-input" id="m-ed-ref" value="' + (rec.source_ref || '') + '" /></div>',
      function () {
        rec.unit = document.getElementById('m-ed-unit').value;
        var bid = parseInt(document.getElementById('m-ed-biz').value, 10);
        rec.biz_id = isNaN(bid) ? null : bid;
        rec.amount = parseFloat(document.getElementById('m-ed-amt').value) || 0;
        rec.trade_date = document.getElementById('m-ed-date').value || null;
        rec.settle_date = rec.trade_date;
        rec.source_ref = document.getElementById('m-ed-ref').value || null;
        if (backendOk) {
          (async function () {
            try {
              await API.put('/api/records/' + id, recordPutPayload(rec, rec.status));
              Toast.success('已保存');
              closeModal();
              await window.cfReloadCoreData();
              loadCfTable();
            } catch (e) {
              console.warn(e);
              Toast.warn('保存失败');
            }
          })();
          return;
        }
        Toast.success('已保存（演示）');
        closeModal();
        loadCfTable();
      });
  };

  window.deleteRecord = function (id) {
    var rec = (AppData.records.items || []).find(function (r) { return r.id === id; });
    if (!rec || (rec.status !== '暂存' && rec.status !== '打回')) {
      Toast.warn('仅「暂存」「打回」可删除（软删除）');
      return;
    }
    openModal('删除资金流单据', '<p>软删除，不物理删除数据（PRD）。</p>', function () {
      if (backendOk) {
        (async function () {
          try {
            await API.del('/api/records/' + id);
            Toast.success('已删除');
            closeModal();
            await window.cfReloadCoreData();
            refreshStats();
            loadCfTable();
          } catch (e) {
            console.warn(e);
            Toast.warn('删除失败');
          }
        })();
        return;
      }
      AppData.records.items = (AppData.records.items || []).filter(function (r) { return r.id !== id; });
      AppData.records.total = AppData.records.items.length;
      Toast.success('已删除（演示）');
      closeModal();
      refreshStats();
      loadCfTable();
    });
  };

  window.confirmRecord = function (id) {
    var rec = (AppData.records.items || []).find(function (r) { return r.id === id; });
    if (!rec) return;
    rec.status = '已确认';
    if (backendOk) {
      (async function () {
        try {
          await API.put('/api/records/' + id, recordPutPayload(rec, '已确认'));
        } catch (e) { console.warn(e); }
        refreshStats();
        Toast.success('已确认单据 ' + (rec.code || '#' + id));
        loadCfTable();
      })();
      return;
    }
    refreshStats();
    Toast.success('已确认单据 ' + (rec.code || '#' + id));
    loadCfTable();
  };

  window.reviewRecord = function (id) {
    var rec = (AppData.records.items || []).find(function (r) { return r.id === id; });
    if (!rec) return;
    openModal('审核大额单据 — ' + rec.code,
      '<table class="data-table" style="font-size:13px;"><tbody>' +
      '<tr><td style="font-weight:600;width:80px;">单位</td><td>' + (rec.unit || '-') + '</td></tr>' +
      '<tr><td style="font-weight:600;">金额</td><td style="color:var(--danger);font-weight:700;font-size:16px;">' + fmtNum(rec.amount) + ' ' + (rec.currency || 'CNY') + '</td></tr>' +
      '<tr><td style="font-weight:600;">日期</td><td>' + (rec.trade_date || '-') + '</td></tr>' +
      '</tbody></table>' +
      '<div class="alert-banner warn" style="margin-top:12px;">⚠️ 此单据金额超过 5,000 万阈值，需人工审核后方可确认</div>' +
      '<div class="form-group" style="margin-top:12px;"><label>审核意见</label><textarea class="form-input" id="m-review-note" rows="2" style="width:100%;" placeholder="选填"></textarea></div>',
      function () {
        var note = (document.getElementById('m-review-note').value || '').trim();
        rec.status = '已确认';
        rec.review_note = note || '审核通过';
        rec.reviewed_at = new Date().toISOString().slice(0, 16).replace('T', ' ');
        if (backendOk) {
          (async function () {
            try {
              await API.put('/api/records/' + id, recordPutPayload(rec, '已确认'));
            } catch (e) { console.warn(e); Toast.warn('后端更新失败'); }
            refreshStats();
            Toast.success('审核通过，单据已确认');
            closeModal();
            loadCfTable();
          })();
          return;
        }
        refreshStats();
        Toast.success('审核通过，单据已确认');
        closeModal();
        loadCfTable();
      });
  };

  _domOn('cf-btn-query', 'click', function () { cfPage = 1; loadCfTable(); });
  _domOn('cf-btn-reset', 'click', function () {
    ['cf-filter-collection', 'cf-filter-code', 'cf-filter-unit', 'cf-filter-biz', 'cf-filter-currency', 'cf-filter-amt-min', 'cf-filter-amt-max', 'cf-filter-date-from', 'cf-filter-date-to', 'cf-filter-status', 'cf-filter-source'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    cfPage = 1;
    loadCfTable();
  });

  var cfColSel = document.getElementById('cf-filter-collection');
  if (cfColSel) cfColSel.addEventListener('change', function () { cfPage = 1; loadCfTable(); });

  var cfSelAll = document.getElementById('cf-select-all');
  if (cfSelAll) {
    cfSelAll.addEventListener('change', function () {
      var on = this.checked;
      document.querySelectorAll('.cf-row-sel').forEach(function (cb) { cb.checked = on; });
      updateCfBulkHint();
    });
  }
  var cfBulkClear = document.getElementById('cf-bulk-clear-sel');
  if (cfBulkClear) {
    cfBulkClear.addEventListener('click', function () {
      document.querySelectorAll('.cf-row-sel').forEach(function (cb) { cb.checked = false; });
      if (cfSelAll) cfSelAll.checked = false;
      updateCfBulkHint();
    });
  }

  var cfSrc = document.getElementById('cf-filter-source');
  if (cfSrc) cfSrc.addEventListener('change', updateCfManualBar);

  var cfTog = document.getElementById('cf-toggle-manual');
  if (cfTog) {
    cfTog.addEventListener('click', function () {
      cfManualToggle = !cfManualToggle;
      cfTog.classList.toggle('on', cfManualToggle);
      cfTog.textContent = cfManualToggle ? 'ON' : 'OFF';
      updateCfManualBar();
    });
  }

  _domOn('cf-btn-batch-status', 'click', function () {
    var ids = [];
    document.querySelectorAll('.cf-row-sel:checked').forEach(function (cb) { ids.push(parseInt(cb.getAttribute('data-id'), 10)); });
    if (!ids.length) { Toast.warn('请先勾选要修改的单据'); return; }
    openModal('修改资金流状态',
      '<div class="form-group"><label>资金流状态</label><select class="form-select" id="m-cf-st">' +
      '<option value="">请选择</option><option>流水</option><option>待确认</option><option>已确认</option><option>预测</option><option>暂存</option><option>打回</option></select></div>',
      function () {
        var st = document.getElementById('m-cf-st').value;
        if (!st) { Toast.warn('请选择状态'); return; }
        var items = AppData.records.items || [];
        var apiSt = st === '待确认' ? '未确认' : st;
        if (backendOk) {
          (async function () {
            try {
              for (var i = 0; i < ids.length; i++) {
                var rec = items.find(function (r) { return r.id === ids[i]; });
                if (rec) {
                  rec.status = apiSt;
                  await API.put('/api/records/' + ids[i], recordPutPayload(rec, apiSt));
                }
              }
              Toast.success('已更新 ' + ids.length + ' 条');
            } catch (e) {
              console.warn(e);
              Toast.warn('部分失败');
            }
          closeModal();
            await window.cfReloadCoreData();
          loadCfTable();
          })();
          return;
        }
        ids.forEach(function (id) {
          var rec = items.find(function (r) { return r.id === id; });
          if (rec) rec.status = apiSt;
        });
        Toast.success('已更新 ' + ids.length + ' 条（演示）');
        closeModal();
        loadCfTable();
      });
  });

  _domOn('cf-btn-print', 'click', function () {
    Toast.info('打印预览（演示）：请使用浏览器打印当前页或导出 CSV');
    window.print();
  });

  _domOn('cf-btn-import', 'click', function () {
    var _fi2 = document.getElementById('cf-file-import');
    if (_fi2) _fi2.click();
  });

  _domOn('cf-file-import', 'change', function (ev) {
    var f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    if (!backendOk) { Toast.warn('离线模式下请使用数据集成页导入演示'); return; }
    (async function () {
      try {
        var fd = new FormData();
        fd.append('file', f);
        fd.append('force_override', 'false');
        await API.postForm('/api/records/import-excel', fd);
        Toast.success('导入已提交');
        await window.cfReloadCoreData();
        loadCfTable();
      } catch (e) {
        console.warn(e);
        Toast.warn('导入失败：' + (e.message || ''));
      }
    })();
  });

  _domOn('cf-btn-batch-add', 'click', function () {
    var uOpts = ['总部', '华东子公司', '华南子公司'].map(function (u) { return '<option>' + u + '</option>'; }).join('');
    var bizOpts = (AppData.businesses || []).slice(0, 8).map(function (b) {
      return '<option value="' + b.id + '">' + (b.name || '') + '</option>';
    }).join('');
    openModal('批量新增',
      '<p class="muted" style="font-size:12px;">每行一条单据；提交后逐条创建（演示）。</p>' +
      '<table class="data-table" style="font-size:12px;"><thead><tr><th>单位</th><th>业务</th><th>币种</th><th>金额</th><th>交易日期</th><th>状态</th></tr></thead><tbody>' +
      '<tr><td><select class="form-select" id="mba-u">' + uOpts + '</select></td>' +
      '<td><select class="form-select" id="mba-b">' + bizOpts + '</select></td>' +
      '<td><select class="form-select" id="mba-c"><option>CNY</option></select></td>' +
      '<td><input class="form-input" id="mba-a" type="number" value="1000" /></td>' +
      '<td><input class="form-input" id="mba-d" type="date" value="' + new Date().toISOString().slice(0, 10) + '" /></td>' +
      '<td><select class="form-select" id="mba-s"><option>预测</option><option>未确认</option></select></td></tr></tbody></table>',
      function () {
        var newRec = {
          unit: document.getElementById('mba-u').value,
          biz_id: parseInt(document.getElementById('mba-b').value, 10) || null,
          currency: document.getElementById('mba-c').value,
          amount: parseFloat(document.getElementById('mba-a').value) || 0,
          trade_date: document.getElementById('mba-d').value || null,
          settle_date: document.getElementById('mba-d').value || null,
          status: document.getElementById('mba-s').value,
          source_system: '手工新增',
        };
        if (backendOk) {
          (async function () {
            try {
              await API.post('/api/records', {
                unit: newRec.unit,
                currency: newRec.currency,
                amount: newRec.amount,
                biz_id: newRec.biz_id,
                trade_date: newRec.trade_date,
                settle_date: newRec.settle_date,
                status: newRec.status === '待确认' ? '未确认' : newRec.status,
                source_system: '手工新增',
                source_ref: null,
                collection_id: null,
                flows_json: '[]',
              });
              Toast.success('已新增 1 条');
              closeModal();
              await window.cfReloadCoreData();
              loadCfTable();
            } catch (e) {
              console.warn(e);
              Toast.warn('新增失败');
            }
          })();
          return;
        }
        var maxId = AppData.records.items.reduce(function (a, r) { return Math.max(a, r.id); }, 0);
        maxId++;
        AppData.records.items.push({
          id: maxId,
          code: 'CF' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + String(maxId).padStart(4, '0'),
          unit: newRec.unit,
          biz_id: newRec.biz_id,
          currency: newRec.currency,
          amount: newRec.amount,
          trade_date: newRec.trade_date,
          status: newRec.status,
          source_system: '手工新增',
        });
        AppData.records.total = AppData.records.items.length;
        Toast.success('已新增（演示）');
        closeModal();
        loadCfTable();
      });
  });

  /** 集成取数：unit 空字符串表示全部单位；日期可空；opts.force_override 对应 PRD 强制覆盖 */
  function _cfRunIntegrationsFetch(unit, dateStart, dateEnd, sys, opts) {
    opts = opts || {};
    var forceOverride = !!opts.force_override;
    var bankStatus = AppData.systemHealth.bank ? AppData.systemHealth.bank.status : 'ok';
    if (bankStatus === 'offline') {
      Toast.warn('银行接口离线，使用最近缓存数据');
      loadCfTable();
      return;
    }
              var units = unit ? [unit] : [];
    var src = sys || '资金管理系统';
    if (backendOk) {
      (async function () {
        try {
              var res = await API.post('/api/integrations/fetch', {
                units: units,
            source_system: src,
                date_from: dateStart || null,
                date_to: dateEnd || null,
                force_override: forceOverride,
              });
          var remark = src;
              if (dateStart || dateEnd) remark += ' ' + (dateStart || '起') + '~' + (dateEnd || '止');
          _addSyncLog(src, '获取数据', res.records_created || 0, '成功', remark);
              await window.cfReloadCoreData();
              refreshStats();
          cfAfterFetchGoToRecords(res);
          Toast.success('已写入 ' + (res.records_created || 0) + ' 条 · 批次 ' + (res.collection_code || ''));
            } catch (e) {
              console.warn(e);
              Toast.warn('接口失败，已回退本地模拟');
          var count = _simulateFetchData(unit || '');
          _addSyncLog(src, '获取数据', count, '成功', src);
              refreshStats();
            }
            loadCfTable();
          })();
          return;
        }
    var count = _simulateFetchData(unit || '');
    var remark = src;
        if (dateStart || dateEnd) remark += ' ' + (dateStart || '起') + '~' + (dateEnd || '止');
    _addSyncLog(src, '获取数据', count, '成功', remark);
        refreshStats();
        Toast.success('成功获取 ' + count + ' 条资金流数据');
        loadCfTable();
  }

  function cfOpenFetchModal() {
    var rules = (AppData.mappingRules || []).filter(function (r) { return r.valid; });
    if (!rules.length) { Toast.warn('暂无有效映射规则，请先到【数据集成】配置'); return; }
    var units = (AppData.stats && AppData.stats.units && AppData.stats.units.length)
      ? AppData.stats.units
      : ['总部', '华东子公司', '华南子公司'];
    var escAttr = function (s) {
      return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    };
    var escHtml = function (s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    };
    var unitOpts = '<option value="">全部单位</option>' + units.map(function (u) {
      return '<option value="' + escAttr(u) + '">' + escHtml(u) + '</option>';
    }).join('');
    openModal('选项获取',
      '<p class="muted" style="margin:0 0 14px;font-size:13px;line-height:1.55;">将按下方条件调用集成拉取。若需立即按默认口径拉取，请关闭本窗并点左侧「一键获取」。</p>' +
      '<p style="margin:0 0 12px;">当前有效映射规则 <strong>' + rules.length + '</strong> 条。</p>' +
      '<div class="form-group"><label>单位</label><select class="form-select" id="m-fetch-unit">' + unitOpts + '</select></div>' +
      '<div class="form-group"><label>交易日期起</label><input class="form-input" id="m-fetch-start" type="date" /></div>' +
      '<div class="form-group"><label>交易日期止</label><input class="form-input" id="m-fetch-end" type="date" /></div>' +
      '<div class="form-group"><label>来源系统</label><select class="form-select" id="m-fetch-sys"><option value="资金管理系统">资金管理系统</option><option value="银企直连">银企直连</option></select></div>' +
      '<div class="form-group" style="margin-bottom:0;"><label class="cf-fetch-force-label"><input type="checkbox" id="m-fetch-force" /> 强制覆盖已存在单据（慎用，需与数据整合页策略一致）</label></div>',
      function () {
        var unit = document.getElementById('m-fetch-unit').value;
        var dateStart = document.getElementById('m-fetch-start').value;
        var dateEnd = document.getElementById('m-fetch-end').value;
        var sys = document.getElementById('m-fetch-sys').value;
        var force = document.getElementById('m-fetch-force') && document.getElementById('m-fetch-force').checked;
        closeModal();
        Toast.info('正在获取数据…');
        _cfRunIntegrationsFetch(unit, dateStart, dateEnd, sys, { force_override: force });
      });
  }

  function _cfEnsureFetchRules() {
    var rules = (AppData.mappingRules || []).filter(function (r) { return r.valid; });
    if (!rules.length) {
      Toast.warn('暂无有效映射规则，请先到【数据集成】配置');
      return false;
    }
    return true;
  }

  _domOn('cf-btn-fetch-quick', 'click', function () {
    if (!_cfEnsureFetchRules()) return;
    Toast.info('正在获取数据…');
    _cfRunIntegrationsFetch('', null, null, '资金管理系统');
  });

  _domOn('cf-btn-fetch-options', 'click', function () {
    if (!_cfEnsureFetchRules()) return;
    cfOpenFetchModal();
  });

  function _simulateFetchData(unit) {
    var bankStatus = AppData.systemHealth.bank ? AppData.systemHealth.bank.status : 'ok';
    if (bankStatus === 'offline') {
      _addSyncLog('资金管理系统', '获取数据', 0, '失败', '银行接口离线');
      Toast.warn('银行接口离线，使用最近缓存数据');
      return 0;
    }

    var simulateTimeout = bankStatus === 'degraded' && Math.random() > 0.5;
    if (simulateTimeout) {
      Toast.info('首次请求超时，正在重试...');
      _addSyncLog('资金管理系统', '获取数据（重试）', 0, '重试中');
    }

    var today = new Date();
    var units = unit ? [unit] : ['总部', '华东子公司', '华南子公司'];
    var count = 0;
    var skipped = 0;
    var maxId = AppData.records.items.reduce(function (a, r) { return Math.max(a, r.id); }, 0);
    var rules = (AppData.mappingRules || []).filter(function (r) { return r.valid; });

    units.forEach(function (u) {
      var n = Math.floor(Math.random() * 3) + 1;
      for (var i = 0; i < n; i++) {
        maxId++;
        var isInflow = Math.random() > 0.4;
        var amt = Math.round((Math.random() * 3000000 + 500000) * (isInflow ? 1 : -1));
        var daysAgo = Math.floor(Math.random() * 10);
        var dt = new Date(today); dt.setDate(dt.getDate() - daysAgo);
        var code = 'CF' + dt.toISOString().slice(0, 10).replace(/-/g, '') + String(maxId).padStart(4, '0');
        var dateStr = dt.toISOString().slice(0, 10);

        var isDuplicate = AppData.records.items.some(function (r) {
          return r.code === code && r.trade_date === dateStr;
        });
        if (isDuplicate) { skipped++; continue; }

        count++;
        AppData.records.items.push({
          id: maxId, code: code,
          unit: u, currency: 'CNY', amount: amt,
          trade_date: dateStr, status: '未确认',
          source_system: '资金管理系统',
        });
      }
    });
    AppData.records.total = AppData.records.items.length;
    if (skipped > 0) Toast.info('跳过重复 ' + skipped + ' 条');
    return count;
  }

  function _cfPendingStatuses(r) {
    return r.status === '未确认' || r.status === '待确认' || r.status === '流水';
  }

  // 智能批量确认（演示：Toast + 状态流转，可选勾选行）
  _domOn('cf-btn-batch-confirm', 'click', function () {
    function finishDemoToast() {
      Toast.info('正在匹配业务类型... 共识别 156 笔流水，成功匹配 148 笔，8 笔需人工核对。');
    }
    if (backendOk) {
      (async function () {
        try {
          var sel = document.querySelectorAll('.cf-row-sel:checked');
          var targets = [];
          if (sel.length) {
            sel.forEach(function (cb) {
              var id = parseInt(cb.getAttribute('data-id'), 10);
              var r = (AppData.records.items || []).find(function (x) { return x.id === id; });
              if (r && _cfPendingStatuses(r)) targets.push(r);
            });
          }
          if (!targets.length) {
            var list = await API.get('/api/records?page_size=500');
            targets = (list.items || []).filter(_cfPendingStatuses);
          }
          if (!targets.length) { Toast.info('请先勾选待确认流水，或当前没有可确认数据'); return; }
          finishDemoToast();
          for (var i = 0; i < targets.length; i++) {
            var r = targets[i];
            try {
                  await API.put('/api/records/' + r.id, recordPutPayload(r, '已确认'));
                  var local = (AppData.records.items || []).find(function (x) { return x.id === r.id; });
                  if (local) local.status = '已确认';
            } catch (e) { console.warn(e); }
          }
              refreshStats();
              loadCfTable();
        } catch (e) {
          console.warn(e);
          Toast.warn('操作失败，请重试');
        }
      })();
      return;
    }
    var items = AppData.records.items || [];
    var sel = document.querySelectorAll('.cf-row-sel:checked');
    var toConfirm = [];
    if (sel.length) {
      sel.forEach(function (cb) {
        var id = parseInt(cb.getAttribute('data-id'), 10);
        var r = items.find(function (x) { return x.id === id; });
        if (r && _cfPendingStatuses(r)) toConfirm.push(r);
      });
    } else {
      toConfirm = items.filter(_cfPendingStatuses);
    }
    if (!toConfirm.length) { Toast.info('请先勾选待确认流水，或当前没有可确认数据'); return; }
    finishDemoToast();
    toConfirm.forEach(function (r) { r.status = '已确认'; });
      refreshStats();
    loadCfTable();
  });

  // 导出
  _domOn('cf-btn-export', 'click', function () {
    var items = AppData.records.items || [];
    var csv = '交易日期,本方账号,本方账户名,对方账号,对方账户名,交易行名,交易金额,币种,摘要,业务类型,确认状态,单位,单据号\n';
    items.forEach(function (r) {
      csv += [r.trade_date, r.self_account_no || '', r.self_account_name || '', r.counterparty_account || '', r.counterparty_name || '', r.bank_name || '', r.amount, r.currency, (r.summary || '').replace(/,/g, '，'), _cfBizName(r.biz_id), cfDisplayStatus(r.status), r.unit, r.code].join(',') + '\n';
    });
    var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '资金流数据_' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    Toast.success('导出成功');
  });

  _domOn('cf-btn-add', 'click', function () {
    var bizOptsAdd = (AppData.businesses || []).map(function (b) {
      return '<option value="' + b.id + '">' + (b.name || '') + '</option>';
    }).join('');
    openModal('新增资金流单据',
      '<div class="form-group"><label>单位 <span style="color:var(--danger);">*</span></label><select class="form-select" id="m-rec-unit"><option>总部</option><option>华东子公司</option><option>华南子公司</option></select></div>' +
      '<div class="form-group"><label>资金业务</label><select class="form-select" id="m-rec-biz"><option value="">请选择</option>' + bizOptsAdd + '</select></div>' +
      '<div class="form-group"><label>币种 <span style="color:var(--danger);">*</span></label><select class="form-select" id="m-rec-currency"><option>CNY</option><option>USD</option><option>EUR</option></select></div>' +
      '<div class="form-group"><label>金额 <span style="color:var(--danger);">*</span></label><input class="form-input" id="m-rec-amount" type="number" value="0" /></div>' +
      '<div class="form-group"><label>交易日期 <span style="color:var(--danger);">*</span></label><input class="form-input" id="m-rec-date" type="date" value="' + new Date().toISOString().slice(0, 10) + '" /></div>' +
      '<div class="form-group"><label>状态</label><select class="form-select" id="m-rec-status"><option>预测</option><option>未确认</option><option>已确认</option></select></div>' +
      '<div id="m-rec-errors" style="color:var(--danger);font-size:12px;margin-top:8px;"></div>',
      function () {
        var bizSel = document.getElementById('m-rec-biz');
        var bid = bizSel ? parseInt(bizSel.value, 10) : null;
        var newRec = {
          unit: document.getElementById('m-rec-unit').value,
          biz_id: bid && !isNaN(bid) ? bid : null,
          currency: document.getElementById('m-rec-currency').value,
          amount: parseFloat(document.getElementById('m-rec-amount').value) || 0,
          trade_date: document.getElementById('m-rec-date').value || null,
          settle_date: document.getElementById('m-rec-date').value || null,
          status: document.getElementById('m-rec-status').value,
        };
        var errors = validateRecord(newRec);
        var isOverThreshold = Math.abs(newRec.amount) > 50000000;
        var blockErrors = errors.filter(function (e) { return e.indexOf('阈值') === -1; });

        if (blockErrors.length > 0) {
          document.getElementById('m-rec-errors').innerHTML = blockErrors.map(function (e) { return '⚠ ' + e; }).join('<br>');
          return;
        }

        var maxId = AppData.records.items.reduce(function (a, r) { return Math.max(a, r.id); }, 0);
        newRec.id = maxId + 1;
        newRec.code = 'CF' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + String(newRec.id).padStart(4, '0');
        newRec.source_system = '手工新增';

        if (isOverThreshold) {
          newRec.status = '待审核';
          Toast.warn('金额超过阈值，记录已标记为「待审核」，需人工复核');
        }

        if (backendOk) {
          (async function () {
            try {
              var created = await API.post('/api/records', {
                unit: newRec.unit,
                currency: newRec.currency,
                amount: newRec.amount,
                biz_id: newRec.biz_id,
                trade_date: newRec.trade_date,
                settle_date: newRec.settle_date,
                status: newRec.status,
                source_system: '手工新增',
                source_ref: null,
                collection_id: null,
                flows_json: '[]',
              });
              AppData.records.items.push(created);
              AppData.records.total = (AppData.records.total || 0) + 1;
              refreshStats();
              Toast.success('创建成功');
              closeModal();
              loadCfTable();
            } catch (e) {
              console.warn(e);
              Toast.warn('后端写入失败，已保存到本地视图');
              var maxId = AppData.records.items.reduce(function (a, r) { return Math.max(a, r.id); }, 0);
              newRec.id = maxId + 1;
              newRec.code = 'CF' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + String(newRec.id).padStart(4, '0');
              newRec.source_system = '手工新增';
              AppData.records.items.push(newRec);
              AppData.records.total = AppData.records.items.length;
              refreshStats();
              closeModal();
              loadCfTable();
            }
          })();
          return;
        }

        AppData.records.items.push(newRec);
        AppData.records.total = AppData.records.items.length;
        refreshStats();
        Toast.success('创建成功');
        closeModal(); loadCfTable();
      });
  });

  // ═══════════════════════════════════════════════
  // 3. ANALYSIS — 运行 + 下发至计划 + 导出
  // ═══════════════════════════════════════════════

  function renderAnUnitTreeTable() {
    var sc = document.getElementById('an-scope');
    var scope = sc && sc.value ? sc.value : 'group';
    var unitPick = document.getElementById('an-unit') && document.getElementById('an-unit').value;
    var rows = [];
    /* 与资金计划 mock（总部/华东/华南）同一口径：集团 = 三分支之和 */
    if (scope === 'group') {
      rows = [
        { name: '集团汇总', plan: 52000000, act: 54600000, indent: 0 },
        { name: '总部', plan: 19000000, act: 21300000, indent: 1 },
        { name: '华东子公司', plan: 18000000, act: 19200000, indent: 1 },
        { name: '华南子公司', plan: 15000000, act: 14100000, indent: 1 },
      ];
      if (unitPick) {
        rows = rows.filter(function (r) { return r.name === '集团汇总' || r.name === unitPick; });
      }
    } else if (scope === 'zb') {
      rows = [{ name: '总部', plan: 19000000, act: 21300000, indent: 0 }];
    } else if (scope === 'hd') {
      rows = [{ name: '华东子公司', plan: 18000000, act: 19200000, indent: 0 }];
    } else if (scope === 'hn') {
      rows = [{ name: '华南子公司', plan: 15000000, act: 14100000, indent: 0 }];
    }
    window._anPlanExecRows = rows;
    var body = document.getElementById('an-unit-tree-body');
    if (!body) return;
    var topRow = rows.find(function (r) { return r.indent === 0; }) || rows[0];
    if (document.getElementById('an-kpi-plan') && topRow) document.getElementById('an-kpi-plan').textContent = fmtNum(topRow.plan);
    if (document.getElementById('an-kpi-act') && topRow) document.getElementById('an-kpi-act').textContent = fmtNum(topRow.act);
    body.innerHTML = rows.map(function (r) {
      var dev = r.plan ? ((r.act - r.plan) / Math.abs(r.plan)) * 100 : 0;
      var devCls = dev >= 0 ? 'positive' : 'negative';
      var pad = 'padding-left:' + (12 + r.indent * 18) + 'px;';
      return '<tr><td style="' + pad + '"><strong>' + r.name + '</strong></td><td class="num">' + fmtNum(r.plan) + '</td><td class="num">' + fmtNum(r.act) + '</td><td class="num ' + devCls + '">' + dev.toFixed(1) + '%</td><td><button type="button" class="btn btn-sm btn-ghost" onclick="openSubjectExecDetailModal(\'' + _anEscapeJsSingleQuoted(r.name) + '\')">查看明细</button></td></tr>';
    }).join('');
  }

  function _anFormatSubjectDevRate(dev) {
    if (dev == null || typeof dev !== 'number' || isNaN(dev)) return '—';
    return (dev * 100).toFixed(1) + '%';
  }

  /** 供 onclick="fn('…')" 使用：JSON.stringify 含双引号会破坏 HTML 属性边界 */
  function _anEscapeJsSingleQuoted(s) {
    return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  function _anMockSubjectDetailItems() {
    var names = ['办公费', '差旅费', '咨询费', '印刷费', '市场推广费'];
    var out = names.map(function (n, i) {
      var budget = 800000 + i * 120000;
      var actual = Math.round(budget * (0.85 + i * 0.03));
      var dev = budget ? (budget - actual) / budget : null;
      return { plan_subject: n, subject_name: n, budget: budget, actual: actual, deviation_rate: dev };
    });
    out.sort(function (a, b) {
      var x = a.deviation_rate == null ? -1e9 : a.deviation_rate;
      var y = b.deviation_rate == null ? -1e9 : b.deviation_rate;
      return y - x;
    });
    return out;
  }

  window.openSubjectExecDetailModal = function (unitName) {
    var list = window._anPlanExecRows || [];
    var row = list.find(function (r) { return r.name === unitName; });
    var planV = row ? row.plan : null;
    var actV = row ? row.act : null;
    var devPct = row && row.plan ? ((row.act - row.plan) / Math.abs(row.plan)) * 100 : 0;
    var devCls = devPct >= 0 ? 'positive' : 'negative';
    var left = '<div class="an-subj-detail-left">' +
      '<div class="an-subj-label">月度</div><div class="an-subj-val muted" id="an-subj-detail-period">—</div>' +
      '<div class="an-subj-label">月度计划总额</div><div class="an-subj-val" id="an-subj-plan-total">' + fmtNum(planV) + '</div>' +
      '<div class="an-subj-label">执行数（总额）</div><div class="an-subj-val" id="an-subj-exec-total">' + fmtNum(actV) + '</div>' +
      '<div class="an-subj-label">执行偏差率</div><div class="an-subj-val num ' + devCls + '">' + (row && row.plan ? devPct.toFixed(1) + '%' : '—') + '</div>' +
      '</div>';
    var right = '<div class="an-subj-detail-right" id="an-subj-detail-right"><p class="muted" style="font-size:12px;margin:0;">加载中…</p></div>';
    openModal('科目执行明细', '<div class="an-subj-detail-layout">' + left + right + '</div>', null, true, { wide: true });

    var pageSize = 12;
    var page = 0;
    var itemsAll = [];

    function renderSubjectTable() {
      var wrap = document.getElementById('an-subj-detail-right');
      if (!wrap) return;
      if (!itemsAll.length) {
        wrap.innerHTML = '<p class="muted" style="font-size:13px;margin:0;">暂无科目明细数据</p>' +
          '<div style="margin-top:12px;"><button type="button" class="btn btn-primary btn-sm" onclick="navigateCfDrillFromAnalysis(\'' + _anEscapeJsSingleQuoted(unitName) + '\')">在「资金流单据」中打开</button></div>';
        return;
      }
      var total = itemsAll.length;
      var maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);
      if (page > maxPage) page = maxPage;
      var start = page * pageSize;
      var slice = itemsAll.slice(start, start + pageSize);
      /* 表样与「计划执行对比」主表一致（data-table an-tree-table），无操作列 */
      var tb = '<div class="an-subj-table-wrap">' +
        '<table class="data-table an-tree-table" style="margin:0;">' +
        '<thead><tr>' +
        '<th>科目名称</th>' +
        '<th class="num">月度计划总额</th>' +
        '<th class="num">实际执行额（已确认）</th>' +
        '<th class="num">执行偏差率</th>' +
        '</tr></thead><tbody>';
      slice.forEach(function (it) {
        var dr = it.deviation_rate;
        var drCls = dr == null ? '' : (dr >= 0 ? 'positive' : 'negative');
        var subj = it.subject_name || it.plan_subject || '—';
        tb += '<tr><td><strong>' + subj + '</strong></td><td class="num">' + fmtNum(it.budget) + '</td><td class="num">' + fmtNum(it.actual) + '</td><td class="num ' + drCls + '">' + _anFormatSubjectDevRate(dr) + '</td></tr>';
      });
      tb += '</tbody></table></div>';
      tb += '<div class="an-subj-pager">' +
        '<span>共 ' + total + ' 条</span>' +
        '<button type="button" class="btn btn-sm" id="an-subj-prev"' + (page <= 0 ? ' disabled' : '') + '>上一页</button>' +
        '<span>' + (page + 1) + ' / ' + (maxPage + 1) + '</span>' +
        '<button type="button" class="btn btn-sm" id="an-subj-next"' + (page >= maxPage ? ' disabled' : '') + '>下一页</button>' +
        '</div>' +
        '<div style="margin-top:10px;"><button type="button" class="btn btn-primary btn-sm" onclick="navigateCfDrillFromAnalysis(\'' + _anEscapeJsSingleQuoted(unitName) + '\')">在「资金流单据」中打开</button></div>';
      wrap.innerHTML = tb;
      var prev = document.getElementById('an-subj-prev');
      var next = document.getElementById('an-subj-next');
      if (prev) prev.onclick = function () { if (page > 0) { page--; renderSubjectTable(); } };
      if (next) next.onclick = function () { if (page < maxPage) { page++; renderSubjectTable(); } };
    }

    if (backendOk) {
      var url = '/api/analysis/plan-subject-detail?unit=' + encodeURIComponent(unitName || '');
      API.get(url).then(function (res) {
        var pel = document.getElementById('an-subj-detail-period');
        if (pel) pel.textContent = (res && res.period_label) ? res.period_label : '—';
        itemsAll = (res && res.items) ? res.items.slice() : [];
        page = 0;
        if (itemsAll.length) {
          var sumB = itemsAll.reduce(function (s, x) { return s + (Number(x.budget) || 0); }, 0);
          var sumA = itemsAll.reduce(function (s, x) { return s + (Number(x.actual) || 0); }, 0);
          var plEl = document.getElementById('an-subj-plan-total');
          var exEl = document.getElementById('an-subj-exec-total');
          if (plEl) plEl.textContent = fmtNum(sumB);
          if (exEl) exEl.textContent = fmtNum(sumA);
        }
        renderSubjectTable();
      }).catch(function (e) {
        console.warn(e);
        var pel = document.getElementById('an-subj-detail-period');
        if (pel) pel.textContent = '—';
        itemsAll = _anMockSubjectDetailItems();
        page = 0;
        if (itemsAll.length) {
          var sumB2 = itemsAll.reduce(function (s, x) { return s + (Number(x.budget) || 0); }, 0);
          var sumA2 = itemsAll.reduce(function (s, x) { return s + (Number(x.actual) || 0); }, 0);
          var plEl2 = document.getElementById('an-subj-plan-total');
          var exEl2 = document.getElementById('an-subj-exec-total');
          if (plEl2) plEl2.textContent = fmtNum(sumB2);
          if (exEl2) exEl2.textContent = fmtNum(sumA2);
        }
        renderSubjectTable();
        Toast.warn('科目明细接口不可用，已展示演示数据');
      });
    } else {
      var pel = document.getElementById('an-subj-detail-period');
      if (pel) pel.textContent = '—';
      itemsAll = _anMockSubjectDetailItems();
      if (itemsAll.length) {
        var sumB3 = itemsAll.reduce(function (s, x) { return s + (Number(x.budget) || 0); }, 0);
        var sumA3 = itemsAll.reduce(function (s, x) { return s + (Number(x.actual) || 0); }, 0);
        var plEl3 = document.getElementById('an-subj-plan-total');
        var exEl3 = document.getElementById('an-subj-exec-total');
        if (plEl3) plEl3.textContent = fmtNum(sumB3);
        if (exEl3) exEl3.textContent = fmtNum(sumA3);
      }
      renderSubjectTable();
    }
  };

  /** @deprecated 保留别名，避免旧 HTML/书签引用 */
  window.openAnDrillModal = window.openSubjectExecDetailModal;

  /** @param {string} [yearMonth] 传入 YYYY-MM 时与「预测/预算」一致，按自然月+已确认筛选单据 */
  window.navigateCfDrillFromAnalysis = function (unitName, yearMonth) {
    try { closeModal(); } catch (e) {}
    if (yearMonth && typeof window.cfDrillToRecordsFromMonth === 'function') {
      var u = unitName && unitName !== '集团汇总' ? unitName : '';
      window.cfDrillToRecordsFromMonth(u, yearMonth);
      return;
    }
    try { sessionStorage.setItem('cf_filter_status', '已确认'); } catch (e4) {}
    if (unitName && unitName !== '集团汇总') {
      try { sessionStorage.setItem('cf_filter_unit', unitName); } catch (e5) {}
    }
    Router.navigate('cashflow');
    Toast.success('已筛选「已确认」单据' + (unitName && unitName !== '集团汇总' ? ' · ' + unitName : ''));
  };

  function _anLastNMonthsClient(n) {
    var d = new Date();
    var y = d.getFullYear();
    var mo = d.getMonth() + 1;
    var acc = [];
    for (var i = 0; i < n; i++) {
      acc.push(y + '-' + String(mo).padStart(2, '0'));
      mo -= 1;
      if (mo === 0) { mo = 12; y -= 1; }
    }
    return acc.reverse();
  }

  function _anBudgetForecastDemo(draw) {
    var months = _anLastNMonthsClient(6);
    var units = ['总部', '华东子公司', '华南子公司'];
    var rows = units.map(function (u, ui) {
      var mc = {};
      months.forEach(function (ym, j) {
        mc[ym] = (j + ui + 1) * 1200000;
      });
      var ex = months.reduce(function (s, ym) { return s + mc[ym]; }, 0);
      return { unit: u, month_cells: mc, quota: ex * 1.05, plan_report: ex * 0.98, executed: ex };
    });
    draw(months, rows);
  }

  function renderBudgetForecastTable() {
    var headEl = document.getElementById('liq-budget-forecast-head');
    var bodyEl = document.getElementById('liq-budget-forecast-body');
    if (!headEl || !bodyEl) return;
    function draw(months, rows) {
      var h = '<tr><th>单位</th>';
      months.forEach(function (ym) { h += '<th class="num">' + ym + '</th>'; });
      h += '<th class="num">额度</th><th class="num">计划上报额度</th><th class="num">执行数</th></tr>';
      headEl.innerHTML = h;
      var colCount = 1 + months.length + 3;
      bodyEl.innerHTML = rows.map(function (r) {
        var tr = '<tr><td><strong>' + r.unit + '</strong></td>';
        months.forEach(function (ym) {
          var v = (r.month_cells && r.month_cells[ym] != null) ? r.month_cells[ym] : 0;
          tr += '<td class="num liq-budget-cell" role="button" tabindex="0" data-unit="' + String(r.unit).replace(/"/g, '&quot;') + '" data-ym="' + ym + '" title="点击查看科目明细">' + fmtNum(v) + '</td>';
        });
        tr += '<td class="num">' + fmtNum(r.quota) + '</td><td class="num">' + fmtNum(r.plan_report) + '</td><td class="num">' + fmtNum(r.executed) + '</td></tr>';
        return tr;
      }).join('');
      if (!rows.length) {
        bodyEl.innerHTML = '<tr><td colspan="' + colCount + '" class="empty-state muted">暂无数据</td></tr>';
      }
    }
    if (backendOk) {
      API.get('/api/budget-forecast/matrix?months=6').then(function (res) {
        var months = (res && res.months) ? res.months : [];
        var rows = (res && res.rows) ? res.rows : [];
        if (!months.length || !rows.length) {
          bodyEl.innerHTML = '<tr><td colspan="12" class="empty-state muted">暂无数据</td></tr>';
          return;
        }
        draw(months, rows);
      }).catch(function () {
        _anBudgetForecastDemo(draw);
        Toast.warn('预算表接口不可用，已展示演示数据');
      });
    } else {
      _anBudgetForecastDemo(draw);
    }
  }

  function _anOpenBudgetMonthDrillModal(unit, ym) {
    var left = '<div class="an-subj-detail-left">' +
      '<div class="an-subj-label">单位</div><div class="an-subj-val"><strong>' + (unit || '—') + '</strong></div>' +
      '<div class="an-subj-label">月份</div><div class="an-subj-val">' + ym + '</div>' +
      '<div class="an-subj-label">月度净额（汇总）</div><div class="an-subj-val" id="an-budget-drill-total">—</div></div>';
    var right = '<div class="an-subj-detail-right" id="an-budget-drill-right"><p class="muted" style="font-size:12px;margin:0;">加载中…</p></div>';
    openModal('科目明细 — ' + (unit || '') + ' · ' + ym, '<div class="an-subj-detail-layout">' + left + right + '</div>', null, true, { wide: true });

    function _bindBudgetDrillToRecordsBtn() {
      var btn = document.getElementById('cf-budget-drill-to-records');
      if (btn) {
        btn.addEventListener('click', function () {
          try { closeModal(); } catch (e) {}
          if (window.cfDrillToRecordsFromMonth) window.cfDrillToRecordsFromMonth(unit, ym);
        });
      }
    }

    function renderDrill(items, cellTotal, sumS, delta) {
      var tel = document.getElementById('an-budget-drill-total');
      if (tel) tel.textContent = fmtNum(cellTotal);
      var wrap = document.getElementById('an-budget-drill-right');
      if (!wrap) return;
      var footer =
        '<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border);">' +
        '<button type="button" class="btn btn-primary" id="cf-budget-drill-to-records">查看该月已确认资金流单据</button>' +
        '<span class="muted" style="font-size:11px;margin-left:10px;">与预测/预算下钻同源（only_confirmed）</span></div>';
      if (!items || !items.length) {
        wrap.innerHTML =
          '<p class="muted" style="font-size:13px;margin:0;">暂无科目明细（该月无已确认单据或未接入后端）。</p>' + footer;
        _bindBudgetDrillToRecordsBtn();
        return;
      }
      var tb = '<div class="an-subj-table-wrap"><table class="data-table an-tree-table" style="margin:0;"><thead><tr><th>科目名称</th><th class="num">具体金额</th></tr></thead><tbody>';
      items.forEach(function (it) {
        tb += '<tr><td><strong>' + (it.subject_name || '—') + '</strong></td><td class="num">' + fmtNum(it.amount) + '</td></tr>';
      });
      tb += '</tbody></table></div>';
      tb += '<p class="muted" style="font-size:11px;margin:8px 0 0;line-height:1.5;">明细合计：<strong>' + fmtNum(sumS) + '</strong> · 月度汇总净额：<strong>' + fmtNum(cellTotal) + '</strong>';
      if (delta != null && Math.abs(Number(delta)) > 0.01) {
        tb += ' <span class="badge badge-warn">差 ' + fmtNum(delta) + '</span>（精度/未分类项）';
      }
      tb += '</p>';
      wrap.innerHTML = tb + footer;
      _bindBudgetDrillToRecordsBtn();
    }

    if (backendOk) {
      API.get('/api/budget-forecast/month-drill?unit=' + encodeURIComponent(unit || '') + '&year_month=' + encodeURIComponent(ym || ''))
        .then(function (res) {
          renderDrill(res.items, res.cell_total, res.sum_subjects, res.delta);
        })
        .catch(function () {
          renderDrill([
            { subject_name: '销售回款', amount: 1200000 },
            { subject_name: '采购付款', amount: -800000 },
          ], 400000, 400000, 0);
          Toast.warn('下钻接口不可用，已展示演示数据');
        });
    } else {
      renderDrill([
        { subject_name: '销售回款', amount: 1200000 },
        { subject_name: '采购付款', amount: -800000 },
      ], 400000, 400000, 0);
    }
  }

  function _bindBudgetForecastDrill() {
    var pg = document.getElementById('page-liquidity');
    if (!pg || pg._liqBudgetDrillBound) return;
    pg._liqBudgetDrillBound = true;
    pg.addEventListener('click', function (e) {
      var td = e.target.closest && e.target.closest('td.liq-budget-cell');
      if (!td) return;
      e.preventDefault();
      var unit = td.getAttribute('data-unit');
      var ym = td.getAttribute('data-ym');
      _anOpenBudgetMonthDrillModal(unit, ym);
    });
  }

  function renderAnalysis() {
    populateUnitSelect('an-unit');
    renderAnUnitTreeTable();
    var sc = document.getElementById('an-scope');
    if (sc && !sc._anBound) {
      sc._anBound = true;
      sc.addEventListener('change', function () { renderAnUnitTreeTable(); });
    }
    var au = document.getElementById('an-unit');
    if (au && !au._anBound) {
      au._anBound = true;
      au.addEventListener('change', function () { renderAnUnitTreeTable(); });
    }
    if (AppData.analysisResult) {
      drawAnalysis(AppData.analysisResult);
      _showAnalysisActions(true);
    }
  }

  function _showAnalysisActions(show) {
    var toPlan = document.getElementById('an-btn-to-plan');
    if (toPlan) toPlan.style.display = 'none';
    var exp = document.getElementById('an-btn-export');
    if (exp) exp.style.display = show ? '' : 'none';
  }

  _domOn('an-btn-run', 'click', function () {
    Toast.info('正在运行分析...');
    var params = {
      unit: document.getElementById('an-unit').value || null,
      period_config_code: document.getElementById('an-period-config').value,
      opening_balance: parseFloat(document.getElementById('an-opening').value) || 0,
    };
    var curEl = document.getElementById('an-currency');
    if (curEl && curEl.value) params.currency = curEl.value;

    (async function () {
      try {
        if (backendOk) {
          var r = await API.post('/api/analysis/run', params);
          AppData.latestReportId = r.report_id;
          AppData.analysisResult = { periods: r.periods, rows: r.rows, position: r.position };
        } else {
          AppData.latestReportId = null;
          AppData.analysisResult = buildLocalAnalysis(params);
        }
        drawAnalysis(AppData.analysisResult);
        _showAnalysisActions(true);
        Toast.success('分析完成');
      } catch (e) {
        console.warn(e);
        AppData.latestReportId = null;
        AppData.analysisResult = buildLocalAnalysis(params);
        drawAnalysis(AppData.analysisResult);
        _showAnalysisActions(true);
        Toast.warn('后端不可用，已使用本地推演数据');
      }
    })();
  });

  // 下发至计划 — 核心跨模块链路
  _domOn('an-btn-to-plan', 'click', function () {
    if (!AppData.analysisResult) { Toast.warn('请先运行分析'); return; }
    var result = AppData.analysisResult;
    var units = ['总部', '华东子公司', '华南子公司'];
    var unit = document.getElementById('an-unit').value;
    if (unit) units = [unit];

    openModal('下发资金计划',
      '<p>将现金流分析结果下发为资金计划：</p>' +
      '<div class="form-group"><label>下发单位</label><p style="font-size:13px;color:var(--text-main);font-weight:600;">' + units.join('、') + '</p></div>' +
      '<div class="form-group"><label>周期类型</label><select class="form-select" id="m-an-plan-type"><option>月</option><option>季</option></select></div>' +
      '<div class="form-group"><label>期间标签</label><input class="form-input" id="m-an-plan-label" value="2026年4月" /></div>' +
      '<p class="muted" style="font-size:12px;">将按科目↔计划科目映射关系汇总金额。</p>',
      function () {
        var periodType = document.getElementById('m-an-plan-type').value;
        var periodLabel = document.getElementById('m-an-plan-label').value;
        var maxId = (AppData.plans || []).reduce(function (a, p) { return Math.max(a, p.id || 0); }, 0);

        var rows = result.rows || [];
        var n = (result.periods || []).length;
        function sumRow(name) {
          var row = rows.find(function (r) { return r.name === name; });
          if (!row || !row.values) return 0;
          return row.values.reduce(function (a, v) { return a + v; }, 0);
        }

        units.forEach(function (u) {
          maxId++;
          var dataJson = {
            '经营性流入': Math.round(sumRow('经营性流入') / Math.max(units.length, 1)),
            '经营性流出': -Math.round(Math.abs(sumRow('经营性流出')) / Math.max(units.length, 1)),
            '投资性流入': Math.round(sumRow('投资性流入') / Math.max(units.length, 1)),
            '投资性流出': -Math.round(Math.abs(sumRow('投资性流出')) / Math.max(units.length, 1)),
            '融资性流入': Math.round(sumRow('融资性流入') / Math.max(units.length, 1)),
            '融资性流出': -Math.round(Math.abs(sumRow('融资性流出')) / Math.max(units.length, 1)),
          };
          AppData.plans.push({
            id: maxId, unit: u, period_type: periodType,
            period_label: periodLabel, status: '草稿',
            data_json: JSON.stringify(dataJson),
          });
        });
        Toast.success('已下发 ' + units.length + ' 个计划');
        closeModal();
        Router.navigate('liquidity');
      });
  });

  // 导出分析报告
  _domOn('an-btn-export', 'click', function () {
    if (!AppData.analysisResult) return;
    var result = AppData.analysisResult;
    var op = document.getElementById('an-opening');
    var un = document.getElementById('an-unit');
    var cr = document.getElementById('an-currency');
    var scp = document.getElementById('an-scope');
    var meta = '# 分析参数:期初余额=' + (op && op.value ? op.value : '') + ',分析口径=' + (scp && scp.options[scp.selectedIndex] ? scp.options[scp.selectedIndex].text : '') + ',单位=' + (un && un.value ? un.value : '全部') + ',币种=' + (cr && cr.value ? cr.value : '全部') + '\n';
    var csv = meta + '科目,' + (result.periods || []).map(function (p) { return p.label; }).join(',') + '\n';
    csv += '期初余额,' + (result.position.opening || []).join(',') + '\n';
    (result.rows || []).forEach(function (r) {
      csv += r.name + ',' + (r.values || []).join(',') + '\n';
      (r.children || []).forEach(function (c) {
        csv += '  ' + c.name + ',' + (c.values || []).join(',') + '\n';
      });
    });
    csv += '期末余额,' + (result.position.closing || []).join(',') + '\n';
    var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '现金流分析报告_' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    Toast.success('报告已导出');
  });

  function buildLocalAnalysis(params) {
    var periods = [
      { label: '第1天', start: '2026-03-25', end: '2026-03-25' },
      { label: '第2天', start: '2026-03-26', end: '2026-03-26' },
      { label: '第3天', start: '2026-03-27', end: '2026-03-27' },
      { label: '第4天', start: '2026-03-28', end: '2026-03-28' },
      { label: '第5天', start: '2026-03-29', end: '2026-03-29' },
      { label: '第6天', start: '2026-03-30', end: '2026-03-30' },
      { label: '第7天', start: '2026-03-31', end: '2026-03-31' },
      { label: '第1周', start: '2026-04-01', end: '2026-04-07' },
      { label: '第2周', start: '2026-04-08', end: '2026-04-14' },
      { label: '第3周', start: '2026-04-15', end: '2026-04-21' },
      { label: '第4周', start: '2026-04-22', end: '2026-04-28' },
      { label: '4月', start: '2026-04-29', end: '2026-05-28' },
      { label: '5月', start: '2026-05-29', end: '2026-06-28' },
      { label: '6月', start: '2026-06-29', end: '2026-07-28' },
    ];
    var n = periods.length;
    var opening = params.opening_balance || 10000000;
    function rnd(base, variance) { return Math.round(base + (Math.random() - 0.3) * variance); }

    var salesIn = [], otherIn = [], investIn = [], loanIn = [];
    var purchaseOut = [], salaryOut = [], salPay = [], salSsi = [], salHpf = [], expenseOut = [], taxOut = [], investOut = [], repayOut = [];

    for (var i = 0; i < n; i++) {
      var scale = i < 7 ? 1 : i < 11 ? 5 : 20;
      salesIn.push(rnd(580000 * scale, 200000 * scale));
      otherIn.push(rnd(45000 * scale, 20000 * scale));
      investIn.push(rnd(20000 * scale, 15000 * scale));
      loanIn.push(i % 4 === 0 ? rnd(300000 * scale, 100000 * scale) : 0);
      purchaseOut.push(rnd(380000 * scale, 150000 * scale));
      var salRaw = i < 7 ? 0 : rnd(120000 * scale, 40000 * scale);
      salPay.push(Math.round(salRaw * 0.55));
      salSsi.push(Math.round(salRaw * 0.28));
      salHpf.push(Math.round(salRaw * 0.17));
      salaryOut.push(salPay[i] + salSsi[i] + salHpf[i]);
      expenseOut.push(rnd(35000 * scale, 15000 * scale));
      taxOut.push(i % 3 === 0 ? rnd(60000 * scale, 25000 * scale) : 0);
      investOut.push(rnd(25000 * scale, 10000 * scale));
      repayOut.push(i % 5 === 0 ? rnd(200000 * scale, 80000 * scale) : 0);
    }

    var inflowArr = [], outflowArr = [], openingArr = [], closingArr = [];
    for (var j = 0; j < n; j++) {
      var tIn = salesIn[j] + otherIn[j] + investIn[j] + loanIn[j];
      var tOut = purchaseOut[j] + salaryOut[j] + expenseOut[j] + taxOut[j] + investOut[j] + repayOut[j];
      inflowArr.push(tIn);
      outflowArr.push(tOut);
      openingArr.push(j === 0 ? opening : closingArr[j - 1]);
      closingArr.push(openingArr[j] + tIn - tOut);
    }

    return {
      periods: periods,
      rows: [
        { name: '经营性流入', values: salesIn.map(function (v, i) { return v + otherIn[i]; }), children: [
          { name: '销售回款', values: salesIn },
          { name: '其他经营收入', values: otherIn },
        ]},
        { name: '投资性流入', values: investIn, children: [
          { name: '利息/理财收入', values: investIn },
        ]},
        { name: '融资性流入', values: loanIn, children: [
          { name: '借款流入', values: loanIn },
        ]},
        { name: '经营性流出', values: purchaseOut.map(function (v, i) { return v + salaryOut[i] + expenseOut[i] + taxOut[i]; }), children: [
          { name: '采购付款', values: purchaseOut },
          { name: '工资薪酬', values: salaryOut, children: [
            { name: '代发工资', values: salPay },
            { name: '社保缴纳', values: salSsi },
            { name: '公积金缴纳', values: salHpf },
          ]},
          { name: '费用报销', values: expenseOut },
          { name: '税费支出', values: taxOut },
        ]},
        { name: '投资性流出', values: investOut, children: [
          { name: '理财购入', values: investOut },
        ]},
        { name: '融资性流出', values: repayOut, children: [
          { name: '还款本金', values: repayOut },
        ]},
      ],
      position: { opening: openingArr, closing: closingArr, inflow: inflowArr, outflow: outflowArr },
    };
  }

  function renderMatrixTable(result, headId, bodyId) {
    var headEl = document.getElementById(headId);
    var bodyEl = document.getElementById(bodyId);
    if (!headEl || !bodyEl) return;
    var periods = result.periods || [];
    headEl.innerHTML = '<tr><th>科目</th>' + periods.map(function (p) { return '<th>' + p.label + '</th>'; }).join('') + '</tr>';
    var rows = '';
    rows += '<tr class="row-opening"><td class="row-header">期初余额</td>' + (result.position.opening || []).map(function (v) { return '<td class="num">' + fmtNum(v) + '</td>'; }).join('') + '</tr>';
    function renderRows(nodes, depth) {
      (nodes || []).forEach(function (n) {
        var pad = depth * 16;
        var bold = n.children && n.children.length;
        rows += '<tr><td class="' + (bold ? 'row-header' : '') + '" style="padding-left:' + (pad + 14) + 'px;">' + n.name + '</td>';
        (n.values || []).forEach(function (v) { rows += '<td class="num ' + (v > 0 ? 'positive' : v < 0 ? 'negative' : '') + '">' + fmtNum(v) + '</td>'; });
        rows += '</tr>';
        if (n.children) renderRows(n.children, depth + 1);
      });
    }
    renderRows(result.rows, 0);
    rows += '<tr class="row-total"><td class="row-header">净流入</td>' + (result.position.inflow || []).map(function (v, i) {
      var net = v - (result.position.outflow[i] || 0);
      return '<td class="num ' + (net >= 0 ? 'positive' : 'negative') + '">' + fmtNum(net) + '</td>';
    }).join('') + '</tr>';
    rows += '<tr class="row-closing"><td class="row-header">期末余额</td>' + (result.position.closing || []).map(function (v) { return '<td class="num">' + fmtNum(v) + '</td>'; }).join('') + '</tr>';
    bodyEl.innerHTML = rows;
  }

  var _anAiReportSeq = 0;
  var _anAiTypewriterCancel = null;

  function _anSummarizeForAi(result) {
    var periods = result.periods || [];
    var pos = result.position || {};
    var o = pos.opening || [];
    var inf = pos.inflow || [];
    var ouf = pos.outflow || [];
    var cl = pos.closing || [];
    var n = Math.min(periods.length, o.length, inf.length, ouf.length, cl.length);
    var sumIn = 0;
    var sumOut = 0;
    var i;
    for (i = 0; i < n; i++) {
      sumIn += Number(inf[i]) || 0;
      sumOut += Number(ouf[i]) || 0;
    }
    var unitEl = document.getElementById('an-unit');
    var scopeEl = document.getElementById('an-scope');
    var obj = {
      unit: unitEl && unitEl.value ? unitEl.value : '全部',
      scope: scopeEl && scopeEl.value ? scopeEl.value : 'group',
      period_count: n,
      last_period_label: n ? periods[n - 1].label : '—',
      opening_first: n ? o[0] : null,
      closing_last: n ? cl[n - 1] : null,
      sum_inflow_cny: sumIn,
      sum_outflow_cny: sumOut,
      net_total_cny: sumIn - sumOut,
    };
    try {
      return JSON.stringify(obj, null, 0);
    } catch (e) {
      return '{}';
    }
  }

  function _anTypewriterPlain(el, fullText, seq, onDone) {
    var cancelled = false;
    var pos = 0;
    var tid = setInterval(function () {
      if (cancelled) return;
      if (seq !== _anAiReportSeq) {
        cancelled = true;
        clearInterval(tid);
        return;
      }
      pos += 2;
      if (pos >= fullText.length) {
        el.textContent = fullText;
        clearInterval(tid);
        if (onDone) onDone();
        return;
      }
      el.textContent = fullText.slice(0, pos);
    }, 18);
    return function () {
      cancelled = true;
      try { clearInterval(tid); } catch (e) {}
    };
  }

  function _bindAnRiskTags(tagsEl) {
    if (!tagsEl) return;
    tagsEl.querySelectorAll('.risk-tag[data-risk]').forEach(function (t) {
      t.addEventListener('click', function () {
        var risk = t.getAttribute('data-risk');
        if (risk === 'bill') {
          try { sessionStorage.removeItem('cf_subtab'); } catch (e) {}
          Router.navigate('cashflow');
          Toast.success('已打开资金流单据（可按业务类型筛选票据相关流水）');
        } else if (risk === 'social') {
          try {
            sessionStorage.setItem('cf_subtab', 'records');
            sessionStorage.setItem('cf_filter_biz', '17');
            sessionStorage.setItem('cf_filter_unit', '华东子公司');
            sessionStorage.setItem('cf_filter_status', '已确认');
          } catch (e2) {}
          Router.navigate('cashflow');
          Toast.success('已筛选：华东 · 社保缴纳（应付职工薪酬映射）');
        } else if (risk === 'expense') {
          try {
            sessionStorage.setItem('cf_subtab', 'records');
            sessionStorage.setItem('cf_filter_biz', '3');
            sessionStorage.setItem('cf_filter_unit', '华南子公司');
            sessionStorage.setItem('cf_filter_status', '已确认');
          } catch (e3) {}
          Router.navigate('cashflow');
          Toast.success('已筛选：华南 · 费用报销');
        }
      });
    });
  }

  function renderAnalysisAiReport(result) {
    var seq = ++_anAiReportSeq;
    if (typeof _anAiTypewriterCancel === 'function') {
      try { _anAiTypewriterCancel(); } catch (e) {}
    }
    _anAiTypewriterCancel = null;

    var el = document.getElementById('an-ai-report');
    var tagsEl = document.getElementById('an-ai-risk-tags');
    if (!el) return;

    el.className = 'an-ai-text ai-msg-content an-ai-rich';
    if (!result || !result.position) {
      el.innerHTML = '<p class="muted" style="margin:0;">暂无分析结果</p>';
      if (tagsEl) tagsEl.innerHTML = '';
      return;
    }

    el.innerHTML = '<p class="muted" style="margin:0;"><span class="an-ai-loading-dots">正在调用大模型</span></p>';
    if (tagsEl) {
      tagsEl.innerHTML = '<span class="muted" style="font-size:11px;">生成中…</span>';
    }

    (async function () {
      var text = '';
      try {
        if (typeof AI !== 'undefined' && AI.chatCompletionOneShot && AI.ANALYSIS_REPORT_SYSTEM_PROMPT) {
          var payload = _anSummarizeForAi(result);
          var userMsg = '以下为本轮分析的结构化摘要（JSON），请基于真实数据撰写报告：\n' + payload;
          text = await AI.chatCompletionOneShot(AI.ANALYSIS_REPORT_SYSTEM_PROMPT, userMsg);
        if (!text || !String(text).trim()) throw new Error('empty_reply');
        } else {
          throw new Error('NO_AI');
        }
      } catch (e) {
        if (seq !== _anAiReportSeq) return;
        console.warn('renderAnalysisAiReport', e);
        var noKey = e && (e.message === 'NO_AI_KEY' || String(e.message || '').indexOf('NO_AI_KEY') !== -1);
        text =
          '## 整体说明\n\n' +
          (noKey
            ? '当前**未配置大模型密钥**或后端不可用。请在 **亿流 Work** 设置 API Key，或由服务端配置 `DEEPSEEK_API_KEY` 后重试。\n\n'
            : '暂时无法连接大模型，以下为**离线提示**：\n\n') +
          '- 请结合上方「头寸走势」与「明细表」查看本期净流入与期末余额。\n\n' +
          '[打开现金流事件](cf-page:cashflow)';
      }

      if (seq !== _anAiReportSeq) return;

      el.textContent = '';
      _anAiTypewriterCancel = _anTypewriterPlain(el, text, seq, function () {
        if (seq !== _anAiReportSeq) return;
        _anAiTypewriterCancel = null;
        if (typeof AI !== 'undefined' && AI.renderMarkdown) {
          el.innerHTML = AI.renderMarkdown(text);
          if (AI.bindInlineLinks) AI.bindInlineLinks(el);
        } else {
          el.textContent = text;
        }
        if (tagsEl) {
          tagsEl.innerHTML =
            '<span class="muted" style="display:block;font-size:11px;margin-bottom:8px;">点击标签将打开现金流事件并自动筛选（闭环）</span>' +
            '<span class="risk-tag" data-risk="bill" role="button" tabindex="0">票据风险</span>' +
            '<span class="risk-tag" data-risk="social" role="button" tabindex="0">社保偏差</span>' +
            '<span class="risk-tag" data-risk="expense" role="button" tabindex="0">费用延迟</span>';
          _bindAnRiskTags(tagsEl);
        }
      });
    })();
  }

  function bindAnalysisChartDrill() {
    var chart = typeof Charts !== 'undefined' && Charts._instances && Charts._instances['chart-analysis-position'];
    if (!chart || typeof chart.off !== 'function') return;
    chart.off('click');
    chart.on('click', function () {
      try {
        sessionStorage.setItem('cf_subtab', 'records');
        sessionStorage.setItem('cf_filter_status', '已确认');
        Router.navigate('cashflow');
        Toast.success('已跳转「资金流单据」· 已确认（与矩阵/头寸同源推演）');
      } catch (e) {}
    });
  }

  function _anFmtWanOne(v) {
    if (v == null || (typeof v === 'number' && isNaN(v))) return '—';
    var n = Number(v);
    if (isNaN(n)) return '—';
    return (Math.round(n) / 10000).toFixed(1) + '万';
  }

  function _anDetailPeriodLabel(periods, idx) {
    if (!periods || idx >= periods.length) return 'P' + (idx + 1);
    var p = periods[idx];
    if (!p) return 'P' + (idx + 1);
    var lab = String(p.label || '');
    var m = lab.match(/第(\d+)天/);
    if (m) return 'D' + m[1];
    m = lab.match(/第(\d+)周/);
    if (m) return 'W' + m[1];
    var freq = p.freq || '';
    if (freq === '天') {
      var d = 0;
      for (var i = 0; i <= idx; i++) {
        if ((periods[i].freq || '') === '天') d++;
      }
      return 'D' + d;
    }
    if (freq === '周') {
      var w = 0;
      for (var j = 0; j <= idx; j++) {
        if ((periods[j].freq || '') === '周') w++;
      }
      return 'W' + w;
    }
    return lab || ('P' + (idx + 1));
  }

  /** 将 periods 与 position 四数组截到同一长度，避免图与表错位；与后端 compute_position 口径一致 */
  function _anAlignAnalysisSeries(result) {
    if (!result || !result.position) return null;
    var periods = result.periods || [];
    var pos = result.position;
    var o = pos.opening || [];
    var inf = pos.inflow || [];
    var ouf = pos.outflow || [];
    var cl = pos.closing || [];
    var lp = periods.length;
    var n = lp > 0
      ? Math.min(lp, o.length, inf.length, ouf.length, cl.length)
      : Math.min(o.length, inf.length, ouf.length, cl.length);
    if (!n) return null;
    var periodsOut = lp ? periods.slice(0, n) : [];
    if (!periodsOut.length) {
      periodsOut = Array.from({ length: n }, function (_, i) {
        return { label: 'P' + (i + 1), freq: '', start: '', end: '' };
      });
    }
    return {
      periods: periodsOut,
      position: {
        opening: o.slice(0, n),
        inflow: inf.slice(0, n),
        outflow: ouf.slice(0, n),
        closing: cl.slice(0, n),
      },
      rows: result.rows,
    };
  }

  function renderAnalysisDetailTable(result) {
    var bodyEl = document.getElementById('an-detail-table-body');
    if (!bodyEl) return;
    if (!result || !result.position) {
      bodyEl.innerHTML = '<tr><td colspan="6" class="empty-state muted">暂无头寸数据，请先运行分析</td></tr>';
      return;
    }
    var periods = result.periods || [];
    var pos = result.position;
    var o = pos.opening || [];
    var inf = pos.inflow || [];
    var ouf = pos.outflow || [];
    var n = periods.length;
    if (!n) {
      n = Math.min(o.length, inf.length, ouf.length, (pos.closing || []).length);
    }
    if (!n) {
      bodyEl.innerHTML = '<tr><td colspan="6" class="empty-state muted">暂无时段数据</td></tr>';
      return;
    }
    var html = [];
    for (var i = 0; i < n; i++) {
      var oi = Number(o[i]) || 0;
      var ii = Number(inf[i]) || 0;
      var oi2 = Number(ouf[i]) || 0;
      var net = ii - oi2;
      /* 期末与矩阵/后端公式一致：期初+流入-流出（避免单独取整 cl[i] 与前三列展示不一致） */
      var ci = oi + ii - oi2;
      var netCls = net >= 0 ? 'positive' : 'negative';
      var plab = _anDetailPeriodLabel(periods, i);
      html.push(
        '<tr>' +
        '<td><strong>' + plab + '</strong></td>' +
        '<td class="num">' + _anFmtWanOne(oi) + '</td>' +
        '<td class="num an-col-in">' + _anFmtWanOne(ii) + '</td>' +
        '<td class="num an-col-out">' + _anFmtWanOne(oi2) + '</td>' +
        '<td class="num ' + netCls + '">' + _anFmtWanOne(net) + '</td>' +
        '<td class="num">' + _anFmtWanOne(ci) + '</td>' +
        '</tr>'
      );
    }
    bodyEl.innerHTML = html.join('');
  }

  function drawAnalysis(result) {
    if (!result || typeof result !== 'object') {
      console.warn('drawAnalysis: 无有效结果，跳过图表');
      renderAnalysisDetailTable(null);
      return;
    }
    var aligned = _anAlignAnalysisSeries(result);
    if (!aligned) {
      if (typeof Charts !== 'undefined' && Charts.analysisPosition) {
        Charts.analysisPosition('chart-analysis-position', { periods: [], position: { opening: [], inflow: [], outflow: [], closing: [] } });
      }
      renderAnalysisDetailTable(null);
      return;
    }
    Charts.analysisPosition('chart-analysis-position', aligned);
    bindAnalysisChartDrill();
    renderAnalysisDetailTable(aligned);
    renderAnUnitTreeTable();
    renderAnalysisAiReport(aligned);
  }

  // ═══════════════════════════════════════════════
  // 4. PLAN — 获取资金流/分析数据 + CRUD
  // ═══════════════════════════════════════════════

  var _planChipsBound = false;

  function renderPlan() {
    if (!document.getElementById('plan-chips')) return;
    var plans = AppData.plans || [];
    var labels = [];
    plans.forEach(function (p) { if (labels.indexOf(p.period_label) === -1) labels.push(p.period_label); });
    var planChipsEl = document.getElementById('plan-chips');
    if (planChipsEl) planChipsEl.innerHTML = labels.map(function (l, i) {
      return '<div class="plan-chip' + (i === 0 ? ' active' : '') + '" data-label="' + l + '">' + l + '</div>';
    }).join('');

    if (!_planChipsBound && planChipsEl) {
      _planChipsBound = true;
      planChipsEl.addEventListener('click', function (e) {
        var chip = e.target.closest('.plan-chip');
        if (!chip) return;
        document.querySelectorAll('.plan-chip').forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        renderPlanTable((AppData.plans || []).filter(function (p) { return p.period_label === chip.dataset.label; }));
      });
    }

    if (labels.length) {
      renderPlanTable(plans.filter(function (p) { return p.period_label === labels[0]; }));
    } else {
      renderPlanTable(plans);
    }
    Charts.planCompare('chart-plan-compare', plans, AppData.actualExecution || []);
    _renderDeviationLogTable();
  }

  function renderPlanTable(list) {
    var body = document.getElementById('plan-table-body');
    if (!list || !list.length) { body.innerHTML = '<tr><td colspan="5" class="empty-state">暂无计划</td></tr>'; return; }
    body.innerHTML = list.map(function (p) {
      var bcls = 'badge-default';
      if (p.status === '已审批') bcls = 'badge-success';
      else if (p.status === '已提交') bcls = 'badge-warn';
      else if (p.status === '执行中') bcls = 'badge-primary';
      else if (p.status === '已完成') bcls = 'badge-success';

      var actions = '<button class="btn btn-sm btn-ghost" onclick="editPlan(' + p.id + ')">编辑</button>';
      if (p.status === '草稿') actions += ' <button class="btn btn-sm btn-ghost" onclick="submitPlan(' + p.id + ')">提交</button>';
      if (p.status === '已提交') actions += ' <button class="btn btn-sm btn-ghost" onclick="approvePlan(' + p.id + ')">审批</button>';
      if (p.status === '已审批') actions += ' <button class="btn btn-sm btn-ghost" onclick="executePlan(' + p.id + ')">下发执行</button>';
      if (p.status === '执行中') actions += ' <button class="btn btn-sm btn-ghost" onclick="completePlan(' + p.id + ')">完成</button>';

      return '<tr><td>' + (p.unit || '-') + '</td><td>' + (p.period_type || '-') + '</td><td>' + (p.period_label || '-') + '</td><td><span class="badge ' + bcls + '">' + p.status + '</span></td>' +
        '<td>' + actions + '</td></tr>';
    }).join('');
  }

  window.editPlan = function (id) {
    var plan = (AppData.plans || []).find(function (p) { return p.id === id; });
    if (!plan) return;
    var dj = {};
    try { dj = typeof plan.data_json === 'string' ? JSON.parse(plan.data_json) : (plan.data_json || {}); } catch (e) { dj = {}; }
    openModal('编辑计划 — ' + plan.unit + ' ' + plan.period_label,
      '<div class="form-group"><label>经营性流入</label><input class="form-input" id="m-pf-opIn" type="number" value="' + (dj['经营性流入'] || 0) + '" /></div>' +
      '<div class="form-group"><label>经营性流出</label><input class="form-input" id="m-pf-opOut" type="number" value="' + Math.abs(dj['经营性流出'] || 0) + '" /></div>' +
      '<div class="form-group"><label>投资性流入</label><input class="form-input" id="m-pf-invIn" type="number" value="' + (dj['投资性流入'] || 0) + '" /></div>' +
      '<div class="form-group"><label>投资性流出</label><input class="form-input" id="m-pf-invOut" type="number" value="' + Math.abs(dj['投资性流出'] || 0) + '" /></div>' +
      '<div class="form-group"><label>融资性流入</label><input class="form-input" id="m-pf-finIn" type="number" value="' + (dj['融资性流入'] || 0) + '" /></div>' +
      '<div class="form-group"><label>融资性流出</label><input class="form-input" id="m-pf-finOut" type="number" value="' + Math.abs(dj['融资性流出'] || 0) + '" /></div>',
      function () {
        plan.data_json = JSON.stringify({
          '经营性流入': parseFloat(document.getElementById('m-pf-opIn').value) || 0,
          '经营性流出': -(parseFloat(document.getElementById('m-pf-opOut').value) || 0),
          '投资性流入': parseFloat(document.getElementById('m-pf-invIn').value) || 0,
          '投资性流出': -(parseFloat(document.getElementById('m-pf-invOut').value) || 0),
          '融资性流入': parseFloat(document.getElementById('m-pf-finIn').value) || 0,
          '融资性流出': -(parseFloat(document.getElementById('m-pf-finOut').value) || 0),
        });
        syncPlanRemote(plan);
        Toast.success('计划已保存');
        closeModal(); renderPlan();
      });
  };

  window.submitPlan = function (id) {
    var plan = (AppData.plans || []).find(function (p) { return p.id === id; });
    if (!plan) return;
    if (plan.status === '已审批') { Toast.warn('该计划已审批'); return; }
    if (plan.status === '已提交') { Toast.warn('该计划已提交'); return; }
    plan.status = '已提交';
    syncPlanRemote(plan);
    Toast.success('计划已提交审批');
    renderPlan();
  };

  window.approvePlan = function (id) {
    var plan = (AppData.plans || []).find(function (p) { return p.id === id; });
    if (!plan) return;
    plan.status = '已审批';
    syncPlanRemote(plan);
    Toast.success('计划已审批通过');
    renderPlan();
  };

  window.executePlan = function (id) {
    var plan = (AppData.plans || []).find(function (p) { return p.id === id; });
    if (!plan) return;
    plan.status = '执行中';
    syncPlanRemote(plan);
    Toast.success('计划已下发执行');
    renderPlan();
  };

  window.completePlan = function (id) {
    var plan = (AppData.plans || []).find(function (p) { return p.id === id; });
    if (!plan) return;

    var planData = {};
    try { planData = typeof plan.data_json === 'string' ? JSON.parse(plan.data_json) : (plan.data_json || {}); } catch (e) {}
    var pfOpIn = planData['经营性流入'] || 0;
    var pfOpOut = Math.abs(planData['经营性流出'] || 0);
    var pfInvIn = planData['投资性流入'] || 0;
    var pfInvOut = Math.abs(planData['投资性流出'] || 0);
    var pfFinIn = planData['融资性流入'] || 0;
    var pfFinOut = Math.abs(planData['融资性流出'] || 0);

    openModal('完成计划 — ' + plan.unit + ' ' + plan.period_label,
      '<p>填写实际执行金额以完成计划并触发偏差分析。<br><span class="muted" style="font-size:12px;">已按计划值预填，请修改为实际值。</span></p>' +
      '<div class="form-group"><label>实际经营性流入 <span class="muted">(计划: ' + fmtNum(pfOpIn) + ')</span></label><input class="form-input" id="m-comp-opIn" type="number" value="' + pfOpIn + '" /></div>' +
      '<div class="form-group"><label>实际经营性流出 <span class="muted">(计划: ' + fmtNum(pfOpOut) + ')</span></label><input class="form-input" id="m-comp-opOut" type="number" value="' + pfOpOut + '" /></div>' +
      '<div class="form-group"><label>实际投资性流入 <span class="muted">(计划: ' + fmtNum(pfInvIn) + ')</span></label><input class="form-input" id="m-comp-invIn" type="number" value="' + pfInvIn + '" /></div>' +
      '<div class="form-group"><label>实际投资性流出 <span class="muted">(计划: ' + fmtNum(pfInvOut) + ')</span></label><input class="form-input" id="m-comp-invOut" type="number" value="' + pfInvOut + '" /></div>' +
      '<div class="form-group"><label>实际融资性流入 <span class="muted">(计划: ' + fmtNum(pfFinIn) + ')</span></label><input class="form-input" id="m-comp-finIn" type="number" value="' + pfFinIn + '" /></div>' +
      '<div class="form-group"><label>实际融资性流出 <span class="muted">(计划: ' + fmtNum(pfFinOut) + ')</span></label><input class="form-input" id="m-comp-finOut" type="number" value="' + pfFinOut + '" /></div>',
      function () {
        plan.status = '已完成';
        var actualJson = {
          '经营性流入': parseFloat(document.getElementById('m-comp-opIn').value) || 0,
          '经营性流出': -(parseFloat(document.getElementById('m-comp-opOut').value) || 0),
          '投资性流入': parseFloat(document.getElementById('m-comp-invIn').value) || 0,
          '投资性流出': -(parseFloat(document.getElementById('m-comp-invOut').value) || 0),
          '融资性流入': parseFloat(document.getElementById('m-comp-finIn').value) || 0,
          '融资性流出': -(parseFloat(document.getElementById('m-comp-finOut').value) || 0),
        };

        var maxId = (AppData.actualExecution || []).reduce(function (a, e) { return Math.max(a, e.id || 0); }, 0);
        AppData.actualExecution.push({
          id: maxId + 1, plan_id: plan.id, unit: plan.unit,
          period_label: plan.period_label,
          actual_json: JSON.stringify(actualJson),
          plan_json: plan.data_json,
        });

        _runDeviationAnalysis(plan, actualJson);
        Toast.success('计划已完成，偏差分析已生成');
        closeModal();
        renderPlan();
      });
  };

  // 获取资金流数据 → 创建计划（页面已下线时跳过绑定）
  var _planFromCf = document.getElementById('plan-btn-from-cf');
  if (_planFromCf) _planFromCf.addEventListener('click', function () {
    var recs = AppData.records.items || [];
    var confirmed = recs.filter(function (r) { return r.status === '已确认' && r.currency === 'CNY'; });
    if (!confirmed.length) { Toast.warn('暂无已确认的CNY资金流数据'); return; }

    openModal('从资金流获取数据',
      '<p>后端模式下按<strong>科目↔计划映射</strong>汇总写入草稿计划；离线模式按记录比例估算。</p>' +
      '<p>已确认 CNY 记录：<strong>' + confirmed.length + '</strong> 条</p>' +
      '<div class="form-group"><label>单位</label><select class="form-select" id="m-pf-cf-unit"><option value="">全部</option><option>总部</option><option>华东子公司</option><option>华南子公司</option></select></div>' +
      '<div class="form-group"><label>周期类型</label><select class="form-select" id="m-pf-cf-type"><option>月</option><option>季</option></select></div>' +
      '<div class="form-group"><label>期间标签</label><input class="form-input" id="m-pf-cf-label" value="2026年4月" /></div>',
      function () {
        var unitFilter = document.getElementById('m-pf-cf-unit').value;
        var periodType = document.getElementById('m-pf-cf-type').value;
        var periodLabel = document.getElementById('m-pf-cf-label').value;

        if (backendOk) {
          (async function () {
            try {
              var drafts = (AppData.plans || []).filter(function (p) {
                return p.status === '草稿' && (!unitFilter || p.unit === unitFilter);
              });
              if (!drafts.length) {
                Toast.warn('没有匹配的草稿计划，请先新建计划');
                closeModal();
                return;
              }
              for (var i = 0; i < drafts.length; i++) {
                await API.post('/api/plans/' + drafts[i].id + '/fill-from-cashflow', {});
              }
              await window.cfReloadCoreData();
              Toast.success('已按映射填充 ' + drafts.length + ' 个草稿计划');
            } catch (e) {
              console.warn(e);
              Toast.warn('接口失败');
            }
            closeModal();
            renderPlan();
          })();
          return;
        }

        var units = unitFilter ? [unitFilter] : ['总部', '华东子公司', '华南子公司'];
        var maxId = (AppData.plans || []).reduce(function (a, p) { return Math.max(a, p.id || 0); }, 0);

        units.forEach(function (u) {
          var unitRecs = confirmed.filter(function (r) { return r.unit === u; });
          var inflow = 0, outflow = 0;
          unitRecs.forEach(function (r) { if (r.amount > 0) inflow += r.amount; else outflow += r.amount; });
          maxId++;
          AppData.plans.push({
            id: maxId, unit: u, period_type: periodType, period_label: periodLabel, status: '草稿',
            data_json: JSON.stringify({
              '经营性流入': Math.round(inflow * 0.65),
              '经营性流出': Math.round(outflow * 0.6),
              '投资性流入': Math.round(inflow * 0.15),
              '投资性流出': Math.round(outflow * 0.2),
              '融资性流入': Math.round(inflow * 0.20),
              '融资性流出': Math.round(outflow * 0.2),
            }),
          });
        });
        Toast.success('已从资金流生成 ' + units.length + ' 个计划');
        closeModal(); renderPlan();
      });
  });

  // 获取分析数据 → 创建计划
  var _planFromAn = document.getElementById('plan-btn-from-analysis');
  if (_planFromAn) _planFromAn.addEventListener('click', function () {
    if (!AppData.analysisResult) { Toast.warn('请先到【现金流分析】页面运行分析'); return; }
    if (backendOk && AppData.latestReportId) {
      (async function () {
        try {
          var drafts = (AppData.plans || []).filter(function (p) { return p.status === '草稿'; });
          if (!drafts.length) {
            Toast.warn('没有草稿计划可填充');
            return;
          }
          var q = '?report_id=' + encodeURIComponent(AppData.latestReportId);
          for (var i = 0; i < drafts.length; i++) {
            await API.post('/api/plans/' + drafts[i].id + '/fill-from-analysis' + q, {});
          }
          await window.cfReloadCoreData();
          Toast.success('已从分析报表填充 ' + drafts.length + ' 个草稿计划');
          renderPlan();
        } catch (e) {
          console.warn(e);
          Toast.warn('接口失败，尝试本地下发流程');
          document.getElementById('an-btn-to-plan').click();
        }
      })();
      return;
    }
    document.getElementById('an-btn-to-plan').click();
  });

  var _planBtnNew = document.getElementById('plan-btn-new');
  if (_planBtnNew) _planBtnNew.addEventListener('click', function () {
    openModal('新建资金计划',
      '<div class="form-group"><label>单位</label><select class="form-select" id="m-plan-unit"><option>总部</option><option>华东子公司</option><option>华南子公司</option></select></div>' +
      '<div class="form-group"><label>周期类型</label><select class="form-select" id="m-plan-type"><option>月</option><option>季</option><option>年</option></select></div>' +
      '<div class="form-group"><label>期间标签</label><input class="form-input" id="m-plan-label" value="2026年5月" /></div>',
      function () {
        var empty = '{"经营性流入":0,"经营性流出":0,"投资性流入":0,"投资性流出":0,"融资性流入":0,"融资性流出":0}';
        var unit = document.getElementById('m-plan-unit').value;
        var pt = document.getElementById('m-plan-type').value;
        var pl = document.getElementById('m-plan-label').value;
        if (backendOk) {
          (async function () {
            try {
              var created = await API.post('/api/plans', {
                unit: unit,
                period_type: pt,
                period_label: pl,
                data_json: empty,
                status: '草稿',
                data_source: '资金流数据',
              });
              AppData.plans = await API.get('/api/plans');
              Toast.success('计划 ' + created.id + ' 已创建');
            } catch (e) { console.warn(e); Toast.warn('创建失败'); }
            closeModal();
            renderPlan();
          })();
          return;
        }
        var maxId = (AppData.plans || []).reduce(function (a, p) { return Math.max(a, p.id || 0); }, 0);
        AppData.plans.push({
          id: maxId + 1,
          unit: unit,
          period_type: pt,
          period_label: pl,
          data_json: empty,
          status: '草稿',
        });
        Toast.success('计划创建成功');
        closeModal(); renderPlan();
      });
  });

  // ═══════════════════════════════════════════════
  // 4b. PLAN — 偏差分析 + 反馈闭环
  // ═══════════════════════════════════════════════

  function _runDeviationAnalysis(plan, actualJson) {
    var planData = {};
    try { planData = typeof plan.data_json === 'string' ? JSON.parse(plan.data_json) : (plan.data_json || {}); } catch (e) {}

    var maxDevId = (AppData.deviationLogs || []).reduce(function (a, l) { return Math.max(a, l.id || 0); }, 0);
    var maxAlertId = (AppData.alertQueue || []).reduce(function (a, l) { return Math.max(a, l.id || 0); }, 0);
    var today = new Date().toISOString().slice(0, 10);
    var consecutiveMap = {};

    Object.keys(planData).forEach(function (subject) {
      var pv = Math.abs(planData[subject] || 0);
      var av = Math.abs(actualJson[subject] || 0);
      if (pv === 0) return;
      var rate = (av - pv) / pv;
      var info = calcDeviationLevel(rate);

      maxDevId++;
      AppData.deviationLogs.push({
        id: maxDevId, plan_id: plan.id, unit: plan.unit,
        period_label: plan.period_label, deviation_rate: Math.abs(rate),
        level: info.level, subject: subject, created_at: today,
        handled: info.level === '正常', action: info.level === '正常' ? '记录' : null,
      });

      if (info.level !== '正常') {
        var key = plan.unit + '_' + subject;
        var recent = (AppData.deviationLogs || []).filter(function (l) {
          return l.unit === plan.unit && l.subject === subject && Math.abs(l.deviation_rate) > 0.30;
        });
        consecutiveMap[key] = recent.length;

        var isConsecutive = recent.length >= 3;
        var alertLevel = info.level;
        var alertTitle = plan.unit + ' ' + subject + ' 偏差 ' + (Math.abs(rate) * 100).toFixed(1) + '%';
        var alertDesc = plan.period_label + ' 实际与计划偏离';
        var suggestion = '';

        if (isConsecutive) {
          alertLevel = '连续异常';
          alertTitle += '（连续 ' + recent.length + ' 次 >30%）';
          alertDesc += '，建议更换预测模型或调整权重';
          suggestion = '该科目连续多期偏差过大，建议切换至 ARIMA/Prophet 模型或降低该科目权重';
        } else if (Math.abs(rate) > 0.50) {
          alertDesc += '，已冻结该区间预测结果，请人工介入';
          suggestion = '偏差严重超标，建议暂停该科目自动预测并进行人工审核';
        } else if (Math.abs(rate) > 0.20) {
          alertDesc += '，已触发模型参数重算';
          suggestion = '建议' + (rate > 0 ? '上调' : '下调') + '下期' + subject + '预测 ' + (Math.abs(rate) * 100 * 0.5).toFixed(0) + '%';
        } else {
          alertDesc += '，建议分析师复核';
          suggestion = '偏差处于关注区间，建议复核数据来源与预测假设';
        }

        maxAlertId++;
        AppData.alertQueue.push({
          id: maxAlertId, type: '偏差预警', level: alertLevel,
          title: alertTitle, desc: alertDesc, target_page: 'analysis',
          created_at: today, status: '待处理',
          ai_suggestion: suggestion, handled_at: null, handle_action: null,
        });
      }
    });
    refreshClosedLoopKPI();
  }

  function _renderDeviationLogTable() {
    var logs = (AppData.deviationLogs || []).slice(-20).reverse();
    var body = document.getElementById('plan-deviation-log-body');
    if (!body) return;
    if (!logs.length) { body.innerHTML = '<tr><td colspan="7" class="empty-state">暂无偏差日志</td></tr>'; return; }
    body.innerHTML = logs.map(function (l) {
      var lvlCls = l.level === '正常' ? 'dev-level-ok' : l.level === '严重' || l.level === '连续异常' ? 'dev-level-danger' : 'dev-level-warn';
      return '<tr><td>' + (l.unit || '-') + '</td><td>' + (l.period_label || '-') + '</td><td>' + (l.subject || '-') + '</td>' +
        '<td class="num" style="color:' + (calcDeviationLevel(l.deviation_rate).color) + ';font-weight:700;">' + (l.deviation_rate * 100).toFixed(1) + '%</td>' +
        '<td><span class="dev-level ' + lvlCls + '">' + l.level + '</span></td>' +
        '<td>' + (l.handled ? '<span style="color:var(--success);">已处理</span>' : '<span style="color:var(--warn);">待处理</span>') + '</td>' +
        '<td>' + (l.action || '-') + '</td></tr>';
    }).join('');
  }

  var _planRunDev = document.getElementById('plan-btn-run-deviation');
  if (_planRunDev) _planRunDev.addEventListener('click', function () {
    var execs = AppData.actualExecution || [];
    if (!execs.length) {
      Toast.warn('暂无实际执行数据，请先完成至少一个计划');
      return;
    }

    var area = document.getElementById('plan-deviation-area');
    var html = '<div class="dev-grid">';

    execs.forEach(function (exec) {
      var items = calcDeviationForExec(exec);
      html += '<div class="dev-card"><div class="dev-card-header"><span class="dev-card-unit">' + exec.unit + '</span><span class="dev-card-period">' + exec.period_label + '</span></div>';
      items.forEach(function (item) {
        var pct = Math.min(Math.abs(item.rate) * 100, 100);
        var lvlCls = item.level === '正常' ? 'dev-level-ok' : item.level === '严重' ? 'dev-level-danger' : 'dev-level-warn';
        html += '<div class="dev-item">' +
          '<span class="dev-item-subject">' + item.subject + '</span>' +
          '<div class="dev-item-bar"><div class="dev-item-fill" style="width:' + pct + '%;background:' + item.color + ';"></div></div>' +
          '<span class="dev-item-rate" style="color:' + item.color + ';">' + (item.rate * 100).toFixed(1) + '%</span>' +
          '<span class="dev-level ' + lvlCls + '">' + item.level + '</span></div>';
      });
      html += '</div>';
    });

    html += '</div>';
    area.innerHTML = html;
    Toast.success('偏差检测完成');
    _renderDeviationLogTable();
  });

  // ═══════════════════════════════════════════════
  // 5b. 流动性预测 MVP（司库文章：数据层 + 算法层 + 结果呈现）
  // ═══════════════════════════════════════════════

  var _liqUiBound = false;
  var _liqDemoBound = false;

  function _liqUpdateModelDesc() {
    var sel = document.getElementById('liq-sch-model');
    var models = window.__liqModels || [];
    var code = sel ? sel.value : '';
    var m = models.find(function (x) { return x.code === code; });
    var el = document.getElementById('liq-model-desc');
    if (el) el.textContent = m ? (m.description || '') : '';
  }

  async function _liqLoadHistorySummary() {
    var el = document.getElementById('liq-hist-summary');
    if (!el) return;
    if (!backendOk) {
      el.textContent = '离线模式：使用本地演示数据时，预测仍基于内存中的资金流结构。';
      return;
    }
    try {
      var u = document.getElementById('liq-sch-unit').value;
      var url = '/api/liquidity/history-monthly' + (u ? '?unit=' + encodeURIComponent(u) : '');
      var rows = await API.get(url);
      if (!rows.length) {
        el.innerHTML = '暂无月度历史。<strong>请先录入资金流单据</strong>或使用左侧 CSV 导入银行账户流水。';
        return;
      }
      var last = rows[rows.length - 1];
      var years = {};
      rows.forEach(function (r) {
        if (r.year_month && r.year_month.length >= 4) years[r.year_month.slice(0, 4)] = 1;
      });
      var yc = Object.keys(years).length;
      el.innerHTML = '共 <strong>' + rows.length + '</strong> 个自然月，<strong>' + yc + '</strong> 个日历年；最近月 <strong>' + last.year_month + '</strong> 流入 ' + fmtNum(last.inflow) + ' · 流出 ' + fmtNum(last.outflow) + ' · 净额 ' + fmtNum(last.net);
    } catch (e) {
      console.warn(e);
      el.textContent = '加载历史概览失败';
    }
  }

  async function _liqRefreshSchemesTable() {
    var body = document.getElementById('liq-schemes-body');
    if (!body || !backendOk) {
      if (body) body.innerHTML = '<tr><td colspan="7" class="empty-state">启动后端后可用</td></tr>';
      return;
    }
    try {
      var list = await API.get('/api/liquidity/schemes');
      if (!list.length) {
        body.innerHTML = '<tr><td colspan="7" class="empty-state">暂无方案</td></tr>';
        return;
      }
      body.innerHTML = list.map(function (s) {
        var isBt = false;
        try { isBt = !!(JSON.parse(s.params_json || '{}').backtest); } catch (e2) {}
        var tag = isBt ? '<span class="badge badge-warn" style="margin-right:4px;">回测</span>' : '';
        return '<tr><td class="mono">' + s.id + '</td><td>' + tag + s.name + '</td><td>' + (s.unit || '全集团') + '</td><td>' + s.model_code + '</td><td>' + s.run_mode + '</td><td>' + s.status + '</td><td>' +
          '<button class="btn btn-sm btn-ghost" onclick="window.__liqShowResults(' + s.id + ')">结果</button> ' +
          '<button class="btn btn-sm btn-ghost" onclick="window.__liqRunScheme(' + s.id + ')">运行</button></td></tr>';
      }).join('');
    } catch (e) {
      console.warn(e);
      body.innerHTML = '<tr><td colspan="7" class="empty-state">加载失败</td></tr>';
    }
  }

  window.__liqShowResults = async function (id) {
    if (!backendOk) return;
    function _liqFmtAct(v) {
      if (v == null || v === '') return '—';
      return fmtNum(v);
    }
    try {
      var data = await API.get('/api/liquidity/schemes/' + id + '/results');
      var items = data.items || [];
      var sch = data.scheme || {};
      document.getElementById('liq-method-note').textContent = sch.method_note || '—';
      var hasHoldout = items.some(function (r) { return r.actual_balance_end != null || r.actual_net != null; });
      var isBtScheme = false;
      try { isBtScheme = !!(JSON.parse(sch.params_json || '{}').backtest); } catch (e0) {}
      document.getElementById('liq-method-badge').textContent = hasHoldout || isBtScheme
        ? 'Hold-out 回测'
        : (sch.run_mode === 'smart' ? '智能预测' : '手动预测');
      var ct = document.getElementById('liq-chart-title');
      if (ct) ct.textContent = hasHoldout ? '预测 vs 实际期末余额（Hold-out）' : '预测期末余额走势';
      var tb = document.getElementById('liq-result-body');
      if (!items.length) {
        tb.innerHTML = '<tr><td colspan="9" class="empty-state">该方案尚无结果，请点击「运行」</td></tr>';
        Charts.liquidityBalanceLine('chart-liq-balance', [], [], null);
        return;
      }
      tb.innerHTML = items.map(function (r) {
        return '<tr><td>' + r.year_month + '</td><td class="num">' + fmtNum(r.pred_inflow) + '</td><td class="num">' + fmtNum(r.pred_outflow) + '</td><td class="num">' + fmtNum(r.pred_net) + '</td><td class="num">' + fmtNum(r.pred_balance_end) + '</td>' +
          '<td class="num muted">' + _liqFmtAct(r.actual_inflow) + '</td><td class="num muted">' + _liqFmtAct(r.actual_outflow) + '</td><td class="num muted">' + _liqFmtAct(r.actual_net) + '</td><td class="num muted">' + _liqFmtAct(r.actual_balance_end) + '</td></tr>';
      }).join('');
      var labels = items.map(function (r) { return r.year_month; });
      var predB = items.map(function (r) { return r.pred_balance_end; });
      var actB = items.map(function (r) { return r.actual_balance_end; });
      Charts.liquidityBalanceLine('chart-liq-balance', labels, predB, actB);
    } catch (e) {
      console.warn(e);
      Toast.warn('加载结果失败');
    }
  };

  window.__liqRunScheme = async function (id) {
    if (!backendOk) return;
    Toast.info('正在运行预测…');
    try {
      await API.post('/api/liquidity/schemes/' + id + '/run', {});
      Toast.success('预测完成');
      await window.__liqShowResults(id);
      await _liqRefreshSchemesTable();
    } catch (e) {
      console.warn(e);
      Toast.warn('运行失败（检查历史数据是否充足）');
    }
  };

  function _liqDateToYm(d) {
    var s = String(d || '');
    if (s.length >= 7) return s.slice(0, 7);
    return '';
  }

  function _liqKeyNodesByYm(keyNodes) {
    var map = {};
    (keyNodes || []).forEach(function (k) {
      var ym = _liqDateToYm(k.date);
      if (!ym) return;
      if (!map[ym]) map[ym] = [];
      map[ym].push(k);
    });
    return map;
  }

  function _liqRenderNestedKeyDaysHtml(nodes) {
    if (!nodes || !nodes.length) {
      return '<p class="muted liq-nested-empty">该月暂无关键日抽样（预测步长可能未落在该月）。</p>';
    }
    var sorted = nodes.slice().sort(function (a, b) { return String(a.date || '').localeCompare(String(b.date || '')); });
    var body = sorted.map(function (r) {
      return '<tr><td>' + (r.date || '—') + '</td><td class="num">' + fmtNum(r.inflow) + '</td><td class="num">' + fmtNum(r.outflow) + '</td><td class="num">' + fmtNum(r.balance) + '</td></tr>';
    }).join('');
    return (
      '<div class="liq-nested-inner">' +
      '<p class="liq-nested-caption">关键日抽样（按预测区间）</p>' +
      '<table class="data-table liq-keyday-subtable">' +
      '<thead><tr><th>日期</th><th class="num">预计流入</th><th class="num">预计流出</th><th class="num">预计余额</th></tr></thead>' +
      '<tbody>' + body + '</tbody></table></div>'
    );
  }

  /** 月汇总 + 关键日抽样合并为展开嵌套（与后端 mvp-forecast 同一 res） */
  function _renderLiqMergedTable(res) {
    var tb = document.getElementById('liq-month-summary-body');
    if (!tb) return;
    window.__liqLastMvp = res || {};
    var rows = (res && res.monthly_summary) ? res.monthly_summary : [];
    var byYm = _liqKeyNodesByYm((res && res.key_nodes) ? res.key_nodes : []);
    if (!rows.length) {
      tb.innerHTML = '<tr><td colspan="5" class="empty-state muted">暂无月汇总，请先点击「预测」</td></tr>';
      return;
    }
    var html = [];
    rows.forEach(function (m) {
      var ym = m.year_month;
      var fc = m.is_forecast ? 'forecast' : 'history';
      var tag = m.is_forecast ? '<span class="badge badge-default" style="margin-left:6px;font-size:10px;">预测</span>' : '';
      var nodes = byYm[ym] || [];
      html.push(
        '<tr class="liq-month-row" data-ym="' + ym + '" data-fc="' + fc + '" data-inflow="' + m.inflow + '" data-outflow="' + m.outflow + '" data-net="' + m.net + '" title="点击行（非展开按钮）查看科目明细">' +
        '<td class="liq-cell-expand"><button type="button" class="btn btn-ghost btn-sm liq-btn-expand" aria-expanded="false" aria-label="展开或收起该月关键日抽样">▸</button></td>' +
        '<td><strong>' + ym + '</strong>' + tag + '</td>' +
        '<td class="num">' + fmtNum(m.inflow) + '</td><td class="num">' + fmtNum(m.outflow) + '</td><td class="num">' + fmtNum(m.net) + '</td></tr>'
      );
      html.push(
        '<tr class="liq-nested-wrap" style="display:none;"><td colspan="5" class="liq-nested-cell">' + _liqRenderNestedKeyDaysHtml(nodes) + '</td></tr>'
      );
    });
    tb.innerHTML = html.join('');
  }

  function _renderLiqMergedDemo() {
    _renderLiqMergedTable({
      monthly_summary: [
        { year_month: '2026-04', inflow: 2463683, outflow: 1106859, net: 1356824, is_forecast: false },
        { year_month: '2026-05', inflow: 2100000, outflow: 1300000, net: 800000, is_forecast: true },
      ],
      last_history_year_month: '2026-03',
      key_nodes: [
        { date: '2026-04-09', inflow: 1500000, outflow: 800000, balance: 12700000 },
        { date: '2026-04-10', inflow: 2000000, outflow: 3500000, balance: 11200000 },
        { date: '2026-04-11', inflow: 500000, outflow: 1200000, balance: 10500000 },
        { date: '2026-04-12', inflow: 1800000, outflow: 900000, balance: 11400000 },
        { date: '2026-04-13', inflow: 1200000, outflow: 2100000, balance: 10500000 },
        { date: '2026-05-10', inflow: 1800000, outflow: 900000, balance: 11800000 },
      ],
    });
  }

  function _liqMockMonthSubjects() {
    return [
      { subject_name: '销售回款', inflow: 1200000, outflow: 0, net: 1200000 },
      { subject_name: '采购付款', inflow: 0, outflow: 800000, net: -800000 },
      { subject_name: '职工薪酬', inflow: 0, outflow: 306859, net: -306859 },
    ];
  }

  function _liqOpenMonthSubjectModal(tr) {
    var ym = tr.getAttribute('data-ym');
    if (!ym) return;
    var inf = parseFloat(tr.getAttribute('data-inflow') || '0');
    var ouf = parseFloat(tr.getAttribute('data-outflow') || '0');
    var net = parseFloat(tr.getAttribute('data-net') || '0');
    var isFc = tr.getAttribute('data-fc') === 'forecast';
    var unitEl = document.getElementById('liq-mvp-unit');
    var unit = unitEl && unitEl.value ? unitEl.value : '';
    var unitLabel = unit || '全集团';
    var left = '<div class="an-subj-detail-left">' +
      '<div class="an-subj-label">月份</div><div class="an-subj-val">' + ym + '</div>' +
      '<div class="an-subj-label">单位</div><div class="an-subj-val muted">' + unitLabel + '</div>' +
      '<div class="an-subj-label">月汇总 · 流入</div><div class="an-subj-val">' + fmtNum(inf) + '</div>' +
      '<div class="an-subj-label">月汇总 · 流出</div><div class="an-subj-val">' + fmtNum(ouf) + '</div>' +
      '<div class="an-subj-label">月汇总 · 净额</div><div class="an-subj-val num">' + fmtNum(net) + '</div>' +
      (isFc ? '<div class="an-subj-label">说明</div><div class="an-subj-val muted" style="font-size:11px;">预测月若无科目级流水，将按最近历史月结构比例分摊。</div>' : '') +
      '</div>';
    var right = '<div class="an-subj-detail-right" id="liq-msd-right"><p class="muted" style="font-size:12px;margin:0;">加载中…</p></div>';
    openModal('月度科目明细 — ' + ym, '<div class="an-subj-detail-layout">' + left + right + '</div>', null, true, { wide: true });

    function _bindLiqMsdToRecordsBtn() {
      var btn = document.getElementById('liq-msd-to-records');
      if (btn) {
        btn.addEventListener('click', function () {
          try { closeModal(); } catch (e) {}
          if (window.cfDrillToRecordsFromMonth) window.cfDrillToRecordsFromMonth(unit || '', ym);
        });
      }
    }

    function renderRows(items, source) {
      var wrap = document.getElementById('liq-msd-right');
      if (!wrap) return;
      var footer =
        '<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border);">' +
        '<button type="button" class="btn btn-primary" id="liq-msd-to-records">查看该月已确认资金流单据</button>' +
        '<span class="muted" style="font-size:11px;margin-left:10px;">与上表同源（only_confirmed）</span></div>';
      if (!items || !items.length) {
        wrap.innerHTML = '<p class="muted" style="font-size:13px;margin:0;">暂无科目明细数据</p>' +
          '<p class="muted" style="font-size:11px;margin:8px 0 0;">可在「现金流事件」录入带科目分录的已确认单据后重试。</p>' + footer;
        _bindLiqMsdToRecordsBtn();
        return;
      }
      var note = source === 'forecast_proportional'
        ? '数据来源：按最近历史月科目结构，将本月预测流入/流出比例分摊至各科目（演示估算）。'
        : (source === 'demo' ? '演示数据。' : '数据来源：已确认 CNY 资金流单据 · flows_json 科目拆分。');
      var tb = '<div class="an-subj-table-wrap"><table class="data-table an-tree-table" style="margin:0;"><thead><tr>' +
        '<th>资金科目</th><th class="num">流入</th><th class="num">流出</th><th class="num">净额</th>' +
        '</tr></thead><tbody>';
      items.forEach(function (it) {
        var nc = (it.net != null && !isNaN(it.net)) ? (it.net >= 0 ? 'positive' : 'negative') : '';
        tb += '<tr><td><strong>' + (it.subject_name || '—') + '</strong></td><td class="num">' + fmtNum(it.inflow) + '</td><td class="num">' + fmtNum(it.outflow) + '</td><td class="num ' + nc + '">' + fmtNum(it.net) + '</td></tr>';
      });
      tb += '</tbody></table></div>';
      tb += '<p class="muted" style="font-size:11px;margin:8px 0 0;line-height:1.5;">' + note + '</p>';
      wrap.innerHTML = tb + footer;
      _bindLiqMsdToRecordsBtn();
    }

    if (backendOk) {
      var url = '/api/liquidity/month-subject-detail?year_month=' + encodeURIComponent(ym) + '&only_confirmed=true';
      if (unit) url += '&unit=' + encodeURIComponent(unit);
      if (isFc) {
        url += '&forecast_inflow=' + encodeURIComponent(String(inf)) + '&forecast_outflow=' + encodeURIComponent(String(ouf));
      }
      API.get(url).then(function (res) {
        renderRows(res.items, res.detail_source);
      }).catch(function (e) {
        console.warn(e);
        renderRows(_liqMockMonthSubjects(), 'demo');
        Toast.warn('科目明细接口不可用，已展示演示数据');
      });
    } else {
      renderRows(_liqMockMonthSubjects(), 'demo');
    }
  }

  function _bindLiqMonthDrill() {
    var pg = document.getElementById('page-liquidity');
    if (!pg || pg._liqMonthDrillBound) return;
    pg._liqMonthDrillBound = true;
    pg.addEventListener('click', function (e) {
      var exp = e.target.closest && e.target.closest('.liq-btn-expand');
      if (exp) {
        e.preventDefault();
        e.stopPropagation();
        var tr = exp.closest('tr.liq-month-row');
        if (!tr || !tr.nextElementSibling) return;
        var nest = tr.nextElementSibling;
        if (!nest.classList.contains('liq-nested-wrap')) return;
        var open = nest.classList.contains('is-open');
        if (open) {
          nest.classList.remove('is-open');
          nest.style.display = 'none';
          exp.setAttribute('aria-expanded', 'false');
          exp.textContent = '▸';
        } else {
          nest.classList.add('is-open');
          nest.style.display = 'table-row';
          exp.setAttribute('aria-expanded', 'true');
          exp.textContent = '▾';
        }
        return;
      }
      var tr = e.target.closest && e.target.closest('tr.liq-month-row');
      if (!tr) return;
      e.preventDefault();
      _liqOpenMonthSubjectModal(tr);
    });
  }

  function _liqEscHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function _clearLiqRiskMetrics() {
    var m = document.getElementById('liq-risk-metrics');
    if (m) m.innerHTML = '';
  }

  function _renderLiqRiskMetricsOffline() {
    var m = document.getElementById('liq-risk-metrics');
    if (!m) return;
    m.innerHTML =
      '<div class="liq-risk-metrics__title">预测数据快照</div>' +
      '<p class="muted" style="margin:0;font-size:12px;line-height:1.55;">未连接后端，暂无真实预测数据。连接后将展示<strong>警戒线</strong>、区间最低/最高、历史月数、growth 与引擎说明。</p>';
  }

  function _renderLiqRiskMetrics(res) {
    var m = document.getElementById('liq-risk-metrics');
    if (!m || !res) return;
    var labels = res.labels || [];
    var alerts = res.alert_indices || [];
    var bal = res.balances || [];
    var minB = Infinity;
    var maxB = -Infinity;
    bal.forEach(function (b) {
      var x = Number(b);
      if (!isNaN(x)) {
        minB = Math.min(minB, x);
        maxB = Math.max(maxB, x);
      }
    });
    var d0 = labels[0] || '—';
    var d1 = labels[labels.length - 1] || '—';
    var unit = res.unit || '全集团';
    var noteRaw = res.method_note ? String(res.method_note) : '';
    var noteShort = noteRaw.length > 220 ? noteRaw.slice(0, 220) + '…' : noteRaw;
    var nodes = (res.key_nodes || []).slice(0, 4);
    var nodesHtml = '';
    if (nodes.length) {
      nodesHtml =
        '<div class="liq-risk-metrics__title" style="margin-top:12px;padding-top:10px;border-top:1px dashed var(--border);font-size:11px;">关键日抽样</div><dl class="liq-risk-dl">';
      nodes.forEach(function (kn) {
        nodesHtml +=
          '<dt>' +
          _liqEscHtml(kn.date) +
          '</dt><dd>' +
          fmtAmt(kn.balance != null ? Number(kn.balance) : NaN) +
          '</dd>';
      });
      nodesHtml += '</dl>';
    }
    m.innerHTML =
      '<div class="liq-risk-metrics__title">预测数据快照</div>' +
      '<dl class="liq-risk-dl">' +
      '<dt>单位</dt><dd>' +
      _liqEscHtml(unit) +
      '</dd>' +
      '<dt>区间</dt><dd>' +
      _liqEscHtml(d0) +
      ' ~ ' +
      _liqEscHtml(d1) +
      '</dd>' +
      '<dt>预测天数</dt><dd>' +
      (res.horizon_days != null ? res.horizon_days : '—') +
      ' 天</dd>' +
      '<dt>历史月数</dt><dd>' +
      (res.history_months != null ? res.history_months : '—') +
      ' 月</dd>' +
      '<dt>growth</dt><dd>' +
      (res.growth_used != null ? Number(res.growth_used).toFixed(4) : '—') +
      '</dd>' +
      '<dt>期初余额</dt><dd>' +
      fmtAmt(res.opening_balance) +
      '</dd>' +
      '<dt>警戒线</dt><dd>' +
      fmtAmt(res.warn_line) +
      '</dd>' +
      '<dt>区间最低</dt><dd>' +
      (minB !== Infinity ? fmtAmt(minB) : '—') +
      '</dd>' +
      '<dt>区间最高</dt><dd>' +
      (maxB !== -Infinity ? fmtAmt(maxB) : '—') +
      '</dd>' +
      '<dt>预警样本天数</dt><dd>' +
      alerts.length +
      ' 天</dd>' +
      '</dl>' +
      (noteShort
        ? '<p class="liq-risk-metrics__note"><strong>引擎</strong> ' + _liqEscHtml(noteShort) + '</p>'
        : '') +
      nodesHtml;
  }

  function _updateLiqRiskRefreshBtn() {
    var btn = document.getElementById('liq-risk-ai-refresh');
    if (!btn) return;
    var ok = !!(window.__liqLastMvpForecastRes && backendOk);
    btn.disabled = !ok;
    btn.title = ok ? '根据最近一次预测摘要重新请求大模型解读' : '需先连接后端并成功完成一次预测';
  }

  function _fillLiqRiskStatic(res, riskEl) {
    var el = riskEl || document.getElementById('liq-risk-alerts');
    if (!el) return;
    if (res) _renderLiqRiskMetrics(res);
    var ac = (res && res.alert_indices && res.alert_indices.length) || 0;
    var tag =
      '<p class="liq-risk-static-tag">规则摘要（非大模型全文）；若已配置 AI 仍见此段，请检查网络、配额或重新点击「预测」。</p>';
    el.innerHTML =
      tag +
      (ac
        ? '<p style="margin:0;">预计余额低于警戒线 <strong>' + ac + '</strong> 天（样本条数），请关注头寸。</p>'
        : '<p style="margin:0;">预计期间内未触发低于警戒线的余额预警。</p>');
  }

  function _buildLiqRiskAiUserMessage(res) {
    var labels = res.labels || [];
    var alerts = res.alert_indices || [];
    var sampleDates = alerts.slice(0, 12).map(function (idx) {
      return labels[idx] || '';
    }).filter(Boolean);
    var bal = res.balances || [];
    var minB = Infinity;
    var maxB = -Infinity;
    bal.forEach(function (b) {
      var x = Number(b);
      if (!isNaN(x)) {
        minB = Math.min(minB, x);
        maxB = Math.max(maxB, x);
      }
    });
    var wl = res.warn_line != null ? Number(res.warn_line) : null;
    var bufVs = null;
    if (minB !== Infinity && wl != null && !isNaN(wl)) {
      bufVs = Math.round((minB - wl) * 100) / 100;
    }
    var payload = {
      unit: res.unit || '全集团',
      forecast_span: { start: labels[0] || null, end: labels[labels.length - 1] || null },
      horizon_days: res.horizon_days,
      opening_balance: res.opening_balance,
      warn_line: res.warn_line,
      alert_days_in_sample: alerts.length,
      alert_sample_dates: sampleDates,
      growth_used: res.growth_used,
      history_months: res.history_months,
      method_note: res.method_note,
      last_history_year_month: res.last_history_year_month,
      min_balance_forecast: minB === Infinity ? null : Math.round(minB * 100) / 100,
      max_balance_forecast: maxB === -Infinity ? null : Math.round(maxB * 100) / 100,
      buffer_vs_warn_line: bufVs,
      key_nodes_sample: (res.key_nodes || []).slice(0, 6),
      monthly_summary_tail: (res.monthly_summary || []).slice(-4),
    };
    return '以下为「资金流滚动预测」结果摘要（JSON）。请撰写风险预警解读：\n' + JSON.stringify(payload, null, 0);
  }

  async function _fillLiqRiskFromForecast(res) {
    var risk = document.getElementById('liq-risk-alerts');
    if (!risk) return;
    _renderLiqRiskMetrics(res);
    if (typeof AI === 'undefined' || !AI.chatCompletionOneShot || !AI.LIQUIDITY_RISK_ALERT_SYSTEM_PROMPT) {
      _fillLiqRiskStatic(res, risk);
      return;
    }
    risk.innerHTML = '<p class="muted" style="margin:0;font-size:13px;">正在生成大模型解读…</p>';
    try {
      var text = await AI.chatCompletionOneShot(
        AI.LIQUIDITY_RISK_ALERT_SYSTEM_PROMPT,
        _buildLiqRiskAiUserMessage(res),
        { max_tokens: 1400 }
      );
      if (!text || !String(text).trim()) {
        _fillLiqRiskStatic(res, risk);
        return;
      }
      var html =
        typeof AI.renderMarkdown === 'function'
          ? AI.renderMarkdown(String(text).trim())
          : '<p>' + String(text).replace(/</g, '&lt;') + '</p>';
      risk.innerHTML =
        '<div class="liq-risk-ai-md">' +
        html +
        '</div>' +
        '<p class="liq-risk-foot">以上由大模型根据当前预测摘要生成，仅供参考；审批与头寸决策请以主台规则与司库复核为准。</p>';
      if (typeof AI.bindInlineLinks === 'function') AI.bindInlineLinks(risk);
    } catch (e) {
      console.warn('_fillLiqRiskFromForecast', e);
      _fillLiqRiskStatic(res, risk);
    }
  }

  async function _runLiqMvpForecast(opts) {
    opts = opts || {};
    var silent = !!opts.silent;
    var hz = document.getElementById('liq-horizon-demo');
    var days = hz ? parseInt(hz.value, 10) || 90 : 90;
    var unitEl = document.getElementById('liq-mvp-unit');
    var unit = unitEl && unitEl.value ? unitEl.value : null;
    var sub = document.getElementById('liq-mvp-subtitle');
    var hint = document.getElementById('liq-mvp-hint');
    if (!backendOk) {
      window.__liqLastMvpForecastRes = null;
      _updateLiqRiskRefreshBtn();
      if (typeof Charts !== 'undefined' && Charts.liquidityForecastDemo) Charts.liquidityForecastDemo('chart-forecast-curve', days);
      _renderLiqMergedDemo();
      if (sub) sub.textContent = '离线演示：随机曲线，请启动后端以对接真实资金流';
      if (hint) hint.textContent = '离线模式：使用本地演示曲线；连接后端后按「资金流单据」月度汇总预测。';
      var noteOff = document.getElementById('liq-rolling-ai-note');
      if (noteOff) noteOff.innerHTML = '<strong>说明：</strong>离线模式为演示数据；连接后端后将与资金流单据及流动性引擎一致。';
      var riskOff = document.getElementById('liq-risk-alerts');
      if (riskOff) {
        _renderLiqRiskMetricsOffline();
        riskOff.innerHTML =
          '<p class="liq-risk-static-tag">大模型解读未启用：离线模式下无法拉取真实预测摘要，故不调用大模型 API。</p>' +
          '<ul style="margin:0;padding-left:18px;line-height:1.65;"><li><strong>演示预警：</strong>应收/应付超期示例。</li><li>连接后端并完成预测后，右侧将生成基于快照的 <strong>大模型解读</strong>。</li></ul>';
      }
      return;
    }
    if (!silent) Toast.info('正在预测…');
    try {
      var res = await API.post('/api/liquidity/mvp-forecast', {
        horizon_days: days,
        unit: unit,
        only_confirmed: true,
        smart: true,
      });
      window.__liqLastMvpForecastRes = res;
      _updateLiqRiskRefreshBtn();
      if (typeof Charts !== 'undefined' && Charts.liquidityForecastSeries) {
        Charts.liquidityForecastSeries('chart-forecast-curve', res.labels, res.balances, res.warn_line, res.alert_indices);
      }
      _renderLiqMergedTable(res);
      if (sub) {
        var gu = res.growth_used != null ? Number(res.growth_used).toFixed(4) : '—';
        sub.textContent = '后端驱动 · 历史 ' + (res.history_months || 0) + ' 月 · growth=' + gu;
      }
      if (hint) hint.textContent = '数据来源：cashflow_records 月度汇总（优先已确认），与「预测方案」月度引擎同款滚动模型。';
      var note = document.getElementById('liq-rolling-ai-note');
      if (note) note.innerHTML = '<strong>引擎说明：</strong>' + String(res.method_note || '—').replace(/</g, '&lt;');
      var risk = document.getElementById('liq-risk-alerts');
      if (risk) {
        _fillLiqRiskFromForecast(res).catch(function (e) {
          console.warn(e);
          _fillLiqRiskStatic(res, risk);
        });
      }
      if (!silent) Toast.success('预测完成');
    } catch (e) {
      console.warn(e);
      window.__liqLastMvpForecastRes = null;
      _updateLiqRiskRefreshBtn();
      if (typeof Charts !== 'undefined' && Charts.liquidityForecastDemo) Charts.liquidityForecastDemo('chart-forecast-curve', days);
      _renderLiqMergedDemo();
      if (sub) sub.textContent = '真实预测不可用：需至少 2 个月资金流 · 以下为演示曲线';
      if (hint) hint.textContent = '提示：在「现金流事件」录入或同步跨月单据后再试。';
      var noteErr = document.getElementById('liq-rolling-ai-note');
      if (noteErr) noteErr.innerHTML = '<strong>说明：</strong>' + String(e && e.message ? e.message : '预测失败').replace(/</g, '&lt;');
      var riskErr = document.getElementById('liq-risk-alerts');
      if (riskErr) {
        _clearLiqRiskMetrics();
        riskErr.innerHTML =
          '<p class="liq-risk-static-tag">大模型解读不可用：未拿到有效预测摘要。</p>' +
          '<p class="muted" style="margin:0;">请补全历史资金流后重新预测；成功后将在此生成解读。</p>';
      }
      if (!silent) Toast.warn('预测失败：请确认已入库至少 2 个月资金流水');
    }
  }

  function renderLiquidityMvp() {
    var unitSel = document.getElementById('liq-sch-unit');
    if (unitSel) {
      var prev = unitSel.value;
      unitSel.innerHTML = '<option value="">全集团</option>';
      ((AppData.stats && AppData.stats.units) || []).forEach(function (u) {
        var o = document.createElement('option');
        o.value = u;
        o.textContent = u;
        unitSel.appendChild(o);
      });
      if (prev) unitSel.value = prev;
    }
    var mvpUnit = document.getElementById('liq-mvp-unit');
    if (mvpUnit) {
      var prevM = mvpUnit.value;
      mvpUnit.innerHTML = '<option value="">全集团</option>';
      ((AppData.stats && AppData.stats.units) || []).forEach(function (u) {
        var o = document.createElement('option');
        o.value = u;
        o.textContent = u;
        mvpUnit.appendChild(o);
      });
      if (prevM) mvpUnit.value = prevM;
    }
    if (!_liqUiBound) {
      _liqUiBound = true;
      _domOn('liq-sch-model', 'change', _liqUpdateModelDesc);
      _domOn('liq-sch-unit', 'change', function () { _liqLoadHistorySummary(); });
      _domOn('liq-btn-refresh-schemes', 'click', function () { _liqRefreshSchemesTable(); });
      _domOn('liq-btn-import-csv', 'click', function () {
        if (!backendOk) { Toast.warn('请先连接后端'); return; }
        var raw = document.getElementById('liq-csv-input').value.trim();
        if (!raw) { Toast.warn('请粘贴 CSV'); return; }
        var unit = document.getElementById('liq-sch-unit').value || '总部';
        (async function () {
          try {
            var res = await API.post('/api/liquidity/import-csv', { csv_text: raw, unit: unit });
            document.getElementById('liq-import-hint').textContent = '账户 +' + res.accounts_created + ' · 流水 +' + res.flows_created;
            Toast.success('导入成功');
          } catch (e) {
            console.warn(e);
            Toast.warn('导入失败，请检查 CSV 格式');
          }
        })();
      });
      _domOn('liq-btn-create-run', 'click', function () {
        if (!backendOk) { Toast.warn('请先连接后端'); return; }
        var name = document.getElementById('liq-sch-name').value.trim();
        if (!name) { Toast.warn('请填写方案名称'); return; }
        var horizon = parseInt(document.getElementById('liq-sch-horizon').value, 10) || 12;
        var modelCode = document.getElementById('liq-sch-model').value;
        var mode = document.getElementById('liq-sch-mode').value;
        var mapeStr = document.getElementById('liq-sch-mape').value.trim();
        var mape = mapeStr ? parseFloat(mapeStr) : null;
        var paramsRaw = document.getElementById('liq-sch-params').value.trim() || '{}';
        try { JSON.parse(paramsRaw); } catch (e) { Toast.warn('params JSON 无效'); return; }
        var u = document.getElementById('liq-sch-unit').value;
        (async function () {
          try {
            var sch = await API.post('/api/liquidity/schemes', {
              name: name,
              unit: u || null,
              horizon_months: horizon,
              model_code: modelCode,
              run_mode: mode,
              target_mape: mape,
              params_json: paramsRaw,
            });
            await API.post('/api/liquidity/schemes/' + sch.id + '/run', {});
            Toast.success('方案已创建并运行');
            await window.__liqShowResults(sch.id);
            await _liqRefreshSchemesTable();
          } catch (e) {
            console.warn(e);
            Toast.warn('创建或运行失败');
          }
        })();
      });
    }
    if (!_liqDemoBound) {
      _liqDemoBound = true;
      var lpd = document.getElementById('liq-btn-predict-demo');
      if (lpd) lpd.addEventListener('click', function () { _runLiqMvpForecast({ silent: false }); });
      var lrd = document.getElementById('liq-btn-rules-demo');
      if (lrd) {
        lrd.addEventListener('click', function () {
          openModal('预警规则（演示）',
            '<ul style="margin:0;padding-left:18px;line-height:1.75;font-size:13px;color:var(--text-secondary);">' +
            '<li><strong>超期应收预警：</strong>应收款项超过约定回款日 <strong>3</strong> 天未到账。</li>' +
            '<li><strong>超期应付预警：</strong>应付款项超过约定付款日 <strong>1</strong> 天未付出。</li>' +
            '<li><strong>头寸警戒线：</strong>预计余额低于 <strong>100 万</strong> 时触发。</li></ul>', null, true);
        });
      }
      var liqAiRefresh = document.getElementById('liq-risk-ai-refresh');
      if (liqAiRefresh) {
        liqAiRefresh.addEventListener('click', function () {
          var last = window.__liqLastMvpForecastRes;
          if (!last || !backendOk) {
            Toast.warn('请先连接后端并成功完成一次预测');
            return;
          }
          var risk = document.getElementById('liq-risk-alerts');
          _fillLiqRiskFromForecast(last).catch(function (err) {
            console.warn(err);
            if (risk) _fillLiqRiskStatic(last, risk);
          });
        });
      }
    }
    if (backendOk) {
      (async function () {
        try {
          window.__liqModels = await API.get('/api/liquidity/models');
          var ms = document.getElementById('liq-sch-model');
          ms.innerHTML = window.__liqModels.map(function (m) {
            return '<option value="' + m.code + '">' + m.name + '</option>';
          }).join('');
          _liqUpdateModelDesc();
          await _liqLoadHistorySummary();
          await _liqRefreshSchemesTable();
        } catch (e) {
          console.warn(e);
          document.getElementById('liq-model-desc').textContent = '无法加载模型目录';
        }
      })();
    } else {
      document.getElementById('liq-model-desc').textContent = '离线模式：连接后端后可使用完整流动性 API（账户、CSV、方案、运行）。';
      document.getElementById('liq-schemes-body').innerHTML = '<tr><td colspan="7" class="empty-state">离线</td></tr>';
    }
    (function () {
      _runLiqMvpForecast({ silent: true }).catch(function (e) { console.warn(e); });
    })();
    _bindLiqMonthDrill();
    renderBudgetForecastTable();
    _bindBudgetForecastDrill();
  }

  // ═══════════════════════════════════════════════
  // 6. BASE DATA — 完整 CRUD + 映射管理
  // ═══════════════════════════════════════════════

  function renderBaseData() {
    renderSubjectTree();
    renderBizTable();
    renderTimePeriods();
    renderSBMap();
    if (backendOk) {
      (async function () {
        await window.cfReloadBaseData();
        renderSubjectTree();
        renderBizTable();
        renderTimePeriods();
        renderSBMap();
      })();
    }
  }

  var _bdTabsBound = false;
  if (!_bdTabsBound) {
    _bdTabsBound = true;
    var _bdTabs = document.getElementById('bd-tabs');
    if (_bdTabs) _bdTabs.addEventListener('click', function (e) {
      var tab = e.target.closest('.content-tab');
      if (!tab) return;
      document.querySelectorAll('#bd-tabs .content-tab').forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      var target = tab.dataset.tab;
      ['bd-subjects', 'bd-businesses', 'bd-timeperiods', 'bd-sbmap'].forEach(function (id) {
        document.getElementById(id).style.display = id === target ? '' : 'none';
      });
    });
  }

  var _bdAiOneclickBound = false;
  if (!_bdAiOneclickBound) {
    _bdAiOneclickBound = true;
    var _bdRoot = document.getElementById('page-basedata');
    if (_bdRoot) {
      _bdRoot.addEventListener('click', function (e) {
        var b = e.target.closest('.bd-ai-oneclick');
        if (!b) return;
        e.preventDefault();
        var tab = b.getAttribute('data-bd-tab');
        if (tab && window.AgentLoop && typeof AgentLoop.presetBaseDataTab === 'function') {
          AgentLoop.presetBaseDataTab(tab);
        }
      });
    }
  }

  function renderSubjectTree() {
    function _bdEsc(s) {
      return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    }
    var subjects = AppData.subjects || [];
    var byParent = {};
    subjects.forEach(function (s) { var pid = s.parent_id || 0; if (!byParent[pid]) byParent[pid] = []; byParent[pid].push(s); });
    function build(pid) {
      var ch = byParent[pid] || [];
      if (!ch.length) return '';
      return ch.map(function (s) {
        var kids = byParent[s.id] && byParent[s.id].length;
        var dirBadge = s.direction === '流入' ? 'badge-success' : 'badge-danger';
        var un = (s.unit_name || '').trim();
        var unitSpan = un ? ' <span class="muted" style="font-size:11px;">· ' + _bdEsc(un) + '</span>' : '';
        return '<div class="tree-node"><div class="tree-label">' +
          (kids ? '<button class="tree-toggle" onclick="toggleTreeNode(this)">▸</button>' : '<span style="width:16px;display:inline-block"></span>') +
          '<span class="badge ' + dirBadge + '">' + s.direction + '</span> <strong class="mono">' + s.code + '</strong> ' + s.name + unitSpan +
          '</div>' + (kids ? '<div class="tree-children">' + build(s.id) + '</div>' : '') + '</div>';
      }).join('');
    }
    document.getElementById('bd-subject-tree').innerHTML = build(0) || build(null) || '<div class="empty-state">暂无科目</div>';
  }

  window.toggleTreeNode = function (btn) {
    var children = btn.closest('.tree-node').querySelector('.tree-children');
    if (!children) return;
    var open = children.style.display !== 'none';
    children.style.display = open ? 'none' : '';
    btn.textContent = open ? '▸' : '▾';
  };

  function renderBizTable() {
    var list = AppData.businesses || [];
    document.getElementById('bd-biz-body').innerHTML = list.length ? list.map(function (b) {
      return '<tr><td class="mono">' + b.code + '</td><td>' + b.name + '</td><td><span class="badge badge-primary">' + b.biz_type + '</span></td>' +
        '<td>' + (b.valid ? '<span style="color:var(--success)">有效</span>' : '<span style="color:var(--danger)">无效</span>') + '</td>' +
        '<td><button class="btn btn-sm btn-ghost" onclick="toggleBizValid(' + b.id + ')">' + (b.valid ? '禁用' : '启用') + '</button></td></tr>';
    }).join('') : '<tr><td colspan="5" class="empty-state">暂无业务</td></tr>';
  }

  window.toggleBizValid = function (id) {
    var biz = (AppData.businesses || []).find(function (b) { return b.id === id; });
    if (!biz) return;
    var next = !biz.valid;
    if (backendOk) {
      (async function () {
        try {
          await API.put('/api/businesses/' + id, {
            code: biz.code,
            name: biz.name,
            biz_type: biz.biz_type,
            valid: next,
          });
          biz.valid = next;
        } catch (e) {
          console.warn(e);
          Toast.warn('更新失败');
        }
        renderBizTable();
        Toast.success(biz.name + (biz.valid ? ' 已启用' : ' 已禁用'));
      })();
      return;
    }
    biz.valid = next;
    renderBizTable();
    Toast.success(biz.name + (biz.valid ? ' 已启用' : ' 已禁用'));
  };

  function renderTimePeriods() {
    var tps = AppData.timePeriods || [];
    if (!tps.length) { document.getElementById('bd-tp-body').innerHTML = '<div class="empty-state">暂无时间段配置</div>'; return; }
    document.getElementById('bd-tp-body').innerHTML = tps.map(function (tp) {
      var periods = [];
      try { periods = JSON.parse(tp.periods_json || '[]'); } catch (e) {}
      return '<div class="insight-card info" style="margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">' +
        '<div><strong>' + tp.code + '</strong> ' + tp.name + '<br/><span class="muted">' + periods.map(function (p) { return p.freq + '×' + p.length; }).join(' → ') + '</span></div>' +
        '<button class="btn btn-sm btn-ghost" onclick="deleteTimePeriod(' + tp.id + ')">删除</button></div>';
    }).join('');
  }

  window.deleteTimePeriod = function (id) {
    if (backendOk) {
      (async function () {
        try {
          await API.del('/api/time-periods/' + id);
          await window.cfReloadBaseData();
        } catch (e) {
          console.warn(e);
          Toast.warn('删除失败（可能被其它配置引用）');
        }
        renderTimePeriods();
        Toast.success('已删除');
      })();
      return;
    }
    AppData.timePeriods = (AppData.timePeriods || []).filter(function (t) { return t.id !== id; });
    renderTimePeriods();
    Toast.success('已删除');
  };

  function _sbEsc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }
  function _sbEscAttr(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }
  function _sbBizByCode(code) {
    var map = {};
    (AppData.businesses || []).forEach(function (b) { map[b.code] = b; });
    return map[code] || null;
  }
  function _sbBizTagsHtml(codes) {
    var arr = codes || [];
    if (!arr.length) return '<span class="muted">—</span>';
    var parts = arr.map(function (code) {
      var b = _sbBizByCode(code);
      var name = b ? b.name : ('未配置:' + code);
      var title = b ? ('编码 ' + b.code) : ('请在「资金业务」中维护编码 ' + code);
      return '<span class="sbmap-biz-tag" title="' + _sbEscAttr(title) + '">' + _sbEsc(name) + '</span>';
    });
    return '<div class="sbmap-biz-tags">' + parts.join('') + '</div>';
  }
  function _sbBuildBizPickerHtml(selectedCodes) {
    var sel = {};
    (selectedCodes || []).forEach(function (c) { sel[String(c)] = true; });
    var list = (AppData.businesses || []).filter(function (b) { return b.valid !== false; }).slice();
    list.sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || ''), 'zh'); });
    return (
      '<div class="sbmap-biz-picker" id="sbmap-biz-picker">' +
      list.map(function (b) {
        var ck = sel[String(b.code)] ? ' checked' : '';
        return (
          '<label class="sbmap-biz-row">' +
          '<input type="checkbox" name="sbmap-biz" value="' + _sbEscAttr(b.code) + '"' + ck + ' />' +
          '<span class="sbmap-biz-name">' + _sbEsc(b.name) + '</span>' +
          '<span class="sbmap-biz-code">' + _sbEsc(b.code) + '</span>' +
          '</label>'
        );
      }).join('') +
      '</div>'
    );
  }
  function openSBMapModal(isEdit, mapRow) {
    var leafSubjects = (AppData.subjects || []).filter(function (s) {
      return !(AppData.subjects || []).some(function (c) { return c.parent_id === s.id; });
    });
    var subjOpts = leafSubjects.map(function (s) {
      return '<option value="' + s.id + '">' + _sbEsc(s.code + ' ' + s.name + ' (' + s.direction + ')') + '</option>';
    }).join('');
    var subjBlock;
    if (isEdit && mapRow) {
      subjBlock =
        '<p style="margin:0 0 12px;font-size:13px;">末级科目：<strong>' + _sbEsc(mapRow.subject_code + ' ' + mapRow.subject_name) + '</strong> ' +
        '<span class="badge ' + (mapRow.direction === '流入' ? 'badge-success' : 'badge-danger') + '">' + _sbEsc(mapRow.direction) + '</span></p>' +
        '<input type="hidden" id="m-sbm-sub" value="' + String(mapRow.subject_id) + '" />';
    } else {
      subjBlock = '<div class="form-group"><label>末级科目</label><select class="form-select" id="m-sbm-sub">' + subjOpts + '</select></div>';
    }
    var pickerHtml = _sbBuildBizPickerHtml(isEdit && mapRow ? mapRow.biz_codes : []);
    var body =
      subjBlock +
      '<div class="form-group"><label>关联资金业务（可多选）</label>' + pickerHtml + '</div>' +
      '<p class="muted" style="font-size:12px;margin:0;">按业务名称勾选；右侧为编码对照。</p>';
    openModal(isEdit ? '编辑科目↔业务映射' : '新增科目↔业务映射', body, function () {
      var subId = isEdit && mapRow
        ? mapRow.subject_id
        : parseInt(document.getElementById('m-sbm-sub').value, 10);
      var sub = (AppData.subjects || []).find(function (s) { return s.id === subId; });
      var wrap = document.getElementById('sbmap-biz-picker');
      var bizCodes = wrap
        ? Array.prototype.map.call(wrap.querySelectorAll('input[name="sbmap-biz"]:checked'), function (cb) { return cb.value; })
        : [];
      if (!sub || !bizCodes.length) { Toast.warn('请选择科目和至少一项资金业务'); return; }
    if (backendOk) {
      (async function () {
        try {
            if (isEdit && mapRow) {
              await API.put('/api/subject-category-map/' + mapRow.id, { biz_codes: bizCodes, valid: true });
            } else {
              await API.post('/api/subject-category-map', { subject_id: subId, biz_codes: bizCodes, valid: true });
            }
          await window.cfReloadBaseData();
            Toast.success(isEdit ? '映射已更新' : '映射创建成功');
        } catch (e) {
          console.warn(e);
            Toast.warn((isEdit ? '更新' : '创建') + '失败');
        }
          closeModal();
        renderSBMap();
      })();
      return;
    }
      var maxId = (AppData.subjectBizMapping || []).reduce(function (a, m) { return Math.max(a, m.id || 0); }, 0);
      if (isEdit && mapRow) {
        mapRow.biz_codes = bizCodes;
      } else {
        AppData.subjectBizMapping.push({
          id: maxId + 1,
          subject_id: sub.id,
          subject_code: sub.code,
          subject_name: sub.name,
          direction: sub.direction,
          biz_codes: bizCodes,
        });
      }
      Toast.success(isEdit ? '映射已更新' : '映射创建成功');
      closeModal();
    renderSBMap();
    });
  }

  function renderSBMap() {
    var maps = AppData.subjectBizMapping || [];
    document.getElementById('bd-sbmap-body').innerHTML = maps.length ? maps.map(function (m) {
      return '<tr><td class="mono">' + _sbEsc(m.subject_code) + '</td><td>' + _sbEsc(m.subject_name) + '</td><td>' + _sbEsc(m.direction) + '</td>' +
        '<td>' + _sbBizTagsHtml(m.biz_codes) + '</td>' +
        '<td><button class="btn btn-sm btn-ghost" onclick="editSBMap(' + m.id + ')">编辑</button> ' +
        '<button class="btn btn-sm btn-ghost" onclick="deleteSBMap(' + m.id + ')">删除</button></td></tr>';
    }).join('') : '<tr><td colspan="5" class="empty-state">暂无映射</td></tr>';
  }

  window.editSBMap = function (id) {
    var m = (AppData.subjectBizMapping || []).find(function (x) { return x.id === id; });
    if (!m) return;
    openSBMapModal(true, m);
  };

  window.deleteSBMap = function (id) {
    if (backendOk) {
      (async function () {
        try {
          await API.del('/api/subject-category-map/' + id);
          await window.cfReloadBaseData();
        } catch (e) {
          console.warn(e);
          Toast.warn('删除失败');
        }
        renderSBMap();
        Toast.success('映射已删除');
      })();
      return;
    }
    AppData.subjectBizMapping = (AppData.subjectBizMapping || []).filter(function (m) { return m.id !== id; });
    renderSBMap();
    Toast.success('映射已删除');
  };

  _domOn('bd-btn-add-subject', 'click', function () {
    var subjects = AppData.subjects || [];
    var byParent = {};
    subjects.forEach(function (s) { var pid = s.parent_id || 0; if (!byParent[pid]) byParent[pid] = []; byParent[pid].push(s); });
    var parentOptsArr = [];
    function walk(pid, depth) {
      (byParent[pid] || []).forEach(function (s) {
        var prefix = new Array(depth + 1).join('　');
        parentOptsArr.push('<option value="' + s.id + '">' + prefix + s.code + ' ' + s.name + '</option>');
        walk(s.id, depth + 1);
      });
    }
    walk(0, 0);
    var parentOpts = '<option value="">无（顶级）</option>' + parentOptsArr.join('');
    openModal('新增资金流科目',
      '<div class="form-group"><label>科目编码</label><input class="form-input" id="m-sub-code" placeholder="如: 200003" /></div>' +
      '<div class="form-group"><label>科目名称</label><input class="form-input" id="m-sub-name" placeholder="如: 其他收入" /></div>' +
      '<div class="form-group"><label>单位名称</label><input class="form-input" id="m-sub-unit" placeholder="可选：账户归属或数据来源主体" /></div>' +
      '<div class="form-group"><label>方向</label><select class="form-select" id="m-sub-dir"><option>流入</option><option>流出</option></select></div>' +
      '<div class="form-group"><label>上级科目</label><select class="form-select" id="m-sub-parent">' + parentOpts + '</select></div>' +
      '<p class="muted" style="font-size:12px;margin:0;">无需关联计划周期或计划配置；树结构仅由上级科目决定。</p>',
      function () {
        var code = document.getElementById('m-sub-code').value.trim();
        var name = document.getElementById('m-sub-name').value.trim();
        if (!code || !name) { Toast.warn('请填写编码和名称'); return; }
        var parentVal = document.getElementById('m-sub-parent').value;
        var unitEl = document.getElementById('m-sub-unit');
        var unitName = unitEl && unitEl.value ? unitEl.value.trim() : '';
        var body = {
          code: code,
          name: name,
          unit_name: unitName,
          direction: document.getElementById('m-sub-dir').value,
          parent_id: parentVal ? parseInt(parentVal, 10) : null,
          is_period: '否',
          valid: true,
        };
        if (backendOk) {
          (async function () {
            try {
              await API.post('/api/subjects', body);
              await window.cfReloadBaseData();
              Toast.success('科目创建成功');
            } catch (e) {
              console.warn(e);
              Toast.warn('创建失败（编码重复或期初/期末唯一性限制）');
            }
            closeModal();
            renderSubjectTree();
          })();
          return;
        }
        var maxId = subjects.reduce(function (a, s) { return Math.max(a, s.id || 0); }, 0);
        AppData.subjects.push({
          id: maxId + 1, code: code, name: name,
          unit_name: unitName,
          direction: body.direction,
          parent_id: body.parent_id,
          is_period: body.is_period, valid: true,
        });
        Toast.success('科目创建成功');
        closeModal(); renderSubjectTree();
      });
  });

  _domOn('bd-btn-add-biz', 'click', function () {
    var bizTypes = ['一般资金流','保证金','借款','对外借款','定期存款','协定存款','金额理财','份额理财','外汇即远期','外汇掉期','外汇期权'];
    openModal('新增资金业务',
      '<div class="form-group"><label>编码</label><input class="form-input" id="m-biz-code" placeholder="如: 031" /></div>' +
      '<div class="form-group"><label>名称</label><input class="form-input" id="m-biz-name" placeholder="如: 新业务" /></div>' +
      '<div class="form-group"><label>类型</label><select class="form-select" id="m-biz-type">' + bizTypes.map(function (t) { return '<option>' + t + '</option>'; }).join('') + '</select></div>',
      function () {
        var code = document.getElementById('m-biz-code').value.trim();
        var name = document.getElementById('m-biz-name').value.trim();
        if (!code || !name) { Toast.warn('请填写编码和名称'); return; }
        var btype = document.getElementById('m-biz-type').value;
        if (backendOk) {
          (async function () {
            try {
              await API.post('/api/businesses', { code: code, name: name, biz_type: btype, valid: true });
              await window.cfReloadBaseData();
              Toast.success('业务创建成功');
            } catch (e) {
              console.warn(e);
              Toast.warn('创建失败（业务编码可能已存在）');
            }
            closeModal();
            renderBizTable();
          })();
          return;
        }
        var maxId = (AppData.businesses || []).reduce(function (a, b) { return Math.max(a, b.id || 0); }, 0);
        AppData.businesses.push({ id: maxId + 1, code: code, name: name, biz_type: btype, valid: true });
        Toast.success('业务创建成功');
        closeModal(); renderBizTable();
      });
  });

  _domOn('bd-btn-add-tp', 'click', function () {
    openModal('新增时间段配置',
      '<div class="form-group"><label>名称</label><input class="form-input" id="m-tp-name" placeholder="如: 月度滚动（月12）" /></div>' +
      '<div class="form-group"><label>频率配置（JSON）</label><textarea class="form-input" id="m-tp-json" rows="4" style="width:100%;font-family:var(--font-mono);font-size:12px;">[{"freq":"天","length":7},{"freq":"月","length":3}]</textarea></div>' +
      '<p class="muted" style="font-size:11px;">频率须按 天→周→月→季→年 顺序。</p>',
      function () {
        var name = document.getElementById('m-tp-name').value.trim();
        var json = document.getElementById('m-tp-json').value.trim();
        if (!name) { Toast.warn('请填写名称'); return; }
        try { JSON.parse(json); } catch (e) { Toast.warn('JSON 格式有误'); return; }
        if (backendOk) {
          (async function () {
            try {
              var tps = await API.get('/api/time-periods');
              var max = 0;
              (tps || []).forEach(function (tp) {
                var m = /^TP(\d+)$/i.exec(String(tp.code || '').trim());
                if (m) max = Math.max(max, parseInt(m[1], 10));
              });
              var code = 'TP' + String(max + 1).padStart(4, '0');
              await API.post('/api/time-periods', { code: code, name: name, periods_json: json, valid: true });
              await window.cfReloadBaseData();
              Toast.success('时间段创建成功');
            } catch (e) {
              console.warn(e);
              Toast.warn('创建失败（编码冲突或频率 JSON 不符合规则）');
            }
            closeModal();
            renderTimePeriods();
          })();
          return;
        }
        var maxId = (AppData.timePeriods || []).reduce(function (a, t) { return Math.max(a, t.id || 0); }, 0);
        AppData.timePeriods.push({ id: maxId + 1, code: 'TP' + String(maxId + 2).padStart(4, '0'), name: name, periods_json: json, valid: true });
        Toast.success('时间段创建成功');
        closeModal(); renderTimePeriods();
      });
  });

  _domOn('bd-btn-add-sbmap', 'click', function () {
    openSBMapModal(false, null);
  });

  // ═══════════════════════════════════════════════
  // 7. INTEGRATION — 完整交互 + 同步日志 + 任务管理
  // ═══════════════════════════════════════════════

  function renderIntegration() {
    _renderRulesTable();
    _renderSyncLog();
    _renderTasksTable();
    _bindIntCards();
    _bindIntegrationWorkbench();
  }

  function _updateIntegrationRuleHint() {
    var el = document.getElementById('int-rules-hint');
    if (!el) return;
    var n = (AppData.mappingRules || []).filter(function (r) { return r.valid; }).length;
    if (n) {
      el.textContent = '已启用 ' + n + ' 条规则：可执行「手动同步」「银企取数」或使用「数据导入 / Excel」。';
      el.setAttribute('data-state', 'ok');
    } else {
      el.textContent = '尚未启用映射规则：请先「+ 新增规则」并启用，否则无法发起 TMS / 银企拉取。';
      el.setAttribute('data-state', 'warn');
    }
  }

  function _bindIntegrationWorkbench() {
    var wb = document.getElementById('int-btn-open-workbench');
    if (wb && !wb._bound) {
      wb._bound = true;
      wb.addEventListener('click', function () {
        if (window.Router && typeof Router.navigate === 'function') Router.navigate('workbench');
      });
    }
  }

  function _renderRulesTable() {
    var rules = AppData.mappingRules || [];
    document.getElementById('int-rules-body').innerHTML = rules.length ? rules.map(function (r) {
      return '<tr><td class="mono">' + r.code + '</td><td>' + (r.name || '-') + '</td><td>' + r.source_system + '</td><td>' + (r.source_doc_type || '-') + '</td>' +
        '<td><span class="badge ' + (r.valid ? 'badge-success' : 'badge-default') + '">' + (r.valid ? '启用' : '禁用') + '</span></td>' +
        '<td><button class="btn btn-sm btn-ghost" onclick="viewRule(' + r.id + ')">查看</button>' +
        ' <button class="btn btn-sm btn-ghost" onclick="toggleRule(' + r.id + ')">' + (r.valid ? '禁用' : '启用') + '</button>' +
        ' <button class="btn btn-sm btn-ghost" onclick="deleteRule(' + r.id + ')">删除</button></td></tr>';
    }).join('') : '<tr><td colspan="6" class="empty-state">暂无映射规则</td></tr>';
    _updateIntegrationRuleHint();
  }

  window.viewRule = function (id) {
    var r = (AppData.mappingRules || []).find(function (x) { return x.id === id; });
    if (!r) return;
    openModal('映射规则详情 — ' + r.code,
      '<table class="data-table" style="font-size:13px;"><tbody>' +
      '<tr><td style="font-weight:600;width:100px;">编码</td><td>' + r.code + '</td></tr>' +
      '<tr><td style="font-weight:600;">名称</td><td>' + r.name + '</td></tr>' +
      '<tr><td style="font-weight:600;">来源系统</td><td>' + r.source_system + '</td></tr>' +
      '<tr><td style="font-weight:600;">单据类型</td><td>' + r.source_doc_type + '</td></tr>' +
      '<tr><td style="font-weight:600;">状态</td><td>' + (r.valid ? '启用' : '禁用') + '</td></tr>' +
      '</tbody></table>', null, true);
  };

  window.toggleRule = function (id) {
    var r = (AppData.mappingRules || []).find(function (x) { return x.id === id; });
    if (!r) return;
    r.valid = !r.valid;
    if (backendOk) {
      (async function () {
        try {
          await API.put('/api/mapping-rules/' + id, {
            name: r.name,
            biz_id: r.biz_id,
            source_system: r.source_system || '资金管理系统',
            source_doc_type: r.source_doc_type,
            filters_json: r.filters_json || '[]',
            field_map_json: r.field_map_json || '{}',
            valid: r.valid,
          });
          await window.cfReloadCoreData();
        } catch (e) { console.warn(e); }
        _renderRulesTable();
        Toast.success(r.code + (r.valid ? ' 已启用' : ' 已禁用'));
      })();
      return;
    }
    _renderRulesTable();
    Toast.success(r.code + (r.valid ? ' 已启用' : ' 已禁用'));
  };

  window.deleteRule = function (id) {
    if (backendOk) {
      (async function () {
        try {
          await API.del('/api/mapping-rules/' + id);
          await window.cfReloadCoreData();
        } catch (e) { console.warn(e); }
        _renderRulesTable();
        Toast.success('规则已删除');
      })();
      return;
    }
    AppData.mappingRules = (AppData.mappingRules || []).filter(function (r) { return r.id !== id; });
    _renderRulesTable();
    Toast.success('规则已删除');
  };

  _domOn('int-btn-add-rule', 'click', function () {
    var docTypes = ['应付票据','应收票据','银行借款','保证金','协定存款','开出信用证','收到信用证','定期存款','资金拆借','外汇即期'];
    openModal('新增取数映射规则',
      '<div class="form-group"><label>规则名称</label><input class="form-input" id="m-rule-name" placeholder="如: 定期存款取数规则" /></div>' +
      '<div class="form-group"><label>来源系统</label><select class="form-select" id="m-rule-sys"><option>资金管理系统</option><option>ERP系统</option></select></div>' +
      '<div class="form-group"><label>单据类型</label><select class="form-select" id="m-rule-type">' + docTypes.map(function (t) { return '<option>' + t + '</option>'; }).join('') + '</select></div>',
      function () {
        var name = document.getElementById('m-rule-name').value.trim();
        if (!name) { Toast.warn('请填写名称'); return; }
        if (backendOk) {
          (async function () {
            try {
              var created = await API.post('/api/mapping-rules', {
                name: name,
                biz_id: null,
                source_system: document.getElementById('m-rule-sys').value,
                source_doc_type: document.getElementById('m-rule-type').value,
                filters_json: '[]',
                field_map_json: '{}',
                valid: true,
              });
              await window.cfReloadCoreData();
              AppData.mappingRules = await API.get('/api/mapping-rules');
              Toast.success('规则 ' + created.code + ' 创建成功');
            } catch (e) {
              console.warn(e);
              Toast.warn('创建失败');
            }
            closeModal();
            _renderRulesTable();
          })();
          return;
        }
        var maxId = (AppData.mappingRules || []).reduce(function (a, r) { return Math.max(a, r.id || 0); }, 0);
        var code = 'MR' + String(maxId + 2).padStart(6, '0');
        AppData.mappingRules.push({ id: maxId + 1, code: code, name: name, source_system: document.getElementById('m-rule-sys').value, source_doc_type: document.getElementById('m-rule-type').value, valid: true });
        Toast.success('规则 ' + code + ' 创建成功');
        closeModal(); _renderRulesTable();
      });
  });

  function _intForceOverride() {
    var cb = document.getElementById('int-force-override');
    return cb && cb.checked;
  }

  async function _runIntegrationFetch(sourceSystem, label) {
    var validRules = (AppData.mappingRules || []).filter(function (r) { return r.valid; });
    if (!validRules.length) { Toast.warn('暂无有效映射规则'); return; }
    Toast.info('正在同步数据...');
    if (backendOk) {
      try {
        var res = await API.post('/api/integrations/fetch', {
          units: [],
          source_system: sourceSystem,
          force_override: _intForceOverride(),
        });
        _addSyncLog(sourceSystem, label || '手动同步', res.records_created || 0, '成功',
          '跳过' + (res.records_skipped || 0) + ' 覆盖' + (res.records_overridden || 0));
        await window.cfReloadCoreData();
        refreshStats();
        _renderSyncLog();
        Toast.success('同步完成：新增 ' + (res.records_created || 0) + ' · 批次 ' + (res.collection_code || '—') + ' · 跳过 ' + (res.records_skipped || 0) + ' · 覆盖 ' + (res.records_overridden || 0));
      } catch (e) {
        console.warn(e);
        Toast.warn('同步接口失败');
      }
      return;
    }
    setTimeout(function () {
      var bankStatus = AppData.systemHealth.bank ? AppData.systemHealth.bank.status : 'ok';
      var count = _simulateFetchData('');
      if (bankStatus !== 'offline') {
        _addSyncLog(sourceSystem, label || '手动同步', count, '成功');
      }
      refreshStats();
      _renderSyncLog();
      if (count > 0) {
        Toast.success('同步完成：获取 ' + count + ' 条记录');
      } else if (bankStatus === 'offline') {
        Toast.warn('银行接口离线，同步失败');
      } else {
        Toast.info('同步完成，无新增记录');
      }
    }, 800);
  }

  var intSyncBtn = document.getElementById('int-btn-sync');
  if (intSyncBtn) intSyncBtn.addEventListener('click', function () { _runIntegrationFetch('资金管理系统', 'TMS手动同步'); });
  var intSyncBankBtn = document.getElementById('int-btn-sync-bank');
  if (intSyncBankBtn) intSyncBankBtn.addEventListener('click', function () { _runIntegrationFetch('银企直连', '银企取数'); });

  var intExcelBtn = document.getElementById('int-btn-excel');
  var intDataImportBtn = document.getElementById('int-btn-data-import');
  var intExcelInput = document.getElementById('int-excel-input');
  if (intExcelInput) {
    if (intExcelBtn) intExcelBtn.addEventListener('click', function () { intExcelInput.click(); });
    if (intDataImportBtn) intDataImportBtn.addEventListener('click', function () { intExcelInput.click(); });
    intExcelInput.addEventListener('change', function () {
      var f = intExcelInput.files && intExcelInput.files[0];
      intExcelInput.value = '';
      if (!f) return;
      if (!backendOk) {
        Toast.warn('请先启动后端服务后再上传 Excel');
        return;
      }
      (async function () {
        try {
          Toast.info('正在导入 Excel…');
          var fd = new FormData();
          fd.append('file', f);
          if (_intForceOverride()) fd.append('force_override', 'true');
          var res = await API.postForm('/api/records/import-excel', fd);
          if (res.ok === false) {
            Toast.warn((res.errors && res.errors[0]) || '导入失败');
            return;
          }
          _addSyncLog('手工录入', 'Excel导入', res.records_created || 0, '成功',
            '跳过' + (res.records_skipped || 0));
          await window.cfReloadCoreData();
          refreshStats();
          _renderSyncLog();
          loadCfTable();
          var msg = '导入完成：写入 ' + (res.records_created || 0) + ' 条 · 跳过 ' + (res.records_skipped || 0);
          if (res.errors && res.errors.length) msg += ' · 行提示 ' + res.errors.length + ' 条';
          Toast.success(msg);
        } catch (e) {
          console.warn(e);
          Toast.warn('导入失败：' + (e.message || String(e)));
        }
      })();
    });
  }

  function _addSyncLog(system, action, count, status, remark) {
    var now = new Date();
    var timeStr = now.toISOString().slice(0, 10) + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    var maxId = (AppData.syncLogs || []).reduce(function (a, l) { return Math.max(a, l.id || 0); }, 0);
    AppData.syncLogs.push({
      id: maxId + 1, time: timeStr, system: system, action: action,
      records_count: count, status: status || '成功', remark: remark || '',
    });
  }

  function _renderSyncLog() {
    var el = document.getElementById('int-sync-log');
    if (!el) return;
    var server = (AppData.serverSyncLogs || []).slice(0, 25);
    var logs = (AppData.syncLogs || []).slice(-10).reverse();
    var parts = [];
    if (server.length) {
      parts.push('<div style="font-size:10px;color:var(--text-muted);margin-bottom:6px;">服务端审计</div>');
      parts.push(server.map(function (l) {
        var hasSnap = l.snapshot_json && l.snapshot_json !== '{}' && l.snapshot_json.length > 5;
        var snapBtn = hasSnap ? ' <button type="button" class="btn btn-sm btn-ghost" onclick="viewSyncSnapshot(' + l.id + ')">查看快照</button>' : '';
        var t = (l.created_at || '').replace('T', ' ').slice(0, 19);
        return '<div class="sync-log-item">' +
          '<span class="sync-log-time">' + t + '</span>' +
          '<span class="sync-log-system">' + (l.action_type || '-') + '</span>' +
          '<span class="sync-log-action">' + (l.message || '') + snapBtn + '</span>' +
          '<span class="sync-log-count">' + (l.source_system || '') + '</span>' +
          '</div>';
      }).join(''));
    }
    if (logs.length) {
      parts.push('<div style="font-size:11px;color:var(--text-muted);margin:12px 0 8px;">本地会话记录</div>');
      parts.push(logs.map(function (l) {
        var statusCls = l.status === '成功' ? 'ok' : l.status === '重试中' ? 'ok' : 'fail';
        return '<div class="sync-log-item">' +
          '<span class="sync-log-time">' + l.time + '</span>' +
          '<span class="sync-log-system">' + l.system + '</span>' +
          '<span class="sync-log-action">' + l.action + (l.remark ? ' <span style="color:var(--text-muted);font-size:10px;">(' + l.remark + ')</span>' : '') + '</span>' +
          '<span class="sync-log-count">+' + l.records_count + ' 条</span>' +
          '<span class="sync-log-status ' + statusCls + '">' + l.status + '</span>' +
          '</div>';
      }).join(''));
    }
    if (!parts.length) { el.innerHTML = '<div class="empty-state">暂无同步记录</div>'; return; }
    el.innerHTML = parts.join('');
  }

  window.viewSyncSnapshot = function (id) {
    var l = (AppData.serverSyncLogs || []).find(function (x) { return x.id === id; });
    if (!l || !l.snapshot_json) { Toast.warn('无快照'); return; }
    var pretty = l.snapshot_json;
    try { pretty = JSON.stringify(JSON.parse(l.snapshot_json), null, 2); } catch (e) {}
    openModal('覆盖前快照 · record #' + (l.target_record_id || '-'),
      '<pre style="font-size:11px;max-height:360px;overflow:auto;white-space:pre-wrap;">' + pretty.replace(/</g, '&lt;') + '</pre>', null, true);
  };

  function _renderTasksTable() {
    var tasks = AppData.fetchTasks || [];
    document.getElementById('int-tasks-body').innerHTML = tasks.length ? tasks.map(function (t) {
      return '<tr><td>' + t.name + '</td><td><span class="badge badge-primary">' + t.type + '</span></td><td class="mono">' + t.cron + '</td>' +
        '<td><span class="badge ' + (t.enabled ? 'badge-success' : 'badge-default') + '">' + (t.enabled ? '运行中' : '已暂停') + '</span></td>' +
        '<td><button class="btn btn-sm btn-ghost" onclick="toggleTask(' + t.id + ')">' + (t.enabled ? '暂停' : '启动') + '</button>' +
        ' <button class="btn btn-sm btn-ghost" onclick="runTask(' + t.id + ')">立即执行</button></td></tr>';
    }).join('') : '<tr><td colspan="5" class="empty-state">暂无定时任务</td></tr>';
  }

  window.toggleTask = function (id) {
    var t = (AppData.fetchTasks || []).find(function (x) { return x.id === id; });
    if (!t) return;
    var nextEnabled = !t.enabled;
    if (backendOk) {
      (async function () {
        try {
          await API.put('/api/fetch-tasks/' + id, {
            name: t.name,
            task_type: t.type,
            enabled: nextEnabled,
            cron_expr: t.cron || '0 0 12 * * ?',
            filters_json: t.filters_json || '[]',
            extra_json: t.extra_json || '{}',
          });
          t.enabled = nextEnabled;
          _renderTasksTable();
          Toast.success(t.name + (t.enabled ? ' 已启动' : ' 已暂停'));
        } catch (e) {
          console.warn(e);
          Toast.warn('更新任务状态失败');
        }
      })();
      return;
    }
    t.enabled = nextEnabled;
    _renderTasksTable();
    Toast.success(t.name + (t.enabled ? ' 已启动' : ' 已暂停'));
  };

  window.runTask = function (id) {
    var t = (AppData.fetchTasks || []).find(function (x) { return x.id === id; });
    if (!t) return;
    Toast.info('正在执行任务: ' + t.name);
    if (backendOk) {
      (async function () {
        try {
          var res = await API.post('/api/fetch-tasks/' + id + '/run', {});
          if (res.result && res.result.records_created != null) {
            _addSyncLog(t.system || '资金管理系统', '定时任务', res.result.records_created, '成功');
            await window.cfReloadCoreData();
            refreshStats();
            _renderSyncLog();
            Toast.success('任务完成：写入 ' + res.result.records_created + ' 条');
          } else if (res.plans_updated != null) {
            await window.cfReloadCoreData();
            Toast.success('已更新 ' + res.plans_updated + ' 个计划（来源：' + (res.report_code || '') + '）');
          } else {
            Toast.info(res.message || '任务已执行');
          }
          _renderTasksTable();
        } catch (e) {
          console.warn(e);
          Toast.warn('任务执行失败');
        }
      })();
      return;
    }
    setTimeout(function () {
      if (t.type === '资金流自动获取') {
        var count = _simulateFetchData('');
        _addSyncLog(t.system || '资金管理系统', '定时任务', count);
        refreshStats();
        _renderSyncLog();
        Toast.success('任务完成：获取 ' + count + ' 条记录');
      } else {
        if (!AppData.analysisResult) { Toast.warn('暂无分析结果，请先运行分析'); return; }
        Toast.success('已将分析数据推送至资金计划');
      }
    }, 600);
  };

  _domOn('int-btn-add-task', 'click', function () {
    openModal('新增定时任务',
      '<div class="form-group"><label>任务名称</label><input class="form-input" id="m-task-name" placeholder="如: 每日资金流同步" /></div>' +
      '<div class="form-group"><label>任务类型</label><select class="form-select" id="m-task-type"><option>资金流自动获取</option><option>资金计划自动获取资金预测</option></select></div>' +
      '<div class="form-group"><label>Cron 表达式</label><input class="form-input" id="m-task-cron" placeholder="0 0 12 * * ?" value="0 0 12 * * ?" /></div>',
      function () {
        var name = document.getElementById('m-task-name').value.trim();
        if (!name) { Toast.warn('请填写名称'); return; }
        var ttype = document.getElementById('m-task-type').value;
        var cron = document.getElementById('m-task-cron').value || '0 0 12 * * ?';
        if (backendOk) {
          (async function () {
            try {
              await API.post('/api/fetch-tasks', {
                name: name,
                task_type: ttype,
                enabled: true,
                cron_expr: cron,
                filters_json: '[]',
                extra_json: '{}',
              });
              await window.cfReloadCoreData();
              Toast.success('任务已写入数据库');
            } catch (e) { console.warn(e); Toast.warn('创建失败'); }
            closeModal();
            _renderTasksTable();
          })();
          return;
        }
        var maxId = (AppData.fetchTasks || []).reduce(function (a, t) { return Math.max(a, t.id || 0); }, 0);
        AppData.fetchTasks.push({
          id: maxId + 1, name: name,
          type: ttype,
          system: '资金管理系统',
          cron: cron,
          enabled: true, last_run: '-', status: '正常',
        });
        Toast.success('任务创建成功');
        closeModal(); _renderTasksTable();
      });
  });

  function _bindIntCards() {
    document.querySelectorAll('#int-systems .integration-card').forEach(function (card) {
      if (card._bound) return;
      card._bound = true;
      card.style.cursor = 'pointer';
      card.addEventListener('click', function () {
        var name = card.querySelector('h4').textContent;
        var statusEl = card.querySelector('.integration-status');
        var sys = card.dataset.sys;

        if (statusEl.classList.contains('connected')) {
          openModal(name + ' — 系统详情',
            '<table class="data-table" style="font-size:13px;"><tbody>' +
            '<tr><td style="font-weight:600;width:100px;">系统名称</td><td>' + name + '</td></tr>' +
            '<tr><td style="font-weight:600;">连接状态</td><td><span style="color:var(--success);">● 已连接</span></td></tr>' +
            '<tr><td style="font-weight:600;">映射规则</td><td>' + (AppData.mappingRules || []).filter(function (r) { return r.valid; }).length + ' 条启用</td></tr>' +
            '<tr><td style="font-weight:600;">最近同步</td><td>' + ((AppData.syncLogs || []).length ? AppData.syncLogs[AppData.syncLogs.length - 1].time : '-') + '</td></tr>' +
            '</tbody></table>', null, true);
        } else {
          openModal('配置 ' + name,
            '<p>是否启用 <strong>' + name + '</strong> 的数据连接？</p>' +
            '<p class="muted" style="font-size:12px;">启用后系统将自动建立数据通道。</p>',
            function () {
              statusEl.classList.remove('pending');
              statusEl.classList.add('connected');
              statusEl.textContent = '● 已连接';
              Toast.success(name + ' 已连接');
              closeModal();
            });
        }
      });
    });
  }

  // ═══════════════════════════════════════════════
  // 8. STAGES — 模块卡片导航到对应页面
  // ═══════════════════════════════════════════════

  var _stagePageMap = {
    '📈 现金流预测': 'liquidity',
    '💰 资金调度': 'liquidity',
    '💱 外汇管理': 'dashboard',
    '📋 资金计划': 'analysis',
    '🤖 AI Agent': 'dashboard',
    '🔗 系统集成': 'integration',
    '⚠️ 异常预警': 'dashboard',
    '🧠 多模型集成': 'analysis',
  };

  function renderStages() {
    document.querySelectorAll('.stage-card').forEach(function (card) {
      card.onclick = function () {
        document.querySelectorAll('.stage-card').forEach(function (c) { c.classList.remove('is-active'); });
        card.classList.add('is-active');
      };
    });

    document.querySelectorAll('.stage-module-card').forEach(function (mc) {
      if (mc._bound) return;
      mc._bound = true;
      mc.style.cursor = 'pointer';
      mc.addEventListener('click', function () {
        var h4 = mc.querySelector('h4');
        var tag = mc.querySelector('.module-tag');
        if (!h4) return;
        var text = h4.textContent.trim();
        var page = _stagePageMap[text];
        if (page && tag && tag.classList.contains('t-ready')) {
          Router.navigate(page);
          Toast.info('已跳转至: ' + text);
        } else {
          Toast.info(text + ' — ' + (tag ? tag.textContent.trim() : ''));
        }
      });
    });
  }

  // ═══════════════════════════════════════════════
  // MODAL
  // ═══════════════════════════════════════════════

  function openModal(title, bodyHtml, onConfirm, readonly, modalOpts) {
    modalOpts = modalOpts || {};
    var mbox = document.querySelector('#modal-mask .modal-box');
    if (mbox) {
      if (modalOpts.wide) mbox.classList.add('modal-box--wide');
      else mbox.classList.remove('modal-box--wide');
    }
    var mt = document.getElementById('modal-title');
    var mb = document.getElementById('modal-body');
    var mf = document.getElementById('modal-footer');
    var mk = document.getElementById('modal-mask');
    if (mt) mt.textContent = title;
    if (mb) mb.innerHTML = bodyHtml;
    if (mf) {
    if (readonly) {
        mf.innerHTML = '<button class="btn btn-primary" id="modal-cancel">关闭</button>';
    } else {
        mf.innerHTML = '<button class="btn" id="modal-cancel">取消</button><button class="btn btn-primary" id="modal-confirm">确认</button>';
      }
    }
    if (mk) mk.classList.add('is-open');
    var mc = document.getElementById('modal-cancel');
    if (mc) mc.addEventListener('click', closeModal);
    if (!readonly && onConfirm) {
      var mconf = document.getElementById('modal-confirm');
      if (mconf) mconf.addEventListener('click', onConfirm);
    }
  }

  function closeModal() {
    var mk = document.getElementById('modal-mask');
    if (mk) mk.classList.remove('is-open');
    var mbox = document.querySelector('#modal-mask .modal-box');
    if (mbox) mbox.classList.remove('modal-box--wide');
  }

  // ═══════════════════════════════════════════════
  // UTILITY
  // ═══════════════════════════════════════════════

  function fmtAmt(v) {
    if (v == null || isNaN(v)) return '-';
    if (Math.abs(v) >= 1e8) return (v / 1e8).toFixed(2) + ' 亿';
    if (Math.abs(v) >= 1e4) return (v / 1e4).toFixed(1) + ' 万';
    return v.toLocaleString('zh-CN');
  }
  function fmtNum(v) {
    if (v == null || isNaN(v)) return '-';
    return Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 0 });
  }
  window.fmtNum = fmtNum;
  window.fmtAmt = fmtAmt;

  function populateUnitSelect(id) {
    var sel = document.getElementById(id);
    if (!sel) return;
    var units = AppData.stats && AppData.stats.units ? AppData.stats.units : ['总部', '华东子公司', '华南子公司'];
    var existing = Array.from(sel.options).map(function (o) { return o.value; });
    units.forEach(function (u) { if (existing.indexOf(u) === -1) { var opt = document.createElement('option'); opt.value = u; opt.textContent = u; sel.appendChild(opt); } });
  }

})();

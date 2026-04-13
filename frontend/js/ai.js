/**
 * ai.js — AI 对话 + DeepSeek API 集成 + 页面操作 + 富文本渲染
 */

/**
 * 可选：内置默认大模型密钥（留空则仅用 localStorage「cf_ai_api_key」或后端代理）。
 * 公网仓库切勿填入真实密钥；本地可临时填写或通过设置页保存。
 */
var CF_DEFAULT_AI_API_KEY = '';

window.AI = {
  /** 浏览器直连大模型（OpenAI 兼容 /chat/completions）。优先走后端 /api/agent/chat。Key 存 localStorage: cf_ai_api_key */
  _dsConfig: {
    apiKey: '',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
  },

  /** 启动时从 localStorage 与 window.__DEEPSEEK_API_KEY__ 合并 */
  loadStoredApiConfig: function () {
    try {
      var k = localStorage.getItem('cf_ai_api_key');
      if (k && String(k).trim()) {
        k = String(k).trim();
        this._dsConfig.apiKey = k;
        window.__DEEPSEEK_API_KEY__ = k;
      } else if (typeof CF_DEFAULT_AI_API_KEY === 'string' && CF_DEFAULT_AI_API_KEY.trim()) {
        k = CF_DEFAULT_AI_API_KEY.trim();
        this._dsConfig.apiKey = k;
        window.__DEEPSEEK_API_KEY__ = k;
      } else if (typeof window !== 'undefined' && window.__DEEPSEEK_API_KEY__) {
        this._dsConfig.apiKey = String(window.__DEEPSEEK_API_KEY__).trim();
      }
      var b = localStorage.getItem('cf_ai_base_url');
      if (b && String(b).trim()) this._dsConfig.baseUrl = String(b).trim().replace(/\/+$/, '');
      var m = localStorage.getItem('cf_ai_model');
      if (m && String(m).trim()) this._dsConfig.model = String(m).trim();
    } catch (e) {}
  },

  saveApiConfig: function (keyInput, baseUrl, model) {
    try {
      var existing = '';
      try { existing = localStorage.getItem('cf_ai_api_key') || ''; } catch (e2) {}
      var key = (keyInput && String(keyInput).trim()) ? String(keyInput).trim() : existing;
      if (key) {
        localStorage.setItem('cf_ai_api_key', key);
        this._dsConfig.apiKey = key;
        window.__DEEPSEEK_API_KEY__ = key;
      } else {
        localStorage.removeItem('cf_ai_api_key');
        this._dsConfig.apiKey = '';
        try { window.__DEEPSEEK_API_KEY__ = ''; } catch (e3) {}
      }
      var bu = (baseUrl && String(baseUrl).trim()) ? String(baseUrl).trim().replace(/\/+$/, '') : '';
      if (bu) {
        localStorage.setItem('cf_ai_base_url', bu);
        this._dsConfig.baseUrl = bu;
      } else {
        localStorage.removeItem('cf_ai_base_url');
        this._dsConfig.baseUrl = 'https://api.deepseek.com';
      }
      var mo = (model && String(model).trim()) ? String(model).trim() : '';
      if (mo) {
        localStorage.setItem('cf_ai_model', mo);
        this._dsConfig.model = mo;
      } else {
        localStorage.removeItem('cf_ai_model');
        this._dsConfig.model = 'deepseek-chat';
      }
    } catch (e) {}
  },

  _onAiKeyFile: function (ev) {
    var f = ev.target.files && ev.target.files[0];
    if (!f) return;
    var self = this;
    var r = new FileReader();
    r.onload = function () {
      var t = String(r.result || '').replace(/\r/g, '\n').split(/\n/)[0].trim();
      var inp = document.getElementById('ai-cfg-key');
      if (inp) inp.value = t;
      if (typeof Toast !== 'undefined') Toast.info('已从文件读取密钥，请点「保存」生效');
    };
    r.readAsText(f);
    try { ev.target.value = ''; } catch (e) {}
  },

  testApiConnection: function () {
    var keyEl = document.getElementById('ai-cfg-key');
    var baseEl = document.getElementById('ai-cfg-base');
    var modelEl = document.getElementById('ai-cfg-model');
    if (!keyEl || !baseEl || !modelEl) return;
    var key = (keyEl.value || '').trim();
    if (!key) {
      try { key = localStorage.getItem('cf_ai_api_key') || ''; } catch (e) {}
    }
    if (!key && typeof CF_DEFAULT_AI_API_KEY === 'string') key = CF_DEFAULT_AI_API_KEY.trim();
    if (!key) {
      if (typeof Toast !== 'undefined') Toast.warn('请先填写 API Key');
      return;
    }
    var base = (baseEl.value || '').trim().replace(/\/+$/, '') || 'https://api.deepseek.com';
    var model = (modelEl.value || '').trim() || 'deepseek-chat';
    if (typeof Toast !== 'undefined') Toast.info('正在测试连接…');
    var self = this;
    fetch(base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 8,
      }),
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(t || String(r.status)); });
      return r.json();
    }).then(function () {
      if (typeof Toast !== 'undefined') Toast.success('连接成功，可保存配置');
    }).catch(function (err) {
      if (typeof Toast !== 'undefined') Toast.warn('失败：' + (err && err.message ? err.message : String(err)));
    });
  },

  openApiKeySettings: function () {
    if (typeof window.openModal !== 'function') {
      if (typeof Toast !== 'undefined') {
        Toast.warn('页面未就绪，请稍后重试');
      }
      return;
    }
    this.loadStoredApiConfig();
    var curKey = '';
    try { curKey = localStorage.getItem('cf_ai_api_key') || ''; } catch (e) {}
    var curBase = this._dsConfig.baseUrl || 'https://api.deepseek.com';
    var curModel = this._dsConfig.model || 'deepseek-chat';
    var activeKey = curKey || (this._dsConfig.apiKey || '');
    var masked = activeKey
      ? (curKey ? (activeKey.slice(0, 6) + '…' + activeKey.slice(-4)) : '产品内置默认（' + activeKey.slice(0, 6) + '…' + activeKey.slice(-4) + '）')
      : '未配置';
    var body =
      '<div class="form-group"><label>API Key</label>' +
      '<input type="password" class="form-input" id="ai-cfg-key" placeholder="sk-…" autocomplete="off" />' +
      '<p class="muted" style="font-size:11px;margin:6px 0 0;">当前生效：<strong>' + masked + '</strong> · 自定义密钥仅存本机 · 留空确认则保留当前生效密钥</p>' +
      '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">' +
      '<input type="file" id="ai-cfg-file" accept=".txt,.key,text/plain" style="display:none" />' +
      '<button type="button" class="btn btn-sm" id="ai-cfg-import">从文件导入</button>' +
      '<button type="button" class="btn btn-sm" id="ai-cfg-test">测试连接</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" id="ai-cfg-clear">清除本地密钥</button>' +
      '</div></div>' +
      '<div class="form-group"><label>Base URL（OpenAI 兼容）</label>' +
      '<input type="text" class="form-input" id="ai-cfg-base" value="' + String(curBase).replace(/"/g, '&quot;') + '" placeholder="https://api.deepseek.com" /></div>' +
      '<div class="form-group"><label>模型 ID</label>' +
      '<input type="text" class="form-input" id="ai-cfg-model" value="' + String(curModel).replace(/"/g, '&quot;') + '" placeholder="deepseek-chat" /></div>' +
      '<p class="muted" style="font-size:12px;line-height:1.55;margin:0;">保存后：密钥会随请求传给后端 <code>/api/agent/chat</code>（与服务器环境变量 <code>DEEPSEEK_API_KEY</code> 二选一），用于 DataAgent 完整推理；若后端仍不可用，协作区会回退为浏览器直连大模型。公网部署建议由后端代理以保护密钥。</p>';

    var self = this;
    window.openModal('AI 大模型 API', body, function () {
      var key = document.getElementById('ai-cfg-key').value.trim();
      var base = document.getElementById('ai-cfg-base').value.trim();
      var model = document.getElementById('ai-cfg-model').value.trim();
      self.saveApiConfig(key, base, model);
      window.closeModal();
      if (typeof Toast !== 'undefined') Toast.success('已保存');
    });

    setTimeout(function () {
      var imp = document.getElementById('ai-cfg-import');
      var fi = document.getElementById('ai-cfg-file');
      var tst = document.getElementById('ai-cfg-test');
      var clr = document.getElementById('ai-cfg-clear');
      if (fi && imp) {
        imp.addEventListener('click', function () { fi.click(); });
        fi.addEventListener('change', function (ev) { self._onAiKeyFile(ev); });
      }
      if (tst) tst.addEventListener('click', function () { self.testApiConnection(); });
      if (clr) {
        clr.addEventListener('click', function () {
          try {
            localStorage.removeItem('cf_ai_api_key');
            localStorage.removeItem('cf_ai_base_url');
            localStorage.removeItem('cf_ai_model');
          } catch (e) {}
          self.loadStoredApiConfig();
          window.closeModal();
          if (typeof Toast !== 'undefined') Toast.success('已清除本地自定义配置，恢复产品默认密钥');
        });
      }
    }, 0);
  },

  _history: [],
  _maxHistory: 10,

  _bodyEl: function () {
    return document.getElementById('copilot-messages') || document.getElementById('ai-body');
  },
  _inputEl: function () {
    return document.getElementById('copilot-input') || document.getElementById('ai-input');
  },
  _sendBtnEl: function () {
    return document.getElementById('copilot-send') || document.getElementById('ai-send-btn');
  },

  _parseAiPanelPx: function (shell) {
    var v = (getComputedStyle(shell).getPropertyValue('--ai-panel-w') || '').trim();
    var n = parseFloat(v);
    return isNaN(n) ? 440 : n;
  },

  /** 拖拽或窗口变化时更新右栏宽度（写入 --ai-panel-w 与 localStorage） */
  _applyAiPanelWidth: function (w) {
    var shell = document.getElementById('app-shell');
    if (!shell) return;
    var min = 260;
    var vw = window.innerWidth || document.documentElement.clientWidth || 1200;
    var max = Math.max(min, Math.min(720, vw - 300));
    w = Math.max(min, Math.min(max, Math.round(Number(w))));
    shell.style.setProperty('--ai-panel-w', w + 'px');
    try { localStorage.setItem('cf_ai_panel_w', String(w)); } catch (e) {}
  },

  _restoreAiPanelWidth: function () {
    var shell = document.getElementById('app-shell');
    if (!shell) return;
    var w = null;
    try {
      var s = localStorage.getItem('cf_ai_panel_w');
      if (s) w = parseInt(s, 10);
    } catch (e) {}
    if (w != null && !isNaN(w)) this._applyAiPanelWidth(w);
  },

  _resizeChartsAfterLayout: function (delay) {
    delay = typeof delay === 'number' ? delay : 400;
    setTimeout(function () {
      try {
        if (window.Charts && Charts._instances) {
          Object.keys(Charts._instances).forEach(function (k) {
            Charts._instances[k].resize();
          });
        }
      } catch (e) {}
    }, delay);
  },

  _initAiPanelResize: function () {
    var handle = document.getElementById('ai-resize-handle');
    var shell = document.getElementById('app-shell');
    if (!handle || !shell) return;
    var dragging = false;
    var startX = 0;
    var startW = 0;
    var self = this;
    function onMove(e) {
      if (!dragging) return;
      var w = startW - (e.clientX - startX);
      self._applyAiPanelWidth(w);
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      shell.classList.remove('ai-resizing');
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      self._resizeChartsAfterLayout(80);
    }
    handle.addEventListener('mousedown', function (e) {
      if (!shell.classList.contains('ai-open')) return;
      e.preventDefault();
      dragging = true;
      startX = e.clientX;
      var panel = document.getElementById('ai-panel');
      startW = panel ? panel.getBoundingClientRect().width : self._parseAiPanelPx(shell);
      shell.classList.add('ai-resizing');
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    var winResizeT;
    window.addEventListener('resize', function () {
      clearTimeout(winResizeT);
      winResizeT = setTimeout(function () {
        if (!shell.classList.contains('ai-open')) return;
        self._applyAiPanelWidth(self._parseAiPanelPx(shell));
      }, 120);
    });
  },

  /** 协作区消息内 [文字](cf-page:xxx) / [文字](cf-action:xxx) / 外链 的点击委托 */
  _bindCopilotMessageActions: function () {
    var body = document.getElementById('copilot-messages');
    if (!body || body._cfMsgBound) return;
    body._cfMsgBound = true;
    body.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-cf-page]');
      if (a) {
        e.preventDefault();
        var page = (a.getAttribute('data-cf-page') || '').replace(/[^a-z0-9_-]/gi, '');
        if (page) AI._exec({ action: 'navigate', page: page });
        return;
      }
      var btn = e.target.closest('button[data-cf-cmd]');
      if (btn) {
        e.preventDefault();
        var raw = btn.getAttribute('data-cf-cmd');
        if (!raw) return;
        try {
          var cmd = JSON.parse(decodeURIComponent(raw));
          AI._exec(cmd);
        } catch (err1) {
          try { AI._exec(JSON.parse(raw)); } catch (err2) {}
        }
      }
    });
  },

  init: function () {
    this.loadStoredApiConfig();
    this._restoreAiPanelWidth();
    this._initAiPanelResize();
    this._bindCopilotMessageActions();
    var floatBtn = document.getElementById('ai-float-toggle');
    if (floatBtn) {
      floatBtn.addEventListener('click', function () {
        AI.toggleDrawer(true);
        if (window.Copilot && Copilot.openTab) Copilot.openTab('chat');
      });
    }
    var closeBtn = document.getElementById('ai-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function () { AI.toggleDrawer(false); });
    var sendBtn = this._sendBtnEl();
    if (sendBtn) sendBtn.addEventListener('click', function () { AI.send(); });
    var inp = this._inputEl();
    if (inp) {
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); AI.send(); }
      });
    }
    var msgRoot = document.getElementById('copilot-messages');
    if (msgRoot) {
      msgRoot.addEventListener('click', function (ev) {
        var chip = ev.target && ev.target.closest ? ev.target.closest('.copilot-q-chip') : null;
        if (!chip || !msgRoot.contains(chip)) return;
        ev.preventDefault();
        var q = (chip.getAttribute('data-copilot-q') || chip.textContent || '').trim();
        if (!q) return;
        var ta = AI._inputEl();
        if (ta) {
          ta.value = q;
          ta.focus();
        }
        AI.send();
      });
    }
    try {
      var sp = new URLSearchParams(window.location.search || '');
      if (sp.get('ai') === '1') {
        setTimeout(function () {
          AI.toggleDrawer(true);
          if (window.Copilot && Copilot.openTab) Copilot.openTab('chat');
        }, 500);
      }
    } catch (e) {}
  },

  toggleDrawer: function (open) {
    var shell = document.getElementById('app-shell');
    if (open) {
      shell.classList.add('ai-open');
      this._applyAiPanelWidth(this._parseAiPanelPx(shell));
    } else {
      shell.classList.remove('ai-open');
    }
    this._resizeChartsAfterLayout(400);
  },

  _workbenchApiBase: function () {
    try {
      var sp = new URLSearchParams(window.location.search || '');
      var q = sp.get('workbenchApi');
      if (q) {
        var u = String(q).replace(/\/+$/, '');
        try { localStorage.setItem('cf_workbench_api', u); } catch (e) {}
        return u;
      }
      var ls = localStorage.getItem('cf_workbench_api');
      if (ls) return String(ls).replace(/\/+$/, '');
    } catch (e) {}
    return '';
  },

  _copilotAgentMode: function () {
    var sel = document.getElementById('copilot-agent-select');
    if (!sel) return 'data';
    var v = sel.value || 'data';
    if (v === 'prd') return 'prd';
    if (v === 'plan') return 'plan';
    return 'data';
  },

  send: async function () {
    var input = this._inputEl();
    if (!input) return;
    var msg = (input.value || '').trim();
    if (!msg) return;
    input.value = '';
    var welcomeEl = document.getElementById('copilot-welcome');
    if (welcomeEl) welcomeEl.remove();
    var priorHistory = this._history.slice();
    this._appendMsg(msg, 'user');
    this._history.push({ role: 'user', content: msg });
    this._setLoading(true);

    var wbBase = this._workbenchApiBase();
    try {
      if (wbBase) {
        try {
          var sess = (typeof window.__CF_WORKBENCH_SESSION__ === 'string' && window.__CF_WORKBENCH_SESSION__) ? window.__CF_WORKBENCH_SESSION__ : '';
          var wResp = await fetch(wbBase + '/api/workbench/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: msg,
              role: Auth.getRoleId(),
              history: priorHistory,
              session_id: sess || undefined,
              agent_mode: this._copilotAgentMode(),
            }),
          });
          if (!wResp.ok) {
            if (wResp.status === 404) try { window.__CF_WORKBENCH_SESSION__ = ''; } catch (e) {}
            throw new Error('workbench ' + wResp.status);
          }
          var wJson = await wResp.json();
          if (wJson.session_id) window.__CF_WORKBENCH_SESSION__ = wJson.session_id;
          this._onReply(wJson.reply || '(无回复)');
          this._setLoading(false);
          return;
        } catch (wbErr) {
          console.warn('Workbench 不可用，回退主服务 /api/agent/chat', wbErr);
        }
      }

      this.loadStoredApiConfig();
      var chatPayload = {
        message: msg,
        role: Auth.getRoleId(),
        history: priorHistory,
        system_prompt: this._buildBackendAgentContext(),
      };
      var dk = (this._dsConfig.apiKey || '').trim();
      if (dk) chatPayload.deepseek_api_key = dk;
      var resp = await API.post('/api/agent/chat', chatPayload);
      var reply = resp.reply || '(无回复)';
      this._onReply(reply, resp.trace);
    } catch (_backendErr) {
      try {
        var dsReply = await this._callDeepSeek(msg);
        this._onReply(dsReply);
      } catch (_dsErr) {
        console.warn('DataAgent fallback chain:', _backendErr, _dsErr);
        var fallback = this._localFallback(msg);
        this._onReply(fallback);
      }
    }

    this._setLoading(false);
  },

  _onReply: function (text, trace) {
    var display = text || '';
    if (trace && trace.length) {
      var names = [];
      trace.forEach(function (t) {
        if (t && t.phase === 'tool' && t.title) names.push(String(t.title).replace(/^工具 · /, ''));
      });
      if (names.length) {
        display += '\n\n---\n*服务端 LangChain 工具：* ' + names.join(' → ');
      }
    }
    this._appendMsg(display, 'assistant');
    this._history.push({ role: 'assistant', content: text || '' });
    if (this._history.length > this._maxHistory * 2) {
      this._history = this._history.slice(-this._maxHistory * 2);
    }
    this._parseCommands(text || '');
  },

  _buildSystemPrompt: function () {
    var s = AppData.stats || {};
    var role = Auth.getCurrentRole();
    var plans = AppData.plans || [];
    var alerts = (AppData.alertQueue || []).filter(function (a) { return a.status === '待处理'; });
    var health = AppData.systemHealth || {};
    var kpi = AppData.closedLoopKPI || {};

    var healthSummary = Object.keys(health).map(function (k) {
      return health[k].name + ':' + health[k].status;
    }).join(', ');

    var planSummary = plans.slice(0, 5).map(function (p) {
      return p.unit + ' ' + p.period_label + '(' + p.status + ')';
    }).join('; ');

    var alertSummary = alerts.slice(0, 3).map(function (a) {
      return a.title;
    }).join('; ');

    return [
      '你是 **DataAgent（数据智能体）**，服务于亿流科技「现金流预测 Agent」。你根据系统注入的实时数据回答问数类问题，并可通过 JSON 指令操作前端。产品定位与对外演讲一致：现金流事件 → 现金流预测 → 风险识别 → Agent 执行。',
      '',
      '## 交互范式（必须遵守）',
      '1. **自然语言优先**：用多轮对话完成用户目标，**不要**假设用户会点击固定菜单；侧栏已取消「快捷按钮」，一切从用户自然语言出发。',
      '2. **单步引导**：**每轮只推进当前一步**，正文宜短（约 120～220 字，追问更短）。**禁止**一次列出「第一步、第二步…」全套；**禁止**同时铺陈全景数据 + 全部缺口 + 所有选项。用户通过 **在对话里回复「确认」「继续」或选项** 进入下一步即可。',
      '3. **Agent 自动执行，用户不点主台**：意图已明确时，你必须在**同一条回复内**完成自动执行——服务端用 Function Calling / 浏览器侧用回复末 ```json```；**禁止**写「请到某某页点击某某按钮」。仅 **本地上传文件**、**必须在表单里手填的字段** 才请用户动手，可辅以 `navigate` 打开页面。',
      '4. **需要用户确认或二选一时，用可点击按钮，不要依赖打字**：在回复**末尾**附加 ```user-choices``` 代码块（JSON 数组，见 AgentLoop 附录）。每项含 `label` 与 `cmd`（与 ```json``` 指令同款，如 api_post、toast）。侧栏会渲染为按钮；**禁止**仅用「请回复确认」「请回复启用或禁用」而无按钮。高风险步（批量确认、`force_override`、删除/禁用、多草稿选一）仍只问一句，但**必须**附 user-choices。',
      '5. **利用对话记忆**：必须结合本轮之前的历史消息；已说过的口径、已展示过的统计**不要重复排版**，只补充新信息、新一步或下一个追问。',
      '6. **缺数时短说**：若数据不足以预测/分析，本轮**只强调最关键的一条缺口** + 一种补数方式（必要时再追问）；需要补文件时 navigate 到 **数据整合**，需要补确认时 navigate 到 **现金流事件**，并附 JSON。',
      '7. **人工审核提示**：敏感操作执行后用一句话提醒「主台可复核」即可，**不要**展开教程。',
      '8. **分步推进**：多轮任务每轮**一步**；但**每一步在对话内自动执行工具**，不要把「整段操作说明」当成一步。',
      '',
      '当前用户角色: ' + (role ? role.name + '（' + role.id + '）' : '未知'),
      '当前用户可访问页面: ' + (role ? role.pages.join(', ') : '无'),
      '',
      '## 实时业务数据',
      '- 净头寸: ' + _fmtWan(s.net_position),
      '- 总流入: ' + _fmtWan(s.total_inflow) + '（已确认 ' + (s.confirmed || 0) + ' 笔）',
      '- 总流出: ' + _fmtWan(s.total_outflow) + '（预测 ' + (s.predicted || 0) + ' 笔，未确认 ' + (s.unconfirmed || 0) + ' 笔，待审核 ' + (s.pending_review || 0) + ' 笔）',
      '- 资金流记录: ' + (s.record_count || 0) + ' 笔',
      '- 资金计划: ' + plans.length + ' 个（' + planSummary + '）',
      '- 待处理预警: ' + alerts.length + ' 条' + (alertSummary ? '（' + alertSummary + '）' : ''),
      '- 闭环KPI: 偏差收敛' + (kpi.deviation_converge_months || '-') + '月, 预警处理' + (kpi.alert_handle_avg_hours || '-') + 'h, AI采纳率' + ((kpi.ai_adopt_rate || 0) * 100).toFixed(0) + '%',
      '- 系统健康: ' + healthSummary,
      '',
      '## 你可以执行的操作指令',
      '在回复中用 ```json 代码块包裹 JSON 指令，系统会自动执行：',
      '',
      '| 操作 | 指令格式 | 说明 |',
      '|------|---------|------|',
      '| 跳转页面 | {"action":"navigate","page":"dashboard"} | 可选: dashboard/cashflow/analysis/liquidity/basedata/integration |',
      '| 运行分析 | {"action":"run_analysis"} | 自动跳转到分析页并点击运行 |',
      '| 刷新看板 | {"action":"refresh_dashboard"} | 刷新Dashboard数据 |',
      '| 批量确认 | {"action":"batch_confirm"} | **须用户先在对话明确同意**后再输出 |',
      '| 导出数据 | {"action":"export_csv"} | 导出当前资金流为CSV |',
      '| 新建计划 | {"action":"new_plan"} | 打开新建计划弹窗 |',
      '| 获取数据 | {"action":"fetch_data"} | 自动点「一键获取」（默认口径）；需自选条件时请用户点「选项获取」 |',
      '| 提示消息 | {"action":"toast","type":"success","message":"xxx"} | type: success/info/warn |',
      '',
      '## 重要规则',
      '1. 用中文回复，排版清晰；可用 **加粗** 与短列表；可用 ## 小节标题。**避免**在同一轮里用多个 ## 堆满「全流程教程」。',
      '2. 用户请求「跳转/同步/跑分析/刷新」等可自动化操作时：**先输出 JSON 自动执行**，正文可仅一行说明；cf-page 链接只是补充，**不能**代替 JSON。',
      '3. 当用户问数据相关问题，引用上面的实时数据回答；若数据不足，本轮**只写一条**最关键缺口与对应动作（+ JSON），下一轮流再展开。',
      '4. 在正文中可写 Markdown 链接（前端会渲染为可点击）：',
      '   - 站内：[现金流分析](cf-page:analysis)、[现金流事件](cf-page:cashflow)、[总览看板](cf-page:dashboard)、[现金流预测](cf-page:liquidity)、[数据整合](cf-page:integration)',
      '   - 操作：[重新运行分析](cf-action:run_analysis)、[导出 CSV](cf-action:export_csv)、[批量确认](cf-action:batch_confirm)',
      '   - 外链：[说明](https://example.com)',
      '5. 分析/预测类回答在需要复核时**最多**附 1 个站内链接即可，不要链接轰炸。',
      '6. 默认单次回复保持精炼；复杂任务**必须**多轮完成，**不要**用一轮长文替代多轮。',
      '7. 当用户说"你好"或打招呼，用 2～3 句简介能力 + 问一个具体目标即可，**不要**贴完整能力清单。',
      (typeof window !== 'undefined' && window.AgentLoop && typeof window.AgentLoop.getSystemPromptAppend === 'function')
        ? window.AgentLoop.getSystemPromptAppend()
        : '',
    ].join('\n');
  },

  /**
   * 供 POST /api/agent/chat 注入。后端会将 agent_core.SYSTEM_PROMPT（LangChain 工具）与此段 **合并**，
   * 不可再传完整 _buildSystemPrompt()，否则会稀释 Function Calling。
   */
  _buildBackendAgentContext: function () {
    var s = AppData.stats || {};
    var role = Auth.getCurrentRole();
    var plans = AppData.plans || [];
    var alerts = (AppData.alertQueue || []).filter(function (a) { return a.status === '待处理'; });
    var health = AppData.systemHealth || {};
    var kpi = AppData.closedLoopKPI || {};
    var healthSummary = Object.keys(health).map(function (k) {
      return health[k].name + ':' + health[k].status;
    }).join(', ');
    var planSummary = plans.slice(0, 5).map(function (p) {
      return p.unit + ' ' + p.period_label + '(' + p.status + ')';
    }).join('; ');
    var alertSummary = alerts.slice(0, 3).map(function (a) { return a.title; }).join('; ');
    return [
      '以下为浏览器侧缓存，**可能与数据库有秒级延迟**；回答问数/预测/计划等问题时，**必须以服务端 Function Calling 工具结果为准**。',
      '',
      '## 侧栏交互模式（必读）',
      '- **一步一步**：每轮只推进当前一步，短句说明「现在做什么」即可。',
      '- **用户用侧栏按钮表态，不要强依赖打字**：需要确认、同意、或 A/B 选择时，在回复末附 ```user-choices``` JSON 数组（每项 `label` + `cmd`），浏览器会渲染为可点击按钮。仍可用 `[文字](cf-action:run_analysis)` 等内联快捷；**不要**只写「请回复确认」而不给按钮。',
      '- **由 Agent 自动执行**：能调用的服务端工具立即 tool_calls；需要驱动浏览器时由你在回复末附 ```json``` 自动执行。**用户不应**为了完成该步自己去主台点菜单。',
      '',
      '当前用户角色: ' + (role ? role.name + '（' + role.id + '）' : '未知'),
      '可访问页面: ' + (role ? role.pages.join(', ') : '无'),
      '',
      '## 实时业务数据（浏览器缓存）',
      '- 净头寸: ' + _fmtWan(s.net_position),
      '- 总流入: ' + _fmtWan(s.total_inflow) + '（已确认 ' + (s.confirmed || 0) + ' 笔）',
      '- 总流出: ' + _fmtWan(s.total_outflow) + '（预测 ' + (s.predicted || 0) + ' 笔，未确认 ' + (s.unconfirmed || 0) + ' 笔，待审核 ' + (s.pending_review || 0) + ' 笔）',
      '- 资金流记录: ' + (s.record_count || 0) + ' 笔',
      '- 资金计划: ' + plans.length + ' 个（' + planSummary + '）',
      '- 待处理预警: ' + alerts.length + ' 条' + (alertSummary ? '（' + alertSummary + '）' : ''),
      '- 闭环KPI: 偏差收敛' + (kpi.deviation_converge_months || '-') + '月, 预警处理' + (kpi.alert_handle_avg_hours || '-') + 'h, AI采纳率' + ((kpi.ai_adopt_rate || 0) * 100).toFixed(0) + '%',
      '- 系统健康: ' + healthSummary,
      '',
      '## 浏览器自动化（补充）',
      '仅在需要驱动本机页面/按钮时，可在回复末附 ```json```；**不得**用 JSON 代替服务端工具。',
      (typeof window !== 'undefined' && window.AgentLoop && typeof window.AgentLoop.getSystemPromptAppend === 'function')
        ? window.AgentLoop.getSystemPromptAppend()
        : '',
    ].join('\n');
  },

  _callDeepSeek: async function () {
    var cfg = this._dsConfig;
    if (!cfg.apiKey) {
      throw new Error('未配置 __DEEPSEEK_API_KEY__，且后端不可用');
    }
    var messages = [{ role: 'system', content: this._buildSystemPrompt() }];

    this._history.forEach(function (h) {
      messages.push({ role: h.role, content: h.content });
    });

    var resp = await fetch(cfg.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + cfg.apiKey,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1024,
        stream: false,
      }),
    });

    if (!resp.ok) {
      var errText = '';
      try { errText = await resp.text(); } catch (_) {}
      throw new Error('DeepSeek API ' + resp.status + ': ' + errText);
    }

    var data = await resp.json();
    var choice = data.choices && data.choices[0];
    if (!choice || !choice.message || !choice.message.content) {
      throw new Error('DeepSeek 返回格式异常');
    }
    return choice.message.content;
  },

  /** 现金流分析页「AI 报告」专用系统提示（与协作区人设分离） */
  ANALYSIS_REPORT_SYSTEM_PROMPT:
    '你是资深司库资金分析师。用户将提供一段「现金流分析 / 计划 vs 实际分析」的 JSON 摘要（含头寸、期间、单位等）。\n' +
    '请用中文撰写 2～4 段解读：可使用 ## 小节标题与 **加粗**；可含 Markdown 列表。\n' +
    '必须严格基于摘要中的数字与时段表述，不要编造未出现的金额或单位。\n' +
    '不要输出 JSON、不要输出 ``` 代码围栏；不要输出 ```json 指令块。\n' +
    '字数控制在 450 字内。可在文末用 [打开现金流事件](cf-page:cashflow) 引导核对单据。',

  /** 现金流预测页「风险预警」区块：基于 mvp-forecast 返回摘要生成解读 */
  LIQUIDITY_RISK_ALERT_SYSTEM_PROMPT:
    '你是资深司库流动性风险助手。用户将提供「滚动日余额预测」结果的 JSON 摘要（含警戒线、区间最低/最高、预警样本、关键日抽样、月度尾部汇总、引擎 method_note 等）。\n' +
    '请用中文撰写**充实、可核对**的解读（总字数约 380～520 字），必须显式引用摘要中的数字与日期，避免空泛套话。\n' +
    '请按以下结构输出（使用 ## 二级标题），每节都要落到具体数据：\n' +
    '## 流动性结论 — 结合「区间最低/最高」「警戒线」「预警样本天数」「预测起止日期」说明是否触警、安全边际大致如何。\n' +
    '## 预测与模型 — 简述 growth、历史月数；**逐句转述 method_note** 中关于选参/网格/MAPE 等要点（若摘要中有），说明不确定性来源。\n' +
    '## 审慎建议 — 用无序列表写 2～4 条可执行建议（滚动复核、压力情景、多模型对照、关注关键日抽样等），可与摘要中的 key_nodes_sample / monthly_summary_tail 呼应。\n' +
    '若 alert_days_in_sample > 0：结合 alert_sample_dates 提示关注时段与头寸安排。\n' +
    '若 alert_days_in_sample 为 0：说明未触警时仍要关注模型误差与极端情景。\n' +
    '可使用 **加粗** 标注关键金额与比例；不要编造摘要中未出现的数字或单位。\n' +
    '预警天数样本最多为引擎返回条数（可能截断），勿臆测总天数。\n' +
    '不要输出 JSON、不要输出 ``` 代码围栏；不要输出 ```json 指令块。\n' +
    '不要写成具体投资建议或承诺收益。',

  /**
   * 单次对话（不写入亿流 Work 历史），用于分析页嵌入报告等。
   * 优先 POST /api/agent/chat，失败则浏览器直连 DeepSeek（需密钥）。
   */
  chatCompletionOneShot: async function (systemPrompt, userMessage, opts) {
    opts = opts || {};
    var maxTok = opts.max_tokens != null ? Math.min(4096, Math.max(256, Number(opts.max_tokens))) : 1024;
    this.loadStoredApiConfig();
    var sys = String(systemPrompt || '').trim();
    var usr = String(userMessage || '').trim();
    if (!usr) throw new Error('empty message');
    try {
      var chatPayload = {
        message: usr,
        role: typeof Auth !== 'undefined' && Auth.getRoleId ? Auth.getRoleId() : 'treasurer',
        history: [],
        system_prompt: sys,
      };
      var dk = (this._dsConfig.apiKey || '').trim();
      if (dk) chatPayload.deepseek_api_key = dk;
      var resp = await API.post('/api/agent/chat', chatPayload);
      var reply = resp && resp.reply ? String(resp.reply).trim() : '';
      if (reply) return reply;
    } catch (e) {
      console.warn('chatCompletionOneShot /api/agent/chat', e);
    }
    var cfg = this._dsConfig;
    if (!cfg.apiKey || !String(cfg.apiKey).trim()) {
      throw new Error('NO_AI_KEY');
    }
    var resp = await fetch(cfg.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + cfg.apiKey,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: 'system', content: sys || '你是资金分析师，用中文简洁回答。' },
          { role: 'user', content: usr },
        ],
        temperature: 0.65,
        max_tokens: maxTok,
        stream: false,
      }),
    });
    if (!resp.ok) {
      var errText = '';
      try { errText = await resp.text(); } catch (_) {}
      throw new Error('DeepSeek ' + resp.status + ': ' + errText);
    }
    var data = await resp.json();
    var choice = data.choices && data.choices[0];
    if (!choice || !choice.message || !choice.message.content) {
      throw new Error('DeepSeek 返回格式异常');
    }
    return String(choice.message.content).trim();
  },

  /** 将 Markdown 转为 HTML（与协作区一致，不含协作区后处理） */
  renderMarkdown: function (text) {
    return this._renderMarkdown(text);
  },

  /** 与协作区相同：消息内 [文字](cf-page:xxx) / cf-action 点击 */
  bindInlineLinks: function (rootEl) {
    if (!rootEl || rootEl._cfAnReportBound) return;
    rootEl._cfAnReportBound = true;
    rootEl.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-cf-page]');
      if (a) {
        e.preventDefault();
        var page = (a.getAttribute('data-cf-page') || '').replace(/[^a-z0-9_-]/gi, '');
        if (page && typeof Router !== 'undefined' && Router.navigate) Router.navigate(page);
        return;
      }
      var btn = e.target.closest('button[data-cf-cmd]');
      if (btn) {
        e.preventDefault();
        var raw = btn.getAttribute('data-cf-cmd');
        if (!raw) return;
        try {
          var cmd = JSON.parse(decodeURIComponent(raw));
          if (typeof AI !== 'undefined' && AI._exec) AI._exec(cmd);
        } catch (err1) {
          try {
            if (typeof AI !== 'undefined' && AI._exec) AI._exec(JSON.parse(raw));
          } catch (err2) {}
        }
      }
    });
  },

  _localFallback: function (msg) {
    var s = AppData.stats || {};
    var lm = msg.toLowerCase();

    if (lm.indexOf('头寸') !== -1 || lm.indexOf('余额') !== -1 || lm.indexOf('position') !== -1) {
      return '**当前资金概况**\n- 净头寸: ' + _fmtWan(s.net_position) + '\n- 总流入: ' + _fmtWan(s.total_inflow) + '\n- 总流出: ' + _fmtWan(s.total_outflow) + '\n- 记录: ' + (s.record_count || 0) + ' 笔（已确认 ' + (s.confirmed || 0) + ' / 预测 ' + (s.predicted || 0) + '）\n```json\n{"action":"navigate","page":"dashboard"}\n```';
    }
    if (lm.indexOf('外汇') !== -1 || lm.indexOf('敞口') !== -1 || lm.indexOf('fx') !== -1) {
      return '当前版本已**下线外汇敞口独立页面**。若需汇率相关分析，请到**现金流分析**或**总览看板**查看多币种资金流。\n```json\n{"action":"navigate","page":"analysis"}\n```';
    }
    if (lm.indexOf('分析') !== -1 || lm.indexOf('预测') !== -1 || lm.indexOf('运行') !== -1) {
      return '## 现金流分析\n\n正在为您**运行分析**（复合区间），稍后在主台图表中查看走势。\n\n**快捷操作** [打开现金流分析页](cf-page:analysis) · [重新运行](cf-action:run_analysis)\n\n```json\n{"action":"run_analysis"}\n```';
    }
    if (lm.indexOf('确认') !== -1 && (lm.indexOf('资金') !== -1 || lm.indexOf('批量') !== -1)) {
      return '正在为您**批量确认**未确认的资金流记录...\n```json\n{"action":"batch_confirm"}\n```';
    }
    if (lm.indexOf('导出') !== -1 || lm.indexOf('export') !== -1) {
      return '正在为您**导出资金流数据**...\n```json\n{"action":"export_csv"}\n```';
    }
    if (lm.indexOf('计划') !== -1 || lm.indexOf('plan') !== -1) {
      var plans = AppData.plans || [];
      return '## 资金计划状态汇总\n\n**资金计划**（共 ' + plans.length + ' 个）\n' + plans.slice(0, 5).map(function (p) { return '- ' + p.unit + ' ' + p.period_label + '（' + p.status + '）'; }).join('\n') + '\n\n**快捷操作** [打开资金计划](cf-page:plan)\n\n```json\n{"action":"navigate","page":"plan"}\n```';
    }
    if (lm.indexOf('流入') !== -1 || lm.indexOf('流出') !== -1 || lm.indexOf('资金流') !== -1) {
      return '**现金流概况**\n- 总流入: ' + _fmtWan(s.total_inflow) + '\n- 总流出: ' + _fmtWan(s.total_outflow) + '\n\n跳转到现金流事件页。\n```json\n{"action":"navigate","page":"cashflow"}\n```';
    }
    if (lm.indexOf('看板') !== -1 || lm.indexOf('概览') !== -1 || lm.indexOf('总览') !== -1 || lm.indexOf('dashboard') !== -1) {
      return '为您跳转到**总览看板**。\n```json\n{"action":"navigate","page":"dashboard"}\n```';
    }
    if (lm.indexOf('刷新') !== -1) {
      return '正在为您**刷新数据**...\n```json\n{"action":"refresh_dashboard"}\n```';
    }
    if (lm.indexOf('获取') !== -1 && lm.indexOf('数据') !== -1) {
      return '正在从集成系统**获取数据**...\n```json\n{"action":"fetch_data"}\n```';
    }
    if (lm.indexOf('帮助') !== -1 || lm.indexOf('help') !== -1 || lm.indexOf('你能') !== -1 || lm.indexOf('你会') !== -1) {
      return '**DataAgent（自然语言 + 工具）** 可协助：\n- 用对话澄清预测口径与期间，缺数时引导您去 **数据整合** 上传或 **现金流事件** 确认\n- 通过 JSON 指令 **跳转页面、运行分析、批量确认、导出**\n- 提醒您在 **现金流分析 / 现金流预测** 等页 **人工核对** 后再决策\n\n可直接说目标，例如：**「做未来90天总部流动性预测，数据不够请告诉我怎么补」**。';
    }

    return '收到。请用**自然语言**说明目标（主体、时间、预测类型）。若缺数据，我会提示您到 **数据整合** 补传或在 **现金流事件** 确认；当前为**离线模式**时能力受限，可配置 API 或连接后端以启用完整工具调用。\n\n也可先说：「帮我看头寸」或「打开现金流预测」。';
  },

  /** 将 GFM 风格管道表格转为 HTML（单元格内已转义） */
  _markdownTableToHtml: function (rows) {
    var cellRich = function (s) {
      s = String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
      return s;
    };
    var splitRow = function (line) {
      var p = line.trim().split('|');
      if (p.length && p[0].trim() === '') p.shift();
      if (p.length && p[p.length - 1].trim() === '') p.pop();
      return p.map(function (x) { return x.trim(); });
    };
    var isSep = function (line) {
      var cells = splitRow(line);
      return (
        cells.length > 0 &&
        cells.every(function (c) {
          return /^[\s\-:]+$/.test(c);
        })
      );
    };
    if (!rows || rows.length < 2) return '';
    var header = splitRow(rows[0]);
    var dataStart = 1;
    if (rows.length > 1 && isSep(rows[1])) dataStart = 2;
    var body = rows.slice(dataStart).filter(function (r) {
      return !isSep(r);
    });
    var hLen = header.length;
    if (hLen === 0) return '';
    var sb =
      '<div class="ai-md-table-wrap"><table class="ai-md-table"><thead><tr>';
    header.forEach(function (h) {
      sb += '<th>' + cellRich(h) + '</th>';
    });
    sb += '</tr></thead><tbody>';
    body.forEach(function (r) {
      var cells = splitRow(r);
      sb += '<tr>';
      for (var c = 0; c < hLen; c++) {
        sb += '<td>' + cellRich(cells[c] !== undefined ? cells[c] : '') + '</td>';
      }
      sb += '</tr>';
    });
    sb += '</tbody></table></div>';
    return sb;
  },

  /**
   * 提取 Markdown 表格块（支持行首带列表符 `- ` 的误格式，会先剥离再识别）
   * 返回 { text: 带占位符的正文, tables: HTML 片段数组 }
   */
  /**
   * 从助手原文中提取 ```user-choices ...```，渲染为侧栏按钮（data-cf-cmd → AI._exec）
   */
  _extractUserChoiceBlocks: function (text) {
    var choices = [];
    var clean = String(text || '').replace(/```user-choices\s*\n([\s\S]*?)```/gi, function (_m, inner) {
      try {
        var arr = JSON.parse(inner.trim());
        if (Array.isArray(arr)) {
          arr.forEach(function (item) {
            if (item && item.label && item.cmd && item.cmd.action) {
              choices.push({ label: String(item.label), cmd: item.cmd });
            }
          });
        }
      } catch (e) {}
      return '';
    });
    clean = clean.replace(/\n{3,}/g, '\n\n').trim();
    return { text: clean, choices: choices };
  },

  _renderChoiceBar: function (choices) {
    var esc = function (s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;');
    };
    var sb = '<div class="ai-choice-bar" role="group" aria-label="快捷操作">';
    choices.forEach(function (c) {
      try {
        var cmdStr = encodeURIComponent(JSON.stringify(c.cmd));
        sb += '<button type="button" class="ai-inline-btn ai-choice-btn" data-cf-cmd="' + cmdStr + '">' + esc(c.label) + '</button>';
      } catch (e) {}
    });
    sb += '</div>';
    return sb;
  },

  _extractMarkdownTables: function (text) {
    var self = this;
    var tables = [];
    var lines = text.split(/\r?\n/);
    var out = [];
    var i = 0;
    while (i < lines.length) {
      var raw = lines[i];
      var stripped = raw.replace(/^\s*[-*]\s+/, '').trim();
      if (stripped.indexOf('|') !== -1 && /^\|/.test(stripped)) {
        var block = [];
        var j = i;
        while (j < lines.length) {
          var L = lines[j].replace(/^\s*[-*]\s+/, '').trim();
          if (L.indexOf('|') !== -1 && /^\|/.test(L)) {
            block.push(L);
            j++;
          } else break;
        }
        if (block.length >= 2) {
          tables.push(self._markdownTableToHtml(block));
          out.push('\uE010TBL' + (tables.length - 1) + '\uE011');
          i = j;
          continue;
        }
      }
      out.push(raw);
      i++;
    }
    return { text: out.join('\n'), tables: tables };
  },

  _renderMarkdown: function (text) {
    var clean = text.replace(/```json[\s\S]*?```/g, '').trim();
    if (!clean) clean = text;

    var links = [];
    clean = clean.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (match, label, url) {
      var i = links.length;
      links.push({ label: label, url: url.trim() });
      return '\uE000' + i + '\uE001';
    });

    var tabEx = this._extractMarkdownTables(clean);
    clean = tabEx.text;
    var mdTables = tabEx.tables;

    var html = clean
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^### (.+)$/gm, '<div class="ai-h3">$1</div>')
      .replace(/^## (.+)$/gm, '<div class="ai-h2">$1</div>')
      .replace(/\n/g, '<br>');

    html = html.replace(/((?:<br>)?- .+(?:<br>- .+)*)/g, function (block) {
      var items = block.split('<br>').filter(function (l) { return l.trim(); });
      return '<ul class="ai-list">' + items.map(function (item) {
        return '<li>' + item.replace(/^-\s*/, '').trim() + '</li>';
      }).join('') + '</ul>';
    });

    html = html.replace(/((?:<br>)?• .+(?:<br>• .+)*)/g, function (block) {
      var items = block.split('<br>').filter(function (l) { return l.trim(); });
      return '<ul class="ai-list">' + items.map(function (item) {
        return '<li>' + item.replace(/^•\s*/, '').trim() + '</li>';
      }).join('') + '</ul>';
    });

    html = html.replace(/<br><br>/g, '<br>');
    html = html.replace(/^<br>/, '').replace(/<br>$/, '');

    html = html.replace(/\uE010TBL(\d+)\uE011/g, function (m, num) {
      var idx = parseInt(num, 10);
      return mdTables[idx] || '';
    });

    html = html.replace(/\uE000(\d+)\uE001/g, function (m, numStr) {
      var ph = links[parseInt(numStr, 10)];
      if (!ph) return '';
      var labelEsc = ph.label
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      var u = ph.url;
      if (/^cf-page:/i.test(u)) {
        var page = u.slice(8).replace(/[^a-z0-9_-]/gi, '');
        return '<a href="#" class="ai-inline-link" data-cf-page="' + page + '">' + labelEsc + '</a>';
      }
      if (/^cf-action:/i.test(u)) {
        var act = u.slice(10).replace(/[^a-z0-9_]/gi, '');
        var cmd = JSON.stringify({ action: act });
        return '<button type="button" class="ai-inline-btn" data-cf-cmd="' + encodeURIComponent(cmd) + '">' + labelEsc + '</button>';
      }
      if (/^https?:\/\//i.test(u)) {
        var safe = u.replace(/[\s"'<>`]/g, '');
        return '<a href="' + safe.replace(/"/g, '&quot;') + '" class="ai-inline-link ai-inline-link-ext" target="_blank" rel="noopener noreferrer">' + labelEsc + '</a>';
      }
      return '<span class="ai-inline-muted">' + labelEsc + '</span>';
    });

    return html;
  },

  /** 协作区：关键金额与趋势词高亮（在 Markdown 生成之后执行） */
  _postprocessCopilotHtml: function (html) {
    if (!html) return html;
    try {
      html = html.replace(/(\d+(?:,\d{3})*(?:\.\d+)?[亿万](?:元)?)/g, '<span class="ai-kpi">$1</span>');
      html = html.replace(/(上升|增长|回升|走高|扩大|攀升)/g, '<span class="ai-trend ai-trend-up">$1</span>');
      html = html.replace(/(下降|回落|收窄|走低|减少|下滑)/g, '<span class="ai-trend ai-trend-down">$1</span>');
      html = this._postprocessCopilotHeadings(html);
    } catch (e) {}
    return html;
  },

  /** 协作区：## 标题略加强调，便于扫读 */
  _postprocessCopilotHeadings: function (html) {
    if (!html || html.indexOf('ai-h2') === -1) return html;
    return html.replace(/<div class="ai-h2">/g, '<div class="ai-h2 copilot-md-h2">');
  },

  /** 协作区：助手回复是否叠加「数据快照」可视化（问数/概况类） */
  _shouldShowCopilotSnapshot: function (rawText) {
    if (!rawText || typeof AppData === 'undefined' || !AppData.stats) return false;
    var t = String(rawText);
    return /净头寸|总流入|总流出|资金概况|现金流概况|待处理预警|资金计划/.test(t);
  },

  /** 与快照重复时去掉纯文本列表，避免同一屏堆两遍数字 */
  _stripRedundantCopilotStatsMarkdown: function (text) {
    var t = String(text);
    var orig = t;
    t = t.replace(/\*\*当前资金概况\*\*\s*\n(?:[-•][^\n]+\n)+/m, '');
    t = t.replace(/\*\*现金流概况\*\*\s*\n(?:[-•][^\n]+\n)+/m, '');
    if (t.replace(/\s/g, '').length < 35 && orig.replace(/\s/g, '').length > 70) return orig;
    return t;
  },

  _copilotVizSeq: 0,

  /**
   * 协作区：数据快照（ECharts 双图 + 规范卡片；无 echarts 时 CSS 回退）
   */
  _buildCopilotSnapshotHtml: function () {
    try {
      var s = AppData.stats || {};
      var inf = Number(s.total_inflow) || 0;
      var outf = Number(s.total_outflow) || 0;
      var net = Number(s.net_position);
      if (isNaN(net)) net = inf - outf;
      var sum = inf + outf;
      var pin = sum > 0 ? (inf / sum) * 100 : 50;
      var plans = AppData.plans || [];
      var alertAll = AppData.alertQueue || [];
      var pending = alertAll.filter(function (a) {
        return a.status === '待处理';
      });
      this._copilotVizSeq = (this._copilotVizSeq || 0) + 1;
      var vid = this._copilotVizSeq;
      var esc = function (x) {
        return String(x == null ? '' : x)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/"/g, '&quot;');
      };
      var netClass = net >= 0 ? 'copilot-viz-net--pos' : 'copilot-viz-net--neg';
      var netStr = _fmtWan(net);
      var alertsHtml =
        pending.length === 0
          ? '<span class="copilot-viz-badge copilot-viz-badge--ok"><span class="copilot-viz-badge-ico" aria-hidden="true">✓</span>预警 0 条</span>'
          : '<span class="copilot-viz-badge copilot-viz-badge--warn"><span class="copilot-viz-badge-ico" aria-hidden="true">!</span>待处理 ' +
            pending.length +
            ' 条</span>';

      var planChips = '';
      var nShow = Math.min(3, plans.length);
      for (var i = 0; i < nShow; i++) {
        var p = plans[i];
        var u = esc(String(p.unit || '').slice(0, 16));
        var st = String(p.status || '');
        var cls = 'copilot-viz-plan';
        if (/执行|生效|已批|进行中/.test(st)) cls += ' copilot-viz-plan--run';
        else if (/草稿|编制|待审/.test(st)) cls += ' copilot-viz-plan--draft';
        else cls += ' copilot-viz-plan--other';
        planChips +=
          '<li class="' +
          cls +
          '" title="' +
          esc(st) +
          '"><span class="copilot-viz-plan-dot" aria-hidden="true"></span><span class="copilot-viz-plan-txt">' +
          u +
          '</span></li>';
      }
      var planMore =
        plans.length > 3
          ? '<li class="copilot-viz-plan copilot-viz-plan--more" title="更多计划"><span>+' + (plans.length - 3) + '</span></li>'
          : '';

      var barFallback =
        sum > 0
          ? '<div class="copilot-viz-flow" role="img" aria-hidden="true"><div class="copilot-viz-flow-track"><span class="copilot-viz-flow-in" style="width:' +
            pin.toFixed(2) +
            '%"></span><span class="copilot-viz-flow-out" style="width:' +
            (100 - pin).toFixed(2) +
            '%"></span></div><div class="copilot-viz-flow-legend"><span class="copilot-viz-flow-legend-in">流入 ' +
            esc(_fmtWan(inf)) +
            '</span><span class="copilot-viz-flow-legend-out">流出 ' +
            esc(_fmtWan(outf)) +
            '</span></div></div>'
          : '<div class="copilot-viz-flow copilot-viz-flow--empty">暂无流入/流出分项</div>';

      var chartIoId = 'cfCopilotChartIO_' + vid;
      var chartPlId = 'cfCopilotChartPL_' + vid;

      return (
        '<div class="copilot-viz-snapshot copilot-viz-snapshot--pro" role="region" aria-label="数据快照" data-copilot-viz-root="1" data-viz-id="' +
        vid +
        '" data-io-in="' +
        inf +
        '" data-io-out="' +
        outf +
        '">' +
        '<div class="copilot-viz-snapshot__head">' +
        '<div class="copilot-viz-snapshot__head-text">' +
        '<span class="copilot-viz-snapshot__label">数据快照</span>' +
        '<span class="copilot-viz-snapshot__sub">主台缓存 · 与问数口径一致</span>' +
        '</div>' +
        '</div>' +
        '<div class="copilot-viz-kpi-row">' +
        '<div class="copilot-viz-net ' +
        netClass +
        '">' +
        '<div class="copilot-viz-net-left"><span class="copilot-viz-net-label">净头寸</span><span class="copilot-viz-net-hint">流入 − 流出</span></div>' +
        '<span class="copilot-viz-net-val">' +
        esc(netStr) +
        '</span>' +
        '</div>' +
        '<div class="copilot-viz-chart-grid">' +
        '<div class="copilot-viz-chart-cell">' +
        '<div class="copilot-viz-chart-title">流入 / 流出</div>' +
        '<div id="' +
        chartIoId +
        '" class="copilot-viz-echart" role="img" aria-label="流入流出占比图"></div>' +
        '<div class="copilot-viz-chart-fallback" hidden>' +
        barFallback +
        '</div>' +
        '</div>' +
        '<div class="copilot-viz-chart-cell">' +
        '<div class="copilot-viz-chart-title">资金计划 · 按主体</div>' +
        '<div id="' +
        chartPlId +
        '" class="copilot-viz-echart" role="img" aria-label="计划主体分布"></div>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div class="copilot-viz-stats-row">' +
        '<div class="copilot-viz-stat"><span class="copilot-viz-stat-label">资金流记录</span><strong>' +
        (s.record_count != null ? esc(String(s.record_count)) : '—') +
        '</strong><span class="copilot-viz-stat-sub">笔</span></div>' +
        '<div class="copilot-viz-stat"><span class="copilot-viz-stat-label">资金计划</span><strong>' +
        plans.length +
        '</strong><span class="copilot-viz-stat-sub">个</span></div>' +
        '<div class="copilot-viz-stat copilot-viz-stat--badge">' +
        alertsHtml +
        '</div>' +
        '</div>' +
        (plans.length
          ? '<ul class="copilot-viz-plan-list" aria-label="计划抽样">' + planChips + planMore + '</ul>'
          : '') +
        '<p class="copilot-viz-foot">数据来源：浏览器 AppData；与后端实时库可能存在秒级差异，审批以主台为准。</p>' +
        '</div>'
      );
    } catch (e) {
      return '';
    }
  },

  /** 挂载 ECharts；失败或无库时展示 CSS 条形回退 */
  _mountCopilotSnapshotCharts: function (snapEl) {
    if (!snapEl || !snapEl.getAttribute || snapEl.getAttribute('data-copilot-viz-root') !== '1') return;
    var ioEl = snapEl.querySelector('.copilot-viz-echart[id^="cfCopilotChartIO_"]');
    var plEl = snapEl.querySelector('.copilot-viz-echart[id^="cfCopilotChartPL_"]');
    var fb = snapEl.querySelector('.copilot-viz-chart-fallback');
    var inf = Number(snapEl.getAttribute('data-io-in')) || 0;
    var outf = Number(snapEl.getAttribute('data-io-out')) || 0;
    var plans = (typeof AppData !== 'undefined' && AppData.plans) || [];
    var byUnit = {};
    plans.forEach(function (p) {
      var u = (p && p.unit) || '未分类';
      byUnit[u] = (byUnit[u] || 0) + 1;
    });
    var piePlan = Object.keys(byUnit).map(function (k) {
      return { name: k.length > 8 ? k.slice(0, 8) + '…' : k, value: byUnit[k] };
    });

    var showFallbackBar = function () {
      if (fb) {
        fb.hidden = false;
        if (ioEl) ioEl.style.display = 'none';
      }
    };

    if (typeof echarts === 'undefined') {
      showFallbackBar();
      if (plEl) {
        var escN = function (t) {
          return String(t == null ? '' : t)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        };
        plEl.innerHTML =
          '<div class="copilot-viz-chart-empty">' +
          (piePlan.length
            ? piePlan
                .map(function (d) {
                  return (
                    '<div class="copilot-viz-mini-row"><span>' +
                    escN(d.name) +
                    '</span><b>' +
                    escN(String(d.value)) +
                    '</b></div>'
                  );
                })
                .join('')
            : '暂无计划') +
          '</div>';
      }
      return;
    }

    /* 快照内图表：低饱和、与极简 UI 一致 */
    var palette = ['#5c6b66', '#8a9590', '#a8b0ab', '#c5cbc7', '#6e6e73', '#8e8e93', '#aeaeb2'];
    var baseOpt = {
      textStyle: { fontFamily: 'inherit', fontSize: 10 },
      animation: true,
      animationDuration: 380,
    };

    if (ioEl) {
      try {
        var chartIo = echarts.init(ioEl, null, { renderer: 'svg', useDirtyRect: true });
        var sum = inf + outf;
        if (sum <= 0) {
          chartIo.setOption({
            title: {
              text: '暂无分项',
              left: 'center',
              top: 'center',
              textStyle: { color: '#86868b', fontSize: 11, fontWeight: 500 },
            },
          });
        } else {
          chartIo.setOption(
            Object.assign({}, baseOpt, {
              color: ['#6d7f74', '#c4a99e'],
              tooltip: {
                trigger: 'item',
                formatter: function (p) {
                  return p.name + '<br/>' + _fmtWan(p.value);
                },
              },
              series: [
                {
                  type: 'pie',
                  radius: ['44%', '70%'],
                  center: ['50%', '52%'],
                  avoidLabelOverlap: true,
                  itemStyle: { borderRadius: 2, borderColor: '#fff', borderWidth: 1 },
                  label: {
                    formatter: function (x) {
                      var pct = x.percent != null ? x.percent.toFixed(0) : '';
                      return x.name + '\n' + pct + '%';
                    },
                    fontSize: 10,
                    color: '#86868b',
                  },
                  labelLine: { length: 8, length2: 6 },
                  data: [
                    { name: '流入', value: inf },
                    { name: '流出', value: outf },
                  ],
                },
              ],
            })
          );
        }
        snapEl._cfChartIO = chartIo;
        if (typeof ResizeObserver !== 'undefined') {
          var ro = new ResizeObserver(function () {
            try {
              chartIo.resize();
            } catch (e2) {}
          });
          ro.observe(ioEl);
          snapEl._cfRoIO = ro;
        }
      } catch (e1) {
        showFallbackBar();
      }
    }

    if (plEl) {
      try {
        var chartPl = echarts.init(plEl, null, { renderer: 'svg', useDirtyRect: true });
        if (!piePlan.length) {
          chartPl.setOption({
            title: {
              text: '暂无计划',
              left: 'center',
              top: 'center',
              textStyle: { color: '#86868b', fontSize: 11, fontWeight: 500 },
            },
          });
        } else {
          chartPl.setOption(
            Object.assign({}, baseOpt, {
              color: palette,
              tooltip: { trigger: 'item', formatter: '{b}: {c} 个' },
              series: [
                {
                  type: 'pie',
                  radius: ['42%', '68%'],
                  center: ['50%', '52%'],
                  avoidLabelOverlap: true,
                  itemStyle: { borderRadius: 2, borderColor: '#fff', borderWidth: 1 },
                  label: { fontSize: 9, color: '#86868b' },
                  data: piePlan,
                },
              ],
            })
          );
        }
        snapEl._cfChartPL = chartPl;
        if (typeof ResizeObserver !== 'undefined') {
          var roP = new ResizeObserver(function () {
            try {
              chartPl.resize();
            } catch (e3) {}
          });
          roP.observe(plEl);
          snapEl._cfRoPL = roP;
        }
      } catch (e4) {
        plEl.innerHTML = '<div class="copilot-viz-chart-empty muted">图表不可用</div>';
      }
    }

    setTimeout(function () {
      try {
        if (snapEl._cfChartIO) snapEl._cfChartIO.resize();
      } catch (e5) {}
      try {
        if (snapEl._cfChartPL) snapEl._cfChartPL.resize();
      } catch (e6) {}
    }, 120);
  },

  _appendMsg: function (text, role) {
    var body = this._bodyEl();
    if (!body) return;
    var el = document.createElement('div');
    el.className = 'ai-msg ' + role + ' ai-msg-enter';

    if (role === 'assistant') {
      var richClass = body.id === 'copilot-messages' ? ' ai-msg-rich' : '';
      var avatarHtml = '<div class="ai-msg-avatar">🤖</div>';
      if (body.id === 'copilot-messages') {
        avatarHtml = '<div class="ai-msg-avatar copilot-msg-avatar-svg" aria-hidden="true"><svg width="22" height="22"><use href="#copilot-ico-agent"/></svg></div>';
      }
      var srcText = text;
      var choiceExtra = '';
      if (body.id === 'copilot-messages') {
        var ch = this._extractUserChoiceBlocks(text);
        srcText = ch.text;
        if (ch.choices.length) choiceExtra = this._renderChoiceBar(ch.choices);
      }
      var mdSource = srcText;
      if (body.id === 'copilot-messages' && this._shouldShowCopilotSnapshot(srcText)) {
        mdSource = this._stripRedundantCopilotStatsMarkdown(srcText);
      }
      var mdHtml = this._renderMarkdown(mdSource);
      if (body.id === 'copilot-messages') {
        mdHtml = this._postprocessCopilotHtml(mdHtml);
        if (this._shouldShowCopilotSnapshot(srcText)) {
          var snap = this._buildCopilotSnapshotHtml();
          if (snap) mdHtml = snap + mdHtml;
        }
      }
      if (choiceExtra) mdHtml += choiceExtra;
      el.innerHTML = avatarHtml + '<div class="ai-msg-content' + richClass + '">' + mdHtml + '</div>';
    } else {
      el.innerHTML = '<div class="ai-msg-content">' + text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>';
    }

    body.appendChild(el);
    if (role === 'assistant' && body.id === 'copilot-messages') {
      var snapMount = el.querySelector('[data-copilot-viz-root="1"]');
      if (snapMount) {
        var self = this;
        requestAnimationFrame(function () {
          self._mountCopilotSnapshotCharts(snapMount);
        });
      }
    }
    requestAnimationFrame(function () { el.classList.remove('ai-msg-enter'); });
    var wrap = body.closest('.copilot-chat-scroll');
    if (wrap) wrap.scrollTop = wrap.scrollHeight;
    else body.scrollTop = body.scrollHeight;
  },

  _setLoading: function (on) {
    var btn = this._sendBtnEl();
    var body = this._bodyEl();
    if (btn) {
      btn.disabled = on;
      if (btn.id === 'copilot-send') {
        if (on) {
          btn.textContent = '…';
        } else {
          btn.innerHTML = '<svg width="18" height="18" aria-hidden="true"><use href="#copilot-ico-send"/></svg>';
        }
      } else {
        btn.textContent = on ? '...' : '发送';
      }
    }

    var existing = document.getElementById('ai-typing');
    if (on && !existing && body) {
      var dot = document.createElement('div');
      dot.id = 'ai-typing';
      dot.className = 'ai-msg assistant ai-typing';
      var av = document.getElementById('copilot-messages') === body
        ? '<div class="ai-msg-avatar copilot-msg-avatar-svg" aria-hidden="true"><svg width="22" height="22"><use href="#copilot-ico-agent"/></svg></div>'
        : '<div class="ai-msg-avatar">🤖</div>';
      dot.innerHTML = av + '<div class="ai-msg-content"><span class="ai-dot"></span><span class="ai-dot"></span><span class="ai-dot"></span></div>';
      body.appendChild(dot);
      var wrap2 = body.closest('.copilot-chat-scroll');
      if (wrap2) wrap2.scrollTop = wrap2.scrollHeight;
      else body.scrollTop = body.scrollHeight;
    } else if (!on && existing) {
      existing.remove();
    }
  },

  /** 等待 DOM 上出现目标按钮后再 click，避免固定延时竞态 */
  _waitClickEl: function (elementId, maxAttempts, intervalMs) {
    maxAttempts = maxAttempts || 50;
    intervalMs = intervalMs || 40;
    var n = 0;
    function tick() {
      var el = document.getElementById(elementId);
      if (el) {
        try { el.click(); } catch (e) {}
        return;
      }
      n += 1;
      if (n < maxAttempts) setTimeout(tick, intervalMs);
    }
    tick();
  },

  _parseCommands: function (text) {
    var re = /```json\s*\n?([\s\S]*?)```/g;
    var m;
    while ((m = re.exec(text)) !== null) {
      try { var cmd = JSON.parse(m[1]); this._exec(cmd); } catch (e) {}
    }
  },

  /** Agent 可调用的后端写入白名单（path 全路径，含 query）；method 为 POST | PUT | DELETE */
  _allowedAgentApiWrite: function (path, method) {
    var p = String(path || '').trim();
    var m = String(method || 'POST').toUpperCase();
    if (!p.startsWith('/api/')) return false;
    if (m === 'POST' && p === '/api/integrations/fetch') return true;
    if (m === 'POST' && /^\/api\/plans\/\d+\/fill-from-cashflow$/.test(p)) return true;
    if (m === 'POST' && /^\/api\/plans\/\d+\/fill-from-analysis\?report_id=\d+$/.test(p)) return true;
    if (m === 'POST' && /^\/api\/fetch-tasks\/\d+\/run$/.test(p)) return true;
    if (m === 'POST' && p === '/api/analysis/run') return true;
    if (m === 'POST' && p === '/api/subjects') return true;
    if ((m === 'PUT' || m === 'DELETE') && /^\/api\/subjects\/\d+$/.test(p)) return true;
    if (m === 'POST' && p === '/api/businesses') return true;
    if ((m === 'PUT' || m === 'DELETE') && /^\/api\/businesses\/\d+$/.test(p)) return true;
    if (m === 'POST' && p === '/api/time-periods') return true;
    if ((m === 'PUT' || m === 'DELETE') && /^\/api\/time-periods\/\d+$/.test(p)) return true;
    if (m === 'POST' && p === '/api/subject-category-map') return true;
    if ((m === 'PUT' || m === 'DELETE') && /^\/api\/subject-category-map\/\d+$/.test(p)) return true;
    return false;
  },

  _exec: function (cmd) {
    if (!cmd || !cmd.action) return;
    var self = this;
    switch (cmd.action) {
      case 'navigate':
        if (cmd.page && Auth.hasPage(cmd.page)) {
          Router.navigate(cmd.page);
          Toast.info('已跳转: ' + cmd.page);
        }
        break;
      case 'bd_tab':
        if (typeof window.__cfSwitchBdTab === 'function') {
          Router.ensurePageThen('basedata', function () {
            window.__cfSwitchBdTab(cmd.tab || 'bd-subjects');
          });
          Toast.info('已打开基础数据');
        } else {
          Router.navigate('basedata');
        }
        break;
      case 'open_workbench':
        Router.navigate('workbench');
        Toast.info('已打开亿流 Work');
        break;
      case 'integration_sync':
        Router.ensurePageThen('integration', function () {
          AI._waitClickEl('int-btn-sync');
        });
        Toast.info('已触发手动同步');
        break;
      case 'integration_bank':
        Router.ensurePageThen('integration', function () {
          AI._waitClickEl('int-btn-sync-bank');
        });
        Toast.info('已触发银企取数');
        break;
      case 'integration_import':
        Router.ensurePageThen('integration', function () {
          var b = document.getElementById('int-btn-data-import');
          if (b) b.click();
        });
        Toast.info('已打开数据导入');
        break;
      case 'reload_data':
        if (typeof window.loadFromBackend === 'function') {
          window.loadFromBackend().then(function () {
            Toast.success('数据已刷新');
          }).catch(function () {
            Toast.warn('刷新失败');
          });
        } else {
          Toast.warn('loadFromBackend 不可用');
        }
        break;
      case 'liquidity_predict':
        Router.ensurePageThen('liquidity', function () {
          AI._waitClickEl('liq-btn-predict-demo');
        });
        Toast.info('已触发现金流预测');
        break;
      case 'api_post': {
        var path = String(cmd.path || '').trim();
        var method = String(cmd.method || 'POST').toUpperCase();
        if (method !== 'POST' && method !== 'PUT' && method !== 'DELETE') {
          Toast.warn('api_post 仅支持 method: POST / PUT / DELETE');
          break;
        }
        var body = cmd.body && typeof cmd.body === 'object' ? cmd.body : {};
        if (!self._allowedAgentApiWrite(path, method)) {
          Toast.warn('接口不在白名单: ' + method + ' ' + path);
          break;
        }
        if (typeof API === 'undefined') {
          Toast.warn('API 未就绪');
          break;
        }
        var req =
          method === 'DELETE'
            ? API.del(path)
            : method === 'PUT'
              ? API.put(path, body)
              : API.post(path, body);
        req
          .then(function (res) {
            Toast.success('接口已执行');
            if (typeof window !== 'undefined' && window.__CF_DEBUG_AGENT__) {
              try {
                console.debug('[CF_DEBUG_AGENT] api_write', method, path, res);
              } catch (e) {}
            }
            if (typeof window.loadFromBackend === 'function') {
              window.loadFromBackend().catch(function () {});
            }
          })
          .catch(function (err) {
            Toast.warn(err && err.message ? String(err.message) : '接口失败');
          });
        break;
      }
      case 'run_analysis':
        Router.ensurePageThen('analysis', function () {
          AI._waitClickEl('an-btn-run');
        });
        Toast.info('已打开现金流分析');
        break;
      case 'refresh_dashboard':
        Router.ensurePageThen('dashboard', function () {
          var run = function () {
            var btn = document.getElementById('dash-btn-refresh');
            if (btn) btn.click();
          };
          if (window.loadFromBackend) {
            window.loadFromBackend().then(run).catch(run);
          } else {
            run();
          }
        });
        Toast.info('已刷新看板');
        break;
      case 'batch_confirm':
        Router.ensurePageThen('cashflow', function () {
          AI._waitClickEl('cf-btn-batch-confirm');
        });
        Toast.info('已打开现金流事件');
        break;
      case 'export_csv':
        Router.ensurePageThen('cashflow', function () {
          AI._waitClickEl('cf-btn-export');
        });
        Toast.info('已打开现金流事件');
        break;
      case 'new_plan':
        Router.ensurePageThen('analysis', function () {
          AI._waitClickEl('plan-btn-new');
        });
        Toast.info('已打开现金流分析');
        break;
      case 'fetch_data':
        Router.ensurePageThen('cashflow', function () {
          AI._waitClickEl('cf-btn-fetch-quick');
        });
        Toast.info('已打开现金流事件');
        break;
      case 'toast':
        Toast.show(cmd.type || 'info', cmd.message || '');
        break;
    }
  },
};

/** 供 app.html 内联 onclick 调用，避免侧栏叠层导致 addEventListener 不触发 */
window.__cfOpenAiSettings = function (e) {
  if (e && e.preventDefault) e.preventDefault();
  if (e && e.stopPropagation) e.stopPropagation();
  if (window.AI && typeof AI.openApiKeySettings === 'function') {
    AI.openApiKeySettings();
  } else if (typeof Toast !== 'undefined') {
    Toast.warn('AI 模块未就绪');
  }
};

function _fmtWan(v) {
  if (v == null || isNaN(v)) return '-';
  if (Math.abs(v) >= 1e8) return (v / 1e8).toFixed(2) + '亿';
  if (Math.abs(v) >= 1e4) return (v / 1e4).toFixed(1) + '万';
  return v.toLocaleString('zh-CN');
}

document.addEventListener('DOMContentLoaded', function () { AI.init(); });

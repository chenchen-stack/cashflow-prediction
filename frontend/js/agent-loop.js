/**
 * agent-loop.js — PRD 资金预测闭环 × Agent 自然语言编排（前端可执行指令与 UI 入口）
 * 与 ai.js 中 JSON 指令配合；不替代后端校验与完整 PRD 表单实现。
 */
window.AgentLoop = {
  /** 与《用户需求说明书》3.1 章节对齐的闭环阶段（用于提示词与界面文案） */
  STAGES: [
    { id: 'L0', name: '基础数据', page: 'basedata', tab: 'bd-subjects', desc: '科目 · 业务 · 时间段 · 映射' },
    { id: 'L1', name: '资金流', page: 'cashflow', desc: '单据确认 / 获取 / 导入' },
    { id: 'L2', name: '数据整合', page: 'integration', desc: '映射规则 · 同步 · 日志 · 任务' },
    { id: 'L3', name: '现金流分析', page: 'analysis', desc: '复合区间分析 · 报表' },
    { id: 'L4', name: '现金流预测', page: 'liquidity', desc: '滚动流动性 / 情景' },
    { id: 'L5', name: '资金计划', page: 'analysis', desc: '计划编制与从资金流/分析取数' },
  ],

  /** 供 _buildSystemPrompt 追加 */
  getSystemPromptAppend: function () {
    return [
      '',
      '## PRD 闭环编排（必须遵守）',
      '端到端按 **基础数据 → 资金流/整合 → 现金流分析 →（可选）现金流预测 → 资金计划** 分多轮推进：**每轮只说当前一步**，用户 **只在对话里** 回复「确认 / 继续」或选项；**执行由 Agent 通过 JSON 自动完成**，用户 **不要**自己去主台点按钮。**仅**敏感操作（见「对话确认例外」）本回合先发问、不附 JSON。',
      '下列 **action** 由前端自动执行；意图明确时 **同轮内** 产出 ```json```（可多块顺序执行），**禁止**依赖用户点击图形界面：',
      '| action | 含义 | 主要参数 |',
      '|--------|------|----------|',
      '| navigate | 打开页面 | page: dashboard/cashflow/analysis/liquidity/basedata/integration |',
      '| bd_tab | 基础数据子页 | tab: bd-subjects / bd-businesses / bd-timeperiods / bd-sbmap |',
      '| open_workbench | 打开亿流 Work 侧栏 | 无 |',
      '| integration_sync | 数据整合页 · 手动同步（TMS） | 无 |',
      '| integration_bank | 数据整合页 · 银企取数 | 无 |',
      '| integration_import | 数据整合页 · 数据导入 | 无 |',
      '| reload_data | 全量刷新 AppData（loadFromBackend） | 无 |',
      '| run_analysis | 现金流分析页 · 运行分析 | 无 |',
      '| liquidity_predict | 现金流预测页 · 触发演示预测 | 无 |',
      '| api_post | **仅白名单** 后端写入（默认 POST；可设 **method**: PUT / DELETE） | path, body, method? |',
      '',
      '**api_post 允许 path（须完全一致或匹配下列模式）**：',
      '- `/api/integrations/fetch` body: { units?:[], source_system?:\"资金管理系统\"|\"银企直连\", force_override?:boolean }',
      '- `/api/plans/<id>/fill-from-cashflow` body: {}',
      '- `/api/plans/<id>/fill-from-analysis?report_id=<数字>` body: {}',
      '- `/api/fetch-tasks/<id>/run` body: {}',
      '- `/api/analysis/run` body: 与现金流分析页参数一致（unit、period_config_code、opening_balance 等，缺省可用当前页或合理默认）',
      '- **基础数据**：`POST /api/subjects|/api/businesses|/api/time-periods|/api/subject-category-map`；`PUT|DELETE /api/subjects/<id>`、businesses、time-periods、subject-category-map 同型；body 与后端 OpenAPI 字段一致。删除/禁用前须在对话征得确认。',
      '',
      '执行取数或计划填充后，应 **reload_data** 或提示用户刷新，以便侧栏统计更新。',
      '',
      '## 侧栏「可点击按钮」（user-choices，替代「请回复确认」打字）',
      '需要用户确认、二选一、是否继续时，在回复**末尾**输出（与正文之间空一行）：',
      '```user-choices',
      '[',
      '  {"label":"确认并执行","cmd":{"action":"api_post","path":"/api/businesses","body":{"code":"…","name":"…","biz_type":"一般资金流","valid":true}}},',
      '  {"label":"暂不","cmd":{"action":"toast","type":"info","message":"已取消"}}',
      ']',
      '```',
      '`cmd` 与 ```json``` 指令相同；侧栏会渲染为按钮。**同一操作不要**既写自动执行的 ```json``` 又写 user-choices，以免重复执行；待用户点击时只输出 user-choices。',
    ].join('\n');
  },

  /** 看板「闭环阶段」按钮：打开侧栏并预填一句自然语言 */
  presetChat: function (stageId) {
    var tail = '我只需在对话里回复确认或继续，请你自动执行工具/JSON，不要让我自己去主台点按钮。';
    var map = {
      basdata: '我要配置基础数据（科目与业务）。请一步一步引导；' + tail,
      cashflow: '我要处理现金流事件。请一步一步引导；' + tail,
      integration: '我要做数据整合。请一步一步引导，需要同步时请你自动执行；' + tail,
      analysis: '我要做现金流分析（复合区间等）。请一步一步引导并自动跑分析；' + tail,
      liquidity: '我要看现金流预测与流动性。请一步一步引导；' + tail,
      plan: '我要编制资金计划并从资金流或分析取数。请一步一步引导，需要填充时在对话里让我确认后再执行；' + tail,
    };
    var hint = map[stageId] || '请按 PRD 闭环单步引导我。';
    if (window.Router && typeof Router.navigate === 'function') Router.navigate('workbench');
    if (window.AI && typeof AI.toggleDrawer === 'function') AI.toggleDrawer(true);
    if (window.Copilot && typeof Copilot.openTab === 'function') Copilot.openTab('chat');
    setTimeout(function () {
      var inp = document.getElementById('copilot-input');
      if (inp) {
        inp.value = hint;
        try { inp.focus(); } catch (e) {}
      }
    }, 80);
  },

  /**
   * 基础数据各子 Tab：跳转对应页 + 打开侧栏 + 预填「一键由 Agent 调白名单接口执行」
   * tabId: bd-subjects | bd-businesses | bd-timeperiods | bd-sbmap
   */
  presetBaseDataTab: function (tabId) {
    var allow = { 'bd-subjects': 1, 'bd-businesses': 1, 'bd-timeperiods': 1, 'bd-sbmap': 1 };
    if (!tabId || !allow[tabId]) tabId = 'bd-subjects';
    var prompts = {
      'bd-subjects':
        '【基础数据 · 资金科目】请自动执行：先 `{"action":"reload_data"}` 拉齐主数据；再检查科目树是否满足复合预测对流入/流出、末级科目的要求。若有缺口，请用 **api_post**（白名单已含 POST /api/subjects 与 PUT/DELETE /api/subjects/<id>）在回复中附 ```json``` **逐条**创建或修正。我仅在侧栏对话里回复「确认」；不要让我手动点「新增科目」。',
      'bd-businesses':
        '【基础数据 · 资金业务】请检查业务类型是否与引擎/演示一致；需新增或启用/禁用时，用白名单内的 POST /api/businesses、PUT/DELETE /api/businesses/<id> 通过 ```json``` 执行，必要时 reload_data。禁用前请先对话确认。',
      'bd-timeperiods':
        '【基础数据 · 时间段】请检查天/周/月/季/年等滚动配置是否齐备；缺失则用 POST /api/time-periods 或 PUT /api/time-periods/<id> 补全，必要时 reload_data。删除前请先对话确认。',
      'bd-sbmap':
        '【基础数据 · 业务类型映射】请核对末级科目与资金业务的对应关系；按多对一补全映射，使用 POST /api/subject-category-map 或 PUT /api/subject-category-map/<id>，body 与后端字段一致，必要时 reload_data。删除映射前请先对话确认。',
    };
    var hint = prompts[tabId];
    if (window.__cfBackendOk === false && typeof Toast !== 'undefined') {
      Toast.info('当前未连接后端，AI 仅能给出建议；连接后可自动写入主数据');
    }
    if (window.Router && typeof Router.ensurePageThen === 'function') {
      Router.ensurePageThen('basedata', function () {
        if (typeof window.__cfSwitchBdTab === 'function') window.__cfSwitchBdTab(tabId);
        if (window.AI && typeof AI.toggleDrawer === 'function') AI.toggleDrawer(true);
        if (window.Copilot && typeof Copilot.openTab === 'function') Copilot.openTab('chat');
        setTimeout(function () {
          var inp = document.getElementById('copilot-input');
          if (inp) {
            inp.value = hint;
            try {
              inp.focus();
            } catch (e) {}
          }
        }, 100);
      });
    }
  },
};

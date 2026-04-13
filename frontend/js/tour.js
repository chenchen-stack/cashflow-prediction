/**
 * 新手引导 — 聚光灯 + 步骤卡片（不依赖第三方库）
 * 使用：Tour.start('full') 或 Tour.start('quick')
 */
(function () {
  var PAD = 10;
  var NAV_DELAY = 480;

  var FLOWS = {
    /** 按业务闭环排序：先「有据」→「确认」→「看全景」→「归因」→「前瞻」→「口径」→「Agent」→「找路」 */
    full: [
      {
        id: 'welcome',
        phase: '业务导读',
        title: '从业务闭环开始，而不是从菜单开始',
        body:
          '司库场景下的顺序是：先让「资金流水」可信且同源 → 再确认进账 → 再看健康度 → 再分析归因 → 再预测与预警 → 最后才落到科目与映射等主数据维护。\n\n下面每一步都会说明：这一步解决什么业务问题、和上下步的关系。可随时「跳过」。',
        center: true,
      },
      {
        page: 'integration',
        selector: '#int-btn-excel',
        phase: '业务① 同一本账',
        title: '先解决：钱从哪来、是否只有一套数',
        body:
          '业务目标：避免「Excel 一套、系统一套、口头一套」。导入或同步进来的单据，与「现金流事件」里看到的是同一本台账，后面的分析、预测才有共同口径。\n\n您可在此：用数据导入/同步把外部数据写进系统；映射与日志在同级流程里维护。\n\n与下一步：数据进来后，到现金流事件页做获取与确认，进入闭环。',
        placement: 'bottom',
      },
      {
        page: 'cashflow',
        selector: '.cf-fetch-group',
        phase: '业务② 可信流水',
        title: '把「业务发生」变成可分析的现金流事实',
        body:
          '业务目标：预测和分析只能基于「已确认、可追溯」的流水；未确认的仍视为待核实，不应默默进入决策口径。\n\n您可在此：一键/选项获取接口数据；对结果做智能批量确认。只有已确认部分，才会稳定进入分析与预测链路。\n\n与下一步：确认后，到总览看板看头寸与待办是否异常。',
        placement: 'bottom',
      },
      {
        page: 'dashboard',
        selector: '#dash-kpi',
        phase: '业务③ 一屏判断',
        title: '先看经营结果：头寸够不够、有没有雷',
        body:
          '业务目标：司库先回答「我现在安全吗、哪里要马上处理」，再下钻细节。\n\n您可在此：从 KPI 卡片跳到事件或分析，形成「发现问题 → 定位单据」的路径。\n\n与下一步：需要结构归因时，去现金流分析做复合区间与规则检验。',
        placement: 'bottom',
      },
      {
        page: 'analysis',
        selector: '#an-btn-run',
        phase: '业务④ 归因与规则',
        title: '回答：头寸变化来自哪些科目与区间',
        body:
          '业务目标：把「为什么这几天缺口变大」说清楚——是规则、流程还是结构性因素，而不是只看一个总数。\n\n您可在此：运行分析，查看头寸图与明细；下方可结合 AI 解读做沟通备忘。\n\n与下一步：需要看未来与警戒线时，去现金流预测。',
        placement: 'bottom',
      },
      {
        page: 'liquidity',
        selector: '#liq-btn-predict-demo',
        phase: '业务⑤ 前瞻与边界',
        title: '回答：未来一段钱够不够、何时碰警戒线',
        body:
          '业务目标：在已确认事件与引擎口径上，做滚动预测、关键日与预算对照，识别「什么时候会难受」而非只看昨天。\n\n您可在此：触发预测，查看曲线、预警与风险区解读。\n\n与下一步：若数字对不上，往往要回到基础数据核对科目与映射。',
        placement: 'bottom',
      },
      {
        page: 'basedata',
        selector: '#bd-tabs',
        phase: '业务⑥ 口径底座',
        title: '主数据决定：上面的数怎么归集、能不能比',
        body:
          '业务目标：科目树、资金业务、时间段与映射一变，看板和分析结果就会变——这里是「口径」而不是普通表单。\n\n您可在此：切换子页签维护各类主数据；保持与分析引擎、预测引擎引用关系一致。\n\n与下一步：新建叶子科目时，用「新增科目」维护层级与方向。',
        placement: 'bottom',
      },
      {
        page: 'basedata',
        selector: '#bd-btn-add-subject',
        phase: '业务⑥ 续 · 科目树',
        title: '把科目补全：上下级与方向一致，报表才站得住',
        body:
          '业务目标：缺科目会导致流水无处归集或误归集，直接扭曲头寸与预测。\n\n您可在此：新增科目节点，维护方向、名称与层级。\n\n与下一步：需要对话里自动跳转、取数或单步执行时，用亿流 Work。',
        placement: 'left',
      },
      {
        page: 'dashboard',
        selector: '#topbar-copilot',
        phase: '业务⑦ Agent 执行',
        title: '亿流 Work：把「业务目标」翻译成「页面动作」',
        body:
          '业务目标：减少「去某页点某按钮」的心智负担——用自然语言说明目标（补数、确认、跑分析、同步），由 Agent 在权限内驱动主台。\n\n您可在此：打开侧栏，用场景话术或点选技能条；缺数时会引导你到数据整合或现金流事件。\n\n与下一步：需要自己在模块间切换时，看侧栏分区。',
        placement: 'bottom',
      },
      {
        page: 'dashboard',
        selector: '#sidebar-nav',
        phase: '业务⑧ 模块地图',
        title: '导航分区：闭环一条线、扩展一块地',
        body:
          '业务目标：知道「我现在该去闭环里的哪一段」，而不是背菜单名。\n\n您可在此：「预测与闭环」跟事件→分析→预测一条线；「扩展与基础」放主数据、数据整合等底座能力；「亿流 Work」是 Agent 入口。\n\n与下一步：确认当前模块，请看顶栏标题。',
        placement: 'right',
      },
      {
        page: 'dashboard',
        selector: '#current-tab-name',
        phase: '业务⑨ 上下文',
        title: '始终清楚：我正处在闭环的哪一环',
        body:
          '业务目标：避免在分析页找预测按钮这类迷路——先看标题再操作。\n\n顶栏此处显示当前模块名称，与侧栏高亮一致。长流程中随时回到这里校准「我现在在干什么」。',
        placement: 'bottom',
      },
      {
        id: 'done',
        phase: '结束',
        title: '闭环在心里，功能在手上',
        body:
          '完整路径可随时从顶栏「导」再跑一遍。日常使用时记住顺序：数据同源 → 事件确认 → 看板 → 分析 → 预测 → 口径维护；Agent 负责在对话里帮你落地。\n\n祝使用愉快！',
        center: true,
      },
    ],
    quick: [
      {
        id: 'welcome',
        phase: '快速导读',
        title: '四条业务线，各看一眼',
        body:
          '不展开每一步细节，只建立「先数据、再事件、再看板」的印象。需要逐步讲解请选「全流程引导」。',
        center: true,
      },
      {
        page: 'integration',
        selector: '#int-btn-excel',
        phase: '① 数据',
        title: '数据先进同一本账',
        body: '业务要点：整合导入与事件共用记录，避免两套数。',
        placement: 'bottom',
      },
      {
        page: 'cashflow',
        selector: '.cf-fetch-group',
        phase: '② 事件',
        title: '再确认成可信流水',
        body: '业务要点：获取后批量确认，未确认不贸然进分析口径。',
        placement: 'bottom',
      },
      {
        page: 'dashboard',
        selector: '#dash-kpi',
        phase: '③ 看板',
        title: '一屏看头寸与异常',
        body: '业务要点：先看健康度，再下钻。',
        placement: 'bottom',
      },
      {
        id: 'done',
        phase: '完成',
        title: '需要逐步引导请选全流程',
        body: '顶栏「导」→ 全流程引导：按业务顺序走完 12 步。',
        center: true,
      },
    ],
  };

  var root = null;
  var shades = [];
  var tooltip = null;
  var currentIndex = 0;
  var currentFlow = [];
  var lastTarget = null;
  var escHandler = null;

  function ensureDom() {
    if (root) return;
    root = document.createElement('div');
    root.className = 'tour-root';
    root.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 4; i++) {
      var s = document.createElement('div');
      s.className = 'tour-shade';
      shades.push(s);
      root.appendChild(s);
    }
    tooltip = document.createElement('div');
    tooltip.className = 'tour-tooltip';
    tooltip.setAttribute('role', 'dialog');
    document.body.appendChild(root);
    document.body.appendChild(tooltip);
  }

  function clearGlow() {
    if (lastTarget) {
      lastTarget.classList.remove('tour-target-glow');
      lastTarget = null;
    }
  }

  function layoutShades(rect) {
    shades.forEach(function (s) {
      s.style.display = '';
    });
    var w = window.innerWidth;
    var h = window.innerHeight;
    var top = Math.max(0, rect.top - PAD);
    var left = Math.max(0, rect.left - PAD);
    var right = Math.min(w, rect.right + PAD);
    var bottom = Math.min(h, rect.bottom + PAD);

    shades[0].style.cssText = 'top:0;left:0;width:100%;height:' + top + 'px;';
    shades[1].style.cssText = 'top:' + top + 'px;left:0;width:' + left + 'px;height:' + (bottom - top) + 'px;';
    shades[2].style.cssText =
      'top:' + top + 'px;left:' + right + 'px;width:' + (w - right) + 'px;height:' + (bottom - top) + 'px;';
    shades[3].style.cssText = 'top:' + bottom + 'px;left:0;width:100%;height:' + (h - bottom) + 'px;';
  }

  function fullDim() {
    shades.forEach(function (s) {
      s.style.display = '';
    });
    var h = window.innerHeight;
    shades[0].style.cssText = 'top:0;left:0;width:100%;height:' + h + 'px;';
    shades[1].style.cssText = shades[2].style.cssText = shades[3].style.cssText = 'display:none;';
  }

  function placeTooltip(step, rect) {
    var tw = tooltip.offsetWidth || 320;
    var th = tooltip.offsetHeight || 120;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var margin = 16;
    var top;
    var left;

    if (step.center || !rect) {
      top = (vh - th) / 2;
      left = (vw - tw) / 2;
    } else {
      var placement = step.placement || 'bottom';
      if (placement === 'bottom') {
        top = rect.bottom + PAD + 8;
        left = rect.left + rect.width / 2 - tw / 2;
      } else if (placement === 'top') {
        top = rect.top - th - 12;
        left = rect.left + rect.width / 2 - tw / 2;
      } else if (placement === 'left') {
        top = rect.top + rect.height / 2 - th / 2;
        left = rect.left - tw - 12;
      } else {
        top = rect.top + rect.height / 2 - th / 2;
        left = rect.right + 12;
      }
      left = Math.max(margin, Math.min(left, vw - tw - margin));
      top = Math.max(margin, Math.min(top, vh - th - margin));
    }

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  }

  function escTour(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function renderTooltip(step, index, total) {
    var isLast = index >= total - 1;
    var meta = '第 ' + (index + 1) + ' / ' + total + ' 步';
    var phaseHtml = step.phase
      ? '<div class="tour-tooltip__phase">' + escTour(step.phase) + '</div>'
      : '';
    tooltip.innerHTML =
      '<div class="tour-tooltip__meta">' +
      meta +
      '</div>' +
      phaseHtml +
      '<div class="tour-tooltip__title">' +
      escTour(step.title) +
      '</div>' +
      '<p class="tour-tooltip__body">' +
      escTour(step.body) +
      '</p>' +
      '<div class="tour-tooltip__actions">' +
      '<button type="button" class="tour-btn tour-btn--ghost" data-tour-act="skip">跳过</button>' +
      (index > 0 ? '<button type="button" class="tour-btn tour-btn--ghost" data-tour-act="prev">上一步</button>' : '') +
      '<button type="button" class="tour-btn tour-btn--primary" data-tour-act="next">' +
      (isLast ? '完成' : '下一步') +
      '</button>' +
      '</div>';

    tooltip.querySelectorAll('[data-tour-act]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var act = btn.getAttribute('data-tour-act');
        if (act === 'skip') Tour.stop();
        else if (act === 'prev') Tour.prev();
        else Tour.next();
      });
    });
  }

  function showStep(index) {
    ensureDom();
    currentIndex = index;
    var step = currentFlow[index];
    if (!step) {
      Tour.stop();
      return;
    }

    clearGlow();
    root.classList.add('is-active');
    root.setAttribute('aria-hidden', 'false');

    var total = currentFlow.length;
    renderTooltip(step, index, total);

    if (step.center || !step.selector) {
      fullDim();
      tooltip.style.visibility = 'hidden';
      tooltip.style.display = 'block';
      requestAnimationFrame(function () {
        tooltip.style.visibility = 'visible';
        placeTooltip(step, null);
      });
      return;
    }

    var el = document.querySelector(step.selector);
    if (!el) {
      if (typeof Toast !== 'undefined') Toast.warn('本步目标未找到，已跳过：' + (step.selector || ''));
      setTimeout(function () {
        showStep(index + 1);
      }, 0);
      return;
    }

    try {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } catch (e) {}

    setTimeout(function () {
      var rect = el.getBoundingClientRect();
      if (rect.width < 2 && rect.height < 2) {
        if (typeof Toast !== 'undefined') Toast.warn('目标不可见，已跳过');
        showStep(index + 1);
        return;
      }
      el.classList.add('tour-target-glow');
      lastTarget = el;
      layoutShades(rect);
      tooltip.style.visibility = 'hidden';
      tooltip.style.display = 'block';
      requestAnimationFrame(function () {
        tooltip.style.visibility = 'visible';
        placeTooltip(step, rect);
      });
    }, 120);
  }

  function goToPageThen(stepIndex, step) {
    if (!step || step.center || !step.page) {
      showStep(stepIndex);
      return;
    }
    if (typeof Router === 'undefined' || !Router.navigate) {
      showStep(stepIndex);
      return;
    }
    var cur = Router.getCurrent ? Router.getCurrent() : '';
    if (cur === step.page) {
      setTimeout(function () {
        showStep(stepIndex);
      }, 80);
      return;
    }
    Router.navigate(step.page);
    setTimeout(function () {
      showStep(stepIndex);
    }, NAV_DELAY);
  }

  window.Tour = {
    start: function (flowId) {
      var flow = FLOWS[flowId] || FLOWS.full;
      if (!flow || !flow.length) return;
      currentFlow = flow.slice();
      Tour.stop();
      ensureDom();
      if (!escHandler) {
        escHandler = function (e) {
          if (e.key === 'Escape' && root && root.classList.contains('is-active')) Tour.stop();
        };
        document.addEventListener('keydown', escHandler);
      }
      goToPageThen(0, currentFlow[0]);
    },

    next: function () {
      if (currentIndex + 1 >= currentFlow.length) {
        Tour.stop();
        if (typeof Toast !== 'undefined') Toast.success('引导已结束');
        return;
      }
      var nextIdx = currentIndex + 1;
      var step = currentFlow[nextIdx];
      goToPageThen(nextIdx, step);
    },

    prev: function () {
      if (currentIndex <= 0) return;
      var prevIdx = currentIndex - 1;
      goToPageThen(prevIdx, currentFlow[prevIdx]);
    },

    stop: function () {
      clearGlow();
      if (root) root.classList.remove('is-active');
      if (tooltip) {
        tooltip.style.display = 'none';
        tooltip.innerHTML = '';
      }
      if (shades.length) {
        shades.forEach(function (s) {
          s.style.cssText = '';
        });
      }
    },
  };

  window.__cfStartTour = function (flowId) {
    var w = document.getElementById('topbar-tour-wrap');
    if (w) w.removeAttribute('open');
    Tour.start(flowId || 'full');
  };

  window.addEventListener(
    'resize',
    function () {
      if (!root || !root.classList.contains('is-active')) return;
      var step = currentFlow[currentIndex];
      if (!step || step.center || !step.selector) return;
      var el = document.querySelector(step.selector);
      if (el && lastTarget === el) {
        layoutShades(el.getBoundingClientRect());
        placeTooltip(step, el.getBoundingClientRect());
      }
    },
    { passive: true }
  );
})();

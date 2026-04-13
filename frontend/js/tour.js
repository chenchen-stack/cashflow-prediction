/**
 * 新手引导 — 聚光灯 + 步骤卡片（不依赖第三方库）
 * 使用：Tour.start('full') 或 Tour.start('quick')
 */
(function () {
  var PAD = 10;
  var NAV_DELAY = 480;

  var FLOWS = {
    full: [
      {
        id: 'welcome',
        title: '欢迎使用「现金流预测 Agent」',
        body: '产品结构与演讲稿一致：现金流事件 → 现金流预测 → 风险识别 → Agent 执行。可随时点「跳过」结束。',
        center: true,
      },
      {
        page: 'dashboard',
        selector: '#topbar-copilot',
        title: '亿流 Work（Agent 执行层）',
        body: '与演讲稿一致：感知 · 决策 · 执行；可对话查数、跳转主台、触发演示动作。',
        placement: 'bottom',
      },
      {
        page: 'dashboard',
        selector: '#sidebar-nav',
        title: '侧栏导航',
        body: 'Agent 执行、预测与闭环（看板→现金流事件→现金流分析→现金流预测）、数据与基础（主数据→数据整合）按组分区。',
        placement: 'right',
      },
      {
        page: 'dashboard',
        selector: '#current-tab-name',
        title: '当前页面',
        body: '顶栏标签显示当前所在模块名称，与侧栏选中项一致。',
        placement: 'bottom',
      },
      {
        page: 'dashboard',
        selector: '#dash-kpi',
        title: '总览 KPI',
        body: '点击 KPI 卡片可跳转到现金流事件或现金流分析（演示联动）。',
        placement: 'bottom',
      },
      {
        page: 'cashflow',
        selector: '.cf-fetch-group',
        title: '现金流事件 · 获取数据',
        body: '「一键获取」按默认口径立即拉取；「选项获取」可指定单位、日期区间、来源与覆盖策略。再「智能批量确认」，仅已确认进入现金流分析等环节。',
        placement: 'bottom',
      },
      {
        page: 'analysis',
        selector: '#an-btn-run',
        title: '现金流分析 · 运行分析',
        body: '规则 / 流程 / AI 融合。运行后生成头寸图与明细；下方 AI 报告解读风险。',
        placement: 'bottom',
      },
      {
        page: 'liquidity',
        selector: '#liq-btn-predict-demo',
        title: '现金流预测',
        body: '现金流预测与风险识别：滚动曲线、关键日、预算与预警；口径与已确认事件一致。',
        placement: 'bottom',
      },
      {
        page: 'basedata',
        selector: '#bd-tabs',
        title: '基础数据 · 子页签',
        body: '维护科目树、资金业务、时间段与业务映射，分析引擎会引用这些配置。',
        placement: 'bottom',
      },
      {
        page: 'basedata',
        selector: '#bd-btn-add-subject',
        title: '新增科目',
        body: '在此新增科目节点；可维护方向、单位名称与上下级关系。',
        placement: 'left',
      },
      {
        page: 'integration',
        selector: '#int-btn-excel',
        title: '数据整合',
        body: '数据整合层：Excel 导入或模拟同步写入单据，与「现金流事件」共用同一套记录。',
        placement: 'bottom',
      },
      {
        id: 'done',
        title: '引导结束',
        body: '您可以随时点击顶栏「导」打开菜单，再次选择全流程或快速引导。祝使用愉快！',
        center: true,
      },
    ],
    quick: [
      {
        id: 'welcome',
        title: '快速引导',
        body: '仅浏览侧栏、看板与当前页要点，适合第一次打开。',
        center: true,
      },
      {
        page: 'dashboard',
        selector: '#sidebar-nav',
        title: '侧栏',
        body: '从这里切换各模块；「基础数据」维护科目与映射。',
        placement: 'right',
      },
      {
        page: 'dashboard',
        selector: '#dash-btn-refresh',
        title: '刷新数据',
        body: '从后端重新拉取统计与列表（需启动后端）。',
        placement: 'bottom',
      },
      {
        id: 'done',
        title: '完成',
        body: '需要完整路径请选「全流程引导」。',
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

  function renderTooltip(step, index, total) {
    var isLast = index >= total - 1;
    var meta = '第 ' + (index + 1) + ' / ' + total + ' 步';
    tooltip.innerHTML =
      '<div class="tour-tooltip__meta">' +
      meta +
      '</div>' +
      '<div class="tour-tooltip__title">' +
      String(step.title || '') +
      '</div>' +
      '<p class="tour-tooltip__body">' +
      String(step.body || '') +
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

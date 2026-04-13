/**
 * router.js — Hash SPA 路由（对齐风控原型架构：_buildNav + navigate + onNavigate）
 */

window.Router = {
  _listeners: [],

  init: function () {
    if (!Auth.getCurrentRole()) {
      window.location.href = 'index.html';
      return;
    }
    this._buildNav();
    window.addEventListener('hashchange', this._dispatch.bind(this));
    this._dispatch();
  },

  _buildNav: function () {
    var container = document.getElementById('sidebar-nav');
    if (!container) return;
    container.innerHTML = '';
    var role = Auth.getCurrentRole();
    AppData.navItems.forEach(function (group) {
      var visible = group.items.filter(function (item) {
        return role.pages.indexOf(item.id) !== -1;
      });
      if (visible.length === 0) return;
      var label = document.createElement('div');
      label.className = 'nav-group-label';
      label.textContent = group.group;
      container.appendChild(label);
      visible.forEach(function (item) {
        var btn = document.createElement('button');
        btn.className = 'nav-item';
        btn.dataset.page = item.id;
        btn.innerHTML = '<span class="nav-icon">' + item.icon + '</span><span>' + item.text + '</span>';
        btn.addEventListener('click', function () { Router.navigate(item.id); });
        container.appendChild(btn);
      });
    });
  },

  navigate: function (pageId) {
    if (pageId === 'workbench') {
      if (window.AI && typeof AI.toggleDrawer === 'function') AI.toggleDrawer(true);
      if (window.Copilot && typeof Copilot.openTab === 'function') Copilot.openTab('chat');
      return;
    }
    if (!Auth.hasPage(pageId)) {
      var role = Auth.getCurrentRole();
      pageId = role ? role.pages[0] : 'dashboard';
    }
    window.location.hash = '#' + pageId;
  },

  getCurrent: function () {
    return (window.location.hash || '#dashboard').replace('#', '');
  },

  onNavigate: function (fn) {
    this._listeners.push(fn);
  },

  /**
   * 确保进入 pageId 后执行 fn（在 onNavigate 渲染之后、双 rAF 后调用）。
   * 若已在该页，不重复改 hash，避免 hashchange 不触发导致回调丢失。
   */
  ensurePageThen: function (pageId, fn) {
    if (pageId === 'workbench') {
      this.navigate('workbench');
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { try { fn(); } catch (e) {} });
      });
      return;
    }
    if (!Auth.hasPage(pageId)) {
      if (typeof Toast !== 'undefined') Toast.warn('当前角色无权访问该页面');
      return;
    }
    if (this.getCurrent() === pageId) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { try { fn(); } catch (e) {} });
      });
      return;
    }
    var self = this;
    var wrapped = function (page) {
      if (page !== pageId) return;
      var i = self._listeners.indexOf(wrapped);
      if (i !== -1) self._listeners.splice(i, 1);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { try { fn(); } catch (e) {} });
      });
    };
    this._listeners.push(wrapped);
    this.navigate(pageId);
  },

  _dispatch: function () {
    var page = this.getCurrent();
    if (page === 'plan') {
      window.location.replace(window.location.pathname + window.location.search + '#analysis');
      return;
    }
    if (page === 'fx') {
      window.location.replace(window.location.pathname + window.location.search + '#dashboard');
      return;
    }
    if (page === 'stages') {
      window.location.replace(window.location.pathname + window.location.search + '#dashboard');
      return;
    }
    if (!Auth.hasPage(page)) {
      var role = Auth.getCurrentRole();
      page = role ? role.pages[0] : 'dashboard';
      window.location.hash = '#' + page;
      return;
    }

    document.querySelectorAll('.page-panel').forEach(function (p) { p.classList.remove('active'); });
    var panel = document.getElementById('page-' + page);
    if (panel) panel.classList.add('active');

    document.querySelectorAll('.nav-item').forEach(function (n) {
      n.classList.toggle('active', n.dataset.page === page);
    });

    var tabEl = document.getElementById('current-tab-name');
    if (tabEl) {
      var titles = {
        dashboard:'总览看板', cashflow:'现金流事件', analysis:'现金流分析',
        liquidity:'现金流预测', basedata:'基础数据',
        integration:'数据整合'
      };
      tabEl.textContent = titles[page] || page;
    }

    this._listeners.forEach(function (fn) { fn(page); });
  },
};

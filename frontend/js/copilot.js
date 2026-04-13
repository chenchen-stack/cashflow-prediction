/**
 * copilot.js — 亿流 Work 侧栏：仅对话区；兼容旧 DOM（子标签/更多能力/选项若不存在则跳过）
 */
window.Copilot = {
  openTab: function (tabId) {
    var chatBtn = document.querySelector('.copilot-tab-main[data-copilot-tab="chat"]');
    if (chatBtn) {
      var isChat = tabId === 'chat';
      chatBtn.classList.toggle('on', isChat);
      chatBtn.setAttribute('aria-selected', isChat ? 'true' : 'false');
    }

    document.querySelectorAll('.copilot-tab-sub[data-copilot-tab]').forEach(function (t) {
      var on = t.getAttribute('data-copilot-tab') === tabId;
      t.classList.toggle('on', on);
    });

    var moreEl = document.getElementById('copilotTabsMore');
    var moreBtn = document.getElementById('copilotTabsMoreBtn');
    if (tabId !== 'chat' && moreEl && moreBtn) {
      moreEl.hidden = false;
      moreBtn.setAttribute('aria-expanded', 'true');
    }

    document.querySelectorAll('.copilot-pane').forEach(function (p) {
      var match = p.getAttribute('data-pane') === tabId;
      p.classList.toggle('is-active', match);
      if (match) p.removeAttribute('hidden');
      else p.setAttribute('hidden', '');
    });
  },

  init: function () {
    document.querySelectorAll('.copilot-tab-main[data-copilot-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        Copilot.openTab(btn.getAttribute('data-copilot-tab'));
      });
    });

    document.querySelectorAll('.copilot-tab-sub[data-copilot-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        Copilot.openTab(btn.getAttribute('data-copilot-tab'));
      });
    });

    var moreBtn = document.getElementById('copilotTabsMoreBtn');
    var moreEl = document.getElementById('copilotTabsMore');
    if (moreBtn && moreEl) {
      moreBtn.addEventListener('click', function () {
        var open = moreBtn.getAttribute('aria-expanded') === 'true';
        moreEl.hidden = open;
        moreBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
        moreBtn.textContent = open ? '更多能力 ▾' : '更多能力 ▴';
      });
    }

    var optBtn = document.getElementById('copilotComposerOptsBtn');
    var optEl = document.getElementById('copilotComposerExtras');
    if (optBtn && optEl) {
      optBtn.addEventListener('click', function () {
        var open = optBtn.getAttribute('aria-expanded') === 'true';
        optEl.hidden = open;
        optBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
        optBtn.textContent = open ? '选项 ▾' : '选项 ▴';
      });
    }

    function _copilotFillPrompt(el) {
      var t = document.getElementById('copilot-input');
      var msg = (el && el.getAttribute('data-prompt')) || '';
      if (t && msg) {
        t.value = msg;
        try { t.focus(); } catch (e) {}
      }
    }
    document.querySelectorAll('.copilot-qcard[data-prompt]').forEach(function (c) {
      c.addEventListener('click', function () {
        _copilotFillPrompt(c);
      });
    });
    document.querySelectorAll('.copilot-skill-chip[data-prompt]').forEach(function (c) {
      c.addEventListener('click', function () {
        _copilotFillPrompt(c);
      });
    });

    document.querySelectorAll('.copilot-goto').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = b.getAttribute('data-goto');
        if (p && window.Router) Router.navigate(p);
        if (window.AI && typeof AI.toggleDrawer === 'function') AI.toggleDrawer(false);
      });
    });

    var tb = document.getElementById('topbar-copilot');
    if (tb) {
      tb.addEventListener('click', function () {
        if (window.AI) AI.toggleDrawer(true);
        Copilot.openTab('chat');
      });
    }
  },
};

document.addEventListener('DOMContentLoaded', function () {
  Copilot.init();
});

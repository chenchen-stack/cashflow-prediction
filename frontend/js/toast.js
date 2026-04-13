/**
 * toast.js — Toast 提示（对齐风控原型：Toast.show(type, title, desc)）
 */

window.Toast = {
  _container: null,

  _ensureContainer: function () {
    if (!this._container) {
      this._container = document.createElement('div');
      this._container.className = 'toast-container';
      document.body.appendChild(this._container);
    }
  },

  show: function (type, title, desc) {
    this._ensureContainer();
    var el = document.createElement('div');
    el.className = 'toast ' + (type || 'info');
    el.innerHTML = '<strong>' + (title || '') + '</strong>' + (desc ? ' ' + desc : '');
    this._container.appendChild(el);
    setTimeout(function () {
      el.style.opacity = '0';
      el.style.transform = 'translateX(20px)';
      el.style.transition = 'all .3s ease';
      setTimeout(function () { el.remove(); }, 300);
    }, 3000);
  },

  success: function (msg) { this.show('success', msg); },
  warn:    function (msg) { this.show('warn', msg); },
  warning: function (msg) { this.show('warn', msg); },
  danger:  function (msg) { this.show('danger', msg); },
  info:    function (msg) { this.show('info', msg); },
};

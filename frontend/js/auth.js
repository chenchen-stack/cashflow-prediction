/**
 * auth.js — 角色会话管理（对齐风控原型 sessionStorage 模式）
 */

window.Auth = {
  login: function (roleId) {
    sessionStorage.setItem('cf_role', roleId);
    if (window.location.protocol === 'file:') {
      window.location.href = 'app.html';
      return;
    }
    var host = window.location.hostname || '';
    /* GitHub Pages 等静态站无 /app 重写：与 index.html 同目录走 app.html */
    if (host === 'chenchen-stack.github.io') {
      window.location.href = 'app.html';
      return;
    }
    window.location.href = '/app';
  },

  logout: function () {
    sessionStorage.removeItem('cf_role');
    if (window.location.protocol === 'file:') {
      window.location.href = 'index.html';
      return;
    }
    var host = window.location.hostname || '';
    if (host === 'chenchen-stack.github.io') {
      window.location.href = 'index.html';
      return;
    }
    window.location.href = '/';
  },

  getCurrentRole: function () {
    var rid = sessionStorage.getItem('cf_role') || '';
    return AppData.roles[rid] || null;
  },

  getRoleId: function () {
    return sessionStorage.getItem('cf_role') || '';
  },

  hasPage: function (pageId) {
    var role = this.getCurrentRole();
    return role ? role.pages.indexOf(pageId) !== -1 : false;
  },

  isTreasurer: function () { return this.getRoleId() === 'treasurer'; },
  isCFO:       function () { return this.getRoleId() === 'cfo'; },
  isAnalyst:   function () { return this.getRoleId() === 'analyst'; },
  isBizFin:    function () { return this.getRoleId() === 'bizfin'; },
  isAdmin:     function () { return this.getRoleId() === 'admin'; },
};

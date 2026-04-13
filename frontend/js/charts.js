/**
 * charts.js — ECharts 图表
 * 配色对齐 PRD：亿流橙 #F26522 · 成功绿 #34C759 · 警示红 #FF3B30 · 墨色/灰轴 #1D1D1F / #6E6E73
 */

window.Charts = {
  _instances: {},

  _get: function (domId) {
    if (typeof echarts === 'undefined') {
      console.warn('ECharts not loaded, chart "' + domId + '" skipped.');
      var dom = document.getElementById(domId);
      if (dom) dom.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#86868B;font-size:13px;">图表库加载失败，请检查网络</div>';
      return null;
    }
    var dom = document.getElementById(domId);
    if (!dom) return null;
    if (this._instances[domId]) { this._instances[domId].resize(); return this._instances[domId]; }
    var chart = echarts.init(dom);
    this._instances[domId] = chart;
    window.addEventListener('resize', function () { chart.resize(); });
    return chart;
  },

  _colors: ['#F26522', '#D9480F', '#FF3B30', '#34C759', '#86868B', '#6E6E73'],

  _emptyOpt: function (text) {
    return {
      title: { text: text || '暂无数据', left: 'center', top: 'center', textStyle: { color: '#AEAEB2', fontSize: 13, fontWeight: 'normal' } },
      xAxis: { show: false }, yAxis: { show: false }, series: [],
    };
  },

  // ═══ 1. 头寸趋势（Dashboard） ═══
  positionTrend: function (domId, records) {
    var chart = this._get(domId); if (!chart) return;
    var byDate = {};
    (records || []).forEach(function (r) {
      if (!r.trade_date) return;
      if (r.currency && r.currency !== 'CNY') return;
      var d = r.trade_date.slice(0, 10);
      if (!byDate[d]) byDate[d] = { i: 0, o: 0 };
      if (r.amount > 0) byDate[d].i += r.amount; else byDate[d].o += Math.abs(r.amount);
    });
    var dates = Object.keys(byDate).sort();
    if (!dates.length) { chart.setOption(this._emptyOpt('暂无趋势数据')); return; }

    chart.setOption({
      tooltip: { trigger: 'axis', textStyle: { fontSize: 12 },
        axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(242,101,34,0.04)' } },
      },
      dataZoom: [
        { type: 'inside', xAxisIndex: 0, filterMode: 'none' },
        { type: 'slider', xAxisIndex: 0, bottom: 22, height: 18, textStyle: { fontSize: 10, color: '#86868B' } },
      ],
      legend: { data: ['流入', '流出', '净额'], bottom: 4, itemWidth: 14, itemHeight: 10, textStyle: { fontSize: 11, color: '#6E6E73' } },
      grid: { top: 20, right: 20, bottom: 72, left: 12, containLabel: true },
      xAxis: {
        type: 'category', data: dates,
        axisLine: { lineStyle: { color: '#E8E8ED' } },
        axisTick: { alignWithLabel: true, lineStyle: { color: '#E8E8ED' } },
        axisLabel: { fontSize: 10, color: '#86868B', formatter: function (v) { return v.slice(5); } },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#E8E8ED', type: 'dashed' } },
        axisLabel: { formatter: function (v) { return (v / 10000).toFixed(0) + '万'; }, color: '#86868B', fontSize: 10 },
      },
      series: [
        { name: '流入', type: 'bar', data: dates.map(function (d) { return byDate[d].i; }), itemStyle: { color: '#34C759', borderRadius: [3, 3, 0, 0] }, barMaxWidth: 20, barGap: '10%' },
        { name: '流出', type: 'bar', data: dates.map(function (d) { return byDate[d].o; }), itemStyle: { color: '#FF3B30', borderRadius: [3, 3, 0, 0] }, barMaxWidth: 20 },
        { name: '净额', type: 'line', data: dates.map(function (d) { return byDate[d].i - byDate[d].o; }), itemStyle: { color: '#F26522' }, smooth: true, lineStyle: { width: 2 }, symbol: 'circle', symbolSize: 5 },
      ],
    });
  },

  // ═══ 2. 流入/流出饼图（Dashboard） ═══
  flowPie: function (domId, stats) {
    var chart = this._get(domId); if (!chart) return;
    if (!stats || (!stats.total_inflow && !stats.total_outflow)) { chart.setOption(this._emptyOpt('暂无流入流出数据')); return; }

    chart.setOption({
      tooltip: { trigger: 'item', formatter: '{b}<br/>{c} ({d}%)' },
      legend: { bottom: 4, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11, color: '#6E6E73' }, type: 'scroll' },
      color: ['#34C759', '#D9480F', '#E68600', '#FF3B30', '#F26522', '#86868B'],
      series: [{
        type: 'pie', radius: ['38%', '66%'], center: ['50%', '44%'],
        label: { formatter: '{b}\n{d}%', fontSize: 11, color: '#6E6E73' },
        emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.2)' } },
        data: [
          { name: '经营性流入', value: Math.round((stats.total_inflow || 0) * 0.6) },
          { name: '投资性流入', value: Math.round((stats.total_inflow || 0) * 0.15) },
          { name: '融资性流入', value: Math.round((stats.total_inflow || 0) * 0.25) },
          { name: '经营性流出', value: Math.round((stats.total_outflow || 0) * 0.55) },
          { name: '投资性流出', value: Math.round((stats.total_outflow || 0) * 0.2) },
          { name: '融资性流出', value: Math.round((stats.total_outflow || 0) * 0.25) },
        ],
      }],
    });
    chart.off('click');
    chart.on('click', function (params) {
      if (params && params.seriesType === 'pie' && params.name && typeof window.onFlowPieSectorClick === 'function') {
        window.onFlowPieSectorClick(params.name, params);
      }
    });
  },

  // ═══ 3. 分析头寸走势（Analysis） ═══
  analysisPosition: function (domId, result) {
    var chart = this._get(domId); if (!chart) return;
    var raw = result.periods || [];
    var pos = result.position || {};
    var o = pos.opening || [];
    var inf = pos.inflow || [];
    var ouf = pos.outflow || [];
    var cl = pos.closing || [];
    var lp = raw.length;
    var n = lp > 0
      ? Math.min(lp, o.length, inf.length, ouf.length, cl.length)
      : Math.min(o.length, inf.length, ouf.length, cl.length);
    if (!n) {
      chart.setOption(this._emptyOpt('暂无头寸数据'));
      return;
    }
    var periods = (lp ? raw.slice(0, n) : Array.from({ length: n }, function (_, i) { return { label: 'P' + (i + 1) }; }))
      .map(function (p) { return p.label; });
    o = o.slice(0, n);
    inf = inf.slice(0, n);
    ouf = ouf.slice(0, n);
    cl = cl.slice(0, n);

    chart.setOption({
      tooltip: {
        trigger: 'axis', textStyle: { fontSize: 12 },
        axisPointer: { type: 'cross', crossStyle: { color: '#AEAEB2' } },
      },
      legend: {
        data: ['期末余额', '期初余额', '流入', '流出'],
        top: 4, left: 'center',
        itemWidth: 14, itemHeight: 10,
        textStyle: { fontSize: 11, color: '#6E6E73' },
      },
      grid: { top: 36, right: 20, bottom: 46, left: 14, containLabel: true },
      xAxis: {
        type: 'category', data: periods,
        axisLabel: { fontSize: 10, color: '#86868B', rotate: periods.length > 10 ? 35 : 0, interval: 0 },
        axisLine: { lineStyle: { color: '#E8E8ED' } },
        axisTick: { alignWithLabel: true },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#E8E8ED', type: 'dashed' } },
        axisLabel: { formatter: function (v) { return (v / 10000).toFixed(0) + '万'; }, fontSize: 10, color: '#86868B' },
      },
      series: [
        {
          name: '期末余额', type: 'line', data: cl,
          itemStyle: { color: '#F26522' }, smooth: true,
          areaStyle: { color: typeof echarts !== 'undefined' ? new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(242,101,34,.18)' }, { offset: 1, color: 'rgba(242,101,34,.01)' }
          ]) : 'rgba(242,101,34,.08)' },
          lineStyle: { width: 2.5 }, symbol: 'circle', symbolSize: 5, z: 10,
        },
        {
          name: '期初余额', type: 'line', data: o,
          itemStyle: { color: '#D9480F' }, lineStyle: { type: 'dashed', width: 1.5 },
          symbol: 'emptyCircle', symbolSize: 4, z: 9,
        },
        {
          name: '流入', type: 'bar', data: inf,
          itemStyle: { color: '#34C759', borderRadius: [2, 2, 0, 0] }, barMaxWidth: 16, barGap: '5%',
        },
        {
          name: '流出', type: 'bar', data: ouf.map(function (v) { return -v; }),
          itemStyle: { color: '#FF3B30', borderRadius: [0, 0, 2, 2] }, barMaxWidth: 16,
        },
      ],
    });
  },

  // ═══ 4. 计划对比（Plan） ═══
  planCompare: function (domId, plans, actualExecs) {
    var chart = this._get(domId); if (!chart) return;
    if (!plans || !plans.length) { chart.setOption(this._emptyOpt('暂无计划数据')); return; }

    var units = []; plans.forEach(function (p) { if (units.indexOf(p.unit) === -1) units.push(p.unit); });
    function safeData(unit) {
      var p = plans.find(function (x) { return x.unit === unit; });
      if (!p) return {};
      try { return typeof p.data_json === 'string' ? JSON.parse(p.data_json) : (p.data_json || {}); } catch (e) { return {}; }
    }
    function safeActual(unit) {
      if (!actualExecs) return null;
      var ex = actualExecs.find(function (x) { return x.unit === unit; });
      if (!ex) return null;
      try { return JSON.parse(ex.actual_json || '{}'); } catch (e) { return null; }
    }
    var planIn = units.map(function (u) { var d = safeData(u); return Math.abs(d['经营性流入'] || 0) + Math.abs(d['投资性流入'] || 0) + Math.abs(d['融资性流入'] || 0); });
    var planOut = units.map(function (u) { var d = safeData(u); return Math.abs(d['经营性流出'] || 0) + Math.abs(d['投资性流出'] || 0) + Math.abs(d['融资性流出'] || 0); });
    var actualIn = units.map(function (u) { var d = safeActual(u); if (!d) return 0; return Math.abs(d['经营性流入'] || 0) + Math.abs(d['投资性流入'] || 0) + Math.abs(d['融资性流入'] || 0); });
    var actualOut = units.map(function (u) { var d = safeActual(u); if (!d) return 0; return Math.abs(d['经营性流出'] || 0) + Math.abs(d['投资性流出'] || 0) + Math.abs(d['融资性流出'] || 0); });

    var hasActual = actualIn.some(function (v) { return v > 0; });
    var legendData = ['计划流入', '计划流出'];
    var series = [
      { name: '计划流入', type: 'bar', data: planIn, itemStyle: { color: '#34C759', borderRadius: [4, 4, 0, 0] }, barMaxWidth: 24, barGap: '5%' },
      { name: '计划流出', type: 'bar', data: planOut, itemStyle: { color: '#FF3B30', borderRadius: [4, 4, 0, 0] }, barMaxWidth: 24 },
    ];
    if (hasActual) {
      legendData.push('实际流入', '实际流出');
      series.push(
        { name: '实际流入', type: 'bar', data: actualIn, itemStyle: { color: 'rgba(52,199,89,0.35)', borderRadius: [4, 4, 0, 0], borderColor: '#34C759', borderWidth: 1, borderType: 'dashed' }, barMaxWidth: 24 },
        { name: '实际流出', type: 'bar', data: actualOut, itemStyle: { color: 'rgba(255,59,48,0.35)', borderRadius: [4, 4, 0, 0], borderColor: '#FF3B30', borderWidth: 1, borderType: 'dashed' }, barMaxWidth: 24 }
      );
    }

    chart.setOption({
      tooltip: { trigger: 'axis', textStyle: { fontSize: 12 } },
      legend: { data: legendData, top: 4, itemWidth: 14, itemHeight: 10, textStyle: { fontSize: 11, color: '#6E6E73' } },
      grid: { top: 36, right: 20, bottom: 12, left: 14, containLabel: true },
      xAxis: { type: 'category', data: units, axisLine: { lineStyle: { color: '#E8E8ED' } }, axisTick: { alignWithLabel: true } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: '#E8E8ED', type: 'dashed' } }, axisLabel: { formatter: function (v) { return (v / 10000).toFixed(0) + '万'; }, fontSize: 10, color: '#86868B' } },
      series: series,
    });
  },

  // ═══ 5. 敞口分布饼图（FX） ═══
  fxDist: function (domId, fxList) {
    var chart = this._get(domId); if (!chart) return;
    if (!fxList || !fxList.length) { chart.setOption(this._emptyOpt('暂无敞口数据')); return; }

    var byPair = {};
    fxList.forEach(function (e) { byPair[e.currency_pair] = (byPair[e.currency_pair] || 0) + e.notional; });

    chart.setOption({
      tooltip: { trigger: 'item', formatter: '{b}<br/>{c} ({d}%)' },
      legend: { bottom: 4, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11, color: '#6E6E73' } },
      color: this._colors,
      series: [{
        type: 'pie', radius: ['38%', '66%'], center: ['50%', '42%'],
        label: { formatter: '{b}\n{d}%', fontSize: 11, color: '#6E6E73' },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.2)' } },
        data: Object.keys(byPair).map(function (k) { return { name: k, value: byPair[k] }; }),
      }],
    });
  },

  // ═══ 6. 对冲比率横条（FX） ═══
  fxHedge: function (domId, fxList) {
    var chart = this._get(domId); if (!chart) return;
    if (!fxList || !fxList.length) { chart.setOption(this._emptyOpt('暂无对冲数据')); return; }

    var items = fxList.map(function (e) {
      return { pair: e.currency_pair, ratio: (e.hedge_ratio || 0) * 100 };
    });

    chart.setOption({
      tooltip: { trigger: 'axis', formatter: function (p) { return p[0].name + ': ' + p[0].value.toFixed(0) + '%'; } },
      grid: { top: 12, right: 40, bottom: 16, left: 14, containLabel: true },
      xAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%', fontSize: 10, color: '#86868B' }, splitLine: { lineStyle: { color: '#E8E8ED', type: 'dashed' } } },
      yAxis: { type: 'category', data: items.map(function (i) { return i.pair; }), axisLabel: { fontSize: 12, color: '#1D1D1F', fontWeight: 500 }, axisTick: { show: false }, axisLine: { lineStyle: { color: '#E8E8ED' } } },
      series: [{
        type: 'bar',
        data: items.map(function (i) {
          return {
            value: i.ratio,
            itemStyle: {
              color: i.ratio >= 60 ? '#34C759' : i.ratio >= 30 ? '#E68600' : '#FF3B30',
              borderRadius: [0, 4, 4, 0],
            },
            label: { show: true, position: 'right', formatter: '{c}%', fontSize: 11, color: '#6E6E73' },
          };
        }),
        barMaxWidth: 18, barMinHeight: 2,
      }],
    });
  },

  /** 流动性 MVP：预测期末余额 vs 实际（回测时可填实际列） */
  liquidityBalanceLine: function (domId, labels, predBalance, actualBalance) {
    var chart = this._get(domId); if (!chart) return;
    if (!labels || !labels.length) { chart.setOption(this._emptyOpt('暂无预测数据')); return; }
    var hasAct = actualBalance && actualBalance.some(function (x) { return x != null && !isNaN(x); });
    var series = [
      {
        name: '预测期末余额', type: 'line', smooth: true,
        data: predBalance,
        itemStyle: { color: '#F26522' },
        lineStyle: { width: 2.5 },
        symbol: 'circle', symbolSize: 6,
      },
    ];
    if (hasAct) {
      series.push({
        name: '实际/回测', type: 'line', smooth: true,
        data: actualBalance,
        itemStyle: { color: '#D9480F' },
        lineStyle: { width: 2, type: 'dashed' },
        symbol: 'diamond', symbolSize: 5,
      });
    }
    chart.setOption({
      tooltip: { trigger: 'axis', textStyle: { fontSize: 12 } },
      legend: { bottom: 4, data: series.map(function (s) { return s.name; }), textStyle: { fontSize: 11, color: '#6E6E73' } },
      grid: { top: 28, right: 24, bottom: 40, left: 12, containLabel: true },
      xAxis: {
        type: 'category', data: labels,
        axisLabel: { fontSize: 10, color: '#86868B', rotate: labels.length > 14 ? 32 : 0 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#E8E8ED', type: 'dashed' } },
        axisLabel: { formatter: function (v) { return (v / 10000).toFixed(0) + '万'; }, fontSize: 10, color: '#86868B' },
      },
      series: series,
    });
  },

  /** 资金流预测页：演示用日级余额 vs 警戒线 + 预警点 */
  liquidityForecastDemo: function (domId, horizonDays) {
    var chart = this._get(domId); if (!chart) return;
    var n = Math.min(Math.max(horizonDays || 90, 7), 120);
    var labels = [];
    var balance = [];
    var warnY = 1000000;
    var b = 12700000;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var i;
    for (i = 0; i < n; i++) {
      var dt = new Date(today);
      dt.setDate(dt.getDate() + i + 1);
      labels.push(dt.toISOString().slice(0, 10));
      b += Math.round((Math.random() - 0.46) * 750000);
      if (b < warnY + 400000) b = warnY + 550000 + Math.round(Math.random() * 300000);
      balance.push(b);
    }
    var alertDays = [5, 22, 41];
    var markData = alertDays.filter(function (idx) { return idx < n; }).map(function (idx) {
      return { name: '预警', coord: [labels[idx], balance[idx]], value: '!' };
    });
    chart.setOption({
      tooltip: { trigger: 'axis', textStyle: { fontSize: 12 } },
      legend: { data: ['预计每日余额'], bottom: 4, textStyle: { fontSize: 11, color: '#6E6E73' } },
      grid: { top: 36, right: 20, bottom: 48, left: 12, containLabel: true },
      xAxis: {
        type: 'category', data: labels,
        axisLabel: { fontSize: 9, color: '#86868B', rotate: n > 30 ? 40 : 0, interval: Math.max(0, Math.floor(n / 12) - 1) },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#E8E8ED', type: 'dashed' } },
        axisLabel: { formatter: function (v) { return (v / 10000).toFixed(0) + '万'; }, fontSize: 10, color: '#86868B' },
      },
      series: [
        {
          name: '预计每日余额', type: 'line', smooth: true, z: 3,
          data: balance,
          itemStyle: { color: '#2563EB' },
          lineStyle: { width: 2.2 },
          symbol: 'none',
          markLine: {
            silent: true, symbol: 'none',
            lineStyle: { color: '#E53935', type: 'dashed', width: 1.5 },
            data: [{ yAxis: warnY, label: { formatter: '100万', fontSize: 10 } }],
          },
          markPoint: {
            symbol: 'pin', symbolSize: 36,
            itemStyle: { color: '#E53935' },
            label: { show: true, formatter: '!', color: '#fff', fontSize: 11, fontWeight: 700 },
            data: markData,
          },
        },
      ],
    });
  },

  /** 资金流预测：后端 mvp-forecast 返回的日余额 + 警戒线 + 预警日索引 */
  liquidityForecastSeries: function (domId, labels, balances, warnLine, alertIndices) {
    var chart = this._get(domId); if (!chart) return;
    if (!labels || !labels.length || !balances || balances.length !== labels.length) {
      chart.setOption(this._emptyOpt('暂无预测数据'));
      return;
    }
    var n = labels.length;
    var wl = typeof warnLine === 'number' && !isNaN(warnLine) ? warnLine : 1000000;
    var markData = (alertIndices || []).filter(function (idx) {
      return idx >= 0 && idx < n;
    }).map(function (idx) {
      return { name: '预警', coord: [labels[idx], balances[idx]], value: '!' };
    });
    chart.setOption({
      tooltip: { trigger: 'axis', textStyle: { fontSize: 12 } },
      legend: { data: ['预计每日余额'], bottom: 4, textStyle: { fontSize: 11, color: '#6E6E73' } },
      grid: { top: 36, right: 20, bottom: 48, left: 12, containLabel: true },
      xAxis: {
        type: 'category', data: labels,
        axisLabel: { fontSize: 9, color: '#86868B', rotate: n > 30 ? 40 : 0, interval: Math.max(0, Math.floor(n / 12) - 1) },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#E8E8ED', type: 'dashed' } },
        axisLabel: { formatter: function (v) { return (v / 10000).toFixed(0) + '万'; }, fontSize: 10, color: '#86868B' },
      },
      series: [
        {
          name: '预计每日余额', type: 'line', smooth: true, z: 3,
          data: balances,
          itemStyle: { color: '#2563EB' },
          lineStyle: { width: 2.2 },
          symbol: 'none',
          markLine: {
            silent: true, symbol: 'none',
            lineStyle: { color: '#E53935', type: 'dashed', width: 1.5 },
            data: [{ yAxis: wl, label: { formatter: '警戒线', fontSize: 10 } }],
          },
          markPoint: markData.length ? {
            symbol: 'pin', symbolSize: 34,
            itemStyle: { color: '#E53935' },
            label: { show: true, formatter: '!', color: '#fff', fontSize: 11, fontWeight: 700 },
            data: markData,
          } : undefined,
        },
      ],
    });
  },

  /** 分析下钻：单位日级计划 vs 实际（演示） */
  analysisDrillDay: function (domId, unitName) {
    var chart = this._get(domId); if (!chart) return;
    var labels = [];
    var planD = [];
    var actD = [];
    var i;
    for (i = 0; i < 30; i++) {
      var dt = new Date();
      dt.setDate(dt.getDate() - 29 + i);
      labels.push(dt.toISOString().slice(5, 10));
      var seed = (unitName || '').charCodeAt(0) || 72;
      var p = 1800000 + (i % 7) * 120000 + (seed % 5) * 10000;
      planD.push(p);
      actD.push(Math.round(p * (0.92 + (i % 5) * 0.02)));
    }
    chart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['日计划', '日实际（已确认推演）'], top: 4, textStyle: { fontSize: 11, color: '#6E6E73' } },
      grid: { top: 40, right: 16, bottom: 28, left: 12, containLabel: true },
      xAxis: { type: 'category', data: labels, axisLabel: { fontSize: 9, color: '#86868B' } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: '#E8E8ED', type: 'dashed' } }, axisLabel: { formatter: function (v) { return (v / 10000).toFixed(0) + '万'; }, fontSize: 10 } },
      series: [
        { name: '日计划', type: 'line', smooth: true, data: planD, itemStyle: { color: '#94A3B8' }, lineStyle: { type: 'dashed', width: 1.5 } },
        { name: '日实际（已确认推演）', type: 'line', smooth: true, data: actD, itemStyle: { color: '#F26522' }, lineStyle: { width: 2 } },
      ],
    });
  },
};

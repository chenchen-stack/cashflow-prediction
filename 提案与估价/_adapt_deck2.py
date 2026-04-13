# -*- coding: utf-8 -*-
from pathlib import Path
import re

p = Path(__file__).resolve().parent / "unified-proposal" / "index.html"
t = p.read_text(encoding="utf-8")

# 去掉仍残留的 graphic img（多行属性）
t = re.sub(
    r'<img class="u-slide-graphic"[^>]*/>\s*',
    "",
    t,
)

# 封面底栏
t = t.replace(
    """        <div class="u-hero-filmstrip" aria-label="产品界面掠影，点击跳转对应实机页">
          <a href="index.html?slide=25" title="跳到实机总览">总览</a>
          <a href="index.html?slide=26" title="跳到全链路"><span>链路</span></a>
          <a href="index.html?slide=27" title="跳到审批+助手"><span>审批</span></a>
          <a href="index.html?slide=28" title="跳到付款异常"><span>异常</span></a>
        </div>""",
    """        <div class="u-hero-filmstrip" aria-label="产品界面掠影，点击跳转对应实机页">
          <a href="index.html?slide=25" title="实机 · 总览看板"><span>总览</span></a>
          <a href="index.html?slide=26" title="实机 · 资金流"><span>资金流</span></a>
          <a href="index.html?slide=27" title="实机 · 分析 + DataAgent"><span>分析</span></a>
          <a href="index.html?slide=28" title="实机 · 资金计划"><span>计划</span></a>
        </div>""",
)

t = t.replace(
    "右侧为<strong>全链路实机</strong>；本地起服务即 Live；有 <code>PPT/assets</code> 截图则叠在 iframe 上，离线也能讲。",
    "右侧为<strong>资金流实机</strong>（<code>?embed=1#cashflow</code>）；本地起前端服务即可 Live。",
)

t = t.replace(
    "口语化对齐访谈；非经营采购常被选作第一个切口。客户现场常先问「收费模式」再问具体数——话术接后文「三笔钱」与三档区间。",
    "口语化对齐访谈；<strong>经营性现金流 + 计划编报</strong>常被选作第一个切口。客户常先问「收费模式」——接后文「三笔钱」与三档区间。",
)

# Slide 3
t = t.replace(
    "<p class=\"kicker\">上线顺序（和大型套件采购惯例一致）</p>",
    "<p class=\"kicker\">上线顺序（先管道，再智能）</p>",
)
t = t.replace(
    "<h1 class=\"headline\"><span class=\"tx-a\">先把数据跑通，</span><br />再上规则与助手。</h1>",
    "<h1 class=\"headline\"><span class=\"tx-a\">先把流水与口径跑通，</span><br />再上预测、偏差与助手。</h1>",
)
t = t.replace(
    "接口、主数据、同步监控<strong>先验收</strong>，再谈规则命中与侧栏查询——和「年费 + 实施」类项目里<strong>实施常占首年软件费相当比例</strong>是同一个道理：管道不稳，后面全是返工。助手侧<strong>默认只读</strong>；任何写回须<strong>白名单 + 全量日志</strong>，便于抽查。",
    "银企/导入、科目与主体映射、计划口径<strong>先验收</strong>，再谈预测场景与 DataAgent 问数——逻辑与「年费 + 实施」类司库项目相同：<strong>数据不稳，预测不可信</strong>。助手侧<strong>默认只读</strong>；写回须<strong>白名单 + 日志</strong>。",
)
t = t.replace(
    "<strong>阶段 A</strong>：汇聚、标签、总览/链路/异常清单；<strong>阶段 B</strong>：可版本规则、审批旁呈现、受控工具调用（可查库）。",
    "<strong>阶段 A</strong>：总览、资金流、集成监控、计划与预警清单；<strong>阶段 B</strong>：预测假设版本化、偏差闭环、DataAgent 受控查库与导出。",
)
t = t.replace(
    """        <div class="u-loop" aria-label="实施顺序">
          <span>接数据</span>
          <span class="u-loop-arrow">→</span>
          <span>打标签</span>
          <span class="u-loop-arrow">→</span>
          <span>定规则</span>
          <span class="u-loop-arrow">→</span>
          <span>提醒 / 可选拦截</span>
        </div>""",
    """        <div class="u-loop" aria-label="实施顺序">
          <span>接流水</span>
          <span class="u-loop-arrow">→</span>
          <span>对计划口径</span>
          <span class="u-loop-arrow">→</span>
          <span>跑预测</span>
          <span class="u-loop-arrow">→</span>
          <span>偏差预警 / 闭环</span>
        </div>""",
)

# Slide 4 SVG 文案
t = t.replace(">第一步<", ">一阶段<")
t = t.replace(">第二步<", ">二阶段<")
t = t.replace(">数据与监控<", ">数据与可观测<")
t = t.replace(">规则与辅助<", ">预测与助手<")
t = t.replace(
    ">各系统数据拉通 · 主数据 · 业务标签<",
    ">账户流水汇聚 · 映射规则 · 计划口径<",
)
t = t.replace(
    ">一屏总览 · 异常清单 · 接口监控<",
    ">总览 KPI · 集成健康 · 预警队列<",
)
t = t.replace(
    ">验收：随便抽一笔，能说清前面环节<",
    ">验收：抽几天头寸，能说清数据来源<",
)
t = t.replace(
    ">规则可升级、可回退 · 受控查库（DataAgent）<",
    ">预测假设可版本 · 偏差可复盘 · DataAgent 问数<",
)
t = t.replace(
    ">审计导出 · 弱提醒 → 强管控（与法务对齐）<",
    ">导出对账包 · 预警分派 → 与司库制度对齐<",
)
t = t.replace(
    ">验收：干预能配置、日志能抽查<",
    ">验收：采纳率与处理时长可统计<",
)

# Slide 5
t = t.replace(
    "<p class=\"kicker\">演示与 POC 建议当场说清的三点</p>",
    "<p class=\"kicker\">演示与 POC 建议当场说清的三点</p>",
)
t = t.replace(
    "<h1 class=\"headline-sm\">取数、规则、审批旁呈现——<strong class=\"tx-a\">一条线验收</strong></h1>",
    "<h1 class=\"headline-sm\">取数、预测口径、侧栏问数——<strong class=\"tx-a\">一条线验收</strong></h1>",
)
OLD5 = """        <ul class="pain-bullets" style="max-width:52ch;margin-left:0;margin-top:1rem">
          <li><strong>① 数据来源与频率</strong>：采购 / 合同（OA）/ 付款（财资或 ERP）<strong>三路</strong>——API 或批量、增量还是 T+1；可先脱敏样例跑通再签生产接口，写进 SOW 附件。</li>
          <li><strong>② 标签与规则谁定</strong>：业务字典（如<strong>非经营采购</strong>）共建；规则<strong>有版本、可回滚</strong>（例：大额付款须关联申请）。默认<strong>提示</strong>；若要<strong>硬拦</strong>，与法务/共享中心节奏单议。</li>
          <li><strong>③ 审批界面长什么样</strong>：合同/付款单旁直接给<strong>前序是否齐、关键字段摘要</strong>；需要时由助手做<strong>受控查库</strong>，输出带来源；<strong>建议不等于审批结论</strong>，全程可导出留痕。</li>
        </ul>
        <p class=\"u-foot\" style=\"margin-top:1.1rem\">若集团另有<strong>资金预测、头寸、外汇</strong>等专项，可与司库/TMS 并行——本方案主交付锚在<strong>支付前内控可见</strong>，与 Coupa 类「支出可见」、Kyriba 类「资金可见」<strong>相邻互补</strong>，而非替代整套套件。</p>"""

NEW5 = """        <ul class="pain-bullets" style="max-width:52ch;margin-left:0;margin-top:1rem">
          <li><strong>① 流水从哪来、多勤更新</strong>：<strong>银企直连</strong>与<strong>离线导入</strong>并存时，接口/文件格式、对账频率（T+0 / T+1）写进合同附件；可先脱敏样例跑通再接生产。</li>
          <li><strong>② 预测假设谁定、怎么改</strong>：业务线参数、季节性、票据账期等<strong>共建字典</strong>；模型与假设<strong>有版本、可回滚</strong>；默认<strong>提示与解释</strong>，硬拦截节奏与财务制度对齐。</li>
          <li><strong>③ DataAgent 边界</strong>：侧栏<strong>问数、解释偏差、带出计算依据</strong>；需要时走<strong>受控工具</strong>读库；<strong>建议不等于司库决策</strong>，全程可留痕、可导出。</li>
        </ul>
        <p class=\"u-foot\" style=\"margin-top:1.1rem\">若集团同步上<strong>支付前内控 / 风控智能体</strong>，可与本方案<strong>并行</strong>：一个管「钱怎么出去」，一个管「钱怎么<strong>预见与排程</strong>」——与 TMS <strong>执行层</strong>也是互补关系。</p>"""

if OLD5 in t:
    t = t.replace(OLD5, NEW5)

# Slide 6 表格
OLD_TB = """          <tbody>
            <tr><td><strong>总览</strong></td><td>异常量、卡点、孤儿付款占比等 KPI</td><td><span class="ph1">一</span></td><td>指标依赖清洗与口径一致</td></tr>
            <tr><td><strong>全链路</strong></td><td>单笔业务在各系统的状态一览</td><td><span class="ph1">一</span></td><td>标签一致才能自动标断点</td></tr>
            <tr><td><strong>付款异常</strong></td><td>待办列表、分派、关单</td><td><span class="ph1">一→二</span></td><td>二阶段可由规则写清原因码</td></tr>
            <tr><td><strong>审批 + 助手</strong></td><td>审批界面侧栏提问，答复带来源</td><td><span class="ph2">二</span></td><td>默认只读；写回须白名单</td></tr>
            <tr><td><strong>规则引擎</strong></td><td>发布/回滚/留痕</td><td><span class="ph2">二</span></td><td>与标签、审批提示联动</td></tr>
            <tr><td><strong>审计导出</strong></td><td>按内审字段模板导出</td><td><span class="ph2">二</span></td><td>减少线下二次加工</td></tr>
            <tr><td><strong>接口监控</strong></td><td>同步任务成功率和最近失败时间</td><td><span class="ph1">一</span></td><td>先保证管道，再谈上层功能</td></tr>
          </tbody>"""

NEW_TB = """          <tbody>
            <tr><td><strong>总览看板</strong></td><td>头寸、流入流出、预警与闭环 KPI</td><td><span class="ph1">一</span></td><td>依赖流水清洗与口径一致</td></tr>
            <tr><td><strong>资金流管理</strong></td><td>明细维护、确认与预测标记</td><td><span class="ph1">一</span></td><td>在线/离线数据源对齐</td></tr>
            <tr><td><strong>分析预测</strong></td><td>运行模型、看偏差与情景</td><td><span class="ph1">一→二</span></td><td>二阶段加深假设版本与复盘</td></tr>
            <tr><td><strong>资金计划</strong></td><td>排程、偏差预警与分派</td><td><span class="ph1">一</span></td><td>与业务计划联动</td></tr>
            <tr><td><strong>外汇敞口</strong></td><td>名义额、对冲比例可视化</td><td><span class="ph1">一</span></td><td>可按模块裁剪交付</td></tr>
            <tr><td><strong>DataAgent</strong></td><td>侧栏问数、解释、操作建议</td><td><span class="ph2">二</span></td><td>受控查库；默认只读</td></tr>
            <tr><td><strong>数据集成</strong></td><td>任务、日志与健康状态</td><td><span class="ph1">一</span></td><td>管道先行</td></tr>
          </tbody>"""

if OLD_TB in t:
    t = t.replace(OLD_TB, NEW_TB)

t = t.replace(
    "<p class=\"kicker\">功能清单（与前端菜单一致）</p>",
    "<p class=\"kicker\">功能清单（与原型菜单一致）</p>",
)

# 6b story
t = t.replace(
    "<h1 class=\"headline-sm\"><strong class=\"tx-a\">晨会看板 · 白天审批带侧栏 · 下班前清异常队列</strong></h1>",
    "<h1 class=\"headline-sm\"><strong class=\"tx-a\">晨会看头寸 · 白天跑预测 · 下班前清计划偏差</strong></h1>",
)
OLD_ST = """            <ul class="u-story-list">
              <li><strong>晨会前</strong>：打开<strong>总览</strong>看当日/本周「缺前序」笔数、规则命中趋势——和 AP 自动化里强调的<strong>匹配率、例外队列</strong>是同一类管理动作。</li>
              <li><strong>白天审批</strong>：合同或付款单旁直接看<strong>采购侧是否齐套</strong>；需要明细时用侧栏发起<strong>受控查库（DataAgent）</strong>，答复带来源字段，便于复核。</li>
              <li><strong>下班前</strong>：<strong>异常清单</strong>里跟进人、状态、关单记录可查；内审按模板<strong>导出</strong>，字段与财务口径事先对齐。</li>
            </ul>
            <p class=\"u-foot\" style=\"margin-top:0.75rem\">右侧为界面缩略图；后文<strong>实机四页</strong>可当场点开。交付物以 SOW 中的界面与字段清单为准。</p>"""

NEW_ST = """            <ul class=\"u-story-list">
              <li><strong>晨会前</strong>：打开<strong>总览</strong>看净头寸、大额待审核、预测待确认——与司库<strong>头寸会</strong>节奏一致。</li>
              <li><strong>白天</strong>：分析师在<strong>分析预测</strong>里跑情景、看偏差；业务财务维护<strong>资金流与计划</strong>；需要时用 DataAgent <strong>问数并带出依据</strong>。</li>
              <li><strong>下班前</strong>：<strong>计划偏差预警</strong>队列里分派、记录处理；需要时<strong>导出</strong>对账与复盘包，口径与财务事先对齐。</li>
            </ul>
            <p class=\"u-foot\" style=\"margin-top:0.75rem\">后文<strong>实机四页</strong>可当场点开。交付物以合同中的界面与字段清单为准。</p>"""

if OLD_ST in t:
    t = t.replace(OLD_ST, NEW_ST)

# 缩略图区 figcaption
t = t.replace("<figcaption>总览</figcaption>", "<figcaption>总览</figcaption>")
t = t.replace("<figcaption>链路</figcaption>", "<figcaption>资金流</figcaption>")
t = t.replace("<figcaption>审批+助手</figcaption>", "<figcaption>分析+助手</figcaption>")
t = t.replace("<figcaption>付款异常</figcaption>", "<figcaption>资金计划</figcaption>")

# Slide 7
t = t.replace(
    "<h1 class=\"headline-sm\">定位在<strong class=\"tx-a\">跨系统看见 + 可配置规则 + 审批侧栏查询</strong></h1>",
    "<h1 class=\"headline-sm\">定位在<strong class=\"tx-a\">头寸可见 + 预测可解释 + DataAgent 问数</strong></h1>",
)

# Slide 8 why
t = t.replace(
    "<div class=\"u-why-card\"><b>按内控话术设计</b>输出要求<strong>可解释、可追溯、可导出</strong>；侧栏是<strong>辅助查阅</strong>，审批结论仍在人，责任边界写进方案。</div>",
    "<div class=\"u-why-card\"><b>按司库/CFO 话术设计</b>预测与偏差要求<strong>可解释、可追溯、可导出</strong>；DataAgent 是<strong>辅助问数</strong>，决策仍在人，责任边界写进方案。</div>",
)
t = t.replace(
    "<div class=\"u-why-card\"><b>少动核心账套</b>先把各系统数据<strong>汇聚、主数据与标签对齐</strong>，再呈现与核对；<strong>不改写 ERP/OA 核心流程</strong>——适合「先看清再决定是否大集成」的集团。</div>",
    "<div class=\"u-why-card\"><b>少动核心账套</b>以<strong>汇聚与呈现</strong>为主，预测与计划<strong>可插拔</strong>；<strong>不改写 ERP/司库核心过账流程</strong>——适合「先看清头寸与偏差，再谈深度集成」的集团。</div>",
)
t = t.replace(
    "<div class=\"u-why-card\"><b>范围写得清</b>上一页三件事 + 本页功能表，把<strong>接口、字段、规则版本、界面</strong>拆到可写进 SOW 的程度，减少口头承诺。</div>",
    "<div class=\"u-why-card\"><b>范围写得清</b>上一页三件事 + 本页功能表，把<strong>数据源、预测口径、假设版本、界面</strong>拆到可写进合同附件的程度，减少口头承诺。</div>",
)
t = t.replace(
    "<div class=\"u-why-card\"><b>切口明确</b>聚焦<strong>支付前</strong>采购—合同—付款对齐；不包圆银企直联全家桶，也不替代完整 P2P/费控套件。</div>",
    "<div class=\"u-why-card\"><b>切口明确</b>聚焦<strong>现金流预测、计划排程与偏差闭环</strong>；不承诺替代完整 TMS/司库套件，也不包圆全集团所有业务线模型定制。</div>",
)
t = t.replace(
    "<div class=\"u-why-card\"><b>可 POC 验证</b>工程可本地跑通；工具调用、模型与留痕可在尽调中逐项打开，不靠「只有演示片」。</div>",
    "<div class=\"u-why-card\"><b>可 POC 验证</b>工程可本地跑通；预测假设、DataAgent 与导出可在尽调中逐项打开，不靠「只有 PPT」。</div>",
)
t = t.replace(
    "<p class=\"u-foot\">叙述顺序建议：<strong>痛点（跨系统对不上）→ 范围（支付前）→ 里程碑（数据—规则—界面）→ 价钱与风险</strong>。</p>",
    "<p class=\"u-foot\">叙述顺序建议：<strong>痛点（口径散、预测不可信）→ 范围（预测与计划）→ 里程碑（流水—口径—模型—助手）→ 价钱与风险</strong>。</p>",
)

# TCO 本方案
t = t.replace(
    "<li><strong>本方案（风控智能体）</strong>：",
    "<li><strong>本方案（资金预测智能体）</strong>：",
)

t = t.replace(
    "详见后文「三笔钱」、三档报价与附录。",
    "详见后文「三笔钱」、三档报价与附录（结构与风控包<strong>同构</strong>，场景不同）。",
)

# 甘特条文字
t = t.replace("总览/链路/异常/规则", "总览/资金流/计划/预测")
t = t.replace("W6–12 总览/资金流/计划/预测（与左条并行）", "W6–12 功能联调/UAT（与左条并行）")

# Appendix 竞品表三行
t = t.replace(
    "<td>接银行、支付工厂；<strong>互补</strong>——我们做采购—付款内控看见。</td>",
    "<td>接银行、支付工厂；<strong>互补</strong>——我们做<strong>预测与计划看见</strong>。</td>",
)
t = t.replace(
    "<td><strong>强互补</strong>——风控专题或 AI 子项目嵌入。</td>",
    "<td><strong>强互补</strong>——预测/AI 子项目可嵌入司库门户。</td>",
)
t = t.replace(
    "说明与专项风控屏的差异",
    "说明与专项预测屏的差异",
)

# Appendix 差异化左列
t = t.replace(
    "<li>国内司库：资金强，采购—付款异常仍散在 OA/ERP。</li>",
    "<li>国内司库：执行强，<strong>预测与计划</strong>仍常散在 Excel。</li>",
)
t = t.replace(
    "<li><strong>一条业务叙事</strong>：总览、链路、异常、规则、导出同一套字段与口径。</li>",
    "<li><strong>一条资金叙事</strong>：总览、流水、计划、预测、预警同一套口径。</li>",
)

# 案例页
t = t.replace(
    "<p><strong>现状</strong>：采购、OA、财资/ERP <strong>字段与状态对不齐</strong>；全量深度集成评估后<strong>预算与周期</strong>过高，项目<strong>暂缓</strong>，核心系统短期内不动。</p>",
    "<p><strong>现状</strong>：多法人、多数据源，<strong>计划与预测各算各的</strong>；上大型 TMS 预算与周期压力大，先做<strong>专题预测</strong>更现实。</p>",
)
t = t.replace(
    "<p style=\"margin-top:0.65rem\"><strong>风控在干什么</strong>：靠<strong>专人导出 + 手工核对前序</strong>；与上 Coupa 类套件前「例外付款」堆积的情况类似，只是缺少统一界面。</p>",
    "<p style=\"margin-top:0.65rem\"><strong>司库在干什么</strong>：靠<strong>Excel 拼头寸</strong>；会前临时改数，<strong>难以复盘预测依据</strong>。</p>",
)
t = t.replace(
    "<p style=\"margin-top:0.65rem\"><strong>一期目标</strong>：先把<strong>链路看清</strong>（例：合同审批旁看到采购侧是否齐），<strong>不承诺</strong>一期上全自动通过。</p>",
    "<p style=\"margin-top:0.65rem\"><strong>一期目标</strong>：先把<strong>流水 + 计划 + 预测一屏看清</strong>，偏差可预警、可导出，<strong>不承诺</strong>一期替代全集团资金系统。</p>",
)
t = t.replace(
    "<p style=\"margin-top:0.65rem\"><strong>常见切口</strong>：<strong>非经营采购</strong>——笔数多、口径相对集中。<strong>落地路径</strong>：三路抓数 → 共建标签/规则 → 审批旁呈现 + 侧栏受控查询。</p>",
    "<p style=\"margin-top:0.65rem\"><strong>常见切口</strong>：<strong>经营性现金流 + 周/月计划</strong>。<strong>落地路径</strong>：接流水 → 对计划口径 → 上预测与预警 → DataAgent 问数。</p>",
)

# Demo slides
t = t.replace("Live · 风控总览", "Live · 总览看板")
t = t.replace(
    "<p class=\"kicker\">实机 · 全链路</p>",
    "<p class=\"kicker\">实机 · 资金流</p>",
)
t = t.replace(
    "<h2 class=\"headline-xs\">一笔钱从预算走到付款，<strong>哪步红了</strong>一眼看到</h2>",
    "<h2 class=\"headline-xs\">流入流出与确认状态，<strong>一表看清</strong></h2>",
)
t = t.replace(
    "<div class=\"stage-chrome\">Live · 全链路</div>",
    "<div class=\"stage-chrome\">Live · 资金流</div>",
)
t = t.replace('iframe title="链路"', 'iframe title="资金流"')
t = t.replace(
    "强调「每笔走到哪、哪步红了」，减少跨部门口头对账。",
    "强调在线/离线数据源、确认与预测标记，减少临时拼表。",
)

t = t.replace(
    "<p class=\"kicker\">实机 · 审批 + 侧栏查询</p>",
    "<p class=\"kicker\">实机 · 分析预测 + DataAgent</p>",
)
t = t.replace(
    "<h2 class=\"headline-xs\">边批边查，<strong>答复带来源字段</strong></h2>",
    "<h2 class=\"headline-xs\">跑分析、看偏差，<strong>侧栏问数带依据</strong></h2>",
)
t = t.replace(
    "<div class=\"stage-chrome\">Live · 审批 + DataAgent</div>",
    "<div class=\"stage-chrome\">Live · 分析 + DataAgent</div>",
)
t = t.replace('iframe title="审批"', 'iframe title="分析预测"')
t = t.replace(
    "上线前须完成权限、安全与模型评审；工具白名单写进运维手册。",
    "上线前须完成权限、安全与模型评审；DataAgent 工具白名单写进运维手册。",
)

t = t.replace(
    "<p class=\"kicker\">实机 · 付款异常</p>",
    "<p class=\"kicker\">实机 · 资金计划</p>",
)
t = t.replace(
    "<h2 class=\"headline-xs\">该补合同、该补申请的，<strong>拉成清单</strong>好分派</h2>",
    "<h2 class=\"headline-xs\">计划与实际的偏差，<strong>预警分派</strong>可跟踪</h2>",
)
t = t.replace(
    "<div class=\"stage-chrome\">Live · 付款异常</div>",
    "<div class=\"stage-chrome\">Live · 资金计划</div>",
)
t = t.replace('iframe title="异常"', 'iframe title="资金计划"')
t = t.replace(
    "对标 AP 例外队列：谁跟进、何时关单，可导出。",
    "对标计划执行复盘：谁跟进、何时闭环，可导出。",
)

t = t.replace(
    "<!-- 对客户：收费口径（风控智能体 / Agent 落地）— 紧接三档报价页 -->",
    "<!-- 对客户：收费口径（资金预测智能体 / Agent 落地）— 紧接三档报价页 -->",
)
t = t.replace(
    "——总览、全流程、异常单、规则、给审计导出、审批旁边的小助手等",
    "——总览、资金流、分析预测、资金计划、预警导出、侧栏 DataAgent 等",
)
t = t.replace(
    "<li><strong>③ 大模型（助手）怎么用</strong>：审批时点「问一句」、自动帮查数会走大模型，用量要<strong>单独算钱</strong>。",
    "<li><strong>③ 大模型（助手）怎么用</strong>：司库点「问一句」、自动帮查数/解释偏差会走大模型，用量要<strong>单独算钱</strong>。",
)

t = t.replace(
    "<h2 class=\"headline-xs\">一屏看清<strong>风险与趋势</strong>（可运行演示）</h2>",
    "<h2 class=\"headline-xs\">一屏看清<strong>头寸与趋势</strong>（可运行演示）</h2>",
)

# 标准交付 tier 描述
t = t.replace(
    "<p>接口多、规则配齐、能导出给审计看，审批里深度用助手</p>",
    "<p>数据源多、预测场景做全、计划偏差闭环、DataAgent 深度使用</p>",
)

# 试点 tier
t = t.replace(
    "<p>先做一小块，接的系统少，以提醒为主，助手多看、少改数据</p>",
    "<p>先做单法人或单业务线，以看板 + 计划为主，助手多看、少改数据</p>",
)

p.write_text(t, encoding="utf-8")
print("adapt2 ok")

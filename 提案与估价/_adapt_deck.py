# -*- coding: utf-8 -*-
"""一次性：将复制的风控 unified-proposal 改为资金预测口径与 iframe 路由。"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
p = ROOT / "unified-proposal" / "index.html"
text = p.read_text(encoding="utf-8")

# iframe：hash 路由
text = text.replace(
    "../../frontend/app.html?embed=1&amp;page=overview",
    "../../frontend/app.html?embed=1#dashboard",
)
text = text.replace(
    "../../frontend/app.html?embed=1&amp;page=chain",
    "../../frontend/app.html?embed=1#cashflow",
)
text = text.replace(
    "../../frontend/app.html?embed=1&amp;page=approval&amp;ai=1",
    "../../frontend/app.html?embed=1&amp;ai=1#analysis",
)
text = text.replace(
    "../../frontend/app.html?embed=1&amp;page=payment",
    "../../frontend/app.html?embed=1#plan",
)

# 去掉依赖风控工程 PPT/assets 的缩略图与叠层（本仓库无这些 PNG）
text = re.sub(r"\s*<img class=\"shot\"[^>]*/>", "", text)
text = re.sub(
    r"<img src=\"\.\./\.\./PPT/assets/[^\"]+\"[^>]*/>",
    "",
    text,
)
text = re.sub(
    r"<p class=\"u-slide-graphic-caption\">[^<]*</p>\s*",
    "",
    text,
)

pairs = [
    ("风控智能体 · 完整提案 — 亿流科技", "资金预测智能体 · 完整提案 — 亿流科技"),
    ("<!-- 1 封面：主视觉「风控智能体」全屏沉浸 -->", "<!-- 1 封面：主视觉「资金预测智能体」全屏沉浸 -->"),
    ("<p class=\"u-hero-eyebrow\">支付前内控 · 跨系统对齐</p>", "<p class=\"u-hero-eyebrow\">账户流水 · 预测排程 · 头寸可见</p>"),
    ("<h1 class=\"u-hero-mega\" lang=\"zh-CN\">风控智能体</h1>", "<h1 class=\"u-hero-mega\" lang=\"zh-CN\">资金预测智能体</h1>"),
    (
        "<p class=\"u-hero-lead\">同一笔业务，从<strong>采购、合同到付款</strong>，在一屏里<strong>对得上、查得到、交得出底稿</strong>。</p>",
        "<p class=\"u-hero-lead\">把<strong>账户、流水、应收应付与预测</strong>拢到一屏，看清<strong>未来几周头寸</strong>，方便排理财、融资和<strong>大额审批前</strong>心里有数。</p>",
    ),
    (
        "<p class=\"u-hero-boundary\">助手负责<strong>提示与受控查数</strong>；<strong>审批与责任在人</strong>——适合要落地、要审计、要过会的那类项目。</p>",
        "<p class=\"u-hero-boundary\">DataAgent 负责<strong>问数、解释偏差与操作建议</strong>；<strong>拍板仍在人</strong>——适合司库/CFO 要看清预测依据、又要能对外讲清口径的项目。</p>",
    ),
    ("与「现金流预测」同属资金管理智能化方向；<strong>本套材料主讲支付前内控与跨系统对齐</strong>。", "与「支付前内控 / 风控智能体」同属司库智能化方向；<strong>本套材料主讲现金流预测、计划与头寸可见</strong>。"),
    ("<p class=\"kicker\">买方现场常听到的抱怨</p>", "<p class=\"kicker\">司库与财务现场常听到的抱怨</p>"),
    (
        "<h1 class=\"headline-sm\">问题往往不在「缺一个 AI」，<br />在<strong class=\"tx-a\">三套系统各有一套说法</strong>。</h1>",
        "<h1 class=\"headline-sm\">问题往往不在「缺一个模型」，<br />在<strong class=\"tx-a\">流水、计划、预测各算各的</strong>。</h1>",
    ),
    (
        "打个比方：采购、合同、付款像<strong>三条没对齐的火车轨</strong>——审批的人<strong>看不到前一站卸了什么货</strong>，只能翻附件、打电话问。",
        "打个比方：<strong>网银流水、业务计划、预测模型</strong>像三张表——会上问「下周钱够不够」，往往要<strong>临时拼 Excel</strong>，谁也不敢拍胸脯。",
    ),
    (
        """            <div class="u-chain" aria-label="业务断点" style="justify-content:flex-start">
              <span class="u-chain-node"><strong>采购</strong> 下单验收</span>
              <span class="u-chain-arrow">≠</span>
              <span class="u-chain-node"><strong>OA</strong> 合同付款单</span>
              <span class="u-chain-arrow">≠</span>
              <span class="u-chain-node"><strong>财资/ERP</strong> 真付钱</span>
            </div>""",
        """            <div class="u-chain" aria-label="数据断点" style="justify-content:flex-start">
              <span class="u-chain-node"><strong>账户流水</strong> 银企/导入</span>
              <span class="u-chain-arrow">+</span>
              <span class="u-chain-node"><strong>业务计划</strong> 收支排程</span>
              <span class="u-chain-arrow">→</span>
              <span class="u-chain-node"><strong>预测与预警</strong> 可解释</span>
            </div>""",
    ),
]

# 痛点列表：整块替换 ul
OLD_UL = """            <ul class="pain-bullets" style="max-width:48ch;margin-left:0;margin-top:0.85rem">
              <li>内控希望<strong>付款前</strong>就看到缺口，而不是月底在 Excel 里对账。</li>
              <li>审计要<strong>证据链</strong>：谁批的、按哪条规则、系统提示了什么——能导出、能复查。</li>
              <li><strong>先统一口径再谈智能</strong>：采购、合同、付款往往在<strong>不同系统里各有一套字段和状态</strong>。风控智能体先把数据<strong>汇聚、打同一套标签</strong>，再在一屏里呈现——对内可叫「数据中台」，对客户讲<strong>一屏能对上、能留痕</strong>就好懂。</li>
              <li>采购与支出类厂商（如 Coupa / Ariba 路线）强调<strong>事前可见与匹配率</strong>；财资/TMS（如 Kyriba 路线）强调<strong>银行与头寸</strong>——我们补的是<strong>支付前跨系统对齐</strong>这一截，不抢整条赛道。</li>
            </ul>"""

NEW_UL = """            <ul class="pain-bullets" style="max-width:48ch;margin-left:0;margin-top:0.85rem">
              <li>CFO 要回答<strong>「未来 30/60 天头寸」</strong>，但预测假设散落在业务线，一调参数全员重算。</li>
              <li><strong>在线户与离线户</strong>并存：直连能自动拉流水，离线户仍靠导出——需要<strong>统一汇聚与对账口径</strong>。</li>
              <li><strong>先统一数据再谈算法</strong>：科目、账户、业务标签对齐后，预测与偏差预警才<strong>可解释、可复盘</strong>；对内常说「数据底座」，对客户讲<strong>一屏能讲清钱从哪来、要到哪去</strong>。</li>
              <li>TMS/司库套件强项在<strong>银企与支付执行</strong>；本方案侧重<strong>预测、计划排程与偏差闭环</strong>——与风控「支付前对齐」、与 TMS <strong>相邻互补</strong>，不承诺替代整套司库。</li>
            </ul>"""

if OLD_UL in text:
    text = text.replace(OLD_UL, NEW_UL)

for a, b in pairs:
    if a in text:
        text = text.replace(a, b)

# 实机 chrome 条文案
text = text.replace("Live · 全链路", "Live · 资金流")
text = text.replace("原型 · 全链路一屏（交付物样貌）", "原型 · 资金流一屏（交付物样貌）")
text = text.replace('iframe title="全链路界面原型"', 'iframe title="资金流界面原型"')

# 封面 filmstrip 纯文字（图片已删）
text = text.replace(
    '<a href="index.html?slide=25" title="跳到实机总览"><span>总览</span></a>',
    '<a href="index.html?slide=25" title="跳到实机总览">总览</a>',
)

p.write_text(text, encoding="utf-8")
print("ok:", p)

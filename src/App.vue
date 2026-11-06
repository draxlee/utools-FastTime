<template>
  <main class="help-page" aria-labelledby="app-title">
    <header class="page-header">
      <img class="app-logo" src="/logo-fasttime.png" alt="" width="48" height="48" />
      <div>
        <p class="eyebrow">使用说明</p>
        <h1 id="app-title">FastTime</h1>
      </div>
      <span class="local-badge">本地转换</span>
    </header>

    <section class="intro" aria-labelledby="intro-title">
      <h2 id="intro-title">输入时间，答案就在搜索框。</h2>
      <p>时间戳与日期互转，点击复制。日常使用直接在 uTools 主搜索框输入，即可查看转换结果。</p>
    </section>

    <aside class="permission-note" aria-labelledby="permission-title">
      <span class="note-marker" aria-hidden="true">i</span>
      <div>
        <h2 id="permission-title">首次使用，先允许推送</h2>
        <p>请在 uTools 中为 FastTime 开启“允许推送内容到搜索框”。授权由 uTools 管理，需由你手动开启。</p>
      </div>
    </aside>

    <ol class="usage-steps" aria-label="使用步骤">
      <li><span class="step-number" aria-hidden="true">01</span><div><strong>直接输入</strong><p>无需 FastTime 前缀</p></div></li>
      <li><span class="step-number" aria-hidden="true">02</span><div><strong>选择答案</strong><p>时间戳显示本地、UTC 两项；日期显示秒、毫秒两项</p></div></li>
      <li><span class="step-number" aria-hidden="true">03</span><div><strong>点击即可复制</strong><p>也可回车，仅复制纯值</p></div></li>
    </ol>

    <section class="formats" aria-labelledby="formats-title">
      <div class="section-heading">
        <h2 id="formats-title">支持的常见格式</h2>
        <span>以下内容可直接输入</span>
      </div>
      <dl class="format-list">
        <div class="format-row">
          <dt>时间戳 <span>→ 本地 / UTC 日期</span></dt>
          <dd><code>1700000000</code><code>1700000000123</code><p>10 位秒级 / 13 位毫秒级非负整数</p></dd>
        </div>
        <div class="format-row">
          <dt>日期与时间 <span>→ 秒 / 毫秒</span></dt>
          <dd><code>2023-11-14</code><code>2023/11/14 22:13:20.123</code><p>日期可用 - 或 /；可追加 HH:mm、HH:mm:ss 或 1–3 位小数秒</p></dd>
        </div>
        <div class="format-row">
          <dt>显式时区 <span>→ 秒 / 毫秒</span></dt>
          <dd><code>2023-11-14T22:13:20.123Z</code><code>2023-11-15 06:13:20+08:00</code><p>连字符日期时间支持 T 或空格分隔，以及 Z、±HH:mm 后缀</p></dd>
        </div>
      </dl>
    </section>

    <section class="rules" aria-label="转换规则">
      <div><h2>时区与精度</h2><p>时间戳同时显示本地日期和 UTC 日期；本地日期标注实际时区偏移（如 UTC+8）。日期输入默认使用电脑本地时区，带显式时区时以该时区为准。仅日期按零点计算，省略秒按 0 计算，保留毫秒精度。</p></div>
      <div><h2>明确格式，准确转换</h2><p>年月日、时分秒需补齐位数，日期分隔符保持一致。无效日期、自然语言和其他位数、负数或小数时间戳不产生结果。</p></div>
    </section>

    <footer class="page-footer">
      <p>离线可用 · 不发送输入 · 不保存历史</p>
      <p>搜索 <code>FastTime</code> 可再次查看本说明。</p>
    </footer>
  </main>
</template>

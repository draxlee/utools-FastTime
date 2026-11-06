# Design

## Context

动机与产品范围见 `proposal.md`。当前项目为 Vue 3/Vite 示例工程，`public/plugin.json` 声明 hello 和读文档功能，`public/preload.js` 暴露文件读取接口，`src/App.vue` 按入口渲染两个示例。尚无测试脚本和主规格，不是 Git 仓库。

本变更横跨宿主匹配、preload 回调和纯日期转换，需要固定数据边界。uTools API 依据 utools-plugin-dev 技能的官方文档：`references/development/plugin-json.md` 的 `feature.mainPush` 和 `regex`，`references/api-reference/events.md` 的 `onMainPush`，`references/api-reference/copy.md` 的 `copyText`，以及 `references/development/preload.md`。运行环境以该技能的架构文档为准，不以开发机版本推断。

## Goals / Non-Goals

**Goals:**
- 将日期解析与宿主集成解耦，测试可独立覆盖时区和格式边界。
- 在 preload 阶段注册推送，不依赖 Vue 页面挂载或进入说明页。
- 沿用 Vue/Vite 和现有 logo，不增加运行时依赖；构建产物包含所需本地模块。

**Non-Goals:**
- 不增加可配置时区、历史、数据库、网络请求或其他插件工具。
- 不设计转换面板或自定义窗口；仅保留官方要求的功能指令对应的精简说明页。
- 不修改开发机级 OpenSpec 配置、不初始化 Git、不在本阶段发布插件。

## Decisions

### 1. 明确格式解析而非宽松猜测

采用用户已选定的常见格式自动识别。`public/lib/timestamp.js` 以 CommonJS 导出 `convertTimestamp(input)`，返回 `{ kind, value, timezone? }[]`，其中 kind 为 `datetime`、`utc`、`seconds` 或 `milliseconds`；无效输入返回空数组。不直接调用 `Date.parse` 猜测任意字符串，不引入日期库。

先去除首尾空白，再识别 10/13 位纯数字，否则按规格固定语法提取日期字段。使用显式字段范围、月份天数和闰年校验，拒绝混合分隔符、日期溢出、非法时区、小数超过三位及多余尾部文本。

无时区时用本地日期构造并回读字段校验，防止夏令时空缺被自动进位。显式时区先构造 UTC 日期字段再减去偏移；处理 JavaScript 将 0 至 99 年映射到 1900 年代的问题，使用完整年份设置方法。仅接收公历 0001 至 9999 年。秒级输出用毫秒整数精确生成十进制字符串，保证负的亚秒时间正确，不使用整数截断。

补充边界由开发者决定并已落入规格：小数秒限 1 至 3 位；小时分钟必须补零；夏令时重复时间使用较早时间点；偏移接受 00 至 23 小时、00 至 59 分钟。它们用于让未明确的格式边界可测试，不扩展为自然语言识别。

### 2. 在 preload 注册推送并保持 CommonJS

`public/lib/main-push.js` 导出 `registerMainPush(utools)`；`public/preload.js` 加载并调用它，移除原示例文件读取桥接。转换模块随 `public/` 一起复制至 `dist/`，不依赖前端 ESM 构建或 node_modules。

`public/plugin.json` 用 `timestamp` 功能声明 `mainPush: true` 和受限的 regex 匹配指令，另设不启用 mainPush 的 `help` 功能提供唯一的 `FastTime` 说明指令。匹配器覆盖规格的输入语法及首尾空白；最终日期有效性由转换模块判断。功能使用官方文档的 `description` 字段，替换示例的 `explain`。保留已有本地开发入口配置。

宿主验收发现：同一 mainPush 功能的说明指令返回空推送结果时，说明指令也从主搜索结果消失。因此将帮助与转换拆为两个功能入口；它们仍属于同一轻量插件，正常转换不进入界面，使用说明可被直接搜索。这一调整修复既定说明入口行为，不增加产品范围。

相较在 Vue 的 onMounted 注册，preload 不需要先进入界面，符合首次直接搜索的目标。匹配和授权、冷启动时回调触发仍须由 uTools 实测，不能用普通浏览器代替。

### 3. 展示标签与复制值分离

时间戳输入返回本地时间和 UTC 时间两项，分别使用 local/UTC 字段格式化；本地 timezone 使用输入时刻的 `getTimezoneOffset()`，支持小时、小时时分及夏令时变化，显示 `UTC+8`、`UTC+5:30` 等。UTC 项标记 `UTC+0`。日期值不附加偏移文字，偏移只在展示标签中出现。后续体验优化：结果 text 只保留类型、时间与必要时区，不再逐行重复复制提示；UTC 行省略冗余的 UTC+0 标记。全部结果通过 title 悬停提示“点击复制，或选中后按回车”，复制仍取纯 value。


推送回调仅处理 `code: timestamp` 的匹配输入，将转换值和类型说明组合为 `MainPushResult.text`，提供 `title` 说明。说明指令不返回转换结果。选择回调使用事件的原始 payload 重新计算，按完整 text 寻找对应结果，复制其纯 value；不把标签当值复制，不使用容易过期的全局最近结果缓存。

`copyText` 返回 false 或抛出异常时，调用官方 `showNotification` 反馈复制失败（实施前读取《系统 API》对应章节）。选择回调任何路径均不返回 true，从而不进入插件页面。不要直接返回 copyText 的布尔值，因为 true 在 onSelect 中意味着进入插件。

### 4. 使用说明与发布描述

`src/App.vue` 和 `src/main.css` 替换为精简说明，移除两个演示组件；`index.html` 使用中文语言标识和 FastTime 标题。说明只展示授权要求、输入示例、本地时区规则、格式范围及回车复制方式，不提供转换输入框或自建权限开关。

`docs/app-description.md` 保存用户要求的中文应用描述，覆盖功能、设计理念和使用方式。授权入口的具体点击路径未获官方文档确认，文案只描述用户需要开启的设置，实测确认后才能补充路径。

### 5. 验证分层

采用 Node 内置测试运行器，无需安装测试框架。`tests/timestamp.test.cjs` 通过固定 TZ 的独立进程覆盖 UTC、Asia/Shanghai、America/New_York；预期结果用已知字面量，不复用待测转换算法计算。

`tests/main-push.test.cjs` 运行真实 preload 和本地模块，仅替代宿主 API 边界，验证正常与无效输入、匹配配置覆盖、两条结果排序、剪贴板值、错误反馈及 onSelect 不进入插件的返回语义。`npm test` 运行全套测试，`npm run build` 验证 Vue 构建及产物路径完整。

最后在 uTools 开发者工具中进行宿主验收，涵盖首次直接搜索、开启/关闭推送、修改输入、回车和鼠标选择复制。未实际执行则保留为未完成任务，不能以单元测试或浏览器预览冒充宿主验收。

## Risks / Trade-offs

- [数字长度规则不支持全部历史时间戳] → 首版按已确认的 10/13 位规则实现，明确说明其他位数和负数字输入不匹配。
- [本地日期涉及夏令时] → 拒绝不存在的本地时间；重复时间按较早点处理，测试固定时区边界；用户可输入显式偏移消除歧义。
- [权限与首次推送依赖宿主行为] → 声明 mainPush 并在 preload 注册，在 uTools 实测开启、关闭和冷启动，不承诺自动授权。
- [搜索显示标签可能污染剪贴板] → 每次选择从原输入推导值，严格验证选中项，仅复制 value。
- [复制 API 的 true 导致意外进入页面] → onSelect 不透传复制返回值，以边界测试固定行为。
- [生产包遗漏本地模块] → 模块放入 public，构建后检查 plugin.json 的入口和 require 链文件存在。

## Migration Plan

1. 先完成纯转换模块和测试，再接入 preload 与匹配配置。
2. 替换演示说明页和发布描述，运行全套测试及生产构建。
3. 使用开发者工具加载开发配置和生产目录，人工确认宿主验收项。
4. 不涉及用户数据迁移。回退时恢复工程示例或此前构建；测试包未发布前不改变其他用户安装。

## Visual Identity

用户选择 B 石墨薄荷系列：统一石墨黑圆角方底、薄荷绿粗线与圆角端点，图形右上保留一处斜切断口作为系列识别。FastTime 使用时钟，后续 FastJson 使用花括号、FastJwt 使用钥匙；沿用相同底色、线宽、留白和圆角。系列参考保存在 `docs/branding/fast-series-b-reference.png`，生成提示保存在 `docs/branding/imagegen.json`。生产图标为 `public/logo-fasttime.png`，PNG 透明外角，图标内不放文字。

实测图标刷新限制：覆盖同名 `logo.png`、重新安装及重新导入后，开发者工具仍显示原图；仅改变资源文件名为 `logo-fasttime.png` 并更新 manifest 后重新导入，界面才加载新图。已同步帮助页引用和生产资源，避免继续复用旧图路径。这是当前宿主的实测结果，不假定未文档化的缓存 API。

生产 Logo 尺寸固定为 256×256 像素并保留 PNG 透明通道；高清原图保存于 `docs/branding/fasttime-logo-master.png`，不随插件资源打包。

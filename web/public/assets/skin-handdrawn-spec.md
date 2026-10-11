# 「小小我」手绘皮肤规范（RoughJS 视觉层）

> 用途：给望舒做 H5 手绘皮肤用。原则来自制作方针——Ant Design Mobile 负责交互，RoughJS / Rough Notation 只负责「儿童绘本感」视觉层，不要让手绘库承担表单、弹层、手势等基础能力。

## 总体风格

- 气质：儿童绘本、铅笔草稿感、温柔不刺眼。线条略微抖动但不潦草。
- 所有手绘元素不使用纯黑描边，统一用暖灰棕 `#5B4A3F`。
- 页面底色：米白 `#FBF8F2`；卡片底：白 `#FFFFFF`。
- 情绪强调色直接取自 `emotions/manifest.json` 的 `color` / `glow` 字段，不在皮肤里另造色板。

## RoughJS 全局参数建议

```js
const ROUGH_BASE = {
  roughness: 1.4,      // 整体抖动感；>2 会显得潦草，<0.8 失去手绘感
  bowing: 2.5,         // 线条弓形弯曲；长边（卡片边框）可用 3.5
  strokeWidth: 2,      // 主要描边 2px；强调圈线 2.5px
  stroke: '#5B4A3F',
  fillWeight: 1.2,     // 填充线粗细，约为描边一半
  hachureGap: 6,       // 填充线间距
  hachureAngle: -41,   // 默认即可
  seed: 42,            // 固定 seed，保证同一元素每次渲染形状稳定
};
```

- `seed` 必须固定：同一卡片重渲染时形状不变，否则列表滚动会「线条跳动」。
- 同一个 DOM 元素只画一次 SVG 叠加层，不跟随 state 高频重绘。

## 组件级用法

### 心情云朵（情绪气泡）

- 形状：若干个 `ellipse` 叠加成云（3 个圆：主圆 + 左右各一个 60% 大小圆）。
- 参数：`roughness 1.8`、`bowing 3`，让云边更蓬松。
- 描边用当前情绪色（manifest `color`），填充 `fillStyle: 'hachure'` + `glow` 色，`fillWeight 1`。
- 白色平静态：描边 `#D8D2C4`（暖浅灰），避免白线上白底看不见。

### 卡片边框（日记卡片 / 日历卡片）

- 形状：`rectangle`，`roughness 1.2`、`bowing 3.5`（长边多一点弓形更像手画）。
- 描边 `#5B4A3F` 2px；不填充或 `fillStyle: 'solid'` 白底。
- 卡片圆角不要 CSS `border-radius` 与 RoughJS 混用——手绘层盖在直角矩形上即可，圆角交给 RoughJS 的自然抖边。

### 强调圈线（情绪词、日记重点句）

- 用 Rough Notation，不用 RoughJS 自己画：
  - 情绪词：`type: 'circle'`，颜色取情绪 `color`，`strokeWidth 2.5`，`animationDuration 600ms`。
  - 重点句：`type: 'underline'` 或 `'highlight'`，highlight 用 `glow` 色 40% 透明度。
  - `multiline: true`、`iterations: 2`（描两遍更有手绘感）。

### 分隔线 / 背景线条

- `line`，`roughness 2`、`bowing 1.5`、`strokeWidth 1.5`，颜色 `#D8D2C4`。
- 首页空舞台背景不加手绘线，保持干净（场景图已是完整氛围）。

## 字号与排版（配合手绘皮肤）

- 字体：系统圆体优先 `PingFang SC` / `HarmonyOS Sans` / fallback 圆体；不引入手写字体文件（体积与版权都不划算）。
- 对话正文 16px / 行高 1.7；日记正文 15px；卡片标题 18px 600。
- 手绘 SVG 层统一 `pointer-events: none`，绝对定位叠在组件上，不拦截触摸。

## 禁区

- 不用 RoughJS 画按钮可点区域、输入框、Modal——这些交给 Ant Design Mobile，手绘只叠皮肤。
- 不混用多种描边色：同一屏最多 1 个情绪强调色 + 暖灰棕基线。
- 不在情绪角色图、场景图上叠加手绘边框（素材本身已是完整画面）。

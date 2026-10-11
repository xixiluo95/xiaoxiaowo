# src/ui — 可替换 UI 工程层

「小小我」儿童端的换肤 / 换页配置层。原则：**配置只控制呈现，行为语义不可被配置破坏**。

## 配置入口（改哪里）

唯一入口：`src/ui/overrides.ts` 里的 `uiOverrides`：

```ts
export const uiOverrides = {
  theme: {},   // 主题 tokens 覆盖（颜色/圆角/字号/描边），见 tokens.ts 的 ThemeOverrides
  buttons: {}, // 单个按钮覆盖，键为 ActionId，值见 buttonConfig.ts 的 ButtonOverride
  pages: {},   // 整页替换，键为 PageKey，值为 React 组件
};
```

- 主题字段：`color.bg / ink / card / muted / line / emotion.{joy,sadness,anger,fear,calm} / emotionGlow.*`、`radius.{card,button,input}`、`fontSize.{body,diary,cardTitle,small}`、`stroke.{color,width}`。
- 按钮字段：`label / icon / colors{bg,fg,border} / shape('pill'|'round'|'rounded') / size{height,fontSize,paddingX,minWidth} / states.{disabled,active,recording} / ariaLabel`。
- 页面键：`child.home`、`child.calendar`、`child.diary`、`child.me`、`parent.home`、`parent.calendar`。

## 能改什么 / 不能改什么

能改（纯呈现）：
- 颜色、圆角、字号、描边等主题变量（写入 `:root` 的 `--xxw-*` CSS 变量）。
- 任意按钮的文案、图标、颜色、形状、尺寸、各态色变体。
- 任意页面整体替换成另一个组件。

不能改（由组件保证，配置破坏不了）：
- 按住说话语义：`pointerdown` 开始录音，`pointerup / pointercancel / pointerleave` 结束（`ActionButton` 的 hold 语义）。
- `disabled` 行为、`aria-label` 兜底。
- STT / TTS / 日记 / 日历等接口与业务逻辑（`src/api/*`、`src/hooks/*`）完全不感知皮肤层。

## 无效配置的回退规则

- 启动时 `validateOverrides()`（在 `main.tsx` 调用）先拦掉未知页面键、非组件的页面覆盖、非对象的按钮覆盖。
- 消费端逐字段校验：非法颜色/形状/尺寸/未知键 → `console.warn` + 回退默认值；其余合法字段仍生效。
- 页面覆盖不是有效组件 → 回退默认页面并 warn。

## 恢复默认

- 把 `src/ui/overrides.ts` 里 `uiOverrides` 的三个字段清空（`{}`），或 `git checkout -- src/ui/overrides.ts`。
- 示例文件（`examples/`）默认不被引用，留着不影响任何行为。

## 示例

- `examples/buttonOverride.example.ts`：把 `voice.hold-talk` 覆盖成紫色大圆钮、文案「按住 告诉小树洞」。启用：`overrides.ts` 顶部 `import { holdTalkPurpleOverride } from './examples/buttonOverride.example';`，并在 `buttons` 加 `'voice.hold-talk': holdTalkPurpleOverride`。验证：首页切到语音态，大圆钮变紫、文案变化；按住（pointerdown）出现录音波纹与红色录音态，松开恢复。
- `examples/pageOverride.example.tsx`：把 `child.me` 整页换成简化示例页。启用：`import { SimpleMePage } from './examples/pageOverride.example';`，并在 `pages` 加 `'child.me': SimpleMePage`。验证：`/#/me` 显示示例页，其余路由不变。

## 结构

- `tokens.ts` — 主题 tokens 单一来源 + `applyTheme(overrides)`（深合并 + 校验 + 写 CSS 变量）。
- `buttonConfig.ts` — `ActionId` 枚举与 `defaultButtonConfig`。
- `ActionButton.tsx` — 统一按钮组件（行为保证 + 呈现配置）。
- `registry.tsx` — 页面注册表（`registerPage` / `resolvePage`），家长端也登记在此（默认仍指向原组件）。
- `overrides.ts` — 唯一配置入口 + `validateOverrides()`。

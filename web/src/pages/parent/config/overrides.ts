// 家长端按钮/文案/主题的唯一覆盖入口（家长端自留配置层，司南维护）。
// 整页替换不在本文件——走公共层 src/ui/overrides.ts 的 uiOverrides.pages
// （key：'parent.home' / 'parent.calendar'，示例组件见 ../examples/MidnightParentHome.tsx）。
//
// 怎么覆盖：
//   - theme：CSS 变量键值对（键形如 '--ph-bg'，值必须是 string），与默认 tokens 逐项合并。
//     例：theme: { '--ph-bg': '#10141c' }
//   - buttons：按稳定 action ID 覆盖按钮的图标/文案/样式，与默认配置逐项合并。
//     例：buttons: { 'parent.home.openCalendar': { label: '日历', icon: <StarOutline />, background: '#223' } }
//   - copy：按文案 key 覆盖文案。例：copy: { 'home.title': '家长中心' }
//
// 覆盖范围：只影响家长端（/parent 与 /parent/calendar），儿童端与共享组件不受影响。
// 非法项会被忽略并 console.warn（未知 action ID、非 string 的 theme 值）。
// 换肤/换按钮不能改变的硬规则：未确认心情=白色、首页三态、只读分享快照、
// 不提供原始录音/聊天回放入口——这些由页面组件与后端保证，配置层碰不到。
//
// 如何恢复默认：把本文件恢复为三个空对象（即下方初始状态）即可，无需改其他文件。
import type { ParentOverrides } from './parentConfig';

export const parentOverrides: ParentOverrides = {
  theme: {},
  buttons: {},
  copy: {},
};

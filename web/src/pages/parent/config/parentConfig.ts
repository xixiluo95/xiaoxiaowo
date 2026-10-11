// 家长端默认配置：主题 tokens、按钮配置表、文案表。
// 这里是「默认值」，要改外观/文案/按钮请改同目录 overrides.ts，不要直接改本文件。
import { createElement, type ReactNode } from 'react';
import { CalendarOutline, LeftOutline, RightOutline } from 'antd-mobile-icons';

// ————— 稳定 action ID（对外契约，取定后勿改）—————
export type ParentActionId =
  | 'parent.home.openCalendar' // 首页右上角日历入口
  | 'parent.home.diaryHint' // 空态「从日历查看」提示
  | 'parent.home.backToChild' // 页脚返回孩子视角
  | 'parent.calendar.back' // 日历页返回
  | 'parent.calendar.prevMonth' // 上一月
  | 'parent.calendar.nextMonth' // 下一月
  | 'parent.calendar.pickDay'; // 日期格（配置只管样式，不管单日差异）

// 页面键（'parent.home' / 'parent.calendar'）与整页替换入口在公共层
// src/ui/registry.tsx + src/ui/overrides.ts（望舒维护），家长端不另设。

// ————— 主题 tokens：键即 CSS 变量名（--ph-*），值必须是 string —————
export type ParentTheme = Record<string, string>;

// 家长端视觉：浅蓝灰底、白色圆角卡片、沉静克制（与儿童端手绘风区分）。
// 配色/字号依据 assets/skin-handdrawn-spec.md 的排版尺度，色相走冷灰蓝。
export const defaultParentTheme: ParentTheme = {
  '--ph-bg': '#edf0f6', // 页面底色：浅蓝灰
  '--ph-card-bg': '#ffffff', // 卡片底
  '--ph-card-radius': '18px', // 卡片圆角
  '--ph-card-shadow': '0 2px 14px rgba(58, 65, 80, 0.06)',
  '--ph-ink': '#3a4150', // 主文字
  '--ph-muted': '#8a93a5', // 次要文字
  '--ph-faint': '#aab2c2', // 更弱文字（说明小字）
  '--ph-accent': '#5b8def', // 选中/强调蓝（日历选中描边、情绪词高亮）
  '--ph-badge-bg': '#eef2f8', // 灰蓝徽章底
  '--ph-badge-ink': '#6b7c96', // 灰蓝徽章字
  '--ph-risk-medium': '#b5894b', // 风险徽章：中
  '--ph-risk-high': '#b3543f', // 风险徽章：高
  '--ph-cell-bg': '#f7f9fc', // 日历日期格底
  '--ph-heart-empty': '#e2e7f0', // 日历小心脏：未来/无数据淡灰
  '--ph-divider': '#e6eaf2', // 分隔/引导线
  '--ph-line': '#c9d1de', // 描边（图标按钮等）
  '--ph-font-title': '17px', // 顶栏标题
  '--ph-font-card-title': '16px', // 卡片标题
  '--ph-font-body': '15px', // 正文
  '--ph-font-small': '12.5px', // 辅助小字
  '--ph-page-padding': '16px', // 页面左右留白
  '--ph-card-gap': '14px', // 卡片间距
};

// ————— 按钮配置 —————
export type ParentButtonVariant = 'icon-box' | 'text' | 'link';
export type ParentButtonShape = 'square' | 'rounded' | 'pill' | 'circle';

export type ParentButtonConfig = {
  label?: string; // 可见文案（icon-box 可无）
  ariaLabel?: string; // 无障碍标签，缺省回退 label
  icon?: ReactNode; // 图标
  variant?: ParentButtonVariant; // icon-box=圆角方形描边图标钮 / text=文字钮 / link=链接式
  shape?: ParentButtonShape;
  size?: 'sm' | 'md' | 'lg';
  color?: string; // 图标/文字颜色
  background?: string;
  borderColor?: string;
};

export const defaultParentButtons: Record<ParentActionId, ParentButtonConfig> = {
  'parent.home.openCalendar': {
    ariaLabel: '按日期查看',
    icon: createElement(CalendarOutline),
    variant: 'icon-box',
    shape: 'rounded',
    size: 'md',
  },
  'parent.home.diaryHint': {
    label: '孩子分享的日记，可从右上角日历查看',
    variant: 'text',
    size: 'sm',
  },
  'parent.home.backToChild': {
    label: '返回孩子视角',
    variant: 'link',
    size: 'sm',
  },
  'parent.calendar.back': {
    ariaLabel: '返回',
    icon: createElement(LeftOutline),
    variant: 'icon-box',
    shape: 'rounded',
    size: 'md',
  },
  'parent.calendar.prevMonth': {
    label: '‹',
    ariaLabel: '上个月',
    variant: 'text',
    size: 'md',
  },
  'parent.calendar.nextMonth': {
    label: '›',
    ariaLabel: '下个月',
    variant: 'text',
    size: 'md',
  },
  // 日期格：样式由 parent.css 的 .ph-cal-cell 承担，这里只留可覆盖的入口
  'parent.calendar.pickDay': {
    ariaLabel: '查看这一天',
    variant: 'text',
    shape: 'rounded',
    size: 'md',
  },
};

// ————— 文案表 —————
export type ParentCopy = Record<string, string>;

export const defaultParentCopy: ParentCopy = {
  'home.title': '小小我 · 家长视图',
  'home.moodToday': '今日心情',
  'home.moodTodayPrefix': '今天孩子的心情：',
  'home.moodUnconfirmed': '未确认',
  'home.diaryHint': '孩子分享的日记，可从右上角日历查看',
  'home.backToChild': '返回孩子视角',
  'home.expired': '内容已超过保留时间，云端数据已删除。',
  'home.empty': '暂时没有可以查看的内容。',
  'diary.titlePrefix': '孩子分享的日记 · ',
  'diary.snapshotTitle': '孩子分享的日记 · 快照',
  'diary.badge': '分享快照',
  'diary.snapshotNote': '快照内容不随后续修改变化',
  'guide.title': '给您的行动指南',
  'guide.actions': '建议的行动',
  'guide.openings': '推荐开场白',
  'guide.avoid': '暂时避免说',
  'guide.followUps': '之后可以问问',
  'guide.watchOut': '后续观察',
  'calendar.title': '按日期查看',
  'calendar.moodPrefix': '心情：',
  'calendar.moodUnconfirmed': '未确认（白色）',
  'calendar.expired': '内容已超过保留时间，云端数据已删除。',
  'calendar.empty': '这一天没有可查看的内容，或已超过保留时间。',
  'calendar.noContent': '这一天没有分享的日记，也没有行动指南。',
};

// 覆盖文件（overrides.ts）的形状
export type ParentOverrides = {
  theme?: ParentTheme;
  buttons?: Partial<Record<ParentActionId, ParentButtonConfig>>;
  copy?: ParentCopy;
};

// 按钮集中配置：ActionId 稳定字符串枚举，覆盖儿童端每一个可点元素。
// 配置只控制呈现（文案/图标/颜色/形状/尺寸/各态样式）；交互行为由 ActionButton 保证。
import type { ReactNode } from 'react';

export type ActionId =
  | 'nav.calendar'
  | 'nav.me'
  | 'nav.back'
  | 'voice.mode-switch'
  | 'voice.hold-talk'
  | 'chat.send'
  | 'chat.replay'
  | 'chat.close-sheet'
  | 'intro.done'
  | 'intro.skip'
  | 'diary.edit-toggle'
  | 'diary.confirm'
  | 'diary.share'
  | 'diary.share-revoke'
  | 'diary.block-edit'
  | 'diary.block-save'
  | 'diary.block-cancel'
  | 'diary.event-delete'
  | 'calendar.prev-month'
  | 'calendar.next-month'
  | 'calendar.day-cell'
  | 'me.entry.calendar'
  | 'me.entry.diary'
  | 'me.entry.share'
  | 'me.entry.guardian'
  | 'me.entry.parent-demo'
  | 'me.dev-finalize';

export type ButtonShape = 'pill' | 'round' | 'rounded';

export type ButtonStateColors = {
  bg: string;
  fg: string;
  border?: string;
};

export type ButtonConfig = {
  label: string | (() => string);
  icon?: ReactNode | (() => ReactNode);
  colors: ButtonStateColors;
  shape: ButtonShape;
  size: {
    height: number;
    fontSize: number;
    paddingX: number;
    minWidth?: number;
  };
  states?: {
    disabled?: Partial<ButtonStateColors>;
    active?: Partial<ButtonStateColors>;
    recording?: Partial<ButtonStateColors>;
  };
  ariaLabel: string;
};

export type ButtonOverride = Partial<{
  label: string | (() => string);
  icon: ReactNode | (() => ReactNode);
  colors: Partial<ButtonStateColors>;
  shape: ButtonShape;
  size: Partial<ButtonConfig['size']>;
  states: {
    disabled?: Partial<ButtonStateColors>;
    active?: Partial<ButtonStateColors>;
    recording?: Partial<ButtonStateColors>;
  };
  ariaLabel: string;
}>;

const INK = 'var(--xxw-ink)';
const GOLD = 'var(--xxw-emotion-joy)';
const MUTED = 'var(--xxw-muted)';

const topbarRound: ButtonConfig = {
  label: '',
  colors: { bg: 'rgba(255,255,255,0.9)', fg: INK, border: 'rgba(91,74,63,0.18)' },
  shape: 'round',
  size: { height: 42, fontSize: 19, paddingX: 0, minWidth: 42 },
  ariaLabel: '按钮',
};

export const defaultButtonConfig: Record<ActionId, ButtonConfig> = {
  'nav.calendar': { ...topbarRound, ariaLabel: '心情日历' },
  'nav.me': {
    label: '我的',
    colors: { bg: 'rgba(255,255,255,0.9)', fg: INK, border: 'rgba(91,74,63,0.18)' },
    shape: 'pill',
    size: { height: 42, fontSize: 15, paddingX: 16 },
    ariaLabel: '我的',
  },
  'nav.back': { ...topbarRound, ariaLabel: '返回' },

  'voice.mode-switch': {
    label: '',
    colors: { bg: 'transparent', fg: MUTED },
    shape: 'round',
    size: { height: 44, fontSize: 22, paddingX: 0, minWidth: 44 },
    ariaLabel: '切换输入方式',
  },
  'voice.hold-talk': {
    label: '按住 说话',
    // 按钮面为美术图（voice-mic.png），底色透明；录音态由 CSS 光晕 + 提示文字表达
    colors: { bg: 'transparent', fg: INK },
    shape: 'round',
    size: { height: 132, fontSize: 17, paddingX: 0, minWidth: 132 },
    ariaLabel: '按住说话，松开发送',
  },
  'chat.send': {
    // 按钮面为美术图（chat-send.png），文案仅忙碌时以 labelOverride 出现
    label: '',
    colors: { bg: 'transparent', fg: INK },
    shape: 'round',
    size: { height: 48, fontSize: 12, paddingX: 0, minWidth: 48 },
    ariaLabel: '发送',
  },
  'chat.replay': {
    label: '播放回复',
    colors: { bg: 'rgba(255,255,255,0.9)', fg: INK },
    shape: 'pill',
    size: { height: 38, fontSize: 14, paddingX: 14 },
    ariaLabel: '播放回复',
  },
  'chat.close-sheet': {
    label: '回到舞台',
    colors: { bg: 'transparent', fg: MUTED },
    shape: 'pill',
    size: { height: 36, fontSize: 13, paddingX: 14 },
    ariaLabel: '回到舞台',
  },

  'intro.done': {
    label: '开始吧',
    colors: { bg: GOLD, fg: INK },
    shape: 'pill',
    size: { height: 50, fontSize: 17, paddingX: 24 },
    ariaLabel: '开始吧',
  },
  'intro.skip': {
    label: '跳过介绍',
    colors: { bg: 'transparent', fg: MUTED, border: 'rgba(91,74,63,0.3)' },
    shape: 'pill',
    size: { height: 46, fontSize: 15, paddingX: 24 },
    ariaLabel: '跳过介绍',
  },

  'diary.edit-toggle': {
    label: '改一改',
    colors: { bg: 'var(--xxw-card)', fg: INK, border: 'var(--xxw-stroke-color)' },
    shape: 'rounded',
    size: { height: 52, fontSize: 17, paddingX: 26 },
    states: { active: { bg: 'var(--xxw-emotion-joy-glow)' } },
    ariaLabel: '改一改',
  },
  'diary.confirm': {
    label: '确认完成',
    colors: { bg: GOLD, fg: INK, border: 'var(--xxw-stroke-color)' },
    shape: 'rounded',
    size: { height: 52, fontSize: 17, paddingX: 26 },
    ariaLabel: '确认完成',
  },
  'diary.share': {
    label: '分享给大人',
    colors: { bg: 'transparent', fg: MUTED },
    shape: 'pill',
    size: { height: 36, fontSize: 13, paddingX: 12 },
    ariaLabel: '分享给大人',
  },
  'diary.share-revoke': {
    label: '撤回分享',
    colors: { bg: 'transparent', fg: '#B3543F' },
    shape: 'pill',
    size: { height: 36, fontSize: 13, paddingX: 12 },
    ariaLabel: '撤回分享，大人将看不到这篇日记',
  },
  'diary.block-edit': {
    label: '改一改',
    colors: { bg: 'rgba(91,74,63,0.07)', fg: INK },
    shape: 'pill',
    size: { height: 32, fontSize: 13, paddingX: 14 },
    ariaLabel: '编辑这一段',
  },
  'diary.block-save': {
    label: '保存',
    colors: { bg: GOLD, fg: INK },
    shape: 'pill',
    size: { height: 32, fontSize: 13, paddingX: 14 },
    ariaLabel: '保存修改',
  },
  'diary.block-cancel': {
    label: '取消',
    colors: { bg: 'rgba(91,74,63,0.07)', fg: INK },
    shape: 'pill',
    size: { height: 32, fontSize: 13, paddingX: 14 },
    ariaLabel: '取消修改',
  },
  'diary.event-delete': {
    label: '删除这件事',
    colors: { bg: 'rgba(91,74,63,0.07)', fg: '#B3543F' },
    shape: 'pill',
    size: { height: 32, fontSize: 13, paddingX: 14 },
    ariaLabel: '删除这件事',
  },

  'calendar.prev-month': { ...topbarRound, ariaLabel: '上个月' },
  'calendar.next-month': { ...topbarRound, ariaLabel: '下个月' },
  'calendar.day-cell': {
    label: '',
    colors: { bg: 'var(--xxw-card)', fg: INK },
    shape: 'rounded',
    size: { height: 0, fontSize: 14, paddingX: 0 },
    ariaLabel: '日期',
  },

  'me.entry.calendar': {
    label: '心情日历',
    colors: { bg: 'var(--xxw-card)', fg: INK, border: 'var(--xxw-stroke-color)' },
    shape: 'rounded',
    size: { height: 76, fontSize: 17, paddingX: 18 },
    ariaLabel: '心情日历',
  },
  'me.entry.diary': {
    label: '我的日记',
    colors: { bg: 'var(--xxw-card)', fg: INK, border: 'var(--xxw-stroke-color)' },
    shape: 'rounded',
    size: { height: 76, fontSize: 17, paddingX: 18 },
    ariaLabel: '我的日记',
  },
  'me.entry.share': {
    label: '分享给家人',
    colors: { bg: 'var(--xxw-card)', fg: INK, border: 'var(--xxw-stroke-color)' },
    shape: 'rounded',
    size: { height: 76, fontSize: 17, paddingX: 18 },
    ariaLabel: '分享给家人',
  },
  'me.entry.guardian': {
    label: '绑定的大人',
    colors: { bg: 'var(--xxw-card)', fg: INK, border: 'var(--xxw-stroke-color)' },
    shape: 'rounded',
    size: { height: 76, fontSize: 17, paddingX: 18 },
    ariaLabel: '绑定的大人',
  },
  'me.entry.parent-demo': {
    label: '家长视角（演示绑定）',
    colors: { bg: 'transparent', fg: MUTED, border: 'rgba(91,74,63,0.3)' },
    shape: 'pill',
    size: { height: 44, fontSize: 14, paddingX: 20 },
    ariaLabel: '进入家长视角（演示）',
  },
  'me.dev-finalize': {
    label: '模拟 0 点整理日记',
    colors: { bg: 'var(--xxw-ink)', fg: '#FFFFFF' },
    shape: 'pill',
    size: { height: 44, fontSize: 14, paddingX: 20 },
    states: { disabled: { bg: 'rgba(91,74,63,0.3)' } },
    ariaLabel: '模拟 0 点整理日记',
  },
};

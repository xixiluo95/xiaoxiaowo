// 示例①：把「按住说话」覆盖成紫色大圆钮、文案「按住 告诉小树洞」。
// 启用方式见 src/ui/overrides.ts 注释。此文件不被默认引用。
import type { ButtonOverride } from '../buttonConfig';

export const holdTalkPurpleOverride: ButtonOverride = {
  label: '按住 告诉小树洞',
  colors: { bg: 'var(--xxw-emotion-fear)', fg: '#FFFFFF', border: 'var(--xxw-stroke-color)' },
  shape: 'round',
  size: { height: 148, fontSize: 16, minWidth: 148 },
  states: {
    recording: { bg: '#6D3FD1', fg: '#FFFFFF' },
  },
};

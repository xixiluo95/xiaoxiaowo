// 可替换 UI 的唯一配置入口。默认全空 = 完全使用内置主题/按钮/页面。
// 想换肤或换页：改这里（或参考 src/ui/examples/ 下的示例，取消注释即生效）。
import type { ComponentType } from 'react';
import type { ThemeOverrides } from './tokens';
import type { ActionId, ButtonOverride } from './buttonConfig';
import type { PageKey } from './registry';

export type UiOverrides = {
  theme: ThemeOverrides;
  buttons: Partial<Record<ActionId, ButtonOverride>>;
  pages: Partial<Record<PageKey, ComponentType>>;
};

export const uiOverrides: UiOverrides = {
  theme: {},
  buttons: {},
  pages: {},

  // —— 示例启用方式（默认注释，不生效）——
  // 示例①：把「按住说话」换成紫色大圆钮
  // 1) 在文件顶部加: import { holdTalkPurpleOverride } from './examples/buttonOverride.example';
  // 2) 在 buttons 里加: 'voice.hold-talk': holdTalkPurpleOverride,
  //
  // 示例②：把「我的」整页换成示例简化页
  // 1) 在文件顶部加: import { SimpleMePage } from './examples/pageOverride.example';
  // 2) 在 pages 里加: 'child.me': SimpleMePage,
};

// 启动时校验：非法键/值 warn 并忽略（真正的回退在 tokens/ActionButton/registry 消费端完成）
export function validateOverrides(): void {
  const VALID_PAGES: PageKey[] = [
    'child.home',
    'child.calendar',
    'child.diary',
    'child.me',
    'parent.home',
    'parent.calendar',
  ];
  for (const [k, v] of Object.entries(uiOverrides.pages)) {
    if (!VALID_PAGES.includes(k as PageKey)) {
      console.warn(`[ui/overrides] 未知页面键已忽略: ${k}`);
      delete (uiOverrides.pages as Record<string, unknown>)[k];
      continue;
    }
    if (typeof v !== 'function' && !(typeof v === 'object' && v !== null)) {
      console.warn(`[ui/overrides] 页面覆盖不是有效组件，已忽略: ${k}`);
      delete (uiOverrides.pages as Record<string, unknown>)[k];
    }
  }
  for (const k of Object.keys(uiOverrides.buttons)) {
    // ActionId 是否有效由 buttonConfig 消费端判断；这里只拦明显的非对象
    const v = (uiOverrides.buttons as Record<string, unknown>)[k];
    if (v !== undefined && (typeof v !== 'object' || v === null)) {
      console.warn(`[ui/overrides] 按钮覆盖不是对象，已忽略: ${k}`);
      delete (uiOverrides.buttons as Record<string, unknown>)[k];
    }
  }
  if (uiOverrides.theme && typeof uiOverrides.theme !== 'object') {
    console.warn('[ui/overrides] theme 覆盖不是对象，已忽略');
    uiOverrides.theme = {};
  }
}

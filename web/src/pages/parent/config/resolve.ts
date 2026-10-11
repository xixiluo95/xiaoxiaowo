// 合并 + 校验 + 回退：按钮/主题/文案只从这里取配置，不直接读 overrides。
// 整页替换不走本文件——由公共层 src/ui/registry.tsx + src/ui/overrides.ts 的
// uiOverrides.pages 承担（望舒维护的页面注册入口，家长端两页已登记在案）。
import type {
  ParentActionId,
  ParentButtonConfig,
  ParentTheme,
} from './parentConfig';
import { defaultParentButtons, defaultParentCopy, defaultParentTheme } from './parentConfig';
import { parentOverrides } from './overrides';

const KNOWN_ACTIONS = new Set<string>(Object.keys(defaultParentButtons));
const warnedActions = new Set<string>();

// 按钮：按 action ID 合并默认与覆盖。未知 action ID 忽略并 warn。
export function resolveButtonConfig(actionId: ParentActionId): ParentButtonConfig {
  const fallback = defaultParentButtons[actionId];
  const table = parentOverrides.buttons ?? {};
  for (const key of Object.keys(table)) {
    if (!KNOWN_ACTIONS.has(key) && !warnedActions.has(key)) {
      warnedActions.add(key);
      console.warn(`[parent] 未知 action ID「${key}」，已忽略`);
    }
  }
  const patch = table[actionId];
  return patch ? { ...fallback, ...patch } : fallback;
}

// 主题：非法值（非 string）忽略并 warn，其余与默认 tokens 合并。
export function resolveTheme(): ParentTheme {
  const merged: ParentTheme = { ...defaultParentTheme };
  const patch = parentOverrides.theme ?? {};
  for (const [key, value] of Object.entries(patch)) {
    if (typeof value !== 'string') {
      console.warn(`[parent] 非法 theme 值「${key}」（非 string），已忽略`);
      continue;
    }
    merged[key] = value;
  }
  return merged;
}

// 文案：t('home.title')，缺 key 回退 key 本身并 warn。
export function t(copyKey: string): string {
  const override = parentOverrides.copy?.[copyKey];
  if (typeof override === 'string') return override;
  const fallback = defaultParentCopy[copyKey];
  if (fallback == null) {
    console.warn(`[parent] 未知文案 key「${copyKey}」`);
    return copyKey;
  }
  return fallback;
}

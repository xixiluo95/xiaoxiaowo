// 页面注册表：App.tsx 路由统一从这里取组件；uiOverrides.pages 可整页替换。
// 家长端默认指向司南现有组件（只登记，不改他的文件）。
import type { ComponentType } from 'react';
import ChildHome from '../pages/ChildHome';
import CalendarPage from '../pages/CalendarPage';
import DiaryPage from '../pages/DiaryPage';
import MePage from '../pages/MePage';
import ParentHome from '../pages/parent/ParentHome';
import ParentCalendarPage from '../pages/parent/ParentCalendarPage';
import { uiOverrides } from './overrides';

export type PageKey =
  | 'child.home'
  | 'child.calendar'
  | 'child.diary'
  | 'child.me'
  | 'parent.home'
  | 'parent.calendar';

const defaults: Record<PageKey, ComponentType> = {
  'child.home': ChildHome,
  'child.calendar': CalendarPage,
  'child.diary': DiaryPage,
  'child.me': MePage,
  'parent.home': ParentHome,
  'parent.calendar': ParentCalendarPage,
};

const registered: Partial<Record<PageKey, ComponentType>> = {};

export function registerPage(pageKey: PageKey, component: ComponentType): void {
  if (typeof component !== 'function' && !(typeof component === 'object' && component !== null)) {
    console.warn(`[ui/registry] 注册的不是有效组件，已忽略: ${pageKey}`);
    return;
  }
  registered[pageKey] = component;
}

function isValidComponent(c: unknown): c is ComponentType {
  return typeof c === 'function' || (typeof c === 'object' && c !== null);
}

// 解析优先级：uiOverrides.pages > registerPage > 内置默认；无效覆盖回退默认并 warn
export function resolvePage(pageKey: PageKey): ComponentType {
  const over = (uiOverrides.pages as Record<string, unknown>)[pageKey];
  if (over !== undefined) {
    if (isValidComponent(over)) return over;
    console.warn(`[ui/registry] 页面覆盖无效，回退默认: ${pageKey}`);
  }
  return registered[pageKey] ?? defaults[pageKey];
}

// 统一按钮组件：行为（点击 / 按住说话 pointer 语义 / disabled / aria-label）由本组件保证，
// 配置只控制呈现。配置非法时回退默认并 warn。
import { useRef, type CSSProperties, type ReactNode } from 'react';
import {
  defaultButtonConfig,
  type ActionId,
  type ButtonConfig,
  type ButtonOverride,
  type ButtonStateColors,
} from './buttonConfig';
import { uiOverrides } from './overrides';

const SHAPES = ['pill', 'round', 'rounded'] as const;
const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|[a-zA-Z]+|var\(--[a-zA-Z0-9-]+\)|transparent)$/;

function isColorLike(v: unknown): v is string {
  return typeof v === 'string' && COLOR_RE.test(v.trim());
}

function mergeStateColors(
  base: ButtonStateColors,
  over: Partial<ButtonStateColors> | undefined,
  path: string,
): ButtonStateColors {
  if (!over) return base;
  const out = { ...base };
  (['bg', 'fg', 'border'] as const).forEach((k) => {
    const v = over[k];
    if (v === undefined) return;
    if (isColorLike(v)) out[k] = v;
    else console.warn(`[ui/button] 非法颜色已忽略: ${path}.${k}`);
  });
  return out;
}

// 深合并默认配置与 override，逐字段校验；坏字段回退默认
export function resolveButtonConfig(actionId: ActionId): ButtonConfig {
  const def = defaultButtonConfig[actionId];
  const over = (uiOverrides.buttons as Record<string, ButtonOverride | undefined>)[actionId];
  if (!over) return def;
  const warn = (field: string) =>
    console.warn(`[ui/button] 非法按钮配置已忽略: ${actionId}.${field}`);
  const cfg: ButtonConfig = {
    ...def,
    colors: { ...def.colors },
    size: { ...def.size },
    states: {
      disabled: { ...def.states?.disabled },
      active: { ...def.states?.active },
      recording: { ...def.states?.recording },
    },
  };
  if (over.label !== undefined) {
    if (typeof over.label === 'string' || typeof over.label === 'function') cfg.label = over.label;
    else warn('label');
  }
  if (over.icon !== undefined) cfg.icon = over.icon;
  if (over.colors) cfg.colors = mergeStateColors(cfg.colors, over.colors, `${actionId}.colors`);
  if (over.shape !== undefined) {
    if ((SHAPES as readonly string[]).includes(over.shape)) cfg.shape = over.shape;
    else warn('shape');
  }
  if (over.size) {
    (['height', 'fontSize', 'paddingX', 'minWidth'] as const).forEach((k) => {
      const v = over.size?.[k];
      if (v === undefined) return;
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) cfg.size[k] = v;
      else warn(`size.${k}`);
    });
  }
  if (over.states) {
    (['disabled', 'active', 'recording'] as const).forEach((s) => {
      const so = over.states?.[s];
      if (!so) return;
      cfg.states = cfg.states ?? {};
      cfg.states[s] = mergeStateColors(
        { ...cfg.colors, ...cfg.states[s] },
        so,
        `${actionId}.states.${s}`,
      );
    });
  }
  if (over.ariaLabel !== undefined) {
    if (typeof over.ariaLabel === 'string' && over.ariaLabel) cfg.ariaLabel = over.ariaLabel;
    else warn('ariaLabel');
  }
  return cfg;
}

function shapeRadius(cfg: ButtonConfig): number | string {
  if (cfg.shape === 'pill') return 999;
  if (cfg.shape === 'round') return '50%';
  return 14;
}

export type ActionButtonState = 'default' | 'active' | 'recording';

export function ActionButton({
  actionId,
  onPress,
  onHoldStart,
  onHoldEnd,
  disabled,
  labelOverride,
  ariaLabel,
  state = 'default',
  className = '',
  children,
}: {
  actionId: ActionId;
  onPress?: () => void;
  onHoldStart?: () => void;
  onHoldEnd?: () => void;
  disabled?: boolean;
  labelOverride?: string;
  ariaLabel?: string; // 动态可访问名（如随模式变化），缺省用配置
  state?: ActionButtonState;
  className?: string;
  children?: ReactNode; // 追加内容（如图标下的副文案）
}) {
  const cfg = resolveButtonConfig(actionId);
  const holdingRef = useRef(false);

  const label =
    labelOverride ?? (typeof cfg.label === 'function' ? cfg.label() : cfg.label);
  const icon = typeof cfg.icon === 'function' ? cfg.icon() : cfg.icon;

  // 各态颜色：disabled > recording > active > 默认
  let colors = cfg.colors;
  let stateClass = '';
  if (disabled && cfg.states?.disabled) {
    colors = { ...colors, ...cfg.states.disabled };
    stateClass = ' xxw-btn--disabled';
  } else if (state === 'recording') {
    colors = { ...colors, ...cfg.states?.recording };
    stateClass = ' xxw-btn--recording';
  } else if (state === 'active' && cfg.states?.active) {
    colors = { ...colors, ...cfg.states.active };
    stateClass = ' xxw-btn--active';
  }

  const style: CSSProperties = {
    height: cfg.size.height || undefined,
    minWidth: cfg.size.minWidth ?? (cfg.shape === 'round' ? cfg.size.height : undefined),
    paddingLeft: cfg.size.paddingX,
    paddingRight: cfg.size.paddingX,
    fontSize: cfg.size.fontSize,
    borderRadius: shapeRadius(cfg),
    background: colors.bg,
    color: colors.fg,
    border: colors.border ? `1.5px solid ${colors.border}` : 'none',
  };

  const isHold = !!(onHoldStart || onHoldEnd);

  // 按住语义：pointerdown 开始；pointerup / cancel / leave 结束。配置不可破坏。
  const holdHandlers = isHold
    ? {
        onPointerDown: (e: React.PointerEvent) => {
          if (disabled) return;
          e.preventDefault();
          holdingRef.current = true;
          onHoldStart?.();
        },
        onPointerUp: () => {
          if (!holdingRef.current) return;
          holdingRef.current = false;
          onHoldEnd?.();
        },
        onPointerCancel: () => {
          if (!holdingRef.current) return;
          holdingRef.current = false;
          onHoldEnd?.();
        },
        onPointerLeave: () => {
          if (!holdingRef.current) return;
          holdingRef.current = false;
          onHoldEnd?.();
        },
        onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
      }
    : {
        onClick: () => {
          if (disabled) return;
          onPress?.();
        },
      };

  return (
    <button
      type="button"
      className={`xxw-btn xxw-btn--${cfg.shape} xxw-btn--${actionId.replace(/\./g, '-')}${stateClass}${isHold ? ' xxw-btn--hold' : ''} ${className}`}
      style={style}
      disabled={disabled}
      aria-label={ariaLabel || cfg.ariaLabel || label}
      {...holdHandlers}
    >
      {icon && <span className="xxw-btn-icon" aria-hidden>{icon}</span>}
      {label && <span className="xxw-btn-label">{label}</span>}
      {children}
    </button>
  );
}

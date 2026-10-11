// 家长端所有按钮的唯一入口：按稳定 action ID 解析图标/文案/样式。
// 想换某个按钮的样子，改 config/overrides.ts 的 buttons 表，不要改这里。
import type { CSSProperties, MouseEventHandler, ReactNode } from 'react';
import type { ParentActionId } from '../config/parentConfig';
import { resolveButtonConfig } from '../config/resolve';

export function ParentActionButton({
  action,
  onClick,
  disabled,
  className = '',
  children,
}: {
  action: ParentActionId;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  className?: string;
  children?: ReactNode; // 额外内容（一般不用；日期格等自定义结构走页面自身）
}) {
  const cfg = resolveButtonConfig(action);
  const style: CSSProperties = {};
  if (cfg.color) style.color = cfg.color;
  if (cfg.background) style.background = cfg.background;
  if (cfg.borderColor) style.borderColor = cfg.borderColor;

  const cls = [
    'ph-btn',
    `ph-btn--${cfg.variant ?? 'text'}`,
    cfg.shape ? `ph-btn--${cfg.shape}` : '',
    cfg.size ? `ph-btn--${cfg.size}` : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={cls}
      style={style}
      aria-label={cfg.ariaLabel ?? cfg.label}
      disabled={disabled}
      onClick={onClick}
    >
      {cfg.icon}
      {cfg.label && <span className="ph-btn-label">{cfg.label}</span>}
      {children}
    </button>
  );
}

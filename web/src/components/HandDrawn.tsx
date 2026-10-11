import { useEffect, useRef, useState, type ReactNode } from 'react';
import rough from 'roughjs';
import { annotate } from 'rough-notation';

// 手绘皮肤参数（照丹青 skin-handdrawn-spec：暖灰棕描边、seed 固定 42 防重绘跳动）
export const SKIN = {
  stroke: '#5B4A3F',
  strokeWidth: 2,
  roughness: 1.4,
  bowing: 2.5,
  fillWeight: 1.2,
  hachureGap: 6,
  hachureAngle: -41,
  seed: 42,
  fillStyle: 'solid' as const,
};

export function RoughCard({
  children,
  color = SKIN.stroke,
  fill,
  padding = 6,
  className = '',
  borderRadius = 14,
}: {
  children: ReactNode;
  color?: string;
  fill?: string;
  padding?: number;
  className?: string;
  borderRadius?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || size.w < 4 || size.h < 4) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const rc = rough.svg(svg);
    // 卡片边框（规范 §卡片）：长边弓形更大更像手画
    const node = rc.rectangle(padding / 2, padding / 2, size.w - padding, size.h - padding, {
      stroke: color,
      strokeWidth: SKIN.strokeWidth,
      roughness: 1.2,
      bowing: 3.5,
      fill,
      fillStyle: SKIN.fillStyle,
      fillWeight: SKIN.fillWeight,
      hachureGap: SKIN.hachureGap,
      hachureAngle: SKIN.hachureAngle,
      seed: SKIN.seed,
    });
    svg.appendChild(node);
  }, [size, color, fill, padding]);

  return (
    <div ref={hostRef} className={`rough-card ${className}`} style={{ borderRadius }}>
      <svg ref={svgRef} className="rough-card-svg" width={size.w} height={size.h} aria-hidden />
      <div className="rough-card-body">{children}</div>
    </div>
  );
}

// 情绪词强调：手绘圈线/下划线
export function EmotionHighlight({
  children,
  color,
  type = 'circle',
}: {
  children: ReactNode;
  color: string;
  type?: 'circle' | 'underline' | 'box' | 'highlight';
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const annotation = annotate(el, {
      type,
      color,
      strokeWidth: 2.5,
      padding: type === 'circle' ? 6 : 2,
      animationDuration: 600,
      multiline: true,
      iterations: 2,
    });
    const t = setTimeout(() => annotation.show(), 120);
    return () => {
      clearTimeout(t);
      annotation.remove();
    };
  }, [color, type]);
  return <span ref={ref}>{children}</span>;
}

// 心情云朵（首页提示语外的手绘云）
export function MoodCloud({ children, color = '#ffffff' }: { children: ReactNode; color?: string }) {
  return (
    <RoughCard color="rgba(255,255,255,0.85)" fill="rgba(255,255,255,0.08)" className="mood-cloud" borderRadius={40}>
      <span style={{ color }}>{children}</span>
    </RoughCard>
  );
}

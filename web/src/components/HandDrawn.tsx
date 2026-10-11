import { useEffect, useRef, useState, type ReactNode } from 'react';
import rough from 'roughjs';
import { annotate } from 'rough-notation';

// 手绘皮肤参数（丹青规范未就绪前的默认值，规范落地后在这里统一替换）
export const SKIN = {
  stroke: '#4a4036',
  strokeWidth: 1.6,
  roughness: 1.7,
  bowing: 2.2,
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
    const node = rc.rectangle(padding / 2, padding / 2, size.w - padding, size.h - padding, {
      stroke: color,
      strokeWidth: SKIN.strokeWidth,
      roughness: SKIN.roughness,
      bowing: SKIN.bowing,
      fill,
      fillStyle: SKIN.fillStyle,
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
      strokeWidth: 2,
      padding: type === 'circle' ? 6 : 2,
      animationDuration: 600,
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

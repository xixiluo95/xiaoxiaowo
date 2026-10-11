import type { Emotion } from '../types';

export type EmotionVisual = {
  image: string; // 静态角色图（丹青素材），缺失时前端回退纯色角色
  color: string; // 主题色
  glow: string; // 光晕色
  enterFrom: 'left' | 'ground' | 'shadow' | 'float' | 'fade';
  label: string;
};

// 内置兜底 manifest；运行时优先读 /assets/emotions/manifest.json（丹青产出）
export const defaultEmotionManifest: Record<Emotion, EmotionVisual> = {
  calm: {
    image: '/assets/emotions/calm/idle.png',
    color: '#f4f1ea',
    glow: 'rgba(244,241,234,0.55)',
    enterFrom: 'fade',
    label: '平静',
  },
  joy: {
    image: '/assets/emotions/joy/idle.png',
    color: '#ffc94d',
    glow: 'rgba(255,201,77,0.55)',
    enterFrom: 'float',
    label: '喜悦',
  },
  anger: {
    image: '/assets/emotions/anger/idle.png',
    color: '#e1554b',
    glow: 'rgba(225,85,75,0.55)',
    enterFrom: 'left',
    label: '愤怒',
  },
  sadness: {
    image: '/assets/emotions/sadness/idle.png',
    color: '#5b8def',
    glow: 'rgba(91,141,239,0.55)',
    enterFrom: 'ground',
    label: '忧伤',
  },
  fear: {
    image: '/assets/emotions/fear/idle.png',
    color: '#9b6dd7',
    glow: 'rgba(155,109,215,0.55)',
    enterFrom: 'shadow',
    label: '害怕',
  },
};

export async function loadEmotionManifest(): Promise<Record<Emotion, EmotionVisual>> {
  try {
    const res = await fetch('/assets/emotions/manifest.json');
    if (!res.ok) return defaultEmotionManifest;
    const raw = (await res.json()) as Record<string, Partial<EmotionVisual>>;
    const merged = { ...defaultEmotionManifest };
    (Object.keys(defaultEmotionManifest) as Emotion[]).forEach((k) => {
      const r = raw[k];
      if (!r) return;
      merged[k] = {
        ...defaultEmotionManifest[k],
        ...(r.image ? { image: `/assets/${r.image.replace(/^\/+/, '')}` } : {}),
        ...(r.color ? { color: r.color } : {}),
        ...(r.enterFrom ? { enterFrom: r.enterFrom } : {}),
      };
    });
    return merged;
  } catch {
    return defaultEmotionManifest;
  }
}

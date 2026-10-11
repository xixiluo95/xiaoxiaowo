import type { Emotion } from '../types';

export type EmotionVisual = {
  image: string; // 静态角色图（丹青素材），缺失时前端回退纯色角色
  video?: string; // 整幅舞台循环视频（人物+场景预合成，鲁班 SHIY-382），缺失/失败时降级 image
  poster?: string; // 视频首帧海报，视频就绪前展示
  skeletal?: string; // 预留：骨骼动画素材（未实现，出现时降级 video → image）
  color: string; // 主题色
  glow: string; // 光晕色
  enterFrom: 'left' | 'ground' | 'shadow' | 'float' | 'fade';
  label: string;
};

// 内置兜底 manifest（与 assets/emotions/manifest.json 保持一致）；运行时优先读 /assets/emotions/manifest.json
export const defaultEmotionManifest: Record<Emotion, EmotionVisual> = {
  calm: {
    image: '/assets/emotions/calm/idle.png',
    video: '/assets/emotions/calm/loop.mp4',
    poster: '/assets/emotions/calm/poster.jpg',
    color: '#F2EEE6',
    glow: '#FFF8E7',
    enterFrom: 'fade',
    label: '平静',
  },
  joy: {
    image: '/assets/emotions/joy/idle.png',
    video: '/assets/emotions/joy/loop.mp4',
    poster: '/assets/emotions/joy/poster.jpg',
    color: '#FFC94D',
    glow: '#FFE9A8',
    enterFrom: 'float',
    label: '开心',
  },
  anger: {
    image: '/assets/emotions/anger/idle.png',
    video: '/assets/emotions/anger/loop.mp4',
    poster: '/assets/emotions/anger/poster.jpg',
    color: '#E8442E',
    glow: '#FF8A5C',
    enterFrom: 'left',
    label: '生气',
  },
  sadness: {
    image: '/assets/emotions/sadness/idle.png',
    video: '/assets/emotions/sadness/loop.mp4',
    poster: '/assets/emotions/sadness/poster.jpg',
    color: '#4A7FD4',
    glow: '#9CC4F5',
    enterFrom: 'ground',
    label: '难过',
  },
  fear: {
    image: '/assets/emotions/fear/idle.png',
    color: '#8B5CF6',
    glow: '#C4B0FA',
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
        ...(r.glow ? { glow: r.glow } : {}),
        ...(r.video ? { video: `/assets/${r.video.replace(/^\/+/, '')}` } : {}),
        ...(r.poster ? { poster: `/assets/${r.poster.replace(/^\/+/, '')}` } : {}),
        ...(r.skeletal ? { skeletal: r.skeletal } : {}),
        ...(r.enterFrom ? { enterFrom: r.enterFrom } : {}),
      };
    });
    return merged;
  } catch {
    return defaultEmotionManifest;
  }
}

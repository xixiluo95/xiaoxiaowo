import { useEffect, useMemo, useState } from 'react';
import { defaultEmotionManifest, loadEmotionManifest, type EmotionVisual } from '../emotion/manifest';
import type { Emotion } from '../types';
import type { StagePhase } from '../hooks/useEmotionChat';
import { CharacterRenderer, prefetchEmotionVideos } from './CharacterRenderer';

let manifestCache: Record<Emotion, EmotionVisual> | null = null;

export function useEmotionManifest() {
  const [manifest, setManifest] = useState<Record<Emotion, EmotionVisual>>(
    manifestCache ?? defaultEmotionManifest,
  );
  useEffect(() => {
    if (manifestCache) return;
    loadEmotionManifest().then((m) => {
      manifestCache = m;
      setManifest(m);
    });
  }, []);
  // 首屏只加载 poster + 当前情绪视频（video 元素自身加载），其余情绪空闲预取
  useEffect(() => {
    prefetchEmotionVideos(Object.values(manifest), manifest.calm.video);
  }, [manifest]);
  return manifest;
}

function LightDots() {
  const dots = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        left: `${(i * 37 + 13) % 100}%`,
        top: `${(i * 53 + 9) % 88}%`,
        delay: `${(i % 7) * 0.7}s`,
        size: 4 + (i % 3) * 3,
      })),
    [],
  );
  return (
    <div className="light-dots" aria-hidden>
      {dots.map((d) => (
        <span
          key={d.id}
          className="light-dot"
          style={{ left: d.left, top: d.top, animationDelay: d.delay, width: d.size, height: d.size }}
        />
      ))}
    </div>
  );
}

export function EmotionStage({
  phase,
  subtitle,
  speaking,
  thinking,
  sheetOpen = false,
  keyboardOpen = false,
}: {
  phase: StagePhase;
  subtitle: string | null;
  speaking: boolean;
  thinking: boolean;
  sheetOpen?: boolean;
  keyboardOpen?: boolean;
}) {
  const manifest = useEmotionManifest();
  const [enterSeq, setEnterSeq] = useState(0);
  // 角色常驻：默认平静小人；明确情绪后更新。sensing 期间保留旧角色，不闪空
  const [lastEmotion, setLastEmotion] = useState<Emotion>('calm');

  useEffect(() => {
    if (phase.kind === 'character') {
      setLastEmotion(phase.emotion);
      setEnterSeq((n) => n + 1);
    }
  }, [phase]);

  const sensingVisual = phase.kind === 'sensing' ? manifest[phase.to] : null;
  const currentVisual = phase.kind === 'character' ? manifest[phase.emotion] : manifest[lastEmotion];

  return (
    <div className={`emotion-stage${sheetOpen ? ' with-sheet' : ''}${keyboardOpen ? ' with-keyboard' : ''}`}>
      {/* 空舞台场景图：完整氛围画面，按规范不叠手绘边框 */}
      <img className="stage-scene" src="/assets/scenes/calm-empty-stage.jpg" alt="" aria-hidden />
      <LightDots />

      {phase.kind === 'empty' && (
        <div className="stage-prompt">
          <p className="stage-prompt-text">今天的心情是什么颜色呢？</p>
        </div>
      )}

      {sensingVisual && (
        <div className="sensing-layer">
          <div
            className="sensing-glow"
            style={{
              background: `radial-gradient(circle, ${sensingVisual.glow} 0%, transparent 65%)`,
            }}
          />
        </div>
      )}

      <CharacterRenderer visual={currentVisual} enterKey={`e${enterSeq}`} />

      {(subtitle || thinking) && (
        <div className="subtitle-zone" role="status" aria-live="polite">
          <p className={`subtitle ${speaking ? 'speaking' : ''}`}>
            {thinking ? '小小我正在想……' : subtitle}
          </p>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { defaultEmotionManifest, loadEmotionManifest, type EmotionVisual } from '../emotion/manifest';
import type { Emotion } from '../types';
import type { StagePhase } from '../hooks/useEmotionChat';

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
  return manifest;
}

// 角色图：素材缺失回退纯色剪影，不白屏
function CharacterFigure({ visual, enterKey }: { visual: EmotionVisual; enterKey: string }) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <div className={`character enter-${visual.enterFrom}`} key={enterKey}>
      {imgOk ? (
        <img
          src={visual.image}
          alt=""
          draggable={false}
          onError={() => setImgOk(false)}
          className="character-img"
        />
      ) : (
        <div
          className="character-fallback"
          style={{ background: `linear-gradient(160deg, ${visual.color}, ${visual.glow})` }}
        />
      )}
      <div className="character-glow" style={{ background: visual.glow }} />
    </div>
  );
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
}: {
  phase: StagePhase;
  subtitle: string | null;
  speaking: boolean;
  thinking: boolean;
}) {
  const manifest = useEmotionManifest();
  const [enterSeq, setEnterSeq] = useState(0);

  useEffect(() => {
    if (phase.kind === 'character') setEnterSeq((n) => n + 1);
  }, [phase]);

  const sensingVisual = phase.kind === 'sensing' ? manifest[phase.to] : null;
  const currentVisual = phase.kind === 'character' ? manifest[phase.emotion] : null;

  return (
    <div className="emotion-stage">
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

      {currentVisual && <CharacterFigure visual={currentVisual} enterKey={`e${enterSeq}`} />}

      {(subtitle || thinking) && (
        <div className="subtitle-zone">
          <p className={`subtitle ${speaking ? 'speaking' : ''}`}>
            {thinking && !subtitle ? '小小我正在想……' : subtitle}
          </p>
        </div>
      )}
    </div>
  );
}

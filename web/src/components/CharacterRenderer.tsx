// CharacterRenderer：角色渲染收口。业务不直接操作 <img>/<video>，
// 统一走这里；素材形态由 manifest 决定，缺失时按 skeletal → video → image → 平静静态图 → 纯色剪影 降级。
// video 形态是「人物+场景」预合成整幅舞台视频（720×1280，鲁班 SHIY-382），直接铺满舞台，不再叠第二层背景。
import { useCallback, useEffect, useRef, useState } from 'react';
import type { EmotionVisual } from '../emotion/manifest';

export type CharacterSourceKind = 'skeletal' | 'video' | 'image';

// 静态小人最终兜底：任何情绪素材失败都先回平静角色，再退纯色剪影（不白屏、不露色块）
const CALM_FALLBACK_IMG = '/assets/emotions/calm/idle.png';

// 本轮已确认失败的视频素材：404/解码失败后该情绪回退静态图链，不再反复请求
const failedVideos = new Set<string>();

const warned = new Set<string>();
const warnOnce = (msg: string) => {
  if (warned.has(msg)) return;
  warned.add(msg);
  console.warn(msg);
};

// 解析当前可用素材形态：skeletal 仅有接口占位（未实现），出现即降级并提示
export function resolveCharacterSource(visual: EmotionVisual): CharacterSourceKind {
  if (visual.skeletal) {
    warnOnce(`[character] skeletal 渲染未实现，降级: ${visual.skeletal}`);
  }
  if (visual.video && !failedVideos.has(visual.video)) return 'video';
  if (visual.video) {
    warnOnce(`[character] 视频素材不可用，降级 image: ${visual.video}`);
  }
  return 'image';
}

// 首屏只加载 poster + 当前情绪视频，其余情绪视频空闲时预取（HTTP 缓存预热）
export function prefetchEmotionVideos(visuals: EmotionVisual[], excludeSrc?: string) {
  const run = () => {
    visuals.forEach((v) => {
      if (v.video && v.video !== excludeSrc && !failedVideos.has(v.video)) {
        fetch(v.video, { cache: 'force-cache' }).catch(() => {});
      }
    });
  };
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => void })
    .requestIdleCallback;
  if (ric) ric(run);
  else window.setTimeout(run, 2500);
}

// loop 接缝交叉淡化窗口：源素材首尾姿态不完全闭合，接缝处双 video 轮换淡化（鲁班建议 200~300ms）
const SEAM_SECONDS = 0.3;
// 情绪切换交叉淡化时长，与 styles.css 中 .video-layer 的 transition 对齐
const EMOTION_FADE_MS = 650;

type VideoProps = {
  src: string;
  poster?: string;
  onReady?: () => void;
  onError: (src: string) => void;
};

// 双 video 轮换的无缝循环：A 接近结尾时 B 从 0 起播并淡入，A 结束后复位待命；
// 若 timeupdate 粒度没赶上淡化窗口，ended 兜底立即接续，保证画面不断
function LoopVideo({ src, poster, onReady, onError }: VideoProps) {
  const aRef = useRef<HTMLVideoElement | null>(null);
  const bRef = useRef<HTMLVideoElement | null>(null);
  const activeRef = useRef<'a' | 'b'>('a');
  const swappingRef = useRef(false);
  const readyRef = useRef(false);
  const [front, setFront] = useState<'a' | 'b'>('a');

  const swapTo = useCallback((next: 'a' | 'b') => {
    const el = (next === 'a' ? aRef : bRef).current;
    if (!el) return;
    swappingRef.current = true;
    activeRef.current = next;
    try {
      el.currentTime = 0;
    } catch {
      /* 元数据未就绪时忽略，play 后从头播 */
    }
    void el.play().catch(() => {});
    setFront(next);
  }, []);

  const handleTimeUpdate = (which: 'a' | 'b') => (e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (activeRef.current !== which || swappingRef.current) return;
    const v = e.currentTarget;
    if (v.duration && v.duration - v.currentTime <= SEAM_SECONDS) {
      swapTo(which === 'a' ? 'b' : 'a');
    }
  };

  const handleEnded = (which: 'a' | 'b') => (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    if (activeRef.current === which) {
      swapTo(which === 'a' ? 'b' : 'a');
    }
    v.pause();
    try {
      v.currentTime = 0;
    } catch {
      /* ignore */
    }
    swappingRef.current = false;
  };

  const handlePlaying = (which: 'a' | 'b') => () => {
    if (which === 'a' && !readyRef.current) {
      readyRef.current = true;
      onReady?.();
    }
  };

  // 自动播放被拒/前后台切换：页面重新可见或用户首次触摸时恢复当前段播放
  useEffect(() => {
    const resume = () => {
      const el = (activeRef.current === 'a' ? aRef : bRef).current;
      if (el && el.paused && !document.hidden) void el.play().catch(() => {});
    };
    const onVis = () => {
      if (!document.hidden) resume();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pointerdown', resume);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointerdown', resume);
    };
  }, []);

  const common = {
    src,
    poster,
    muted: true,
    playsInline: true,
    preload: 'auto',
    disablePictureInPicture: true,
    onError: () => onError(src),
  } as const;

  return (
    <>
      <video
        {...common}
        ref={aRef}
        className={front === 'a' ? 'front' : ''}
        autoPlay
        onTimeUpdate={handleTimeUpdate('a')}
        onEnded={handleEnded('a')}
        onPlaying={handlePlaying('a')}
      />
      <video
        {...common}
        ref={bRef}
        className={front === 'b' ? 'front' : ''}
        onTimeUpdate={handleTimeUpdate('b')}
        onEnded={handleEnded('b')}
        onPlaying={handlePlaying('b')}
      />
    </>
  );
}

type VideoVisual = EmotionVisual & { video: string };

// 情绪切换：旧层继续播放直至新层首帧就绪，再交叉淡化替换，切情绪不闪空
function VideoCharacter({
  visual,
  onVideoError,
}: {
  visual: VideoVisual;
  onVideoError: (src: string) => void;
}) {
  const [layers, setLayers] = useState<VideoVisual[]>([visual]);
  const [readySrc, setReadySrc] = useState<string | null>(null);

  useEffect(() => {
    setLayers((ls) => {
      if (ls[ls.length - 1]?.video === visual.video) return ls;
      // 快速往返切换时把已有层挪回顶层，复用已加载的 video 元素
      return [...ls.filter((l) => l.video !== visual.video), visual];
    });
  }, [visual]);

  const top = layers[layers.length - 1];
  const topReady = layers.length === 1 || readySrc === top.video;

  // 新层首帧就绪 → 交叉淡化，过渡结束后移除旧层
  useEffect(() => {
    if (layers.length < 2 || readySrc !== top.video) return;
    const t = window.setTimeout(() => {
      setLayers((ls) => ls.filter((l) => l.video === top.video));
      setReadySrc(null);
    }, EMOTION_FADE_MS);
    return () => window.clearTimeout(t);
  }, [layers.length, readySrc, top.video]);

  return (
    <div className="stage-video" aria-hidden>
      {layers.map((l, i) => {
        const isTop = i === layers.length - 1;
        const on = isTop ? topReady : !topReady;
        return (
          <div key={l.video} className={`video-layer${on ? '' : ' off'}`}>
            <LoopVideo
              src={l.video}
              poster={l.poster}
              onReady={() => setReadySrc(l.video)}
              onError={(src) => {
                if (isTop) {
                  onVideoError(src);
                } else {
                  // 旧层在淡出途中失败：直接移除，不影响新层
                  setLayers((ls) => ls.filter((x) => x.video !== src));
                }
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

export function CharacterRenderer({
  visual,
  enterKey,
}: {
  visual: EmotionVisual;
  enterKey: string;
}) {
  const [, setBump] = useState(0);
  const [errCount, setErrCount] = useState(0);
  useEffect(() => setErrCount(0), [visual.image]);
  const handleVideoError = useCallback((src: string) => {
    failedVideos.add(src);
    warnOnce(`[character] 视频加载失败，回退静态小人: ${src}`);
    setBump((n) => n + 1);
  }, []);
  const kind = resolveCharacterSource(visual);

  if (kind === 'video' && visual.video) {
    return <VideoCharacter visual={visual as VideoVisual} onVideoError={handleVideoError} />;
  }

  const fallbacks =
    visual.image === CALM_FALLBACK_IMG ? [visual.image] : [visual.image, CALM_FALLBACK_IMG];
  const imgOk = errCount < fallbacks.length;

  return (
    <div className={`character enter-${visual.enterFrom}`} key={enterKey}>
      {imgOk ? (
        <img
          src={fallbacks[errCount]}
          alt=""
          draggable={false}
          onError={() => setErrCount((n) => n + 1)}
          className="character-img"
        />
      ) : (
        // 最终降级：纯色剪影，不白屏
        <div
          className="character-fallback"
          style={{ background: `linear-gradient(160deg, ${visual.color}, ${visual.glow})` }}
        />
      )}
      <div className="character-glow" style={{ background: visual.glow }} />
    </div>
  );
}

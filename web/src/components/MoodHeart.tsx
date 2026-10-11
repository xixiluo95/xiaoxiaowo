import { useId } from 'react';
import type { Emotion } from '../types';
import { defaultEmotionManifest } from '../emotion/manifest';

// 心情心脏：未确认一律白色；并列最高情绪用多色渐变
export function MoodHeart({
  colors,
  confirmed,
  size = 160,
}: {
  colors: Emotion[];
  confirmed: boolean;
  size?: number;
}) {
  const gid = useId();
  const list = confirmed ? colors : [];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className="mood-heart"
      role="img"
      aria-label={confirmed ? '今日心情' : '心情未确认'}
    >
      <defs>
        {list.length > 1 && (
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            {list.map((e, i) => (
              <stop
                key={e}
                offset={`${(i / Math.max(1, list.length - 1)) * 100}%`}
                stopColor={defaultEmotionManifest[e].color}
              />
            ))}
          </linearGradient>
        )}
      </defs>
      <path
        d="M50 88 C20 66 6 48 6 32 C6 18 17 8 30 8 C39 8 46 13 50 21 C54 13 61 8 70 8 C83 8 94 18 94 32 C94 48 80 66 50 88 Z"
        fill={
          list.length === 0
            ? '#ffffff'
            : list.length === 1
              ? defaultEmotionManifest[list[0]].color
              : `url(#${gid})`
        }
        style={{ stroke: 'var(--xxw-ink, #5B4A3F)' }}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      {!confirmed && (
        <text x="50" y="48" textAnchor="middle" fontSize="11" fill="#9a938a">
          未确认
        </text>
      )}
    </svg>
  );
}

// 主题 tokens 单一来源。applyTheme 把 tokens 写成 :root 上的 --xxw-* CSS 变量，
// src/styles.css 儿童端区段只消费这些变量。情绪色与 /assets/emotions/manifest.json 对齐。

export type ThemeTokens = {
  color: {
    bg: string; // 页面底色（米白）
    ink: string; // 墨色（暖灰棕描边/正文）
    card: string; // 卡片底
    muted: string; // 次要文字
    line: string; // 浅分隔线
    emotion: {
      joy: string; // 开心·金
      sadness: string; // 难过·蓝
      anger: string; // 生气·红
      fear: string; // 害怕·紫
      calm: string; // 平静·白
    };
    emotionGlow: {
      joy: string;
      sadness: string;
      anger: string;
      fear: string;
      calm: string;
    };
  };
  radius: {
    card: number;
    button: number; // pill 时用作大圆角基数
    input: number;
  };
  fontSize: {
    body: number; // 对话正文
    diary: number; // 日记正文
    cardTitle: number; // 卡片标题
    small: number;
  };
  stroke: {
    color: string; // 手绘描边色
    width: number;
  };
};

export const defaultTokens: ThemeTokens = {
  color: {
    bg: '#FBF8F2',
    ink: '#5B4A3F',
    card: '#FFFFFF',
    muted: '#9A938A',
    line: '#D8D2C4',
    emotion: {
      joy: '#FFC94D',
      sadness: '#4A7FD4',
      anger: '#E8442E',
      fear: '#8B5CF6',
      calm: '#F2EEE6',
    },
    emotionGlow: {
      joy: '#FFE9A8',
      sadness: '#9CC4F5',
      anger: '#FF8A5C',
      fear: '#C4B0FA',
      calm: '#FFF8E7',
    },
  },
  radius: {
    card: 18,
    button: 999,
    input: 999,
  },
  fontSize: {
    body: 16,
    diary: 15,
    cardTitle: 18,
    small: 12,
  },
  stroke: {
    color: '#5B4A3F',
    width: 2,
  },
};

export type ThemeOverrides = {
  color?: Partial<
    Omit<ThemeTokens['color'], 'emotion' | 'emotionGlow'> & {
      emotion?: Partial<ThemeTokens['color']['emotion']>;
      emotionGlow?: Partial<ThemeTokens['color']['emotionGlow']>;
    }
  >;
  radius?: Partial<ThemeTokens['radius']>;
  fontSize?: Partial<ThemeTokens['fontSize']>;
  stroke?: Partial<ThemeTokens['stroke']>;
};

const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|[a-zA-Z]+)$/;

function isColor(v: unknown): v is string {
  return typeof v === 'string' && COLOR_RE.test(v.trim());
}

function isPositiveNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

// 深合并 + 字段校验：非法值忽略并 warn，回退默认
export function mergeTheme(overrides?: ThemeOverrides): ThemeTokens {
  const t: ThemeTokens = JSON.parse(JSON.stringify(defaultTokens)) as ThemeTokens;
  if (!overrides || typeof overrides !== 'object') return t;
  const warn = (path: string) =>
    console.warn(`[ui/theme] 非法主题覆盖已忽略: ${path}`);

  const mergeColors = (
    target: Record<string, string>,
    src: Record<string, unknown> | undefined,
    path: string,
  ) => {
    if (!src || typeof src !== 'object') return;
    for (const [k, v] of Object.entries(src)) {
      if (!(k in target) || !isColor(v)) {
        warn(`${path}.${k}`);
        continue;
      }
      target[k] = v;
    }
  };
  const mergeNumbers = (
    target: Record<string, number>,
    src: Record<string, unknown> | undefined,
    path: string,
  ) => {
    if (!src || typeof src !== 'object') return;
    for (const [k, v] of Object.entries(src)) {
      if (!(k in target) || !isPositiveNumber(v)) {
        warn(`${path}.${k}`);
        continue;
      }
      target[k] = v;
    }
  };

  const { emotion, emotionGlow, ...flatColors } = overrides.color ?? {};
  mergeColors(t.color as unknown as Record<string, string>, flatColors, 'color');
  mergeColors(t.color.emotion as unknown as Record<string, string>, emotion, 'color.emotion');
  mergeColors(t.color.emotionGlow as unknown as Record<string, string>, emotionGlow, 'color.emotionGlow');
  mergeNumbers(t.radius as unknown as Record<string, number>, overrides.radius, 'radius');
  mergeNumbers(t.fontSize as unknown as Record<string, number>, overrides.fontSize, 'fontSize');
  if (overrides.stroke) {
    if (overrides.stroke.color !== undefined) {
      if (isColor(overrides.stroke.color)) t.stroke.color = overrides.stroke.color;
      else warn('stroke.color');
    }
    if (overrides.stroke.width !== undefined) {
      if (isPositiveNumber(overrides.stroke.width)) t.stroke.width = overrides.stroke.width;
      else warn('stroke.width');
    }
  }
  return t;
}

let currentTokens: ThemeTokens = defaultTokens;

export function getTokens(): ThemeTokens {
  return currentTokens;
}

// 把 tokens 写成 :root CSS 变量
export function applyTheme(overrides?: ThemeOverrides): ThemeTokens {
  const t = mergeTheme(overrides);
  currentTokens = t;
  const root = document.documentElement.style;
  const set = (k: string, v: string | number) => root.setProperty(`--xxw-${k}`, String(v));
  set('bg', t.color.bg);
  set('ink', t.color.ink);
  set('card', t.color.card);
  set('muted', t.color.muted);
  set('line', t.color.line);
  (Object.keys(t.color.emotion) as (keyof ThemeTokens['color']['emotion'])[]).forEach((k) => {
    set(`emotion-${k}`, t.color.emotion[k]);
    set(`emotion-${k}-glow`, t.color.emotionGlow[k]);
  });
  set('radius-card', `${t.radius.card}px`);
  set('radius-button', `${t.radius.button}px`);
  set('radius-input', `${t.radius.input}px`);
  set('fs-body', `${t.fontSize.body}px`);
  set('fs-diary', `${t.fontSize.diary}px`);
  set('fs-card-title', `${t.fontSize.cardTitle}px`);
  set('fs-small', `${t.fontSize.small}px`);
  set('stroke-color', t.stroke.color);
  set('stroke-width', `${t.stroke.width}px`);
  return t;
}

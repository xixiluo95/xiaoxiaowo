// 与后端（司南 T4）约定的接口类型。字段以《制作方针》EmotionDecision 为基准。
export type Emotion = 'calm' | 'joy' | 'anger' | 'sadness' | 'fear';

export type EmotionDecision = {
  primary: Emotion;
  confidence: number;
  ambiguous: boolean;
  diaryEligible: boolean;
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  eventSummary?: string;
};

export type ChatReply = {
  reply: string;
  emotion: EmotionDecision;
};

export type ChatMessage = {
  id: string;
  role: 'child' | 'ai';
  text: string;
  emotion?: Emotion;
  at: number;
};

export type DiaryBlock = {
  id: string;
  source: 'user' | 'ai';
  locked: boolean;
  text: string;
  eventId?: string;
};

export type EmotionStat = { emotion: Emotion; count: number };

export type Diary = {
  date: string; // YYYY-MM-DD
  status: 'draft' | 'final_draft' | 'confirmed';
  blocks: DiaryBlock[];
  emotionStats: EmotionStat[];
  moodConfirmed: boolean;
  shared: boolean;
};

export type CalendarDay = {
  date: string;
  hasDiary: boolean;
  moodConfirmed: boolean;
  colors: Emotion[]; // 并列最高为多个 -> 渐变；未确认为空 -> 白
};

export type Guidance = {
  id: string;
  riskLevel: 'none' | 'medium' | 'high';
  levelName: string; // 日常陪伴 | 疑似霸凌 | 明确危险
  eventBrief: string; // 简短、不确定措辞
  actions: string[];
  openingLines: string[];
  avoid: string[];
  followUps: string[];
  watchOut: string;
};

export type SharedDiarySnapshot = {
  id: string;
  date: string;
  text: string;
  emotionStats: EmotionStat[];
  sharedAt: string; // ISO 时间
};

// 家长端单日聚合内容（GET /api/parent/day）
export type ParentDayContent = {
  date: string;
  mood: { confirmed: boolean; colors: Emotion[]; gradient: boolean; stats: EmotionStat[] };
  guidance: Guidance | null;
  sharedDiary: SharedDiarySnapshot | null;
};

// 家长端月历概览（GET /api/parent/calendar）
export type ParentCalendarDay = {
  date: string;
  moodConfirmed: boolean;
  colors: Emotion[]; // 并列最高多个 -> 渐变；未确认为空 -> 白
  hasSharedDiary: boolean;
  hasGuidance: boolean;
};

export type SttResult = { text: string; final: boolean; confidence?: number };

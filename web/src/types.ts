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
  riskLevel: 'medium' | 'high';
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
  sharedAt: number;
};

export type ParentDayContent = {
  date: string;
  mood: { confirmed: boolean; colors: Emotion[] };
  guidance: Guidance | null;
  sharedDiary: SharedDiarySnapshot | null;
};

export type SttResult = { text: string; final: boolean; confidence?: number };

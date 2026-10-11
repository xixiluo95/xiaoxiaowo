// 本地 Mock：后端未就绪时（VITE_MOCK_API=1）让前端全流程可演示。
import type {
  CalendarDay,
  ChatReply,
  Diary,
  DiaryBlock,
  Emotion,
  EmotionDecision,
  ParentDayContent,
  SttResult,
} from '../types';

const EMOTIONS: Emotion[] = ['joy', 'anger', 'sadness', 'fear', 'calm'];
const KEYWORDS: [RegExp, Emotion][] = [
  [/开心|高兴|好玩|喜欢|棒|笑/, 'joy'],
  [/生气|气死|讨厌|愤怒|凭什么/, 'anger'],
  [/难过|伤心|哭|委屈|想哭/, 'sadness'],
  [/害怕|怕|恐惧|不敢|吓/, 'fear'],
];

let turn = 0;
let diary: Diary | null = null;
let shared = false;
let mockSessionId = '';

const today = () => new Date().toISOString().slice(0, 10);

function decideEmotion(text: string): EmotionDecision {
  const hit = KEYWORDS.find(([re]) => re.test(text));
  const primary = hit ? hit[1] : EMOTIONS[turn % EMOTIONS.length];
  const ambiguous = !hit && turn % 3 === 2;
  return {
    primary,
    confidence: hit ? 0.85 : 0.45,
    ambiguous,
    diaryEligible: !ambiguous,
    riskLevel: 'none',
    eventSummary: text.slice(0, 24),
  };
}

const REPLIES = [
  '我在听呢，你可以慢慢说。',
  '嗯……这听起来真的不太容易。你愿意再多告诉我一点吗？',
  '我们是不是因为这件事，心里有点不舒服呀？',
  '谢谢你告诉我这些，我都会记在心里的。',
  '不管怎样，我都会在这里陪着你。',
];

function ensureDiary(): Diary {
  if (!diary) {
    diary = {
      date: today(),
      status: 'draft',
      blocks: [],
      emotionStats: [],
      moodConfirmed: false,
      shared,
    };
  }
  return diary;
}

function recount(d: Diary) {
  const counts = new Map<Emotion, number>();
  d.blocks.forEach((b) => {
    if (!b.eventId) return;
    const emo = (b as DiaryBlock & { emotion?: Emotion }).emotion;
    if (emo) counts.set(emo, (counts.get(emo) ?? 0) + 1);
  });
  d.emotionStats = [...counts.entries()].map(([emotion, count]) => ({ emotion, count }));
}

export async function ensureSession(): Promise<string> {
  if (!mockSessionId) mockSessionId = `mock-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem('xxw_session_id', mockSessionId);
  return mockSessionId;
}

export async function sendChat(text: string): Promise<ChatReply> {
  await new Promise((r) => setTimeout(r, 700));
  const emotion = decideEmotion(text);
  turn += 1;
  if (emotion.diaryEligible && !emotion.ambiguous) {
    const d = ensureDiary();
    const block: DiaryBlock & { emotion?: Emotion } = {
      id: `b${Date.now()}`,
      source: 'ai',
      locked: false,
      text: `今天我聊到：${emotion.eventSummary ?? text}。`,
      eventId: `e${Date.now()}`,
    };
    block.emotion = emotion.primary;
    d.blocks.push(block);
    recount(d);
  }
  return { reply: REPLIES[turn % REPLIES.length], emotion };
}

export async function transcribe(_audio: Blob): Promise<SttResult> {
  await new Promise((r) => setTimeout(r, 500));
  const samples = [
    '今天体育课小明抢了我的球，我很生气',
    '我和同桌一起画画，特别开心',
    '我有点难过，因为没人跟我玩',
    '晚上一个人睡觉我有点害怕',
  ];
  return { text: samples[turn % samples.length], final: true, confidence: 0.9 };
}

export async function synthesize(_text: string): Promise<Blob> {
  // mock 环境无真实 TTS：模拟失败，前端走「保留字幕」降级路径
  await new Promise((r) => setTimeout(r, 400));
  throw new Error('mock: TTS unavailable');
}

export async function getDiary(date?: string): Promise<Diary | null> {
  if (!diary) return null;
  if (date && date !== diary.date) return null;
  return { ...diary, shared };
}

export async function updateDiaryBlock(blockId: string, text: string): Promise<Diary> {
  const d = ensureDiary();
  const b = d.blocks.find((x) => x.id === blockId);
  if (b) {
    b.text = text;
    b.source = 'user';
    b.locked = true;
  }
  return { ...d };
}

export async function confirmDiary(_date: string): Promise<Diary> {
  const d = ensureDiary();
  d.status = 'confirmed';
  d.moodConfirmed = true;
  return { ...d };
}

export async function deleteDiaryEvent(eventId: string): Promise<Diary> {
  const d = ensureDiary();
  d.blocks = d.blocks.filter((b) => b.eventId !== eventId);
  recount(d);
  return { ...d };
}

export async function shareDiary(_date: string): Promise<{ ok: boolean }> {
  shared = true;
  return { ok: true };
}

export async function getCalendar(month: string): Promise<CalendarDay[]> {
  const days: CalendarDay[] = [];
  if (!diary || !diary.date.startsWith(month)) return days;
  const top = topEmotions(diary);
  days.push({
    date: diary.date,
    hasDiary: diary.blocks.length > 0,
    moodConfirmed: diary.moodConfirmed,
    colors: diary.moodConfirmed ? top : [],
  });
  return days;
}

function topEmotions(d: Diary): Emotion[] {
  if (!d.emotionStats.length) return [];
  const max = Math.max(...d.emotionStats.map((s) => s.count));
  return d.emotionStats.filter((s) => s.count === max).map((s) => s.emotion);
}

export async function getParentDay(date: string): Promise<ParentDayContent> {
  const d = diary && diary.date === date ? diary : null;
  const hasDiary = !!(d && shared && d.blocks.length);
  return {
    date,
    mood: {
      confirmed: !!d?.moodConfirmed,
      colors: d && d.moodConfirmed ? topEmotions(d) : [],
    },
    guidance: null,
    sharedDiary:
      d && hasDiary
        ? {
            id: 'snap-1',
            date: d.date,
            text: d.blocks.map((b) => b.text).join('\n'),
            emotionStats: d.emotionStats,
            sharedAt: Date.now(),
          }
        : null,
  };
}

export async function devFinalizeDiary(): Promise<{ ok: boolean }> {
  const d = ensureDiary();
  d.status = 'final_draft';
  return { ok: true };
}

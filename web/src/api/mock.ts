// 本地 Mock：后端未就绪时（VITE_MOCK_API=1）让前端全流程可演示。
import type {
  CalendarDay,
  ChatReply,
  Diary,
  DiaryBlock,
  Emotion,
  EmotionDecision,
  EmotionStat,
  Guidance,
  ParentCalendarDay,
  ParentDayContent,
  SharedDiarySnapshot,
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

export async function revokeDiaryShare(_date: string): Promise<{ ok: boolean }> {
  shared = false;
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

// ————— 家长端三态演示（仅 mock 模式生效）—————
// VITE_MOCK_API=1 时用 URL query `mockState=empty|guideOnly|both`（默认缺省=旧行为，
// 传了才进演示场景）固定家长端首页三态；hash 路由下 query 在 # 后也认。
type ParentMockState = 'empty' | 'guideOnly' | 'both';

function parentMockState(): ParentMockState | null {
  if (typeof window === 'undefined') return null;
  const read = (q: string) => new URLSearchParams(q).get('mockState');
  const v = read(window.location.search) ?? read(window.location.hash.split('?')[1] ?? '');
  return v === 'empty' || v === 'guideOnly' || v === 'both' ? v : null;
}

const CANNED_GUIDANCE: Guidance = {
  id: 'canned-guidance-1',
  riskLevel: 'medium',
  levelName: '疑似受挫',
  eventBrief: '孩子今天可能遇到了让他有些受挫的事情，具体情况还不确定。',
  actions: [
    '今晚可以一起散步，聊聊那只橘猫的故事，倾听他的感受，给予他充分的陪伴',
    '先听孩子说完，再回应情绪，最后才讨论办法',
  ],
  openingLines: [
    '听说你今天遇到了一只可爱的小猫，能给我讲讲它的样子吗？',
    '我看到你今天好像有点不一样，想聊聊吗？',
  ],
  avoid: ['这有什么好难过的。', '别想那么多了，快去写作业。'],
  followUps: ['这样的事情是第一次，还是发生过几次了？', '你希望我怎么帮你？'],
  watchOut: '留意他明天早晨的情绪状态与起床节奏，看他是否对新一天的学校生活保持积极态度。',
};

const CANNED_DIARY_TODAY = [
  '今天在学校的操场上看到了一只流浪猫，它有着橘色的毛，我把我的一半三明治分给它吃了，它吃得很开心。',
  '下午的数学考试有一道题好难，我想了很久都没做出来，心里有点难过，但是同桌轻轻拍了拍我的肩膀安慰了我。',
  '晚上回家的时候，天已经慢慢黑了，路灯亮起来的样子像一颗颗温暖的星星，我希望明天也能是个阳光明媚的好天气。',
].join('\n');

const CANNED_DIARY_9TH = [
  '今天在幼儿园和明明一起搭了很高的积木城堡，老师还夸我们合作得好。中午吃了最喜欢的糖醋排骨，吃了两碗饭呢！',
  '晚上妈妈给我讲了《小王子》的故事，我觉得那朵玫瑰花虽然有点骄傲，但其实很需要小王子。希望明天也是一个晴天，想去公园看蚂蚁搬家。',
].join('\n');

function cannedCalendarDays(month: string, state: ParentMockState): ParentCalendarDay[] {
  const todayStr = today();
  const mk = (
    day: number,
    moodConfirmed: boolean,
    colors: Emotion[],
    extra?: Partial<ParentCalendarDay>,
  ): ParentCalendarDay => ({
    date: `${month}-${String(day).padStart(2, '0')}`,
    moodConfirmed,
    colors,
    hasSharedDiary: false,
    hasGuidance: false,
    ...extra,
  });
  const days = [
    mk(1, true, ['joy']),
    mk(2, true, ['calm']),
    mk(3, true, ['sadness']),
    mk(4, true, ['joy', 'sadness']), // 并列最高 → 渐变
    mk(5, true, ['fear']),
    mk(8, true, ['anger']),
    mk(9, true, ['joy'], { hasSharedDiary: true }),
    mk(10, false, []), // 未确认 → 白色
  ];
  const todayDay = todayStr.startsWith(month) ? Number(todayStr.slice(8, 10)) : 11;
  days.push(
    mk(todayDay, true, ['joy'], {
      hasSharedDiary: state !== 'guideOnly',
      hasGuidance: state !== 'empty',
    }),
  );
  // 未来日期不出数据（淡灰心）
  return days.filter((d) => d.date <= todayStr);
}

function cannedSnapshot(date: string, stats: EmotionStat[]): SharedDiarySnapshot {
  return {
    id: `canned-snap-${date}`,
    date,
    text: date.endsWith('-09') ? CANNED_DIARY_9TH : CANNED_DIARY_TODAY,
    emotionStats: stats,
    sharedAt: new Date().toISOString(),
  };
}

function cannedParentDay(date: string, state: ParentMockState): ParentDayContent {
  const entry = cannedCalendarDays(date.slice(0, 7), state).find((d) => d.date === date);
  const stats: EmotionStat[] =
    entry?.moodConfirmed && entry.colors.length
      ? entry.colors.length > 1
        ? entry.colors.map((emotion) => ({ emotion, count: 1 }))
        : [
            { emotion: entry.colors[0], count: 2 },
            { emotion: entry.colors[0] === 'joy' ? 'calm' : 'joy', count: 1 },
          ]
      : [];
  return {
    date,
    mood: {
      confirmed: !!entry?.moodConfirmed,
      colors: entry?.moodConfirmed ? entry.colors : [],
      gradient: !!entry && entry.colors.length > 1,
      stats,
    },
    guidance: entry?.hasGuidance ? CANNED_GUIDANCE : null,
    sharedDiary: entry?.hasSharedDiary ? cannedSnapshot(date, stats) : null,
  };
}

// 家长端 mock：聊天里出现风险关键词时给出指南，便于演示三种首页布局
const RISK_RE = /欺负|抢|打骂|威胁|骂/;

function mockGuidance(d: Diary | null): Guidance | null {
  if (!d) return null;
  const risky = d.blocks.some((b) => RISK_RE.test(b.text));
  if (!risky) return shared && d.blocks.length ? {
    id: 'mock-shared-guidance',
    riskLevel: 'none',
    levelName: '日常陪伴',
    eventBrief: '孩子主动分享了这篇日记，可以从感谢分享、倾听感受和一起做一件小事开始。',
    actions: ['感谢孩子愿意分享，留出几分钟专心听。', '让孩子选择一件希望您一起做的小事，并约好时间。'],
    openingLines: ['谢谢你愿意分享，哪件事最想和我聊聊？'],
    avoid: ['这有什么好说的。'],
    followUps: ['你希望我怎样陪你？'],
    watchOut: '尊重孩子不想继续聊的选择，不转发日记或用来批评孩子。',
  } : null;
  return {
    id: 'mock-guidance-1',
    riskLevel: 'medium',
    levelName: '疑似霸凌',
    eventBrief: '孩子可能遇到了和同学之间疑似被欺负的事情，具体情况还不确定。',
    actions: [
      '今天抽时间轻松地问一句，不要正式审问',
      '先听孩子说完，再回应情绪，最后才讨论办法',
    ],
    openingLines: [
      '今天在学校有没有和谁闹别扭呀？',
      '我看到你今天好像有点不一样，想聊聊吗？',
    ],
    avoid: ['一个巴掌拍不响。', '你别理他就行了。', '小孩打闹很正常，别在意。'],
    followUps: [
      '这样的事情是第一次，还是发生过几次了？',
      '当时有老师或其他同学看到吗？',
      '你希望我怎么帮你？',
    ],
    watchOut: '连续几天观察孩子情绪变化；如果类似情况反复出现或升级，建议主动联系老师了解情况后决定下一步。',
  };
}

function mockMood(d: Diary | null) {
  const confirmed = !!d?.moodConfirmed;
  const colors = d && confirmed ? topEmotions(d) : [];
  return {
    confirmed,
    colors,
    gradient: colors.length > 1,
    stats: (d?.emotionStats ?? []) as EmotionStat[],
  };
}

export async function getParentDay(date: string): Promise<ParentDayContent> {
  const state = parentMockState();
  if (state) return cannedParentDay(date, state);
  const d = diary && diary.date === date ? diary : null;
  const hasDiary = !!(d && shared && d.blocks.length);
  return {
    date,
    mood: mockMood(d),
    guidance: mockGuidance(d),
    sharedDiary:
      d && hasDiary
        ? {
            id: 'snap-1',
            date: d.date,
            text: d.blocks.map((b) => b.text).join('\n'),
            emotionStats: d.emotionStats,
            sharedAt: new Date().toISOString(),
          }
        : null,
  };
}

export async function getParentCalendar(month: string): Promise<ParentCalendarDay[]> {
  const state = parentMockState();
  if (state) return cannedCalendarDays(month, state);
  if (!diary || !diary.date.startsWith(month)) return [];
  const mood = mockMood(diary);
  return [
    {
      date: diary.date,
      moodConfirmed: mood.confirmed,
      colors: mood.colors,
      hasSharedDiary: shared && diary.blocks.length > 0,
      hasGuidance: !!mockGuidance(diary),
    },
  ];
}

export async function devFinalizeDiary(): Promise<{ ok: boolean }> {
  const d = ensureDiary();
  d.status = 'final_draft';
  return { ok: true };
}

// 日记数据访问共享层：按真实后端契约适配（api/app/routes.py + diary_service.py）。
// mock 模式（VITE_MOCK_API=1）复用本地 mock 并按同一视图模型归一。
// 由 SHIY-377 的 pages/child/diaryApi.ts 提升而来，旧 client.ts 日记函数（平铺 Diary 假设）已移除。
import { MOCK_ENABLED, getSessionId } from './client';
import * as mock from './mock';
import type { Diary, DiaryBlock, Emotion, EmotionStat } from '../types';

export type DiaryStatus = 'draft' | 'final_draft' | 'confirmed';

// 页面视图模型：一天唯一一篇日记 + 心情心脏状态 + 分享状态
export type DiaryView = {
  date: string; // YYYY-MM-DD
  status: DiaryStatus;
  blocks: DiaryBlock[];
  emotionStats: EmotionStat[];
  moodConfirmed: boolean;
  moodColors: Emotion[]; // 并列最高为多个 -> 渐变；未确认为空 -> 白
  shared: boolean;
};

// 删除事件 / 保存块后后端返回的心脏重算结果
export type HeartPatch = {
  emotionStats: EmotionStat[];
  moodConfirmed: boolean;
  moodColors: Emotion[];
};

const EMOTION_ORDER: Emotion[] = ['joy', 'anger', 'sadness', 'fear', 'calm'];

type CodedError = Error & { code?: string };

function codedError(code: string): CodedError {
  const e = new Error(code) as CodedError;
  e.code = code;
  return e;
}

export function isExpired(e: unknown): boolean {
  const c = (e as CodedError)?.code;
  return c === 'EXPIRED' || c === 'NOT_FOUND';
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (res.status === 410) throw codedError('EXPIRED');
  if (res.status === 404) throw codedError('NOT_FOUND');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

// —— 真实接口返回形状 ——
type RealBlock = {
  id: string;
  eventId: string | null;
  source: 'user' | 'ai';
  locked: boolean;
  text: string;
  position: number;
};

type RealDiaryResp = {
  date: string;
  diary: { id: string; status: string; finalizedAt: string | null } | null;
  blocks: RealBlock[];
};

// GET /api/mood/{sessionId} 与 DELETE /api/events/{id} 返回的 heart
type RealHeart = {
  state: 'confirmed' | 'unconfirmed';
  colors: Emotion[];
  gradient: boolean;
  votes: Record<string, number>;
};

function mapStatus(s: string): DiaryStatus {
  if (s === 'confirmed') return 'confirmed';
  if (s === 'final_draft') return 'final_draft';
  return 'draft'; // 后端 live → 前端草稿
}

function statsFromVotes(votes: Record<string, number>): EmotionStat[] {
  return EMOTION_ORDER.filter((e) => (votes[e] ?? 0) > 0).map((e) => ({
    emotion: e,
    count: votes[e],
  }));
}

function topColors(stats: EmotionStat[]): Emotion[] {
  if (!stats.length) return [];
  const max = Math.max(...stats.map((s) => s.count));
  return stats.filter((s) => s.count === max).map((s) => s.emotion);
}

function heartPatch(heart: RealHeart): HeartPatch {
  const confirmed = heart.state === 'confirmed';
  return {
    emotionStats: statsFromVotes(heart.votes ?? {}),
    moodConfirmed: confirmed,
    // 颜色以后端 heart 为准（覆盖「孩子主动确认但无计票事件」的情况）
    moodColors: confirmed ? heart.colors ?? [] : [],
  };
}

function fromMock(d: Diary): DiaryView {
  return {
    date: d.date,
    status: d.status,
    blocks: d.blocks,
    emotionStats: d.emotionStats,
    moodConfirmed: d.moodConfirmed,
    moodColors: d.moodConfirmed ? topColors(d.emotionStats) : [],
    shared: d.shared,
  };
}

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

/** 读取某天日记；无日记或已过保留期（410/404）返回 null。 */
export async function loadDiary(date?: string): Promise<DiaryView | null> {
  if (MOCK_ENABLED) {
    const d = await mock.getDiary(date);
    return d ? fromMock(d) : null;
  }
  const sid = getSessionId();
  if (!sid) return null;
  const q = `sessionId=${encodeURIComponent(sid)}${date ? `&date=${date}` : ''}`;
  let data: RealDiaryResp;
  try {
    data = await req<RealDiaryResp>(`/api/diary?${q}`);
  } catch (e) {
    if (isExpired(e)) return null;
    throw e;
  }
  if (!data.diary) return null;
  // 心情与分享状态独立获取，失败降级为空，不阻断正文展示
  const heart = await req<RealHeart>(
    `/api/mood/${encodeURIComponent(sid)}${date ? `?date=${date}` : ''}`,
  ).catch(() => null);
  const shared = await req<{ snapshots: unknown[] }>(
    `/api/parent/diaries/${encodeURIComponent(sid)}?date=${data.date}`,
  )
    .then((r) => r.snapshots.length > 0)
    .catch(() => false);
  const patch = heart
    ? heartPatch(heart)
    : { emotionStats: [], moodConfirmed: false, moodColors: [] };
  return {
    date: data.date,
    status: mapStatus(data.diary.status),
    blocks: data.blocks.map((b) => ({
      id: b.id,
      source: b.source,
      locked: b.locked,
      text: b.text,
      eventId: b.eventId ?? undefined,
    })),
    ...patch,
    shared,
  };
}

/** 保存孩子修改：后端只返回被改块（自动置 locked/source=user），调用方合并进本地状态。 */
export async function saveBlock(blockId: string, text: string): Promise<DiaryBlock> {
  if (MOCK_ENABLED) {
    const d = await mock.updateDiaryBlock(blockId, text);
    const b = d.blocks.find((x) => x.id === blockId);
    if (!b) throw codedError('NOT_FOUND');
    return b;
  }
  const r = await req<{ id: string; text: string; locked: boolean; source: 'user' | 'ai' }>(
    `/api/diary/blocks/${encodeURIComponent(blockId)}`,
    jsonInit('PUT', { sessionId: getSessionId(), text }),
  );
  return { id: r.id, text: r.text, locked: r.locked, source: r.source };
}

/** 孩子确认当天日记。 */
export async function confirmDiary(date: string): Promise<DiaryStatus> {
  if (MOCK_ENABLED) {
    await mock.confirmDiary(date);
    return 'confirmed';
  }
  const r = await req<{ diaryId: string; status: string }>(
    '/api/diary/confirm',
    jsonInit('POST', { sessionId: getSessionId(), date }),
  );
  return mapStatus(r.status);
}

/** 删除事件：DELETE /api/events/{id}，返回重算后的心脏状态供局部更新。 */
export async function deleteEvent(eventId: string): Promise<HeartPatch> {
  if (MOCK_ENABLED) {
    const d = await mock.deleteDiaryEvent(eventId);
    return {
      emotionStats: d.emotionStats,
      moodConfirmed: d.moodConfirmed,
      moodColors: d.moodConfirmed ? topColors(d.emotionStats) : [],
    };
  }
  const r = await req<{ deleted: boolean; heart: RealHeart }>(
    `/api/events/${encodeURIComponent(eventId)}?sessionId=${encodeURIComponent(getSessionId() ?? '')}`,
    { method: 'DELETE' },
  );
  return heartPatch(r.heart);
}

/** 分享当天日记（生成该版本独立快照）。 */
export async function shareDiary(date: string): Promise<void> {
  if (MOCK_ENABLED) {
    await mock.shareDiary(date);
    return;
  }
  await req('/api/diary/share', jsonInit('POST', { sessionId: getSessionId(), date }));
}

/** 撤回当天日记的全部分享快照（所有版本旧链接立即 410）。 */
export async function revokeDiaryShare(date: string): Promise<void> {
  if (MOCK_ENABLED) {
    await mock.revokeDiaryShare(date);
    return;
  }
  await req('/api/diary/share/revoke', jsonInit('POST', { sessionId: getSessionId(), date }));
}

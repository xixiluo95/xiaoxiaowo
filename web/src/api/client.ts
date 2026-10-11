import type {
  CalendarDay,
  ChatReply,
  Emotion,
  ParentCalendarDay,
  ParentDayContent,
  SttResult,
} from '../types';
import * as mock from './mock';

export const MOCK_ENABLED = import.meta.env.VITE_MOCK_API === '1';

const SESSION_KEY = 'xxw_session_id';

export function getSessionId(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const res = await fetch(path, { ...init, signal: init?.signal ?? ctrl.signal });
    if (res.status === 410 || res.status === 404) {
      // 410=已过期/被删除（EXPIRED）；404=从未存在（NOT_FOUND），两者语义不同，分开抛
      const err = new Error('gone') as Error & { code?: string };
      err.code = res.status === 410 ? 'EXPIRED' : 'NOT_FOUND';
      throw err;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json() as T;
  } finally {
    clearTimeout(timer);
  }
}

let sessionPending: Promise<string> | null = null;

async function resumeOrCreateSession(): Promise<string> {
  const cached = getSessionId();
  if (cached) {
    try {
      await req('/api/session/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: cached }),
      });
      return cached;
    } catch (error) {
      // 410（已删除）与 404（后端不认识，如后端重置）都视为本地缓存失效，重建会话
      const code = (error as Error & { code?: string }).code;
      if (code !== 'EXPIRED' && code !== 'NOT_FOUND') throw error;
      localStorage.removeItem(SESSION_KEY);
    }
  }
  const data = await req<{ sessionId: string }>('/api/session', { method: 'POST' });
  localStorage.setItem(SESSION_KEY, data.sessionId);
  return data.sessionId;
}

export async function ensureSession(): Promise<string> {
  if (MOCK_ENABLED) return mock.ensureSession();
  if (!sessionPending) sessionPending = resumeOrCreateSession().finally(() => { sessionPending = null; });
  return sessionPending;
}

export async function sendChat(text: string): Promise<ChatReply> {
  if (MOCK_ENABLED) return mock.sendChat(text);
  const sessionId = await ensureSession();
  return req<ChatReply>('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, text }),
  });
}

// —— STT（Adapter 思路，见《制作方针》ApiSttProvider）——
export async function transcribe(audio: Blob, signal?: AbortSignal): Promise<SttResult> {
  if (MOCK_ENABLED) return mock.transcribe(audio);
  const form = new FormData();
  form.append('audio', audio, 'speech.webm');
  form.append('language', 'zh-CN');
  form.append('sessionId', getSessionId() ?? '');
  const res = await fetch('/api/stt', { method: 'POST', body: form, signal });
  if (!res.ok) throw new Error(`STT failed: ${res.status}`);
  return res.json();
}

// —— TTS：返回音频 Blob；失败时调用方保留字幕 ——
export async function synthesize(text: string, signal?: AbortSignal): Promise<Blob> {
  if (MOCK_ENABLED) return mock.synthesize(text);
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: getSessionId(), text }),
    signal,
  });
  if (!res.ok) throw new Error(`TTS failed: ${res.status}`);
  return res.blob();
}

// —— 日记：已迁至共享层 api/diary.ts（loadDiary/saveBlock/confirmDiary/deleteEvent/shareDiary），
// 按真实契约适配（嵌套 {date,diary,blocks}、mood/heart 独立接口、DELETE /api/events/{id}）——

export async function getCalendar(month: string): Promise<CalendarDay[]> {
  if (MOCK_ENABLED) return mock.getCalendar(month);
  return req<CalendarDay[]>(`/api/calendar?month=${month}&sessionId=${getSessionId()}`);
}

// —— 家长端（演示绑定，同一 session）——
// 单日聚合：心情心脏 + 最新已分享日记快照 + 最新行动指南。
// 无本地会话时先建会话（新用户应看到空态而非「已删除」）；
// 已有会话被删返回 410（EXPIRED→过期提示），后端不认识返回 404（NOT_FOUND→重建重试一次）。
export async function getParentDay(date: string): Promise<ParentDayContent> {
  if (MOCK_ENABLED) return mock.getParentDay(date);
  let sessionId = getSessionId() ?? (await ensureSession());
  try {
    return await req<ParentDayContent>(`/api/parent/day?date=${date}&sessionId=${sessionId}`);
  } catch (error) {
    if ((error as Error & { code?: string }).code !== 'NOT_FOUND') throw error;
    sessionId = await ensureSession(); // 本地缓存的会话后端不认识：重建后重试一次
    return req<ParentDayContent>(`/api/parent/day?date=${date}&sessionId=${sessionId}`);
  }
}

// 月历概览：逐日心情颜色、已分享日记与行动指南标记
export async function getParentCalendar(month: string): Promise<ParentCalendarDay[]> {
  if (MOCK_ENABLED) return mock.getParentCalendar(month);
  const fetchDays = (sessionId: string) =>
    req<{ days: ParentCalendarDay[] }>(`/api/parent/calendar?month=${month}&sessionId=${sessionId}`);
  let sessionId = getSessionId() ?? (await ensureSession());
  try {
    return (await fetchDays(sessionId)).days;
  } catch (error) {
    if ((error as Error & { code?: string }).code !== 'NOT_FOUND') throw error;
    sessionId = await ensureSession();
    return (await fetchDays(sessionId)).days;
  }
}

// —— 仅开发环境可见的演示入口 ——
export async function devFinalizeDiary(): Promise<{ ok: boolean }> {
  if (MOCK_ENABLED) return mock.devFinalizeDiary();
  return req('/internal/dev/finalize-diary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: getSessionId() }),
  });
}

// —— 关闭页面信标：通知后端开始 5 分钟删除计时 ——
export function sendCloseBeacon(): void {
  const sessionId = getSessionId();
  if (!sessionId) return;
  const payload = JSON.stringify({ sessionId });
  if (MOCK_ENABLED) return;
  try {
    navigator.sendBeacon(
      '/api/session/beacon',
      new Blob([payload], { type: 'application/json' }),
    );
  } catch {
    // 信标失败不阻断关闭
  }
}

export function emotionList(colors: Emotion[]): Emotion[] {
  return colors;
}

import type {
  CalendarDay,
  ChatReply,
  Diary,
  Emotion,
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
  const res = await fetch(path, init);
  if (res.status === 410 || res.status === 404) {
    const err = new Error('gone') as Error & { code?: string };
    err.code = 'EXPIRED';
    throw err;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export async function ensureSession(): Promise<string> {
  if (MOCK_ENABLED) return mock.ensureSession();
  const cached = getSessionId();
  if (cached) return cached;
  const data = await req<{ sessionId: string }>('/api/session', { method: 'POST' });
  localStorage.setItem(SESSION_KEY, data.sessionId);
  return data.sessionId;
}

export async function sendChat(text: string): Promise<ChatReply> {
  if (MOCK_ENABLED) return mock.sendChat(text);
  return req<ChatReply>('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: getSessionId(), text }),
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

// —— 日记 ——
export async function getDiary(date?: string): Promise<Diary | null> {
  if (MOCK_ENABLED) return mock.getDiary(date);
  const q = date ? `?date=${date}` : '';
  try {
    return await req<Diary>(`/api/diary${q}${q ? '&' : '?'}sessionId=${getSessionId()}`);
  } catch (e) {
    if ((e as Error & { code?: string }).code === 'EXPIRED') return null;
    throw e;
  }
}

export async function updateDiaryBlock(blockId: string, text: string): Promise<Diary> {
  if (MOCK_ENABLED) return mock.updateDiaryBlock(blockId, text);
  return req<Diary>(`/api/diary/blocks/${blockId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: getSessionId(), text }),
  });
}

export async function confirmDiary(date: string): Promise<Diary> {
  if (MOCK_ENABLED) return mock.confirmDiary(date);
  return req<Diary>('/api/diary/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: getSessionId(), date }),
  });
}

export async function deleteDiaryEvent(eventId: string): Promise<Diary> {
  if (MOCK_ENABLED) return mock.deleteDiaryEvent(eventId);
  return req<Diary>(`/api/diary/events/${eventId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: getSessionId() }),
  });
}

export async function shareDiary(date: string): Promise<{ ok: boolean }> {
  if (MOCK_ENABLED) return mock.shareDiary(date);
  return req('/api/diary/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: getSessionId(), date }),
  });
}

export async function getCalendar(month: string): Promise<CalendarDay[]> {
  if (MOCK_ENABLED) return mock.getCalendar(month);
  return req<CalendarDay[]>(`/api/calendar?month=${month}&sessionId=${getSessionId()}`);
}

// —— 家长端（演示绑定，同一 session）——
export async function getParentDay(date: string): Promise<ParentDayContent> {
  if (MOCK_ENABLED) return mock.getParentDay(date);
  return req<ParentDayContent>(
    `/api/parent/day?date=${date}&sessionId=${getSessionId()}`,
  );
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
      '/api/session/close',
      new Blob([payload], { type: 'application/json' }),
    );
  } catch {
    // 信标失败不阻断关闭
  }
}

export function emotionList(colors: Emotion[]): Emotion[] {
  return colors;
}

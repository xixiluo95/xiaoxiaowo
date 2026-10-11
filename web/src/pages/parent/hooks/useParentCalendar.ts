// 家长端日历数据（GET /api/parent/calendar + 选中日的 /api/parent/day）。
// 选中日期读 URL ?date=YYYY-MM-DD；切日期重新拉取，不残留上一日内容；
// 打开中同步到过期（410）即清除旧内容。
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Toast } from 'antd-mobile';
import { getParentCalendar, getParentDay } from '../../../api/client';
import type { ParentCalendarDay, ParentDayContent } from '../../../types';
import { isExpired, useAutoRefresh } from './useAutoRefresh';

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export type ParentCalendarCell = { date: string; day: number } | null;

export type ParentCalendarState = {
  todayStr: string;
  selected: string;
  cursor: Date;
  monthLabel: string; // 2026年10月
  cells: ParentCalendarCell[]; // 周一起的网格（含前导空位）
  byDate: Map<string, ParentCalendarDay>;
  content: ParentDayContent | null;
  loaded: boolean;
  expired: boolean;
  pickDate: (date: string) => void;
  shiftMonth: (delta: number) => void;
};

export function useParentCalendar(): ParentCalendarState {
  const [params, setParams] = useSearchParams();
  const todayStr = new Date().toISOString().slice(0, 10);
  const selected = params.get('date') ?? todayStr;

  const [cursor, setCursor] = useState(() => new Date(`${selected}T00:00:00`));
  const [days, setDays] = useState<ParentCalendarDay[]>([]);
  const [content, setContent] = useState<ParentDayContent | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [expired, setExpired] = useState(false);

  const loadMonth = useCallback(async () => {
    try {
      setDays(await getParentCalendar(monthKey(cursor)));
      setExpired(false);
    } catch (e) {
      if (isExpired(e)) {
        setDays([]);
        setContent(null);
        setExpired(true);
      } else if ((e as Error & { code?: string }).code === 'NOT_FOUND') {
        // 会话从未存在过（404）：空日历，不算「已删除」
        setDays([]);
        setExpired(false);
      } else {
        setDays([]);
        Toast.show({ content: '日历加载失败，请稍后再试' });
      }
    }
  }, [cursor]);

  const loadDay = useCallback(async () => {
    setLoaded(false);
    setContent(null); // 防止切换日期时残留上一日内容
    try {
      setContent(await getParentDay(selected));
      setExpired(false);
    } catch (e) {
      if (isExpired(e)) {
        setContent(null);
        setExpired(true);
      } else if ((e as Error & { code?: string }).code === 'NOT_FOUND') {
        // 会话从未存在过（404）：空态，不算「已删除」
        setContent(null);
        setExpired(false);
      } else {
        Toast.show({ content: '这一天没有可查看的内容，或已超过保留时间' });
      }
    } finally {
      setLoaded(true);
    }
  }, [selected]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  useEffect(() => {
    void loadDay();
  }, [loadDay]);

  useAutoRefresh(() => {
    void loadMonth();
    void loadDay();
  });

  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);

  const cells = useMemo<ParentCalendarCell[]>(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const offset = (new Date(year, month, 1).getDay() + 6) % 7; // 周一起
    const count = new Date(year, month + 1, 0).getDate();
    const list: ParentCalendarCell[] = [];
    for (let i = 0; i < offset; i++) list.push(null);
    for (let d = 1; d <= count; d++) {
      list.push({ date: `${monthKey(cursor)}-${String(d).padStart(2, '0')}`, day: d });
    }
    return list;
  }, [cursor]);

  const monthLabel = `${cursor.getFullYear()}年${cursor.getMonth() + 1}月`;

  const shiftMonth = (delta: number) => {
    const next = new Date(cursor);
    next.setMonth(next.getMonth() + delta);
    setCursor(next);
  };

  const pickDate = (date: string) => {
    setParams({ date });
    setCursor(new Date(`${date}T00:00:00`));
  };

  return {
    todayStr,
    selected,
    cursor,
    monthLabel,
    cells,
    byDate,
    content,
    loaded,
    expired,
    pickDate,
    shiftMonth,
  };
}

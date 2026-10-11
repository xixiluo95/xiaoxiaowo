import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toast } from 'antd-mobile';
import { LeftOutline, RightOutline } from 'antd-mobile-icons';
import { getCalendar } from '../api/client';
import type { CalendarDay } from '../types';
import { defaultEmotionManifest } from '../emotion/manifest';

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function MoodDot({ colors, confirmed, size = 18 }: { colors: string[]; confirmed: boolean; size?: number }) {
  const background = !confirmed || colors.length === 0
    ? '#ffffff'
    : colors.length === 1
      ? colors[0]
      : `linear-gradient(135deg, ${colors.join(', ')})`;
  return (
    <span
      className="mood-dot"
      style={{ width: size, height: size, background }}
      aria-hidden
    />
  );
}

export default function CalendarPage() {
  const navigate = useNavigate();
  const [cursor, setCursor] = useState(() => new Date());
  const [days, setDays] = useState<CalendarDay[]>([]);
  const todayStr = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    try {
      setDays(await getCalendar(monthKey(cursor)));
    } catch {
      setDays([]);
      Toast.show({ content: '日历加载失败，请稍后再试' });
    }
  }, [cursor]);

  useEffect(() => {
    void load();
  }, [load]);

  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7; // 周一起
    const count = new Date(year, month + 1, 0).getDate();
    const list: ({ date: string; day: number } | null)[] = [];
    for (let i = 0; i < offset; i++) list.push(null);
    for (let d = 1; d <= count; d++) {
      list.push({ date: `${monthKey(cursor)}-${String(d).padStart(2, '0')}`, day: d });
    }
    return list;
  }, [cursor]);

  const shiftMonth = (delta: number) => {
    const next = new Date(cursor);
    next.setMonth(next.getMonth() + delta);
    setCursor(next);
  };

  const openDay = (date: string, hasDiary: boolean) => {
    // 空状态一致：无日记也进入日记页，由日记页展示统一空状态
    navigate(`/diary?date=${date}${hasDiary ? '' : ''}`);
  };

  return (
    <div className="page calendar-page">
      <header className="sub-topbar">
        <button type="button" className="topbar-btn" aria-label="返回" onClick={() => navigate(-1)}>
          <LeftOutline />
        </button>
        <h2 className="sub-title">心情日历</h2>
        <span className="topbar-spacer" />
      </header>

      <div className="calendar-header">
        <button type="button" className="topbar-btn" onClick={() => shiftMonth(-1)} aria-label="上个月">
          <LeftOutline />
        </button>
        <span className="calendar-month">{monthKey(cursor)}</span>
        <button type="button" className="topbar-btn" onClick={() => shiftMonth(1)} aria-label="下个月">
          <RightOutline />
        </button>
      </div>

      <div className="calendar-grid">
        {WEEK_LABELS.map((w) => (
          <span key={w} className="calendar-week">
            {w}
          </span>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <span key={`x${i}`} />;
          const info = byDate.get(cell.date);
          return (
            <button
              key={cell.date}
              type="button"
              className={`calendar-cell ${cell.date === todayStr ? 'today' : ''} ${info?.hasDiary ? 'has-diary' : ''}`}
              onClick={() => openDay(cell.date, !!info?.hasDiary)}
            >
              <span className="calendar-day-num">{cell.day}</span>
              <MoodDot
                size={12}
                confirmed={!!info?.moodConfirmed}
                colors={(info?.colors ?? []).map((e) => defaultEmotionManifest[e].color)}
              />
            </button>
          );
        })}
      </div>

      <p className="calendar-note">
        白色表示还没有确认心情；多种颜色表示当天有几种心情一样多。超过保留时间的日期不会显示内容。
      </p>
    </div>
  );
}

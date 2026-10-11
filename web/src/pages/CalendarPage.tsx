import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toast } from 'antd-mobile';
import { LeftOutline, RightOutline } from 'antd-mobile-icons';
import { getCalendar } from '../api/client';
import type { CalendarDay, Emotion } from '../types';
import { defaultEmotionManifest } from '../emotion/manifest';
import { ActionButton } from '../ui/ActionButton';
import './child/child-pages.css';

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日'];
const LEGEND: Emotion[] = ['anger', 'sadness', 'fear', 'joy', 'calm'];

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function cellBackground(info: CalendarDay | undefined): string | undefined {
  if (!info || !info.moodConfirmed || !info.colors.length) return undefined;
  const colors = info.colors.map((e) => defaultEmotionManifest[e].color);
  // 并列最高：多色渐变
  return colors.length === 1 ? colors[0] : `linear-gradient(135deg, ${colors.join(', ')})`;
}

export default function CalendarPage() {
  const navigate = useNavigate();
  const [cursor, setCursor] = useState(() => new Date());
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [expired, setExpired] = useState(false);
  const todayStr = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    // 切换月份先清空旧数据，避免上一月内容串页
    setDays([]);
    setExpired(false);
    try {
      setDays(await getCalendar(monthKey(cursor)));
    } catch (e) {
      if ((e as Error & { code?: string })?.code === 'EXPIRED') {
        // 保留期已过：不显示任何旧内容
        setExpired(true);
      } else {
        Toast.show({ content: '日历加载失败，请稍后再试' });
      }
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

  const openDay = (date: string) => {
    // 空状态一致：无日记也进入日记页，由日记页展示统一空状态
    navigate(`/diary?date=${date}`);
  };

  const monthLabel = `${cursor.getFullYear()}年${cursor.getMonth() + 1}月`;

  return (
    <div className="page calendar-page">
      <header className="sub-topbar">
        <ActionButton actionId="nav.back" onPress={() => navigate(-1)}>
          <span className="topbar-icon" aria-hidden>
            <LeftOutline />
          </span>
        </ActionButton>
        <div className="sub-title-wrap">
          <h2 className="sub-title">心情日历</h2>
          <p className="sub-title-date">看看这个月的心情颜色</p>
        </div>
        <span className="topbar-spacer" />
      </header>

      <div className="calendar-header">
        <ActionButton actionId="calendar.prev-month" onPress={() => shiftMonth(-1)}>
          <span className="topbar-icon" aria-hidden>
            <LeftOutline />
          </span>
        </ActionButton>
        <span className="calendar-month">{monthLabel}</span>
        <ActionButton actionId="calendar.next-month" onPress={() => shiftMonth(1)}>
          <span className="topbar-icon" aria-hidden>
            <RightOutline />
          </span>
        </ActionButton>
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
          const future = cell.date > todayStr;
          const bg = future ? undefined : cellBackground(info);
          const unconfirmed = !!info && !future && !bg;
          const cls = [
            'xwcal-cell',
            bg ? 'xwcal-colored' : '',
            unconfirmed ? 'xwcal-unconfirmed' : '',
            future ? 'xwcal-future' : '',
            cell.date === todayStr ? 'xwcal-today' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <ActionButton
              key={cell.date}
              actionId="calendar.day-cell"
              labelOverride=""
              onPress={() => openDay(cell.date)}
              className={cls}
            >
              {bg && <span className="xwcal-fill" style={{ background: bg }} aria-hidden />}
              <span className="xwcal-daynum">{cell.day}</span>
              {info?.hasDiary && !future && <span className="xwcal-diary-dot" aria-hidden />}
            </ActionButton>
          );
        })}
      </div>

      <div className="calendar-legend" aria-label="情绪颜色图例">
        {LEGEND.map((e) => (
          <span key={e} className="legend-item">
            <span
              className="xwcal-legend-dot"
              style={{ background: defaultEmotionManifest[e].color }}
              aria-hidden
            />
            {defaultEmotionManifest[e].label}
          </span>
        ))}
        <span className="legend-item">
          <span className="xwcal-legend-dot xwcal-legend-dot--white" aria-hidden />
          待确认
        </span>
      </div>

      <p className="calendar-note">
        {expired
          ? '内容已经超过保留时间，这里不再显示旧的心情和日记。'
          : '白色表示还没有确认心情；彩色表示当天的心情颜色，并列最高会显示渐变。超过保留时间的日期不会显示内容。'}
      </p>
    </div>
  );
}

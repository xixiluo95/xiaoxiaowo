// 家长端日历页。纯展示：数据来自 useParentCalendar，样式来自 parent.css + theme tokens。
import { useId, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoodHeart } from '../../components/MoodHeart';
import { defaultEmotionManifest } from '../../emotion/manifest';
import type { ParentCalendarDay } from '../../types';
import { resolveTheme, t } from './config/resolve';
import { ParentActionButton } from './components/ParentActionButton';
import { GuidanceCard, SharedDiaryCard, formatCnDate } from './components/ParentCards';
import { useParentCalendar } from './hooks/useParentCalendar';
import { parentMoodWord } from './ParentHome';

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

// 日期格里的小心情心脏：未确认=白色；并列最高=渐变；未来/无数据=淡灰
function CellHeart({ info }: { info?: ParentCalendarDay }) {
  const gid = useId();
  const colors = info?.moodConfirmed ? info.colors : [];
  let fill = 'var(--ph-heart-empty)'; // 无数据/未来
  if (info) {
    fill =
      colors.length === 0
        ? '#ffffff'
        : colors.length === 1
          ? defaultEmotionManifest[colors[0]].color
          : `url(#${gid})`;
  }
  return (
    <svg width={16} height={16} viewBox="0 0 100 100" aria-hidden className="ph-cell-heart">
      {colors.length > 1 && (
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            {colors.map((e, i) => (
              <stop
                key={e}
                offset={`${(i / Math.max(1, colors.length - 1)) * 100}%`}
                stopColor={defaultEmotionManifest[e].color}
              />
            ))}
          </linearGradient>
        </defs>
      )}
      <path
        d="M50 88 C20 66 6 48 6 32 C6 18 17 8 30 8 C39 8 46 13 50 21 C54 13 61 8 70 8 C83 8 94 18 94 32 C94 48 80 66 50 88 Z"
        fill={fill}
        stroke="var(--ph-divider)"
        strokeWidth={5}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ParentCalendarPage() {
  const navigate = useNavigate();
  const cal = useParentCalendar();
  const theme = resolveTheme() as CSSProperties;
  const content = cal.content;

  return (
    <div className="page ph-page ph-calendar" style={theme}>
      <header className="ph-topbar">
        <ParentActionButton action="parent.calendar.back" onClick={() => navigate('/parent')} />
        <h2 className="ph-topbar-title">{t('calendar.title')}</h2>
        <span className="ph-topbar-spacer" />
      </header>

      <div className="ph-cal-header">
        <ParentActionButton action="parent.calendar.prevMonth" onClick={() => cal.shiftMonth(-1)} />
        <span className="ph-cal-month">{cal.monthLabel}</span>
        <ParentActionButton action="parent.calendar.nextMonth" onClick={() => cal.shiftMonth(1)} />
      </div>

      <div className="ph-cal-grid">
        {WEEK_LABELS.map((w) => (
          <span key={w} className="ph-cal-week">
            {w}
          </span>
        ))}
        {cal.cells.map((cell, i) => {
          if (!cell) return <span key={`x${i}`} />;
          const info = cal.byDate.get(cell.date);
          const cls = [
            'ph-cal-cell',
            cell.date === cal.selected ? 'is-selected' : '',
            cell.date === cal.todayStr ? 'is-today' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <ParentActionButton
              key={cell.date}
              action="parent.calendar.pickDay"
              className={cls}
              onClick={() => cal.pickDate(cell.date)}
            >
              <span className="ph-cal-day-num">{cell.day}</span>
              <CellHeart info={info} />
            </ParentActionButton>
          );
        })}
      </div>

      {cal.loaded && cal.expired && (
        <div className="ph-empty">
          <p>{t('calendar.expired')}</p>
        </div>
      )}

      {cal.loaded && !cal.expired && !content && (
        <div className="ph-empty">
          <p>{t('calendar.empty')}</p>
        </div>
      )}

      {content && (
        <main className="ph-day-main">
          <h3 className="ph-day-date">{formatCnDate(content.date)}</h3>
          <div className="ph-day-mood">
            <span className="ph-day-mood-text">
              {t('calendar.moodPrefix')}
              {content.mood.confirmed ? (
                <span className="ph-heart-word">{parentMoodWord(content.mood)}</span>
              ) : (
                <span className="ph-heart-word is-unconfirmed">
                  {t('calendar.moodUnconfirmed')}
                </span>
              )}
            </span>
            <MoodHeart colors={content.mood.colors} confirmed={content.mood.confirmed} size={20} />
          </div>
          {content.mood.stats.length > 0 && (
            <div className="ph-day-stats">
              {content.mood.stats.map((s) => {
                const total = content.mood.stats.reduce((n, x) => n + x.count, 0);
                const pct = Math.round((s.count / total) * 100);
                return (
                  <span key={s.emotion} className="ph-stat-chip">
                    <i style={{ background: defaultEmotionManifest[s.emotion].color }} />
                    {defaultEmotionManifest[s.emotion].label} {pct}%
                  </span>
                );
              })}
            </div>
          )}
          {content.sharedDiary && <SharedDiaryCard snapshot={content.sharedDiary} variant="snapshot" />}
          {content.guidance && <GuidanceCard guidance={content.guidance} />}
          {!content.sharedDiary && !content.guidance && (
            <div className="ph-empty">
              <p>{t('calendar.noContent')}</p>
            </div>
          )}
        </main>
      )}
    </div>
  );
}

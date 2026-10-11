import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Toast } from 'antd-mobile';
import { LeftOutline } from 'antd-mobile-icons';
import { getParentDay } from '../../api/client';
import type { ParentDayContent } from '../../types';
import { MoodHeart } from '../../components/MoodHeart';
import { GuidanceCard, SharedDiaryCard } from './ParentHome';

// 家长端按日期查看：心情、已分享日记快照、行动指南。
// 日历切换重新拉取，不沿用上一日内容；过期/撤回返回空态。
export default function ParentCalendarPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const date = params.get('date') ?? new Date().toISOString().slice(0, 10);
  const [content, setContent] = useState<ParentDayContent | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoaded(false);
    setContent(null); // 防止切换日期时残留上一日内容
    try {
      setContent(await getParentDay(date));
    } catch {
      Toast.show({ content: '这一天没有可查看的内容，或已超过保留时间' });
    } finally {
      setLoaded(true);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const pickDate = (value: string) => {
    if (value) setParams({ date: value });
  };

  return (
    <div className="page parent-calendar">
      <header className="sub-topbar">
        <button type="button" className="topbar-btn" aria-label="返回" onClick={() => navigate('/parent')}>
          <LeftOutline />
        </button>
        <h2 className="sub-title">按日期查看</h2>
        <span className="topbar-spacer" />
      </header>

      <div className="parent-date-picker">
        <input
          type="date"
          value={date}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => pickDate(e.target.value)}
        />
      </div>

      {loaded && !content && (
        <div className="empty-state">
          <p>这一天没有可查看的内容，或已超过保留时间。</p>
        </div>
      )}

      {content && (
        <main className="parent-day-main">
          <div className="parent-day-mood">
            <MoodHeart colors={content.mood.colors} confirmed={content.mood.confirmed} size={72} />
            <span>{content.mood.confirmed ? '当天心情' : '心情未确认'}</span>
          </div>
          {content.sharedDiary && <SharedDiaryCard snapshot={content.sharedDiary} />}
          {content.guidance && <GuidanceCard guidance={content.guidance} />}
          {!content.sharedDiary && !content.guidance && (
            <div className="empty-state">
              <p>这一天没有分享的日记，也没有行动指南。</p>
            </div>
          )}
        </main>
      )}
    </div>
  );
}

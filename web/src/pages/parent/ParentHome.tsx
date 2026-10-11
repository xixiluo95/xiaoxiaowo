import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toast } from 'antd-mobile';
import { CalendarOutline } from 'antd-mobile-icons';
import { getParentDay } from '../../api/client';
import type { Guidance, ParentDayContent, SharedDiarySnapshot } from '../../types';
import { MoodHeart } from '../../components/MoodHeart';
import { RoughCard } from '../../components/HandDrawn';

export function GuidanceCard({ guidance }: { guidance: Guidance }) {
  return (
    <RoughCard className="guidance-card" color="#b3543f">
      <h3 className="guidance-title">
        给大人的行动小参考
        <span className="guidance-level">{guidance.riskLevel === 'high' ? '需要尽快关注' : '建议留意'}</span>
      </h3>
      <p className="guidance-brief">{guidance.eventBrief}</p>

      <h4>可以试试这样做</h4>
      <ul>{guidance.actions.map((a, i) => <li key={i}>{a}</li>)}</ul>

      <h4>可以这样开场</h4>
      <ul>{guidance.openingLines.map((a, i) => <li key={i}>「{a}」</li>)}</ul>

      <h4>暂时避免这样说</h4>
      <ul>{guidance.avoid.map((a, i) => <li key={i}>「{a}」</li>)}</ul>

      <h4>之后可以问问</h4>
      <ul>{guidance.followUps.map((a, i) => <li key={i}>{a}</li>)}</ul>

      <h4>持续观察</h4>
      <p>{guidance.watchOut}</p>
    </RoughCard>
  );
}

export function SharedDiaryCard({ snapshot }: { snapshot: SharedDiarySnapshot }) {
  return (
    <RoughCard className="shared-diary-card">
      <h3>孩子分享的日记（{snapshot.date}）</h3>
      <p className="shared-diary-text">{snapshot.text}</p>
      <p className="shared-diary-note">这是孩子分享那一刻的内容快照。</p>
    </RoughCard>
  );
}

export default function ParentHome() {
  const navigate = useNavigate();
  const [content, setContent] = useState<ParentDayContent | null>(null);
  const [loaded, setLoaded] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    try {
      setContent(await getParentDay(today));
    } catch {
      Toast.show({ content: '内容加载失败，请稍后再试' });
    } finally {
      setLoaded(true);
    }
  }, [today]);

  useEffect(() => {
    void load();
  }, [load]);

  const guidance = content?.guidance ?? null;
  const diary = content?.sharedDiary ?? null;
  const mood = content?.mood ?? { confirmed: false, colors: [] };

  return (
    <div className="page parent-home">
      <header className="sub-topbar">
        <span className="topbar-spacer" />
        <h2 className="sub-title">家长视角（演示绑定）</h2>
        <button
          type="button"
          className="topbar-btn"
          aria-label="按日期查看"
          onClick={() => navigate('/parent/calendar')}
        >
          <CalendarOutline />
        </button>
      </header>

      {loaded && !content && (
        <div className="empty-state">
          <p>暂时没有可以查看的内容。</p>
        </div>
      )}

      {content && (
        <main className="parent-main">
          {/* 布局硬规则：
              1. 无指南 → 中央只有大心脏（即使日记已分享，日记从日历进）
              2. 有指南无日记 → 指南居中 + 左上小心脏
              3. 两者都有 → 中央日记在上、指南在下，小心脏不遮挡 */}
          {!guidance ? (
            <div className="parent-heart-center">
              <MoodHeart colors={mood.colors} confirmed={mood.confirmed} size={180} />
              <p className="parent-heart-label">孩子今天的心情</p>
              {diary && (
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => navigate(`/parent/calendar?date=${content.date}`)}
                >
                  孩子分享了日记，从日历查看
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="parent-heart-corner">
                <MoodHeart colors={mood.colors} confirmed={mood.confirmed} size={56} />
              </div>
              <div className="parent-center-stack">
                {diary && <SharedDiaryCard snapshot={diary} />}
                <GuidanceCard guidance={guidance} />
              </div>
            </>
          )}
        </main>
      )}
    </div>
  );
}

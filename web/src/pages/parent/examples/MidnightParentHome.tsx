// 示例替换皮肤：午夜版家长首页。
// 用法：在公共入口 src/ui/overrides.ts 里 uiOverrides.pages 加
//   'parent.home': MidnightParentHome（import 自 pages/parent/examples/）。
// 复用 useParentDay —— 换页/换皮肤不需要动数据逻辑，这就是数据与展示分离的证明。
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoodHeart } from '../../../components/MoodHeart';
import { t } from '../config/resolve';
import { ParentActionButton } from '../components/ParentActionButton';
import { GuidanceCard, SharedDiaryCard } from '../components/ParentCards';
import { useParentDay } from '../hooks/useParentDay';
import { parentMoodWord } from '../ParentHome';

const MIDNIGHT_THEME = {
  '--ph-bg': '#12161f',
  '--ph-card-bg': '#1c2330',
  '--ph-card-shadow': '0 2px 16px rgba(0, 0, 0, 0.4)',
  '--ph-ink': '#e6eaf2',
  '--ph-muted': '#8a94a8',
  '--ph-faint': '#5d6678',
  '--ph-line': '#39435a',
  '--ph-divider': '#2a3346',
  '--ph-cell-bg': '#232b3b',
  '--ph-badge-bg': '#2a3346',
  '--ph-badge-ink': '#9db4d8',
  '--ph-risk-medium': '#d9a45b',
  '--ph-risk-high': '#e07a5f',
} as const;

export default function MidnightParentHome() {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const { content, loaded, expired } = useParentDay(today);

  const guidance = content?.guidance ?? null;
  const diary = content?.sharedDiary ?? null;
  const mood = content?.mood ?? { confirmed: false, colors: [], gradient: false, stats: [] };

  return (
    <div className="page ph-page" style={MIDNIGHT_THEME as unknown as CSSProperties}>
      <header className="ph-topbar">
        <span className="ph-topbar-spacer" />
        <h2 className="ph-topbar-title">🌙 {t('home.title')}</h2>
        <ParentActionButton
          action="parent.home.openCalendar"
          onClick={() => navigate('/parent/calendar')}
        />
      </header>

      {loaded && expired && (
        <div className="ph-empty">
          <p>{t('home.expired')}</p>
        </div>
      )}
      {loaded && !expired && !content && (
        <div className="ph-empty">
          <p>{t('home.empty')}</p>
        </div>
      )}

      {content && (
        <main className="ph-main">
          {/* 午夜版布局：心脏恒在顶部居中，卡片竖排在下（三态硬规则不变） */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '8px 0 16px' }}>
            <MoodHeart colors={mood.colors} confirmed={mood.confirmed} size={guidance ? 72 : 170} />
            <p className="ph-heart-line" style={{ color: 'var(--ph-ink)' }}>
              {t('home.moodTodayPrefix')}
              <span className={`ph-heart-word${mood.confirmed ? '' : ' is-unconfirmed'}`}>
                {parentMoodWord(mood)}
              </span>
            </p>
          </div>
          {!guidance && diary && (
            <ParentActionButton
              action="parent.home.diaryHint"
              className="ph-diary-hint"
              onClick={() => navigate(`/parent/calendar?date=${content.date}`)}
            />
          )}
          <div className="ph-stack">
            {guidance && diary && <SharedDiaryCard snapshot={diary} variant="home" />}
            {guidance && <GuidanceCard guidance={guidance} />}
          </div>
        </main>
      )}

      <footer className="ph-footer">
        <ParentActionButton action="parent.home.backToChild" onClick={() => navigate('/')} />
      </footer>
    </div>
  );
}

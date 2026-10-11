// 家长端首页（三态）。纯展示：数据来自 useParentDay，外观来自 theme/copy/buttons 配置。
// 布局硬规则（设定 §7/Q07）：
//   1. 无分享、无风险指南 → 中央只有大心脏
//   2. 有指南无日记 → 指南居中 + 左上小心脏行
//   3. 两者都有 → 中央日记在上、指南在下，小心脏行不遮挡内容
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoodHeart } from '../../components/MoodHeart';
import { defaultEmotionManifest } from '../../emotion/manifest';
import { resolveTheme, t } from './config/resolve';
import { ParentActionButton } from './components/ParentActionButton';
import { GuidanceCard, SharedDiaryCard } from './components/ParentCards';
import { useParentDay } from './hooks/useParentDay';
import './parent.css';

// 心情词：并列最高多个用「、」连接；未确认显示「未确认」
export function parentMoodWord(mood: { confirmed: boolean; colors: string[] }): string {
  if (!mood.confirmed || mood.colors.length === 0) return t('home.moodUnconfirmed');
  return mood.colors
    .map((e) => defaultEmotionManifest[e as keyof typeof defaultEmotionManifest]?.label ?? e)
    .join('、');
}

export default function ParentHome() {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const { content, loaded, expired } = useParentDay(today);
  const theme = resolveTheme() as CSSProperties;

  const guidance = content?.guidance ?? null;
  const diary = content?.sharedDiary ?? null;
  const mood = content?.mood ?? { confirmed: false, colors: [], gradient: false, stats: [] };
  const moodWord = parentMoodWord(mood);

  return (
    <div className="page ph-page" style={theme}>
      <header className="ph-topbar">
        <span className="ph-topbar-spacer" />
        <h2 className="ph-topbar-title">{t('home.title')}</h2>
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
          {!guidance ? (
            <div className="ph-heart-center">
              <MoodHeart colors={mood.colors} confirmed={mood.confirmed} size={190} />
              <p className="ph-heart-line">
                {t('home.moodTodayPrefix')}
                <span className={`ph-heart-word${mood.confirmed ? '' : ' is-unconfirmed'}`}>
                  {moodWord}
                </span>
              </p>
              {diary && (
                <ParentActionButton
                  action="parent.home.diaryHint"
                  className="ph-diary-hint"
                  onClick={() => navigate(`/parent/calendar?date=${content.date}`)}
                />
              )}
            </div>
          ) : (
            <>
              <div className="ph-heart-row">
                <MoodHeart colors={mood.colors} confirmed={mood.confirmed} size={34} />
                <span className="ph-heart-row-text">
                  {t('home.moodToday')}：{moodWord}
                </span>
              </div>
              <div className={`ph-stack${diary ? '' : ' ph-stack--centered'}`}>
                {diary && <SharedDiaryCard snapshot={diary} variant="home" />}
                <GuidanceCard guidance={guidance} />
              </div>
            </>
          )}
        </main>
      )}

      <footer className="ph-footer">
        <ParentActionButton action="parent.home.backToChild" onClick={() => navigate('/')} />
      </footer>
    </div>
  );
}

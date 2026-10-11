// 家长端内容卡：日记快照卡 + 行动指南卡（首页与日历页共用）。
// 纯展示组件：数据由 hooks 给，样式由 parent.css + theme tokens 给。
import type { Guidance, SharedDiarySnapshot } from '../../../types';
import { t } from '../config/resolve';

// '2026-10-11' -> '10月11日'
export function formatCnDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  return `${Number(m[2])}月${Number(m[3])}日`;
}

export function SharedDiaryCard({
  snapshot,
  variant = 'home',
}: {
  snapshot: SharedDiarySnapshot;
  variant?: 'home' | 'snapshot'; // home=首页（日期+徽章）；snapshot=日历（快照标题+不变说明）
}) {
  return (
    <section className="ph-card ph-diary-card">
      <header className="ph-diary-head">
        <h3 className="ph-card-title">
          {variant === 'home'
            ? `${t('diary.titlePrefix')}${formatCnDate(snapshot.date)}`
            : t('diary.snapshotTitle')}
        </h3>
        {variant === 'home' && <span className="ph-badge">{t('diary.badge')}</span>}
      </header>
      <div className="ph-diary-body">
        {snapshot.text
          .split('\n')
          .filter((p) => p.trim())
          .map((p, i) => (
            <p key={i} className="ph-diary-para">
              {p}
            </p>
          ))}
      </div>
      {variant === 'snapshot' && <p className="ph-diary-note">{t('diary.snapshotNote')}</p>}
    </section>
  );
}

export function GuidanceCard({ guidance }: { guidance: Guidance }) {
  return (
    <section className="ph-card ph-guide-card">
      <header className="ph-guide-head">
        <h3 className="ph-card-title">{t('guide.title')}</h3>
        <span className={`ph-badge ph-risk ph-risk--${guidance.riskLevel}`}>
          {guidance.levelName}
        </span>
      </header>
      <p className="ph-guide-brief">{guidance.eventBrief}</p>

      <h4 className="ph-guide-h4">{t('guide.actions')}</h4>
      <ul className="ph-guide-list">
        {guidance.actions.map((a, i) => (
          <li key={i}>{a}</li>
        ))}
      </ul>

      <h4 className="ph-guide-h4">{t('guide.openings')}</h4>
      <ul className="ph-guide-list">
        {guidance.openingLines.map((a, i) => (
          <li key={i}>「{a}」</li>
        ))}
      </ul>

      <h4 className="ph-guide-h4">{t('guide.avoid')}</h4>
      <ul className="ph-guide-list">
        {guidance.avoid.map((a, i) => (
          <li key={i}>「{a}」</li>
        ))}
      </ul>

      {guidance.followUps.length > 0 && (
        <>
          <h4 className="ph-guide-h4">{t('guide.followUps')}</h4>
          <ul className="ph-guide-list">
            {guidance.followUps.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </>
      )}

      <h4 className="ph-guide-h4">{t('guide.watchOut')}</h4>
      <p className="ph-guide-watch">{guidance.watchOut}</p>
    </section>
  );
}

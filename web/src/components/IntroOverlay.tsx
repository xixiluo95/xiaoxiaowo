import { useState } from 'react';
import { RoughCard } from './HandDrawn';
import { ActionButton } from '../ui/ActionButton';

const SEEN_KEY = 'xxw_intro_seen';

export function useIntroSeen(): [boolean, () => void] {
  const [seen, setSeen] = useState(() => localStorage.getItem(SEEN_KEY) === '1');
  const markSeen = () => {
    localStorage.setItem(SEEN_KEY, '1');
    setSeen(true);
  };
  return [seen, markSeen];
}

// 首次介绍：可跳过、之后不重复。
// 文案遵守设定 §3：只说明日记分享方式与实际可用的帮助能力，
// 不得宣称「已通知大人」或保证任何时候在线。
export function IntroOverlay({ onDone }: { onDone: () => void }) {
  return (
    <div className="intro-overlay">
      <RoughCard className="intro-card">
        <h1 className="intro-title">你好呀，我是小小我</h1>
        <div className="intro-body">
          <p>我是住在这里的「另一个你」。</p>
          <p>你可以和我说开心的事、难过的事，也可以只说几个词、停下来想一想，都可以。</p>
          <p>我们聊过的内容，会整理成一篇<strong>只有你今天能看到的日记</strong>。你可以修改它、删掉它。</p>
          <p>
            如果你愿意，可以把日记<strong>分享给家里的大人</strong>看；你不分享，他们就看不到日记内容。
          </p>
          <p>我会尽我所能陪你把心里的事情说清楚。</p>
        </div>
        <div className="intro-actions">
          <ActionButton actionId="intro.done" onPress={onDone} />
          <ActionButton actionId="intro.skip" onPress={onDone} />
        </div>
      </RoughCard>
    </div>
  );
}

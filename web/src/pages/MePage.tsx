import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toast } from 'antd-mobile';
import {
  CalendarOutline,
  ContentOutline,
  LeftOutline,
  MailOpenOutline,
  RightOutline,
  UserSetOutline,
} from 'antd-mobile-icons';
import { devFinalizeDiary, getSessionId } from '../api/client';
import { ActionButton } from '../ui/ActionButton';
import type { ActionId } from '../ui/buttonConfig';
import './child/child-pages.css';

const IS_DEV = import.meta.env.DEV;

const ENTRIES: {
  id: ActionId;
  title: string;
  desc: string;
  icon: JSX.Element;
  to: string;
  badge?: string;
}[] = [
  { id: 'me.entry.calendar', title: '我的心情日历', desc: '看看每天的心情颜色', icon: <CalendarOutline />, to: '/calendar' },
  { id: 'me.entry.diary', title: '今天的小日记', desc: '记录今天发生的事', icon: <ContentOutline />, to: '/diary' },
  { id: 'me.entry.guardian', title: '绑定的大人', desc: '我的专属守护超人', icon: <UserSetOutline />, to: '/parent', badge: '演示绑定' },
  { id: 'me.entry.share', title: '分享给家人', desc: '分享或撤回给爸爸妈妈看', icon: <MailOpenOutline />, to: '/diary' },
];

export default function MePage() {
  const navigate = useNavigate();
  const [finalizing, setFinalizing] = useState(false);
  const sessionId = getSessionId();

  const finalize = async () => {
    setFinalizing(true);
    try {
      await devFinalizeDiary();
      Toast.show({ content: '已模拟「0 点整理」，去看看今天的日记吧' });
    } catch {
      Toast.show({ content: '操作失败，请再试一次', icon: 'fail' });
    } finally {
      setFinalizing(false);
    }
  };

  return (
    <div className="page me-page">
      <header className="sub-topbar">
        <ActionButton actionId="nav.back" onPress={() => navigate(-1)}>
          <span className="topbar-icon" aria-hidden>
            <LeftOutline />
          </span>
        </ActionButton>
        <h2 className="sub-title">我的</h2>
        <span className="topbar-spacer" />
      </header>

      <main className="me-main">
        <div className="me-hero">
          <img className="me-avatar" src="/assets/emotions/calm/idle.png" alt="小小我" />
          <h1 className="me-title">我的小天地</h1>
          <p className="xwme-subtitle">记录心情的小小世界</p>
        </div>

        <div className="me-entries">
          {ENTRIES.map((e) => (
            <ActionButton
              key={e.id}
              actionId={e.id}
              labelOverride={e.title}
              onPress={() => navigate(e.to)}
              className="me-entry"
            >
              <span className="me-entry-icon" aria-hidden>
                {e.icon}
              </span>
              <span className="me-entry-text">
                <span className="me-entry-desc">
                  {e.desc}
                  {e.badge && <span className="xwme-badge">{e.badge}</span>}
                </span>
              </span>
              <span className="me-entry-arrow" aria-hidden>
                <RightOutline />
              </span>
            </ActionButton>
          ))}
        </div>

        {IS_DEV && (
          <div className="me-parent-demo">
            <ActionButton
              actionId="me.dev-finalize"
              disabled={finalizing}
              labelOverride={finalizing ? '整理中……' : undefined}
              onPress={finalize}
            />
          </div>
        )}

        <p className="me-vanish">你离开后，这里的内容会轻轻消失</p>
        <p className="me-session">体验编号：{sessionId ? sessionId.slice(0, 12) : '……'}</p>
      </main>
    </div>
  );
}

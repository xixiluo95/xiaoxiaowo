import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toast } from 'antd-mobile';
import { LeftOutline } from 'antd-mobile-icons';
import { devFinalizeDiary, getSessionId } from '../api/client';
import { RoughCard } from '../components/HandDrawn';

const IS_DEV = import.meta.env.DEV;

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
        <button type="button" className="topbar-btn" aria-label="返回" onClick={() => navigate(-1)}>
          <LeftOutline />
        </button>
        <h2 className="sub-title">我的</h2>
        <span className="topbar-spacer" />
      </header>

      <main className="me-main">
        <RoughCard className="me-card">
          <h3>绑定的大人（演示绑定）</h3>
          <p className="me-muted">本次体验使用临时身份模拟绑定，不代表真实身份已核验。</p>
          <button type="button" className="ghost-btn" onClick={() => navigate('/parent')}>
            进入家长视角（演示）
          </button>
        </RoughCard>

        <RoughCard className="me-card">
          <h3>我的数据</h3>
          <p className="me-muted">
            聊天整理出的日记和心情只保留到本次体验结束；页面关闭后 5 分钟，云端相关内容会被删除。原始语音不会被保存。
          </p>
        </RoughCard>

        {IS_DEV && (
          <RoughCard className="me-card dev-only">
            <h3>演示入口（仅开发环境可见）</h3>
            <button type="button" className="primary-btn" disabled={finalizing} onClick={finalize}>
              {finalizing ? '整理中……' : '模拟 0 点整理日记'}
            </button>
          </RoughCard>
        )}

        <p className="me-session">体验编号：{sessionId ? sessionId.slice(0, 12) : '……'}</p>
      </main>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toast } from 'antd-mobile';
import { CalendarOutline, UserOutline } from 'antd-mobile-icons';
import { useSession } from '../hooks/core';
import { useEmotionChat } from '../hooks/useEmotionChat';
import { EmotionStage } from '../components/EmotionStage';
import { VoiceBar } from '../components/VoiceBar';
import { ChatSheet } from '../components/ChatSheet';
import { IntroOverlay, useIntroSeen } from '../components/IntroOverlay';

export default function ChildHome() {
  const navigate = useNavigate();
  const { ready, error: sessionError } = useSession();
  const chat = useEmotionChat();
  const [introSeen, markIntroSeen] = useIntroSeen();
  const [sheetOpen, setSheetOpen] = useState(false);

  // 上滑看文字流 / 下滑回舞台
  const touchStartY = useRef<number | null>(null);
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);
  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartY.current === null) return;
      const dy = e.changedTouches[0].clientY - touchStartY.current;
      touchStartY.current = null;
      if (dy < -60) setSheetOpen(true);
      else if (dy > 60) setSheetOpen(false);
    },
    [],
  );

  useEffect(() => {
    if (chat.error) {
      Toast.show({ content: chat.error, icon: 'fail' });
      chat.clearError();
    }
  }, [chat]);

  useEffect(() => {
    if (sessionError) Toast.show({ content: sessionError, icon: 'fail' });
  }, [sessionError]);

  const lastAi = [...chat.messages].reverse().find((m) => m.role === 'ai');

  return (
    <div
      className="page child-home"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {!introSeen && <IntroOverlay onDone={markIntroSeen} />}

      <header className="child-topbar">
        <button type="button" className="topbar-btn" aria-label="心情日历" onClick={() => navigate('/calendar')}>
          <CalendarOutline />
        </button>
        <button type="button" className="topbar-btn" aria-label="我的" onClick={() => navigate('/me')}>
          <UserOutline />
        </button>
      </header>

      <EmotionStage
        phase={chat.phase}
        subtitle={lastAi?.text ?? null}
        speaking={chat.speaking}
        thinking={chat.thinking}
      />

      {chat.echoText && (
        <div className="echo-chip" role="status">
          我听到的是：「{chat.echoText}」
        </div>
      )}

      {chat.ttsFailed && (
        <div className="tts-fallback-hint">语音暂时放不出来，先看文字吧</div>
      )}

      <div className="swipe-hint" aria-hidden>
        上滑查看聊天文字
      </div>

      <VoiceBar
        inputMode={chat.inputMode}
        onModeChange={chat.setInputMode}
        onSendText={chat.sendText}
        onVoiceStart={chat.beginVoice}
        onVoiceEnd={chat.endVoice}
        recording={chat.recording}
        recorderSupported={chat.recorderSupported}
        disabled={!ready}
      />

      {sheetOpen && <ChatSheet messages={chat.messages} onClose={() => setSheetOpen(false)} />}
    </div>
  );
}

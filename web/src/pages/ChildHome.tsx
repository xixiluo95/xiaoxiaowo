import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toast } from 'antd-mobile';
import { CalendarOutline } from 'antd-mobile-icons';
import { useSession } from '../hooks/core';
import { useEmotionChat } from '../hooks/useEmotionChat';
import { EmotionStage } from '../components/EmotionStage';
import { VoiceBar } from '../components/VoiceBar';
import { ChatSheet } from '../components/ChatSheet';
import { IntroOverlay, useIntroSeen } from '../components/IntroOverlay';
import { ActionButton } from '../ui/ActionButton';

export default function ChildHome() {
  const navigate = useNavigate();
  const { ready, error: sessionError } = useSession();
  const chat = useEmotionChat();
  const [introSeen, markIntroSeen] = useIntroSeen();
  const [sheetOpen, setSheetOpen] = useState(false);
  // 软键盘展开时角色压缩到顶部可视条（iOS Safari 布局视口不随键盘收缩，用 visualViewport 判定）
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => setKeyboardOpen(vv.height < window.innerHeight * 0.75);
    vv.addEventListener('resize', onResize);
    onResize();
    return () => vv.removeEventListener('resize', onResize);
  }, []);

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
    }
  }, [chat.error]);

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
        <ActionButton actionId="nav.calendar" onPress={() => navigate('/calendar')}>
          <span className="topbar-icon" aria-hidden>
            <CalendarOutline />
          </span>
        </ActionButton>
        <ActionButton actionId="nav.me" onPress={() => navigate('/me')} />
      </header>

      <EmotionStage
        phase={chat.phase}
        subtitle={lastAi?.text ?? null}
        speaking={chat.speaking}
        thinking={chat.thinking}
        sheetOpen={sheetOpen}
        keyboardOpen={keyboardOpen}
      />

      {chat.echoText && (
        <div className="echo-chip" role="status">
          我听到的是：「{chat.echoText}」
        </div>
      )}

      {chat.error && <div className="chat-error" role="alert">{chat.error}</div>}

      {lastAi && !chat.thinking && (
        <div className="tts-fallback-hint" role="status">
          <span>{chat.audioLoading ? '正在准备语音…' : chat.playbackBlocked ? '点一下，听我说' : chat.ttsFailed ? '语音未能播放，可以重试' : chat.speaking ? '正在说话…' : ''}</span>
          <ActionButton actionId="chat.replay" onPress={chat.replay} disabled={chat.audioLoading} />
        </div>
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
        busy={chat.thinking}
      />

      {sheetOpen && <ChatSheet messages={chat.messages} onClose={() => setSheetOpen(false)} />}
    </div>
  );
}

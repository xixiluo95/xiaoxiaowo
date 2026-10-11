import { useEffect, useState } from 'react';
import { Toast } from 'antd-mobile';
import { ActionButton } from '../ui/ActionButton';

// 美术图按钮面：加载失败时回退为文字，保证按钮始终可操作
function BtnArt({ src, className, fallback }: { src: string; className: string; fallback: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="btn-art-fallback">{fallback}</span>;
  return (
    <img
      src={src}
      className={`btn-art ${className}`}
      alt=""
      aria-hidden
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

export function VoiceBar({
  inputMode,
  onModeChange,
  onSendText,
  onVoiceStart,
  onVoiceEnd,
  recording,
  recorderSupported,
  disabled,
  busy,
}: {
  inputMode: 'text' | 'voice';
  onModeChange: (m: 'text' | 'voice') => void;
  onSendText: (text: string) => Promise<boolean>;
  onVoiceStart: () => void;
  onVoiceEnd: () => void;
  recording: boolean;
  recorderSupported: boolean;
  disabled: boolean;
  busy: boolean;
}) {
  const [text, setText] = useState('');
  const [inputArtOk, setInputArtOk] = useState(false);

  // 美术边框加载成功后再隐藏容器描边，失败时保留描边兜底
  useEffect(() => {
    const img = new Image();
    img.onload = () => setInputArtOk(true);
    img.src = '/assets/ui/chat-input-base.png';
  }, []);

  const submit = async () => {
    const t = text.trim();
    if (!t || disabled || busy) return;
    if (await onSendText(t)) setText((current) => current === t ? '' : current);
  };

  const switchMode = () => {
    if (inputMode === 'text') {
      if (!recorderSupported) {
        Toast.show({ content: '这个浏览器不支持录音，先用打字吧' });
        return;
      }
      onModeChange('voice');
    } else {
      onModeChange('text');
    }
  };

  return (
    <div className={`voice-bar ${inputMode === 'voice' ? 'voice-on' : ''}`}>
      {inputMode === 'voice' && (
        <p className={`voice-hint ${recording ? 'listening' : ''}`} role="status">
          {recording ? '正在听… 松开就发送' : '按住下面的大按钮，把心里的话说给我听'}
        </p>
      )}
      <div className="voice-bar-row">
        <ActionButton
          actionId="voice.mode-switch"
          onPress={switchMode}
          className="voice-mode-btn"
          ariaLabel={inputMode === 'text' ? '切换到语音输入' : '切换回文字输入'}
        >
          <span className="voice-mode-icon" aria-hidden>
            {inputMode === 'text' ? (
              <BtnArt src="/assets/ui/voice-mic.png" className="btn-art--mode" fallback="语音" />
            ) : (
              <BtnArt src="/assets/ui/voice-keyboard.png" className="btn-art--mode" fallback="键盘" />
            )}
          </span>
        </ActionButton>

        {inputMode === 'text' ? (
          <>
            <span className={`voice-input-wrap ${inputArtOk ? 'art-ok' : ''}`}>
              <span className="voice-input-bg" aria-hidden />
              <input
                className="voice-input"
                placeholder="和我聊聊吧"
                aria-label="和小我聊天输入框"
                value={text}
                disabled={disabled}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) void submit();
                }}
              />
            </span>
            <ActionButton
              actionId="chat.send"
              disabled={disabled || busy || !text.trim()}
              labelOverride={busy ? '回复中…' : undefined}
              onPress={submit}
            >
              <BtnArt src="/assets/ui/chat-send.png" className="btn-art--send" fallback="发送" />
            </ActionButton>
          </>
        ) : (
          <ActionButton
            actionId="voice.hold-talk"
            disabled={disabled || busy}
            state={recording ? 'recording' : 'default'}
            onHoldStart={onVoiceStart}
            onHoldEnd={onVoiceEnd}
            className="hold-talk-btn"
          >
            <span className="hold-talk-mic" aria-hidden>
              <BtnArt src="/assets/ui/voice-mic.png" className="btn-art--hold" fallback="🎤" />
            </span>
          </ActionButton>
        )}
      </div>
    </div>
  );
}

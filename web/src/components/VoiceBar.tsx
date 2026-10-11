import { useState } from 'react';
import { Toast } from 'antd-mobile';
import { AudioOutline, SoundOutline } from 'antd-mobile-icons';

export function VoiceBar({
  inputMode,
  onModeChange,
  onSendText,
  onVoiceStart,
  onVoiceEnd,
  recording,
  recorderSupported,
  disabled,
}: {
  inputMode: 'text' | 'voice';
  onModeChange: (m: 'text' | 'voice') => void;
  onSendText: (text: string) => void;
  onVoiceStart: () => void;
  onVoiceEnd: () => void;
  recording: boolean;
  recorderSupported: boolean;
  disabled: boolean;
}) {
  const [text, setText] = useState('');

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSendText(t);
    setText('');
  };

  const switchToVoice = () => {
    if (!recorderSupported) {
      Toast.show({ content: '这个浏览器不支持录音，先用打字吧' });
      return;
    }
    onModeChange('voice');
  };

  return (
    <div className="voice-bar">
      <button
        type="button"
        className="voice-mode-btn"
        aria-label={inputMode === 'text' ? '切换语音' : '切换文字'}
        onClick={() => (inputMode === 'text' ? switchToVoice() : onModeChange('text'))}
      >
        {inputMode === 'text' ? <AudioOutline /> : <SoundOutline />}
      </button>

      {inputMode === 'text' ? (
        <input
          className="voice-input"
          placeholder="和我聊聊吧"
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />
      ) : (
        <button
          type="button"
          className={`hold-talk-btn ${recording ? 'recording' : ''}`}
          onPointerDown={(e) => {
            e.preventDefault();
            onVoiceStart();
          }}
          onPointerUp={onVoiceEnd}
          onPointerCancel={onVoiceEnd}
          onPointerLeave={() => {
            if (recording) onVoiceEnd();
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {recording ? '松开 发送' : '按住 说话'}
        </button>
      )}

      {inputMode === 'text' && (
        <button type="button" className="send-btn" disabled={disabled || !text.trim()} onClick={submit}>
          发送
        </button>
      )}
    </div>
  );
}

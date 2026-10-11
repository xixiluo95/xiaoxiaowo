import { useEffect, useRef } from 'react';
import type { ChatMessage } from '../types';
import { defaultEmotionManifest } from '../emotion/manifest';
import { ActionButton } from '../ui/ActionButton';

// 上滑打开的本轮聊天文字流；下滑回舞台（手势由父级统一处理）
export function ChatSheet({ messages, onClose }: { messages: ChatMessage[]; onClose: () => void }) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div className="chat-sheet">
      <div className="chat-sheet-handle">
        <span className="chat-sheet-grip" />
        <ActionButton actionId="chat.close-sheet" onPress={onClose} />
      </div>
      <div className="chat-sheet-list" ref={listRef}>
        {messages.length === 0 && <p className="chat-empty">还没有聊天内容，和小我说点什么吧</p>}
        {messages.map((m) => (
          <div key={m.id} className={`chat-row ${m.role}`}>
            <div
              className="chat-bubble"
              style={
                m.role === 'ai' && m.emotion
                  ? { borderColor: defaultEmotionManifest[m.emotion].color }
                  : undefined
              }
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

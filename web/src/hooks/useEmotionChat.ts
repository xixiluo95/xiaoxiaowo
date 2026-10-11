import { useCallback, useRef, useState } from 'react';
import { sendChat, synthesize, transcribe } from '../api/client';
import { useRecorder, useTtsPlayer } from './core';
import type { ChatMessage, Emotion, EmotionDecision } from '../types';

export type StagePhase =
  | { kind: 'empty' } // 空舞台 + 光点
  | { kind: 'sensing'; to: Emotion } // 感应光效 0.8–1.5s
  | { kind: 'character'; emotion: Emotion };

let msgSeq = 0;
const nextId = () => `m${Date.now()}_${msgSeq++}`;

export function useEmotionChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [phase, setPhase] = useState<StagePhase>({ kind: 'empty' });
  const [thinking, setThinking] = useState(false);
  const [echoText, setEchoText] = useState<string | null>(null); // 孩子识别文字短暂回显
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text');
  const [error, setError] = useState<string | null>(null);

  const tts = useTtsPlayer();
  const recorder = useRecorder();
  const sensingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const echoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendingRef = useRef(false);

  const applyEmotion = useCallback((emo: EmotionDecision) => {
    if (emo.ambiguous) return; // 情绪含糊：保持当前角色继续探索
    // 明确情绪：0.8–1.5s 感应光效后再切换角色
    const delay = 800 + Math.random() * 700;
    setPhase({ kind: 'sensing', to: emo.primary });
    if (sensingTimer.current) clearTimeout(sensingTimer.current);
    sensingTimer.current = setTimeout(() => {
      setPhase({ kind: 'character', emotion: emo.primary });
    }, delay);
  }, []);

  const handleReply = useCallback(
    (replyText: string, emo: EmotionDecision) => {
      setMessages((ms) => [...ms, { id: nextId(), role: 'ai', text: replyText, emotion: emo.primary, at: Date.now() }]);
      applyEmotion(emo);
      // TTS 失败时字幕保留（消息已入列）
      void tts.speak(replyText, (signal) => synthesize(replyText, signal));
    },
    [applyEmotion, tts],
  );

  const sendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sendingRef.current) return false;
      sendingRef.current = true;
      tts.stop();
      tts.unlock();
      setError(null);
      setMessages((ms) => [...ms, { id: nextId(), role: 'child', text: trimmed, at: Date.now() }]);
      setThinking(true);
      try {
        const res = await sendChat(trimmed);
        handleReply(res.reply, res.emotion);
        return true;
      } catch {
        setError('这次没有收到回复，文字已保留，请点击发送重试。');
        return false;
      } finally {
        sendingRef.current = false;
        setThinking(false);
      }
    },
    [thinking, handleReply],
  );

  // —— 语音：按下即 barge-in（静音旧声音 + abort TTS + 立刻采集）——
  const beginVoice = useCallback(async () => {
    tts.stop(); // 打断立即本地静音、丢弃迟到音频
    tts.unlock();
    const ok = await recorder.start();
    if (!ok) {
      setError('麦克风打不开，先用打字聊聊吧');
      setInputMode('text');
    }
  }, [recorder, tts]);

  const endVoice = useCallback(async () => {
    const blob = await recorder.stopAndCollect();
    if (!blob) return;
    try {
      const result = await transcribe(blob);
      const text = result.text?.trim();
      if (!text) throw new Error('empty');
      // 孩子识别文字短暂回显
      setEchoText(text);
      if (echoTimer.current) clearTimeout(echoTimer.current);
      echoTimer.current = setTimeout(() => setEchoText(null), 2600);
      await sendText(text);
    } catch {
      // STT 失败自动回退文字输入
      setError('没听清，我们打字说吧');
      setInputMode('text');
    }
  }, [recorder, sendText]);

  const clearError = useCallback(() => setError(null), []);

  return {
    messages,
    phase,
    thinking,
    echoText,
    inputMode,
    setInputMode,
    error,
    clearError,
    speaking: tts.speaking,
    ttsFailed: tts.ttsFailed,
    playbackBlocked: tts.playbackBlocked,
    audioLoading: tts.loading,
    replay: () => {
      tts.unlock();
      if (tts.replay()) return;
      const last = [...messages].reverse().find((m) => m.role === 'ai');
      if (last) void tts.speak(last.text, (signal) => synthesize(last.text, signal));
    },
    recording: recorder.recording,
    recorderSupported: recorder.supported,
    sendText,
    beginVoice,
    endVoice,
  };
}

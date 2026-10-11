import { useEffect, useRef, useState } from 'react';
import { ensureSession, sendCloseBeacon } from '../api/client';

export function useSession() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    ensureSession()
      .then(() => alive && setReady(true))
      .catch(() => alive && setError('连接失败了，请刷新再试试'));
    return () => {
      alive = false;
    };
  }, []);

  // 页面关闭/隐藏到不可恢复时发信标，后端开始 5 分钟删除计时
  useEffect(() => {
    const onPageHide = () => sendCloseBeacon();
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, []);

  return { ready, error };
}

// —— TTS 播放器：barge-in 核心（对照《制作方针》代码思路）——
export function useTtsPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const [speaking, setSpeaking] = useState(false);
  const [ttsFailed, setTtsFailed] = useState(false);

  const stop = () => {
    // 第一优先级：本地立即静音
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    // 取消仍在进行的 TTS 请求
    abortRef.current?.abort();
    // generation 递增：之后到达的迟到音频一律丢弃
    generationRef.current += 1;
    setSpeaking(false);
  };

  const speak = async (text: string, fetchAudio: (signal: AbortSignal) => Promise<Blob>) => {
    stop();
    setTtsFailed(false);
    const gen = generationRef.current;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const blob = await fetchAudio(ctrl.signal);
      if (gen !== generationRef.current) return; // 已被打断，丢弃
      const url = URL.createObjectURL(blob);
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.src = url;
      audio.onended = () => {
        setSpeaking(false);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setSpeaking(false);
        setTtsFailed(true);
        URL.revokeObjectURL(url);
      };
      setSpeaking(true);
      await audio.play();
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      if (gen !== generationRef.current) return;
      // TTS 失败：保留字幕文本，不阻断对话
      setTtsFailed(true);
      setSpeaking(false);
    }
  };

  useEffect(
    () => () => {
      abortRef.current?.abort();
      audioRef.current?.pause();
    },
    [],
  );

  return { speaking, ttsFailed, speak, stop };
}

// —— 录音：MediaRecorder 按住说话、松开发送 ——
export function useRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [supported] = useState(
    typeof MediaRecorder !== 'undefined' && !!(navigator.mediaDevices?.getUserMedia),
  );

  const start = async (): Promise<boolean> => {
    if (!supported || recording) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      return true;
    } catch {
      setRecording(false);
      return false;
    }
  };

  // 松开发送；关闭录音即彻底停止采集
  const stopAndCollect = (): Promise<Blob | null> =>
    new Promise((resolve) => {
      const rec = recorderRef.current;
      if (!rec || rec.state === 'inactive') {
        setRecording(false);
        resolve(null);
        return;
      }
      rec.onstop = () => {
        rec.stream.getTracks().forEach((t) => t.stop());
        recorderRef.current = null;
        setRecording(false);
        const blob = chunksRef.current.length
          ? new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
          : null;
        chunksRef.current = [];
        resolve(blob);
      };
      rec.stop();
    });

  return { recording, supported, start, stopAndCollect };
}

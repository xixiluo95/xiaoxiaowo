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
  const urlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const [speaking, setSpeaking] = useState(false);
  const [ttsFailed, setTtsFailed] = useState(false);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [loading, setLoading] = useState(false);

  const getAudio = () => (audioRef.current ??= new Audio());

  // 在发送/按住说话的用户手势内激活同一个播放器，兼容移动端播放策略。
  const unlock = () => {
    const audio = getAudio();
    if (audio.src) return;
    const bytes = new Uint8Array(46);
    const view = new DataView(bytes.buffer);
    const write = (at: number, text: string) => [...text].forEach((c, i) => bytes[at + i] = c.charCodeAt(0));
    write(0, 'RIFF'); view.setUint32(4, 38, true); write(8, 'WAVE'); write(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, 8000, true); view.setUint32(28, 16000, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, 2, true);
    audio.src = 'data:audio/wav;base64,' + btoa(String.fromCharCode(...bytes));
    void audio.play().catch(() => { /* 真正回复被拦截时提供显式播放按钮 */ });
  };

  const stop = () => {
    generationRef.current += 1;
    abortRef.current?.abort();
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setSpeaking(false);
    setLoading(false);
    setPlaybackBlocked(false);
    setTtsFailed(false);
  };

  const play = async (gen: number) => {
    const audio = getAudio();
    try {
      await audio.play();
      if (gen !== generationRef.current) return;
      setSpeaking(true);
      setPlaybackBlocked(false);
      setTtsFailed(false);
    } catch (error) {
      if (gen !== generationRef.current) return;
      setSpeaking(false);
      if ((error as Error).name === 'NotAllowedError') setPlaybackBlocked(true);
      else setTtsFailed(true);
    }
  };

  const replay = () => {
    if (!urlRef.current) return false;
    const audio = getAudio();
    audio.currentTime = 0;
    void play(generationRef.current); // 同步进入 play()，保留点击手势
    return true;
  };

  const speak = async (_text: string, fetchAudio: (signal: AbortSignal) => Promise<Blob>) => {
    // 保留发送时已激活的播放器；只替换旧音频。
    generationRef.current += 1;
    abortRef.current?.abort();
    const audio = getAudio();
    audio.pause();
    audio.onended = null;
    audio.onerror = null;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setSpeaking(false);
    setTtsFailed(false);
    setPlaybackBlocked(false);
    setLoading(true);
    const gen = generationRef.current;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const timeout = setTimeout(() => ctrl.abort(), 45000);
    try {
      const blob = await fetchAudio(ctrl.signal);
      if (gen !== generationRef.current) return;
      if (!blob.size) throw new Error('empty_audio');
      urlRef.current = URL.createObjectURL(blob);
      audio.src = urlRef.current;
      audio.onended = () => { if (gen === generationRef.current) setSpeaking(false); };
      audio.onerror = () => {
        if (gen !== generationRef.current) return;
        setSpeaking(false);
        setTtsFailed(true);
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      };
      await play(gen);
    } catch {
      if (gen !== generationRef.current) return;
      setTtsFailed(true);
      setSpeaking(false);
    } finally {
      clearTimeout(timeout);
      if (gen === generationRef.current) setLoading(false);
    }
  };

  useEffect(() => () => {
    generationRef.current += 1;
    abortRef.current?.abort();
    audioRef.current?.pause();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  return { speaking, ttsFailed, playbackBlocked, loading, speak, stop, unlock, replay };
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

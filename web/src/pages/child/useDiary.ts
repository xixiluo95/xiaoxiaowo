// 日记页状态 hook（SHIY-377）：加载/编辑/删除/确认/分享/撤回分享，全部走 diaryApi 适配层。
import { useCallback, useEffect, useState } from 'react';
import {
  confirmDiary,
  deleteEvent,
  loadDiary,
  revokeDiaryShare,
  saveBlock,
  shareDiary,
  type DiaryView,
} from './diaryApi';

export function useDiary(date?: string) {
  const [diary, setDiary] = useState<DiaryView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    // 日期切换先清空旧数据，避免上一日内容在新数据返回前串页
    setDiary(null);
    setLoaded(false);
    setFailed(false);
    try {
      setDiary(await loadDiary(date));
    } catch {
      setFailed(true);
    } finally {
      setLoaded(true);
    }
  }, [date]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const editBlock = useCallback(async (blockId: string, text: string) => {
    const updated = await saveBlock(blockId, text);
    // 真实接口不返回 eventId，合并时保留原块的 eventId
    setDiary((d) =>
      d
        ? {
            ...d,
            blocks: d.blocks.map((b) =>
              b.id === blockId ? { ...updated, eventId: b.eventId } : b,
            ),
          }
        : d,
    );
  }, []);

  const removeEvent = useCallback(async (eventId: string) => {
    const patch = await deleteEvent(eventId);
    // 删除事件：移除对应块 + 用后端重算的心脏状态更新统计，本地不自行补回
    setDiary((d) =>
      d ? { ...d, blocks: d.blocks.filter((b) => b.eventId !== eventId), ...patch } : d,
    );
  }, []);

  const confirm = useCallback(async () => {
    if (!diary) return;
    const status = await confirmDiary(diary.date);
    setDiary((d) => (d ? { ...d, status } : d));
  }, [diary]);

  const share = useCallback(async () => {
    if (!diary) return;
    await shareDiary(diary.date);
    setDiary((d) => (d ? { ...d, shared: true } : d));
  }, [diary]);

  const revokeShare = useCallback(async () => {
    if (!diary) return;
    await revokeDiaryShare(diary.date);
    setDiary((d) => (d ? { ...d, shared: false } : d));
  }, [diary]);

  return { diary, loaded, failed, reload, editBlock, removeEvent, confirm, share, revokeShare };
}

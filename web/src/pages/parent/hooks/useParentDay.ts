// 家长端单日数据（GET /api/parent/day）：拉取 + 过期同步都在这个 hook，
// 页面组件只拿状态渲染（数据/展示分离）。
import { useCallback, useEffect, useState } from 'react';
import { Toast } from 'antd-mobile';
import { getParentDay } from '../../../api/client';
import type { ParentDayContent } from '../../../types';
import { isExpired, useAutoRefresh } from './useAutoRefresh';

export type ParentDayState = {
  content: ParentDayContent | null;
  loaded: boolean; // 首次拉取是否已结束
  expired: boolean; // 410：数据过期/被删除（404「从未有过」走空态，不算过期）
  reload: () => Promise<void>;
};

export function useParentDay(date: string): ParentDayState {
  const [content, setContent] = useState<ParentDayContent | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [expired, setExpired] = useState(false);

  const reload = useCallback(async () => {
    try {
      setContent(await getParentDay(date));
      setExpired(false);
    } catch (e) {
      if (isExpired(e)) {
        // 数据过期/被删除（410）：立即清除旧内容，不继续展示
        setContent(null);
        setExpired(true);
      } else if ((e as Error & { code?: string }).code === 'NOT_FOUND') {
        // 会话从未存在过（404）：不是「已删除」，走空态
        setContent(null);
        setExpired(false);
      } else {
        Toast.show({ content: '内容加载失败，请稍后再试' });
      }
    } finally {
      setLoaded(true);
    }
  }, [date]);

  useEffect(() => {
    void reload();
  }, [reload]);
  useAutoRefresh(() => void reload());

  return { content, loaded, expired, reload };
}

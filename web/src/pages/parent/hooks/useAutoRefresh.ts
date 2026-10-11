// 打开中的过期同步：15s 定时 + 回到前台时重新拉取。
import { useEffect } from 'react';

export const PARENT_REFRESH_MS = 15000;

export function useAutoRefresh(reload: () => void): void {
  useEffect(() => {
    const timer = setInterval(reload, PARENT_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [reload]);
}

export function isExpired(e: unknown): boolean {
  return (e as Error & { code?: string }).code === 'EXPIRED';
}

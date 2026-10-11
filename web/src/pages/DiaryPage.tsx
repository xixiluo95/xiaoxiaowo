import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Dialog, Toast } from 'antd-mobile';
import { LeftOutline } from 'antd-mobile-icons';
import {
  confirmDiary,
  deleteDiaryEvent,
  getDiary,
  shareDiary,
  updateDiaryBlock,
} from '../api/client';
import type { Diary, DiaryBlock } from '../types';
import { defaultEmotionManifest } from '../emotion/manifest';
import { EmotionHighlight, RoughCard } from '../components/HandDrawn';

function StatsBar({ diary }: { diary: Diary }) {
  const total = diary.emotionStats.reduce((s, x) => s + x.count, 0);
  if (!total) return <p className="stats-empty">今天还没有记录心情事件</p>;
  return (
    <div className="stats-bar" aria-label="情绪占比">
      {diary.emotionStats.map((s) => (
        <div
          key={s.emotion}
          className="stats-seg"
          style={{
            flex: s.count,
            background: defaultEmotionManifest[s.emotion].color,
          }}
          title={`${defaultEmotionManifest[s.emotion].label} ${s.count}`}
        />
      ))}
    </div>
  );
}

function BlockItem({
  block,
  onSave,
  onDelete,
}: {
  block: DiaryBlock;
  onSave: (id: string, text: string) => Promise<void>;
  onDelete: (block: DiaryBlock) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(block.text);

  return (
    <RoughCard className="diary-block" fill={block.locked ? 'rgba(255,233,168,0.25)' : undefined}>
      {block.locked && <span className="block-badge">我改过的</span>}
      {editing ? (
        <div className="block-edit">
          <textarea
            value={draft}
            rows={3}
            onChange={(e) => setDraft(e.target.value)}
            className="block-textarea"
          />
          <div className="block-edit-actions">
            <button
              type="button"
              onClick={async () => {
                await onSave(block.id, draft.trim() || block.text);
                setEditing(false);
              }}
            >
              保存
            </button>
            <button type="button" onClick={() => { setDraft(block.text); setEditing(false); }}>
              取消
            </button>
          </div>
        </div>
      ) : (
        <p className="block-text">{block.text}</p>
      )}
      {!editing && (
        <div className="block-actions">
          <button type="button" onClick={() => setEditing(true)}>
            改一改
          </button>
          {block.eventId && (
            <button type="button" className="danger" onClick={() => onDelete(block)}>
              删除这件事
            </button>
          )}
        </div>
      )}
    </RoughCard>
  );
}

export default function DiaryPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const date = params.get('date') ?? undefined;
  const [diary, setDiary] = useState<Diary | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [expired, setExpired] = useState(false);

  const reload = useCallback(async () => {
    try {
      const d = await getDiary(date);
      setDiary(d);
      setExpired(!d);
    } catch {
      Toast.show({ content: '日记加载失败了，请稍后再试' });
    } finally {
      setLoaded(true);
    }
  }, [date]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onSave = async (id: string, text: string) => {
    try {
      setDiary(await updateDiaryBlock(id, text));
      Toast.show({ content: '改好啦' });
    } catch {
      Toast.show({ content: '保存失败，请再试一次', icon: 'fail' });
    }
  };

  const onDelete = (block: DiaryBlock) => {
    if (!block.eventId) return;
    Dialog.confirm({
      content: '确定把这件事从日记里删掉吗？心情统计会马上重新计算哦。',
      onConfirm: async () => {
        try {
          setDiary(await deleteDiaryEvent(block.eventId!));
          Toast.show({ content: '已删除，心情统计已更新' });
        } catch {
          Toast.show({ content: '删除失败，请再试一次', icon: 'fail' });
        }
      },
    });
  };

  const onConfirm = async () => {
    if (!diary) return;
    try {
      setDiary(await confirmDiary(diary.date));
      Toast.show({ content: '日记确认好啦' });
    } catch {
      Toast.show({ content: '确认失败，请再试一次', icon: 'fail' });
    }
  };

  const onShare = async () => {
    if (!diary) return;
    Dialog.confirm({
      content: '分享后，绑定的大人就能看到这篇日记的这一版。之后你再改日记，不会自动改变已经分享的内容。',
      onConfirm: async () => {
        try {
          await shareDiary(diary.date);
          setDiary({ ...diary, shared: true });
          Toast.show({ content: '已分享给大人' });
        } catch {
          Toast.show({ content: '分享失败，请再试一次', icon: 'fail' });
        }
      },
    });
  };

  return (
    <div className="page diary-page">
      <header className="sub-topbar">
        <button type="button" className="topbar-btn" aria-label="返回" onClick={() => navigate(-1)}>
          <LeftOutline />
        </button>
        <h2 className="sub-title">{diary ? `${diary.date} 的日记` : '日记'}</h2>
        <span className="topbar-spacer" />
      </header>

      {loaded && (expired || !diary) && (
        <div className="empty-state">
          <p>这一天没有留下日记，或者内容已经超过了保留时间。</p>
        </div>
      )}

      {diary && (
        <main className="diary-main">
          <div className="diary-mood-line">
            今天的心情颜色：{' '}
            {diary.moodConfirmed && diary.emotionStats.length ? (
              <EmotionHighlight color={defaultEmotionManifest[diary.emotionStats[0].emotion].color}>
                {defaultEmotionManifest[diary.emotionStats[0].emotion].label}
              </EmotionHighlight>
            ) : (
              <span className="mood-unconfirmed">还没确认（白色）</span>
            )}
          </div>

          <StatsBar diary={diary} />

          {diary.blocks.length === 0 && (
            <div className="empty-state">
              <p>日记还没有内容，回去和小我聊聊吧。</p>
            </div>
          )}

          {diary.blocks.map((b) => (
            <BlockItem key={b.id} block={b} onSave={onSave} onDelete={onDelete} />
          ))}

          <div className="diary-footer-actions">
            {diary.status !== 'confirmed' && (
              <button type="button" className="primary-btn" onClick={onConfirm}>
                确认今天的日记
              </button>
            )}
            {diary.shared ? (
              <span className="shared-mark">已分享给大人</span>
            ) : (
              <button type="button" className="ghost-btn" onClick={onShare}>
                分享给大人
              </button>
            )}
          </div>
        </main>
      )}
    </div>
  );
}

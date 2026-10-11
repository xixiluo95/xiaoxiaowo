import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Dialog, Toast } from 'antd-mobile';
import { LeftOutline } from 'antd-mobile-icons';
import type { DiaryBlock } from '../types';
import { defaultEmotionManifest } from '../emotion/manifest';
import { EmotionHighlight, RoughCard } from '../components/HandDrawn';
import { ActionButton } from '../ui/ActionButton';
import { useDiary } from './child/useDiary';
import type { DiaryView } from './child/diaryApi';
import './child/child-pages.css';

const WEEK_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

function formatDateLine(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return `${d.getMonth() + 1}月${d.getDate()}日 · 星期${WEEK_NAMES[d.getDay()]}`;
}

function StatsBar({ diary }: { diary: DiaryView }) {
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
      {block.locked && <span className="block-badge">我改的</span>}
      {editing ? (
        <div className="block-edit">
          <textarea
            value={draft}
            rows={3}
            onChange={(e) => setDraft(e.target.value)}
            className="block-textarea"
          />
          <div className="block-edit-actions">
            <ActionButton
              actionId="diary.block-save"
              onPress={async () => {
                try {
                  await onSave(block.id, draft.trim() || block.text);
                  setEditing(false);
                } catch {
                  // 失败提示由 onSave 负责，保持编辑态
                }
              }}
            />
            <ActionButton
              actionId="diary.block-cancel"
              onPress={() => {
                setDraft(block.text);
                setEditing(false);
              }}
            />
          </div>
        </div>
      ) : (
        <>
          <p className={`block-text ${block.locked ? 'block-text-edited' : ''}`}>{block.text}</p>
          <div className="block-actions xwdiary-block-actions">
            <ActionButton actionId="diary.block-edit" onPress={() => setEditing(true)} />
            {block.eventId && (
              <ActionButton actionId="diary.event-delete" onPress={() => onDelete(block)} />
            )}
          </div>
        </>
      )}
    </RoughCard>
  );
}

export default function DiaryPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const date = params.get('date') ?? undefined;
  const { diary, loaded, failed, editBlock, removeEvent, confirm, share, revokeShare } = useDiary(date);

  const onSave = async (id: string, text: string) => {
    try {
      await editBlock(id, text);
      Toast.show({ content: '改好啦' });
    } catch {
      Toast.show({ content: '保存失败，请再试一次', icon: 'fail' });
      throw new Error('save failed'); // 让 BlockItem 不退出编辑态
    }
  };

  const onDelete = (block: DiaryBlock) => {
    if (!block.eventId) return;
    const eventId = block.eventId;
    Dialog.confirm({
      content: '确定把这件事从日记里删掉吗？心情统计会马上重新计算哦。',
      onConfirm: async () => {
        try {
          await removeEvent(eventId);
          Toast.show({ content: '已删除，心情统计已更新' });
        } catch {
          Toast.show({ content: '删除失败，请再试一次', icon: 'fail' });
        }
      },
    });
  };

  const onConfirm = async () => {
    try {
      await confirm();
      Toast.show({ content: '日记确认好啦' });
    } catch {
      Toast.show({ content: '确认失败，请再试一次', icon: 'fail' });
    }
  };

  const onShare = async () => {
    Dialog.confirm({
      content: '分享后，绑定的大人就能看到这篇日记的这一版。之后你再改日记，不会自动改变已经分享的内容。',
      onConfirm: async () => {
        try {
          await share();
          Toast.show({ content: '已分享给大人' });
        } catch {
          Toast.show({ content: '分享失败，请再试一次', icon: 'fail' });
        }
      },
    });
  };

  const onRevokeShare = () => {
    Dialog.confirm({
      content: '撤回后，大人就看不到这篇日记了，之前发出去的链接也会马上失效。确定要撤回吗？',
      onConfirm: async () => {
        try {
          await revokeShare();
          Toast.show({ content: '已撤回分享' });
        } catch {
          Toast.show({ content: '撤回失败，请再试一次', icon: 'fail' });
        }
      },
    });
  };

  return (
    <div className="page diary-page">
      <header className="sub-topbar">
        <ActionButton actionId="nav.back" onPress={() => navigate(-1)}>
          <span className="topbar-icon" aria-hidden>
            <LeftOutline />
          </span>
        </ActionButton>
        <div className="sub-title-wrap">
          <h2 className="sub-title">今天的日记</h2>
          {diary && <p className="sub-title-date">{formatDateLine(diary.date)}</p>}
        </div>
        <span className="topbar-spacer" />
      </header>

      {!loaded && <p className="xwdiary-loading">加载中……</p>}

      {loaded && failed && (
        <div className="empty-state">
          <p>日记加载失败了，请稍后再试。</p>
        </div>
      )}

      {loaded && !failed && !diary && (
        <div className="empty-state">
          <p>这一天没有留下日记，或者内容已经超过了保留时间。</p>
        </div>
      )}

      {loaded && diary && (
        <main className="diary-main">
          <p className="xwdiary-unique">这是今天唯一的一篇日记哦</p>

          <div className="diary-mood-line">
            今天的心情颜色：{' '}
            {diary.moodConfirmed && diary.moodColors.length ? (
              diary.moodColors.map((e) => (
                <EmotionHighlight key={e} color={defaultEmotionManifest[e].color}>
                  {defaultEmotionManifest[e].label}
                </EmotionHighlight>
              ))
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
            {diary.status !== 'confirmed' ? (
              <ActionButton actionId="diary.confirm" onPress={onConfirm} />
            ) : (
              <span className="xwdiary-confirmed">日记已确认</span>
            )}
          </div>
          <div className="diary-share-row">
            {diary.shared ? (
              <span className="xwdiary-shared-group">
                <span className="shared-mark">已分享给大人</span>
                <ActionButton actionId="diary.share-revoke" onPress={onRevokeShare} />
              </span>
            ) : (
              <ActionButton actionId="diary.share" onPress={onShare} />
            )}
          </div>
        </main>
      )}
    </div>
  );
}

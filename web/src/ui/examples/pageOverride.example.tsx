// 示例②：把 child.me 整页替换成一个示例简化页。
// 启用方式见 src/ui/overrides.ts 注释。此文件不被默认引用。
import { useNavigate } from 'react-router-dom';
import { ActionButton } from '../ActionButton';

export function SimpleMePage() {
  const navigate = useNavigate();
  return (
    <div className="page me-page">
      <main className="me-main" style={{ padding: 24, textAlign: 'center' }}>
        <h2 style={{ marginTop: 80 }}>这里是示例替换页</h2>
        <p style={{ color: 'var(--xxw-muted)', fontSize: 14, lineHeight: 1.8 }}>
          child.me 已被 uiOverrides.pages 整页替换。
          <br />
          清空 overrides 即可恢复原页面。
        </p>
        <div style={{ display: 'grid', placeItems: 'center', marginTop: 24 }}>
          <ActionButton actionId="nav.back" labelOverride="返回舞台" onPress={() => navigate('/')} />
        </div>
      </main>
    </div>
  );
}

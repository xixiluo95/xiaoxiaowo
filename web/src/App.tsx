import { useEffect, useState } from "react";
import { Button, Space, Tag } from "antd-mobile";

const emotions = ["calm", "joy", "anger", "sadness", "fear"] as const;

export default function App() {
  const [health, setHealth] = useState<string>("检查中…");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setHealth(data.status === "ok" ? "ok" : "异常"))
      .catch(() => setHealth("后端未连接（可独立运行）"));
  }, []);

  return (
    <div style={{ padding: 24, textAlign: "center" }}>
      <h1>小小我 · AI 情绪剧场</h1>
      <p>工程脚手架占位首页</p>
      <Space wrap>
        {emotions.map((e) => (
          <Tag key={e} color="primary" fill="outline">
            {e}
          </Tag>
        ))}
      </Space>
      <div style={{ marginTop: 24 }}>
        <Button color="primary">开始对话（占位）</Button>
      </div>
      <p style={{ marginTop: 24, color: "#999" }}>后端健康检查：{health}</p>
    </div>
  );
}

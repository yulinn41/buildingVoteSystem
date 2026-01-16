const http = require("http");
const WebSocket = require("ws");
const express = require("express");
const path = require("path");

const PORT = process.env.PORT || 8081;
const app = express();
app.use(express.static(path.join(__dirname, "public")));
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let unityStatus = "Disconnected";
let unitySocket = null;

wss.on("connection", (ws) => {
  console.log("新客戶端已連接");
  
  // 傳送當前 Unity 連線狀態給新加入的手機端
  ws.send(JSON.stringify({ type: "system", status: unityStatus }));

  // 心跳機制：每 30 秒檢查一次連線，防止被 Render 或網路斷開
  const heartbeat = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) ws.ping();
  }, 30000);

  ws.on("message", (message) => {
    try {
      const msgString = message.toString();

      // 1. Unity 客戶端認證邏輯
      if (msgString === "Unity") {
        unityStatus = "Connected";
        unitySocket = ws;
        broadcastToClients({ type: "system", status: unityStatus });
        console.log("✅ Unity 客戶端已認證");
        return;
      }

      // 2. 處理 JSON 格式的指令 (投票或重置)
      const data = JSON.parse(msgString);
      
      if (data.type === "vote" || data.type === "reset") {
        console.log(`收到指令: ${data.type}, Index: ${data.index ?? 'N/A'}`);
        
        // 廣播給包含 Unity 在內的所有人
        broadcastToClients(data);
      }
    } catch (e) {
      // 忽略非 JSON 的心跳或錯誤格式
    }
  });

  ws.on("close", (code, reason) => {
    clearInterval(heartbeat);
    if (ws === unitySocket) {
      unitySocket = null;
      unityStatus = "Disconnected";
      broadcastToClients({ type: "system", status: unityStatus });
    }
    console.log(`🔴 客戶端離線: ${code}, ${reason}`);
  });

  ws.on("error", (err) => console.error("WebSocket 錯誤:", err));
});

// 廣播函式：將物件轉為 JSON 字串送出
function broadcastToClients(obj) {
  const payload = JSON.stringify(obj);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

server.listen(PORT, () => {
  console.log(`🚀 投票伺服器啟動於 port ${PORT}`);
});
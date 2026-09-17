// SuvivalAcraft — LAN/Internet relay server สำหรับ co-op (host-authoritative)
// รัน: npm run mp-server   (PORT=9310 default)
// โปรโตคอล: ทุกข้อความเป็น JSON ที่มี field "room"; การเชื่อมต่อจะถูกผูกกับห้อง
// จากข้อความแรก แล้วส่งต่อทุกข้อความให้คนอื่น "ในห้องเดียวกัน" เท่านั้น
import { createServer } from "node:http";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT || 9310);
const server = createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("SuvivalAcraft MP relay — connect via WebSocket");
});

const wss = new WebSocketServer({ server });
const conns = new Set();

wss.on("connection", (ws) => {
  ws.room = null;
  conns.add(ws);
  ws.on("message", (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }
    if (!msg || typeof msg.room !== "string" || msg.room.length < 3) return;
    if (ws.room === null) ws.room = msg.room; // ผูกห้องจากข้อความแรก
    if (msg.room !== ws.room) return;
    for (const c of conns) {
      if (c !== ws && c.room === ws.room && c.readyState === 1) c.send(data.toString());
    }
  });
  ws.on("close", () => conns.delete(ws));
  ws.on("error", () => conns.delete(ws));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`SuvivalAcraft MP relay listening on ws://0.0.0.0:${PORT}`);
});

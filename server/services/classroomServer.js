import { WebSocketServer } from "ws";

const rooms = new Map();

function generateRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export function initClassroomWebSocketServer(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname === "/ws/classroom") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  wss.on("connection", (ws) => {
    let currentRoomId = null;
    const userId = `user_${Math.random().toString(36).substring(2, 9)}`;
    let userName = "Learner";

    ws.on("message", (rawMessage) => {
      try {
        const message = JSON.parse(rawMessage.toString());
        const { type } = message;

        if (type === "create_room") {
          currentRoomId = message.roomId || generateRoomId();
          userName = message.userName || "Teacher";
          
          if (!rooms.has(currentRoomId)) {
            rooms.set(currentRoomId, {
              id: currentRoomId,
              hostId: userId,
              clients: new Map(),
              sceneObjects: message.initialScene || [],
              latestTutorHint: null,
            });
          }

          const room = rooms.get(currentRoomId);
          room.clients.set(ws, { userId, userName, cursor: null });

          ws.send(JSON.stringify({
            type: "room_created",
            roomId: currentRoomId,
            userId,
            sceneObjects: room.clients.size > 1 ? room.sceneObjects : (message.initialScene || room.sceneObjects),
            userCount: room.clients.size,
          }));

          broadcastRoomPresence(room);
        } else if (type === "join_room") {
          const roomId = (message.roomId || "").toUpperCase().trim();
          userName = message.userName || "Student";

          if (!rooms.has(roomId)) {
            ws.send(JSON.stringify({ type: "error", message: `Room ${roomId} not found.` }));
            return;
          }

          currentRoomId = roomId;
          const room = rooms.get(roomId);
          room.clients.set(ws, { userId, userName, cursor: null });

          ws.send(JSON.stringify({
            type: "room_joined",
            roomId,
            userId,
            sceneObjects: room.sceneObjects,
            userCount: room.clients.size,
            latestTutorHint: room.latestTutorHint,
          }));

          broadcastRoomPresence(room);
        } else if (type === "scene_update" && currentRoomId) {
          const room = rooms.get(currentRoomId);
          if (!room) return;

          if (message.objects) {
            room.sceneObjects = message.objects;
          }

          broadcastToRoom(room, ws, {
            type: "scene_update",
            senderId: userId,
            senderName: userName,
            action: message.action,
            object: message.object,
            objects: message.objects,
          });
        } else if (type === "presence_update" && currentRoomId) {
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const clientMeta = room.clients.get(ws);
          if (clientMeta) {
            clientMeta.cursor = message.cursor;
            clientMeta.camera = message.camera;
          }

          broadcastToRoom(room, ws, {
            type: "presence_update",
            senderId: userId,
            senderName: userName,
            cursor: message.cursor,
            camera: message.camera,
          });
        } else if (type === "tutor_sync" && currentRoomId) {
          const room = rooms.get(currentRoomId);
          if (!room) return;

          room.latestTutorHint = message.hint;

          broadcastToRoom(room, ws, {
            type: "tutor_sync",
            senderId: userId,
            hint: message.hint,
            formula: message.formula,
          });
        }
      } catch (err) {
        console.error("Classroom WS message error:", err);
      }
    });

    ws.on("close", () => {
      if (currentRoomId && rooms.has(currentRoomId)) {
        const room = rooms.get(currentRoomId);
        room.clients.delete(ws);

        if (room.clients.size === 0) {
          rooms.delete(currentRoomId);
        } else {
          broadcastRoomPresence(room);
        }
      }
    });
  });

  return wss;
}

function broadcastToRoom(room, senderWs, payload) {
  const json = JSON.stringify(payload);
  for (const [clientWs] of room.clients.entries()) {
    if (clientWs !== senderWs && clientWs.readyState === 1) {
      clientWs.send(json);
    }
  }
}

function broadcastRoomPresence(room) {
  const users = Array.from(room.clients.values()).map((c) => ({
    userId: c.userId,
    userName: c.userName,
    cursor: c.cursor,
  }));

  const payload = JSON.stringify({
    type: "room_presence",
    roomId: room.id,
    userCount: room.clients.size,
    users,
  });

  for (const [clientWs] of room.clients.entries()) {
    if (clientWs.readyState === 1) {
      clientWs.send(payload);
    }
  }
}

import * as THREE from "three";

export class ClassroomClient {
  constructor(appContext) {
    this.appContext = appContext;
    this.ws = null;
    this.roomId = null;
    this.userId = null;
    this.userName = "Learner";
    this.isHost = false;
    this.connected = false;
    this.remoteCursors = new Map();
    this.remoteGroup = new THREE.Group();
    this.remoteGroup.name = "classroom-presence";

    if (this.appContext?.world?.scene) {
      this.appContext.world.scene.add(this.remoteGroup);
    }

    this.onStatusChange = null;
    this.onUserPresenceChange = null;
    this.onTutorSync = null;
    this.isApplyingRemote = false;

    this.bindSceneStore();
  }

  get sceneRuntime() {
    return this.appContext?.sceneRuntime || this.appContext?.sceneApi;
  }

  getWsUrl() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    return `${protocol}//${host}/ws/classroom`;
  }

  connect() {
    if (this.ws) return;

    try {
      this.ws = new WebSocket(this.getWsUrl());

      this.ws.onopen = () => {
        this.connected = true;
        this.notifyStatus("connected");
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };

      this.ws.onerror = (err) => {
        console.warn("Classroom WS Error:", err);
        this.notifyStatus("error");
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.ws = null;
        this.notifyStatus("disconnected");
      };
    } catch (err) {
      console.error("Failed to establish classroom WebSocket:", err);
      this.notifyStatus("error");
    }
  }

  createRoom(userName = "Teacher") {
    this.userName = userName;
    this.connect();
    const sendCreate = () => {
      const initialScene = this.sceneRuntime?.snapshot?.()?.objects || [];
      this.ws.send(JSON.stringify({
        type: "create_room",
        userName: this.userName,
        initialScene,
      }));
    };

    if (this.ws?.readyState === WebSocket.OPEN) {
      sendCreate();
    } else if (this.ws) {
      this.ws.addEventListener("open", sendCreate, { once: true });
    }
  }

  joinRoom(roomId, userName = "Student") {
    this.userName = userName;
    this.connect();
    const sendJoin = () => {
      this.ws.send(JSON.stringify({
        type: "join_room",
        roomId,
        userName: this.userName,
      }));
    };

    if (this.ws?.readyState === WebSocket.OPEN) {
      sendJoin();
    } else if (this.ws) {
      this.ws.addEventListener("open", sendJoin, { once: true });
    }
  }

  leaveRoom() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.roomId = null;
    this.connected = false;
    this.clearRemoteCursors();
    this.notifyStatus("disconnected");
  }

  handleMessage(msg) {
    switch (msg.type) {
      case "room_created":
      case "room_joined":
        this.roomId = msg.roomId;
        this.userId = msg.userId;
        this.isHost = msg.type === "room_created";
        this.notifyStatus("in_room", { roomId: this.roomId, isHost: this.isHost, userCount: msg.userCount });

        if (msg.sceneObjects && Array.isArray(msg.sceneObjects)) {
          this.isApplyingRemote = true;
          this.sceneRuntime?.loadSnapshot?.({ objects: msg.sceneObjects });
          this.isApplyingRemote = false;
        }
        break;

      case "scene_update":
        if (msg.senderId !== this.userId) {
          this.isApplyingRemote = true;
          if (msg.objects) {
            this.sceneRuntime?.loadSnapshot?.({ objects: msg.objects });
          } else if (msg.action === "add" && msg.object) {
            this.sceneRuntime?.addObject?.(msg.object);
          } else if (msg.action === "remove" && msg.object?.id) {
            this.sceneRuntime?.removeMesh?.(msg.object.id);
          }
          this.isApplyingRemote = false;
        }
        break;

      case "presence_update":
        if (msg.senderId !== this.userId && msg.cursor) {
          this.updateRemoteCursor(msg.senderId, msg.senderName, msg.cursor);
        }
        break;

      case "room_presence":
        if (this.onUserPresenceChange) {
          this.onUserPresenceChange(msg.users || []);
        }
        break;

      case "tutor_sync":
        if (this.onTutorSync && msg.hint) {
          this.onTutorSync(msg);
        }
        break;

      case "error":
        this.notifyStatus("error", { message: msg.message });
        break;
    }
  }

  bindSceneStore() {
    if (typeof this.appContext?.onSceneChange === "function") {
      this.appContext.onSceneChange((snapshot) => {
        if (this.isApplyingRemote || !this.connected || !this.roomId) return;
        this.sendSceneUpdate("sync_all", null, snapshot.objects);
      });
    }
  }

  sendSceneUpdate(action, object = null, objects = null) {
    if (!this.connected || !this.roomId || !this.ws) return;
    this.ws.send(JSON.stringify({
      type: "scene_update",
      roomId: this.roomId,
      action,
      object,
      objects,
    }));
  }

  sendPresence(cursorPos) {
    if (!this.connected || !this.roomId || !this.ws) return;
    this.ws.send(JSON.stringify({
      type: "presence_update",
      roomId: this.roomId,
      cursor: cursorPos,
    }));
  }

  sendTutorSync(hint, formula = null) {
    if (!this.connected || !this.roomId || !this.ws) return;
    this.ws.send(JSON.stringify({
      type: "tutor_sync",
      roomId: this.roomId,
      hint,
      formula,
    }));
  }

  updateRemoteCursor(userId, userName, position) {
    let cursorMesh = this.remoteCursors.get(userId);
    if (!cursorMesh) {
      const group = new THREE.Group();

      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 16, 16),
        new THREE.MeshBasicMaterial({ color: "#ffd966", wireframe: true })
      );
      group.add(sphere);

      group.userData = { userId, userName };
      this.remoteGroup.add(group);
      cursorMesh = group;
      this.remoteCursors.set(userId, cursorMesh);
    }

    cursorMesh.position.set(position.x || 0, position.y || 0, position.z || 0);
  }

  clearRemoteCursors() {
    for (const [, mesh] of this.remoteCursors.entries()) {
      this.remoteGroup.remove(mesh);
    }
    this.remoteCursors.clear();
  }

  notifyStatus(status, data = {}) {
    if (this.onStatusChange) {
      this.onStatusChange(status, data);
    }
  }
}

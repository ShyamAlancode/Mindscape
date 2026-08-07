import { ClassroomClient } from "../core/classroomClient.js";

let classroomClient = null;

export function initClassroomUI(appContext) {
  classroomClient = new ClassroomClient(appContext);

  const topbarTools = document.querySelector(".topbar-tools");
  if (!topbarTools) return;

  const classroomCluster = document.createElement("div");
  classroomCluster.className = "tool-cluster classroom-cluster";
  classroomCluster.innerHTML = `
    <button id="classroomBtn" class="tool-btn is-classroom" data-tooltip="Real-Time 3D Classroom">
      <span class="tool-label">👥 Classroom</span>
    </button>
    <div id="classroomBadge" class="classroom-badge hidden">
      <span id="classroomRoomCode"></span>
      <span id="classroomUserCount" class="pill">1</span>
    </div>
  `;
  topbarTools.prepend(classroomCluster);

  const modalOverlay = document.createElement("div");
  modalOverlay.id = "classroomModal";
  modalOverlay.className = "classroom-modal-overlay hidden";
  modalOverlay.innerHTML = `
    <div class="classroom-modal">
      <div class="classroom-modal-header">
        <h3>👥 Multi-User Real-Time 3D Classroom</h3>
        <button id="classroomModalClose" class="formula-card-dismiss">&times;</button>
      </div>
      <div class="classroom-modal-body">
        <div id="classroomSetupView" class="classroom-view">
          <p class="muted-text">Connect teachers and learners in a live synchronized 3D canvas room.</p>
          <div class="classroom-field-group">
            <label class="field">
              <span>Your Name</span>
              <input id="classroomUserName" type="text" value="Teacher / Student" placeholder="Enter name" />
            </label>
          </div>
          <div class="classroom-action-row">
            <button id="createRoomBtn" class="question-submit-btn" type="button">Create New Room</button>
          </div>
          <div class="classroom-divider"><span>OR JOIN ROOM</span></div>
          <div class="classroom-join-row">
            <input id="joinRoomCodeInput" type="text" placeholder="Enter 6-char room code (e.g. A8X9K2)" maxLength="6" style="text-transform:uppercase" />
            <button id="joinRoomBtn" class="plan-btn btn-secondary" type="button">Join Room</button>
          </div>
        </div>

        <div id="classroomActiveView" class="classroom-view hidden">
          <div class="room-status-card">
            <p class="eyebrow">ACTIVE ROOM</p>
            <h2 id="activeRoomCode" class="room-code-display">------</h2>
            <p id="activeRoomRole" class="muted-text">Host</p>
          </div>
          <div class="users-list-section">
            <h4>Participants (<span id="userCountNum">1</span>)</h4>
            <ul id="classroomUserList" class="classroom-user-list"></ul>
          </div>
          <div class="classroom-action-row">
            <button id="leaveRoomBtn" class="tool-btn is-stop" type="button" style="width:100%">Leave Room</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modalOverlay);

  const classroomBtn = document.getElementById("classroomBtn");
  const modalClose = document.getElementById("classroomModalClose");
  const createBtn = document.getElementById("createRoomBtn");
  const joinBtn = document.getElementById("joinRoomBtn");
  const leaveBtn = document.getElementById("leaveRoomBtn");
  const nameInput = document.getElementById("classroomUserName");
  const codeInput = document.getElementById("joinRoomCodeInput");

  classroomBtn.addEventListener("click", () => {
    modalOverlay.classList.remove("hidden");
  });

  modalClose.addEventListener("click", () => {
    modalOverlay.classList.add("hidden");
  });

  createBtn.addEventListener("click", () => {
    const userName = nameInput.value.trim() || "Teacher";
    classroomClient.createRoom(userName);
  });

  joinBtn.addEventListener("click", () => {
    const userName = nameInput.value.trim() || "Student";
    const code = codeInput.value.trim().toUpperCase();
    if (!code) return;
    classroomClient.joinRoom(code, userName);
  });

  leaveBtn.addEventListener("click", () => {
    classroomClient.leaveRoom();
  });

  const setupView = document.getElementById("classroomSetupView");
  const activeView = document.getElementById("classroomActiveView");
  const badge = document.getElementById("classroomBadge");
  const badgeCode = document.getElementById("classroomRoomCode");
  const badgeCount = document.getElementById("classroomUserCount");
  const activeCodeDisplay = document.getElementById("activeRoomCode");
  const activeRoleDisplay = document.getElementById("activeRoomRole");
  const userCountNum = document.getElementById("userCountNum");
  const userList = document.getElementById("classroomUserList");

  classroomClient.onStatusChange = (status, data) => {
    if (status === "in_room") {
      setupView.classList.add("hidden");
      activeView.classList.remove("hidden");
      badge.classList.remove("hidden");

      badgeCode.textContent = `Room ${data.roomId}`;
      activeCodeDisplay.textContent = data.roomId;
      activeRoleDisplay.textContent = data.isHost ? "Host / Teacher" : "Participant / Student";
      if (data.userCount) {
        badgeCount.textContent = data.userCount;
        userCountNum.textContent = data.userCount;
      }
    } else if (status === "disconnected") {
      setupView.classList.remove("hidden");
      activeView.classList.add("hidden");
      badge.classList.add("hidden");
    } else if (status === "error") {
      alert(data.message || "Failed to connect to real-time classroom.");
    }
  };

  classroomClient.onUserPresenceChange = (users) => {
    userCountNum.textContent = users.length;
    badgeCount.textContent = users.length;
    userList.innerHTML = users.map((u) => `
      <li class="user-item">
        <span class="user-dot"></span>
        <span class="user-name">${u.userName}</span>
      </li>
    `).join("");
  };

  return classroomClient;
}

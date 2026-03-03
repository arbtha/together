import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  collection,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  writeBatch,
  getDocs,
  where
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

const userConfig = {
  apiKey: "AIzaSyAcIwwapktH2nxyZczVKFacTrLh1o-EgdM",
  authDomain: "shakkak-8f90f.firebaseapp.com",
  projectId: "shakkak-8f90f",
  storageBucket: "shakkak-8f90f.firebasestorage.app",
  messagingSenderId: "1039276785290",
  appId: "1:1039276785290:web:ed874a451b37fb3210f773",
  measurementId: "G-QRH0Z1HM5R"
};

const APP_DOMAIN = "https://arbtha.github.io/together/";
const PROFILE_STORAGE_KEY = "together_watch_profile";
const PRESENCE_TIMEOUT_MS = 30_000;
const HEARTBEAT_MS = 12_000;
const PLAYBACK_PUSH_MS = 1_000;

const state = {
  app: null,
  auth: null,
  db: null,
  storage: null,
  user: null,
  profile: {
    name: "",
    avatar: ""
  },
  pendingRoomFromLink: null,
  roomId: null,
  roomData: null,
  isHost: false,
  loadedVideoId: null,
  loadedVideoUrl: "",
  participants: new Map(),
  roomVideos: [],
  uploadQueue: [],
  isUploadingQueue: false,
  switchTargetVideo: null,
  lastPlaybackPushAt: 0,
  roomUnsub: null,
  participantsUnsub: null,
  chatUnsub: null,
  videosUnsub: null,
  openRoomsUnsub: null,
  heartbeatInterval: null
};

const refs = {
  screens: {
    loading: document.getElementById("loadingScreen"),
    profile: document.getElementById("profileScreen"),
    home: document.getElementById("homeScreen"),
    room: document.getElementById("roomScreen")
  },
  profileForm: document.getElementById("profileForm"),
  profileNameInput: document.getElementById("profileNameInput"),
  profileAvatarInput: document.getElementById("profileAvatarInput"),
  profileAvatarPreview: document.getElementById("profileAvatarPreview"),
  profileSubmitBtn: document.getElementById("profileSubmitBtn"),
  avatarHint: document.getElementById("avatarHint"),
  homeProfileName: document.getElementById("homeProfileName"),
  showCreateRoomBtn: document.getElementById("showCreateRoomBtn"),
  showJoinRoomBtn: document.getElementById("showJoinRoomBtn"),
  createRoomPanel: document.getElementById("createRoomPanel"),
  joinRoomPanel: document.getElementById("joinRoomPanel"),
  createRoomForm: document.getElementById("createRoomForm"),
  roomNameInput: document.getElementById("roomNameInput"),
  initialVideoInput: document.getElementById("initialVideoInput"),
  initialUploadArea: document.getElementById("initialUploadArea"),
  initialUploadFileName: document.getElementById("initialUploadFileName"),
  initialUploadPercent: document.getElementById("initialUploadPercent"),
  initialUploadBar: document.getElementById("initialUploadBar"),
  createRoomSubmitBtn: document.getElementById("createRoomSubmitBtn"),
  roomsList: document.getElementById("roomsList"),
  roomProfileAvatar: document.getElementById("roomProfileAvatar"),
  roomProfileName: document.getElementById("roomProfileName"),
  roomTitle: document.getElementById("roomTitle"),
  hostBadge: document.getElementById("hostBadge"),
  viewerCountBtn: document.getElementById("viewerCountBtn"),
  viewerCount: document.getElementById("viewerCount"),
  openDrawerBtn: document.getElementById("openDrawerBtn"),
  sideDrawer: document.getElementById("sideDrawer"),
  closeDrawerBtn: document.getElementById("closeDrawerBtn"),
  drawerOverlay: document.getElementById("drawerOverlay"),
  copyRoomLinkBtn: document.getElementById("copyRoomLinkBtn"),
  toggleUploadsBtn: document.getElementById("toggleUploadsBtn"),
  uploadsPanel: document.getElementById("uploadsPanel"),
  queueVideoInput: document.getElementById("queueVideoInput"),
  uploadQueueList: document.getElementById("uploadQueueList"),
  videosList: document.getElementById("videosList"),
  currentVideoStatus: document.getElementById("currentVideoStatus"),
  roomVideo: document.getElementById("roomVideo"),
  playPauseBtn: document.getElementById("playPauseBtn"),
  seekBackBtn: document.getElementById("seekBackBtn"),
  seekForwardBtn: document.getElementById("seekForwardBtn"),
  seekRange: document.getElementById("seekRange"),
  timeLabel: document.getElementById("timeLabel"),
  fullscreenBtn: document.getElementById("fullscreenBtn"),
  chatMessages: document.getElementById("chatMessages"),
  chatForm: document.getElementById("chatForm"),
  chatInput: document.getElementById("chatInput"),
  participantsModal: document.getElementById("participantsModal"),
  closeParticipantsModalBtn: document.getElementById("closeParticipantsModalBtn"),
  participantsList: document.getElementById("participantsList"),
  switchVideoModal: document.getElementById("switchVideoModal"),
  switchVideoText: document.getElementById("switchVideoText"),
  confirmSwitchVideoBtn: document.getElementById("confirmSwitchVideoBtn"),
  cancelSwitchVideoBtn: document.getElementById("cancelSwitchVideoBtn"),
  profileChipBtn: document.getElementById("profileChipBtn"),
  profileMenuModal: document.getElementById("profileMenuModal"),
  editNameBtn: document.getElementById("editNameBtn"),
  changeAvatarInput: document.getElementById("changeAvatarInput"),
  logoutBtn: document.getElementById("logoutBtn"),
  closeProfileMenuBtn: document.getElementById("closeProfileMenuBtn"),
  toast: document.getElementById("toast")
};

start().catch((error) => {
  console.error(error);
  showToast("حدث خطأ أثناء تشغيل التطبيق");
  showScreen("profile");
});

async function start() {
  bindEvents();
  initFirebase();
  await ensureAuthReady();
  hydrateProfileFromLocal();

  const params = new URLSearchParams(window.location.search);
  state.pendingRoomFromLink = params.get("room");

  showScreen("profile");
}

function initFirebase() {
  state.app = initializeApp(userConfig);
  state.auth = getAuth(state.app);
  state.db = getFirestore(state.app);
  state.storage = getStorage(state.app);
}

function bindEvents() {
  refs.profileForm.addEventListener("submit", onProfileSubmit);
  refs.profileAvatarInput.addEventListener("change", onProfileAvatarPicked);

  refs.showCreateRoomBtn.addEventListener("click", () => {
    refs.createRoomPanel.classList.remove("hidden");
    refs.joinRoomPanel.classList.add("hidden");
  });

  refs.showJoinRoomBtn.addEventListener("click", () => {
    refs.joinRoomPanel.classList.remove("hidden");
    refs.createRoomPanel.classList.add("hidden");
  });

  refs.createRoomForm.addEventListener("submit", onCreateRoomSubmit);

  refs.viewerCountBtn.addEventListener("click", () => openModal(refs.participantsModal));
  refs.closeParticipantsModalBtn.addEventListener("click", () => closeModal(refs.participantsModal));

  refs.openDrawerBtn.addEventListener("click", openDrawer);
  refs.closeDrawerBtn.addEventListener("click", closeDrawer);
  refs.drawerOverlay.addEventListener("click", closeDrawer);

  refs.copyRoomLinkBtn.addEventListener("click", copyRoomLink);
  refs.toggleUploadsBtn.addEventListener("click", () => refs.uploadsPanel.classList.toggle("hidden"));
  refs.queueVideoInput.addEventListener("change", onQueueVideosPicked);

  refs.playPauseBtn.addEventListener("click", onPlayPauseToggle);
  refs.seekBackBtn.addEventListener("click", () => hostSeekBy(-10));
  refs.seekForwardBtn.addEventListener("click", () => hostSeekBy(10));
  refs.seekRange.addEventListener("input", onHostSeekRangeInput);
  refs.fullscreenBtn.addEventListener("click", openFullscreen);

  refs.roomVideo.addEventListener("timeupdate", onVideoTimeUpdate);
  refs.roomVideo.addEventListener("loadedmetadata", onVideoLoadedMetadata);
  refs.roomVideo.addEventListener("play", () => pushPlaybackState(true));
  refs.roomVideo.addEventListener("pause", () => pushPlaybackState(true));
  refs.roomVideo.addEventListener("seeking", () => pushPlaybackState(true));

  refs.chatForm.addEventListener("submit", onChatSubmit);

  refs.confirmSwitchVideoBtn.addEventListener("click", onConfirmSwitchVideo);
  refs.cancelSwitchVideoBtn.addEventListener("click", () => {
    state.switchTargetVideo = null;
    closeModal(refs.switchVideoModal);
  });

  refs.profileChipBtn.addEventListener("click", () => openModal(refs.profileMenuModal));
  refs.closeProfileMenuBtn.addEventListener("click", () => closeModal(refs.profileMenuModal));
  refs.editNameBtn.addEventListener("click", onEditName);
  refs.changeAvatarInput.addEventListener("change", onChangeAvatar);
  refs.logoutBtn.addEventListener("click", onLogout);

  document.addEventListener("click", (event) => {
    if (event.target.classList.contains("modal")) {
      closeModal(event.target);
    }
  });

  window.addEventListener("beforeunload", () => {
    if (state.roomId) {
      setTimeout(() => {
        leaveRoom({ goingOffline: true }).catch(() => {});
      }, 0);
    }
  });
}

async function ensureAuthReady() {
  const firstUser = await new Promise((resolve, reject) => {
    let unsubscribe = () => {};
    unsubscribe = onAuthStateChanged(
      state.auth,
      (currentUser) => {
        unsubscribe();
        resolve(currentUser);
      },
      (error) => {
        unsubscribe();
        reject(error);
      }
    );
  });

  if (!firstUser) {
    await signInAnonymously(state.auth);
    state.user = state.auth.currentUser;
  } else {
    state.user = firstUser;
  }
}

function hydrateProfileFromLocal() {
  const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!raw) {
    refs.profileAvatarPreview.src = "";
    return;
  }

  try {
    const stored = JSON.parse(raw);
    if (stored?.name) {
      state.profile.name = stored.name;
      refs.profileNameInput.value = stored.name;
    }
    if (stored?.avatar) {
      state.profile.avatar = stored.avatar;
      refs.profileAvatarPreview.src = stored.avatar;
      refs.avatarHint.textContent = "الصورة جاهزة";
    }
  } catch {
    localStorage.removeItem(PROFILE_STORAGE_KEY);
  }
}

async function onProfileAvatarPicked(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  try {
    const avatar = await convertImageFileToAvatar(file);
    state.profile.avatar = avatar;
    refs.profileAvatarPreview.src = avatar;
    refs.avatarHint.textContent = "تم اختيار الصورة";
  } catch (error) {
    console.error(error);
    showToast("فشل قراءة الصورة");
  }
}

async function onProfileSubmit(event) {
  event.preventDefault();

  if (!state.user) {
    showToast("فشل تسجيل الدخول المجهول. فعّل Anonymous Auth في Firebase");
    return;
  }

  const name = refs.profileNameInput.value.trim();
  if (!name) {
    showToast("اكتب الاسم أولاً");
    return;
  }

  if (!state.profile.avatar) {
    showToast("اختر صورة بروفايل أولاً");
    return;
  }

  state.profile.name = name;
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(state.profile));

  refs.homeProfileName.textContent = state.profile.name;
  refs.roomProfileName.textContent = state.profile.name;
  refs.roomProfileAvatar.src = state.profile.avatar;

  showScreen("home");
  refs.joinRoomPanel.classList.add("hidden");
  refs.createRoomPanel.classList.add("hidden");
  watchOpenRooms();

  if (state.pendingRoomFromLink) {
    const targetRoom = state.pendingRoomFromLink;
    state.pendingRoomFromLink = null;
    showToast("جاري الانضمام للرابط...");
    await joinRoom(targetRoom);
  }
}

async function onCreateRoomSubmit(event) {
  event.preventDefault();

  const roomName = refs.roomNameInput.value.trim();
  const firstVideo = refs.initialVideoInput.files?.[0];

  if (!roomName) {
    showToast("اكتب اسم الغرفة");
    return;
  }

  if (!firstVideo) {
    showToast("اختر فيديو أولي");
    return;
  }

  try {
    refs.createRoomSubmitBtn.disabled = true;
    refs.initialUploadArea.classList.remove("hidden");
    refs.initialUploadFileName.textContent = firstVideo.name;
    updateProgress(refs.initialUploadBar, refs.initialUploadPercent, 0);

    const roomId = generateRoomId();
    const roomRef = doc(state.db, "rooms", roomId);

    await setDoc(roomRef, {
      id: roomId,
      name: roomName,
      hostUid: state.user.uid,
      hostName: state.profile.name,
      hostAvatar: state.profile.avatar,
      createdAt: serverTimestamp(),
      isOpen: true,
      viewerCount: 1,
      currentVideoId: "",
      currentVideoUrl: "",
      currentVideoTitle: "",
      playback: {
        time: 0,
        paused: true,
        byUid: state.user.uid,
        updatedAt: Date.now(),
        videoId: ""
      },
      lastActivity: serverTimestamp()
    });

    await upsertParticipant(roomId, { initial: true });

    const uploaded = await uploadVideoWithProgress({
      roomId,
      file: firstVideo,
      onProgress: (percent) => updateProgress(refs.initialUploadBar, refs.initialUploadPercent, percent)
    });

    const videoDocRef = await addDoc(collection(state.db, `rooms/${roomId}/videos`), {
      title: uploaded.title,
      url: uploaded.url,
      filePath: uploaded.filePath,
      size: uploaded.size,
      uploadedByUid: state.user.uid,
      uploadedByName: state.profile.name,
      uploadedAt: serverTimestamp()
    });

    await updateDoc(roomRef, {
      currentVideoId: videoDocRef.id,
      currentVideoUrl: uploaded.url,
      currentVideoTitle: uploaded.title,
      playback: {
        time: 0,
        paused: true,
        byUid: state.user.uid,
        updatedAt: Date.now(),
        videoId: videoDocRef.id
      },
      lastActivity: serverTimestamp()
    });

    await joinRoom(roomId);

    refs.createRoomForm.reset();
    refs.initialUploadArea.classList.add("hidden");
    showToast("تم إنشاء الغرفة بنجاح");
  } catch (error) {
    console.error(error);
    showToast(humanizeFirebaseError(error));
  } finally {
    refs.createRoomSubmitBtn.disabled = false;
  }
}

async function joinRoom(roomId) {
  if (!roomId) {
    return;
  }

  try {
    if (state.roomId && state.roomId !== roomId) {
      await leaveRoom({ keepHome: true });
    }

    const roomRef = doc(state.db, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) {
      showToast("الغرفة غير موجودة");
      showScreen("home");
      clearRoomInUrl();
      return;
    }

    const roomData = roomSnap.data();
    if (!roomData.isOpen) {
      showToast("هذه الغرفة مغلقة حالياً");
      showScreen("home");
      clearRoomInUrl();
      return;
    }

    state.roomId = roomId;
    state.roomData = roomData;
    state.loadedVideoId = "";
    state.loadedVideoUrl = "";

    await upsertParticipant(roomId, { initial: true });
    subscribeRoomListeners(roomId);
    startHeartbeat(roomId);

    showScreen("room");
    setRoomInUrl(roomId);
    closeDrawer();
    closeModal(refs.participantsModal);
    closeModal(refs.profileMenuModal);
    refs.chatInput.value = "";
    refs.chatMessages.innerHTML = "";
    refs.currentVideoStatus.textContent = roomData.currentVideoTitle || "لا يوجد";

    applyRoomHeader(roomData);
  } catch (error) {
    console.error(error);
    showToast(humanizeFirebaseError(error));
  }
}

function subscribeRoomListeners(roomId) {
  cleanupRoomListeners();

  const roomRef = doc(state.db, "rooms", roomId);
  state.roomUnsub = onSnapshot(roomRef, async (snapshot) => {
    if (!snapshot.exists()) {
      showToast("تم حذف الغرفة");
      await leaveRoom({ keepHome: true });
      showScreen("home");
      clearRoomInUrl();
      return;
    }

    const data = snapshot.data();
    state.roomData = data;
    state.isHost = data.hostUid === state.user.uid;

    applyRoomHeader(data);
    applyRoleBasedControls();

    if (data.currentVideoUrl && data.currentVideoId) {
      if (state.loadedVideoId !== data.currentVideoId) {
        loadRoomVideo({
          videoId: data.currentVideoId,
          url: data.currentVideoUrl,
          title: data.currentVideoTitle
        });
      }
    }

    if (data.playback) {
      syncPlaybackFromRoom(data.playback);
    }

    refs.currentVideoStatus.textContent = data.currentVideoTitle || "لا يوجد";
  });

  const participantsRef = collection(state.db, `rooms/${roomId}/participants`);
  state.participantsUnsub = onSnapshot(participantsRef, (snapshot) => {
    const now = Date.now();
    state.participants.clear();

    snapshot.forEach((participantDoc) => {
      const participant = participantDoc.data();
      if ((participant.lastSeen || 0) > now - PRESENCE_TIMEOUT_MS) {
        state.participants.set(participantDoc.id, participant);
      }
    });

    refs.viewerCount.textContent = String(state.participants.size);
    renderParticipants();

    if (state.roomId && state.isHost) {
      updateDoc(doc(state.db, "rooms", state.roomId), {
        viewerCount: state.participants.size,
        lastActivity: serverTimestamp()
      }).catch(() => {});
    }
  });

  const chatQuery = query(collection(state.db, `rooms/${roomId}/chat`), orderBy("createdAt", "asc"));
  state.chatUnsub = onSnapshot(chatQuery, (snapshot) => {
    const fragments = [];
    snapshot.forEach((messageDoc) => {
      const message = messageDoc.data();
      fragments.push(renderMessageHtml(message));
    });

    refs.chatMessages.innerHTML = fragments.join("");
    refs.chatMessages.scrollTop = refs.chatMessages.scrollHeight;
  });

  const videosQuery = query(collection(state.db, `rooms/${roomId}/videos`), orderBy("uploadedAt", "asc"));
  state.videosUnsub = onSnapshot(videosQuery, (snapshot) => {
    state.roomVideos = snapshot.docs.map((videoDoc) => ({ id: videoDoc.id, ...videoDoc.data() }));
    renderVideosList();
  });
}

async function leaveRoom({ keepHome = false, goingOffline = false } = {}) {
  if (!state.roomId) {
    return;
  }

  const leavingRoomId = state.roomId;
  const wasHost = state.isHost;
  const roomRef = doc(state.db, "rooms", leavingRoomId);

  try {
    if (!goingOffline) {
      if (wasHost) {
        await transferHostToNextParticipant(leavingRoomId);
      }

      await deleteDoc(doc(state.db, `rooms/${leavingRoomId}/participants`, state.user.uid));

      if (!wasHost) {
        await updateDoc(roomRef, {
          lastActivity: serverTimestamp()
        }).catch(() => {});
      }
    }
  } catch (error) {
    console.error(error);
  }

  stopHeartbeat();
  cleanupRoomListeners();

  state.roomId = null;
  state.roomData = null;
  state.loadedVideoId = "";
  state.loadedVideoUrl = "";
  state.participants.clear();
  state.roomVideos = [];
  state.isHost = false;
  state.uploadQueue = [];
  state.isUploadingQueue = false;
  state.switchTargetVideo = null;

  refs.uploadQueueList.innerHTML = "";
  refs.videosList.innerHTML = "";
  refs.viewerCount.textContent = "0";
  refs.roomVideo.pause();
  refs.roomVideo.removeAttribute("src");
  refs.roomVideo.load();
  refs.chatMessages.innerHTML = "";

  if (!keepHome) {
    showScreen("home");
  }
  clearRoomInUrl();
}

function cleanupRoomListeners() {
  if (state.roomUnsub) {
    state.roomUnsub();
    state.roomUnsub = null;
  }
  if (state.participantsUnsub) {
    state.participantsUnsub();
    state.participantsUnsub = null;
  }
  if (state.chatUnsub) {
    state.chatUnsub();
    state.chatUnsub = null;
  }
  if (state.videosUnsub) {
    state.videosUnsub();
    state.videosUnsub = null;
  }
}

function startHeartbeat(roomId) {
  stopHeartbeat();
  state.heartbeatInterval = setInterval(() => {
    upsertParticipant(roomId).catch(() => {});
  }, HEARTBEAT_MS);
}

function stopHeartbeat() {
  if (state.heartbeatInterval) {
    clearInterval(state.heartbeatInterval);
    state.heartbeatInterval = null;
  }
}

async function upsertParticipant(roomId, { initial = false } = {}) {
  if (!roomId) {
    return;
  }

  const participantRef = doc(state.db, `rooms/${roomId}/participants`, state.user.uid);
  const baseData = {
    uid: state.user.uid,
    name: state.profile.name,
    avatar: state.profile.avatar,
    isHost: state.roomData?.hostUid === state.user.uid,
    lastSeen: Date.now()
  };

  if (initial) {
    baseData.joinedAt = serverTimestamp();
  }

  await setDoc(participantRef, baseData, { merge: true });
}

function applyRoomHeader(roomData) {
  refs.roomTitle.textContent = roomData.name || "الغرفة";
  refs.roomProfileAvatar.src = state.profile.avatar;
  refs.roomProfileName.textContent = state.profile.name;

  if (state.isHost) {
    refs.hostBadge.textContent = "أنت منشئ/مدير الغرفة";
  } else {
    refs.hostBadge.textContent = `المدير: ${roomData.hostName || "-"}`;
  }
}

function applyRoleBasedControls() {
  const hostControls = document.querySelectorAll(".control-host");
  hostControls.forEach((element) => {
    element.style.display = state.isHost ? "" : "none";
  });

  refs.playPauseBtn.style.display = state.isHost ? "inline-flex" : "none";
  refs.seekBackBtn.style.display = state.isHost ? "inline-flex" : "none";
  refs.seekForwardBtn.style.display = state.isHost ? "inline-flex" : "none";
}

function loadRoomVideo({ videoId, url, title }) {
  if (!url || !videoId) {
    return;
  }

  state.loadedVideoId = videoId;
  state.loadedVideoUrl = url;
  refs.roomVideo.src = url;
  refs.roomVideo.load();
  refs.currentVideoStatus.textContent = title || "فيديو";
  refs.playPauseBtn.textContent = "تشغيل";
}

function syncPlaybackFromRoom(playback) {
  if (!playback || !state.roomId) {
    return;
  }

  const video = refs.roomVideo;

  if (!state.loadedVideoId || playback.videoId !== state.loadedVideoId) {
    return;
  }

  if (state.isHost && playback.byUid === state.user.uid) {
    return;
  }

  const targetTime = Number(playback.time || 0);
  const delta = Math.abs((video.currentTime || 0) - targetTime);

  if (Number.isFinite(targetTime) && delta > 1.2) {
    video.currentTime = targetTime;
  }

  if (playback.paused) {
    if (!video.paused) {
      video.pause();
    }
  } else {
    video.play().catch(() => {});
  }

  refs.playPauseBtn.textContent = video.paused ? "تشغيل" : "إيقاف";
}

function onVideoLoadedMetadata() {
  updateTimeLabel();
}

function onVideoTimeUpdate() {
  updateTimeLabel();

  const video = refs.roomVideo;
  if (video.duration && Number.isFinite(video.duration)) {
    refs.seekRange.value = String((video.currentTime / video.duration) * 100);
  }

  if (!state.isHost) {
    return;
  }

  const now = Date.now();
  if (now - state.lastPlaybackPushAt >= PLAYBACK_PUSH_MS) {
    state.lastPlaybackPushAt = now;
    pushPlaybackState(false);
  }
}

function updateTimeLabel() {
  const current = formatTime(refs.roomVideo.currentTime || 0);
  const duration = formatTime(refs.roomVideo.duration || 0);
  refs.timeLabel.textContent = `${current} / ${duration}`;
}

function onPlayPauseToggle() {
  if (!state.isHost) {
    showToast("التحكم متاح لمدير الغرفة فقط");
    return;
  }

  if (!state.loadedVideoId) {
    showToast("لا يوجد فيديو حالياً");
    return;
  }

  if (refs.roomVideo.paused) {
    refs.roomVideo.play().catch(() => {
      showToast("تعذر تشغيل الفيديو");
    });
  } else {
    refs.roomVideo.pause();
  }

  refs.playPauseBtn.textContent = refs.roomVideo.paused ? "تشغيل" : "إيقاف";
  pushPlaybackState(true);
}

function hostSeekBy(amount) {
  if (!state.isHost) {
    return;
  }

  const next = Math.max(0, (refs.roomVideo.currentTime || 0) + amount);
  refs.roomVideo.currentTime = next;
  pushPlaybackState(true);
}

function onHostSeekRangeInput(event) {
  if (!state.isHost) {
    return;
  }

  const percent = Number(event.target.value || 0);
  if (!refs.roomVideo.duration || !Number.isFinite(refs.roomVideo.duration)) {
    return;
  }

  refs.roomVideo.currentTime = (percent / 100) * refs.roomVideo.duration;
  pushPlaybackState(true);
}

async function pushPlaybackState(force = false) {
  if (!state.isHost || !state.roomId || !state.loadedVideoId) {
    return;
  }

  const now = Date.now();
  if (!force && now - state.lastPlaybackPushAt < PLAYBACK_PUSH_MS) {
    return;
  }

  state.lastPlaybackPushAt = now;

  const payload = {
    playback: {
      time: refs.roomVideo.currentTime || 0,
      paused: refs.roomVideo.paused,
      byUid: state.user.uid,
      updatedAt: now,
      videoId: state.loadedVideoId
    },
    lastActivity: serverTimestamp()
  };

  await updateDoc(doc(state.db, "rooms", state.roomId), payload).catch(() => {});
}

function openFullscreen() {
  const player = refs.roomVideo;
  if (!player.src) {
    return;
  }

  if (player.requestFullscreen) {
    player.requestFullscreen().catch(() => {});
  } else if (player.webkitEnterFullscreen) {
    player.webkitEnterFullscreen();
  }
}

async function onChatSubmit(event) {
  event.preventDefault();

  if (!state.roomId) {
    return;
  }

  const text = refs.chatInput.value.trim();
  if (!text) {
    return;
  }

  try {
    await addDoc(collection(state.db, `rooms/${state.roomId}/chat`), {
      uid: state.user.uid,
      name: state.profile.name,
      avatar: state.profile.avatar,
      text,
      createdAt: serverTimestamp()
    });
    refs.chatInput.value = "";
  } catch (error) {
    console.error(error);
    showToast("فشل إرسال الرسالة");
  }
}

function renderMessageHtml(message) {
  const mine = message.uid === state.user.uid;
  const safeText = escapeHtml(message.text || "");
  const safeName = escapeHtml(message.name || "مستخدم");
  const avatar = message.avatar || state.profile.avatar;

  return `
    <article class="chat-msg ${mine ? "mine" : ""}">
      <img class="avatar" src="${avatar}" alt="${safeName}" />
      <div class="msg-body">
        <strong>${safeName}</strong>
        <p>${safeText}</p>
      </div>
    </article>
  `;
}

function renderParticipants() {
  if (!state.participants.size) {
    refs.participantsList.innerHTML = `<p class="empty">لا يوجد مشاهدون حالياً</p>`;
    return;
  }

  const rows = [];
  for (const [uid, participant] of state.participants.entries()) {
    const isCurrentHost = state.roomData?.hostUid === uid;
    const canPromote = state.isHost && uid !== state.user.uid;

    rows.push(`
      <div class="participant-row">
        <div class="participant-main">
          <img class="avatar" src="${participant.avatar}" alt="${escapeHtml(participant.name)}" />
          <div>
            <strong>${escapeHtml(participant.name)}</strong>
            <small>${isCurrentHost ? "مدير الغرفة" : "مشاهد"}</small>
          </div>
        </div>
        ${canPromote ? `<button data-promote="${uid}" class="btn btn-secondary promote-btn">تعيين مدير</button>` : ""}
      </div>
    `);
  }

  refs.participantsList.innerHTML = rows.join("");

  refs.participantsList.querySelectorAll(".promote-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const targetUid = button.getAttribute("data-promote");
      if (!targetUid) {
        return;
      }
      await transferHostToSpecificParticipant(targetUid);
    });
  });
}

async function transferHostToSpecificParticipant(targetUid) {
  if (!state.roomId || !state.isHost) {
    return;
  }

  const target = state.participants.get(targetUid);
  if (!target) {
    showToast("المشاهد غير متاح حالياً");
    return;
  }

  try {
    const batch = writeBatch(state.db);
    const roomRef = doc(state.db, "rooms", state.roomId);

    batch.update(roomRef, {
      hostUid: targetUid,
      hostName: target.name,
      hostAvatar: target.avatar,
      lastActivity: serverTimestamp()
    });

    batch.update(doc(state.db, `rooms/${state.roomId}/participants`, state.user.uid), {
      isHost: false
    });

    batch.update(doc(state.db, `rooms/${state.roomId}/participants`, targetUid), {
      isHost: true
    });

    await batch.commit();
    showToast(`تم تعيين ${target.name} كمدير للغرفة`);
  } catch (error) {
    console.error(error);
    showToast("فشل نقل الإدارة");
  }
}

async function transferHostToNextParticipant(roomId) {
  const participantsSnap = await getDocs(collection(state.db, `rooms/${roomId}/participants`));
  const aliveParticipants = participantsSnap.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .filter((participant) => participant.uid !== state.user.uid)
    .filter((participant) => (participant.lastSeen || 0) > Date.now() - PRESENCE_TIMEOUT_MS);

  if (!aliveParticipants.length) {
    await updateDoc(doc(state.db, "rooms", roomId), {
      isOpen: false,
      viewerCount: 0,
      lastActivity: serverTimestamp()
    }).catch(() => {});
    return;
  }

  aliveParticipants.sort((a, b) => {
    const aJoined = a.joinedAt?.seconds || 0;
    const bJoined = b.joinedAt?.seconds || 0;
    if (aJoined && bJoined) {
      return aJoined - bJoined;
    }
    return (a.lastSeen || 0) - (b.lastSeen || 0);
  });
  const nextHost = aliveParticipants[0];

  const batch = writeBatch(state.db);
  batch.update(doc(state.db, "rooms", roomId), {
    hostUid: nextHost.uid,
    hostName: nextHost.name,
    hostAvatar: nextHost.avatar,
    lastActivity: serverTimestamp()
  });
  batch.update(doc(state.db, `rooms/${roomId}/participants`, nextHost.uid), {
    isHost: true
  });
  await batch.commit();
}

function onQueueVideosPicked(event) {
  if (!state.roomId) {
    return;
  }
  if (!state.isHost) {
    showToast("رفع الفيديوهات لمدير الغرفة فقط");
    event.target.value = "";
    return;
  }

  const files = Array.from(event.target.files || []);
  if (!files.length) {
    return;
  }

  const queueItems = files.map((file) => ({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    file,
    progress: 0,
    status: "queued",
    title: file.name,
    error: ""
  }));

  state.uploadQueue.push(...queueItems);
  renderUploadQueue();
  processUploadQueue();
  event.target.value = "";
}

async function processUploadQueue() {
  if (state.isUploadingQueue || !state.roomId) {
    return;
  }

  const next = state.uploadQueue.find((item) => item.status === "queued");
  if (!next) {
    return;
  }

  state.isUploadingQueue = true;
  next.status = "uploading";
  renderUploadQueue();

  try {
    const uploaded = await uploadVideoWithProgress({
      roomId: state.roomId,
      file: next.file,
      onProgress: (percent) => {
        next.progress = percent;
        renderUploadQueue();
      }
    });

    await addDoc(collection(state.db, `rooms/${state.roomId}/videos`), {
      title: uploaded.title,
      url: uploaded.url,
      filePath: uploaded.filePath,
      size: uploaded.size,
      uploadedByUid: state.user.uid,
      uploadedByName: state.profile.name,
      uploadedAt: serverTimestamp()
    });

    next.status = "done";
    next.progress = 100;
  } catch (error) {
    console.error(error);
    next.status = "error";
    next.error = humanizeFirebaseError(error);
  } finally {
    state.isUploadingQueue = false;
    renderUploadQueue();
    processUploadQueue();
  }
}

function renderUploadQueue() {
  if (!state.uploadQueue.length) {
    refs.uploadQueueList.innerHTML = `<p class="empty">لا يوجد رفع حالياً</p>`;
    return;
  }

  const rows = state.uploadQueue
    .map((item) => {
      return `
      <div class="queue-row">
        <div class="upload-header">
          <span>${escapeHtml(item.title)}</span>
          <span>${item.status === "done" ? "مكتمل" : item.status === "error" ? "خطأ" : `${Math.round(item.progress)}%`}</span>
        </div>
        <div class="progress-track"><div class="progress-bar" style="width:${Math.round(item.progress)}%"></div></div>
        ${item.error ? `<small class="error-text">${item.error}</small>` : ""}
      </div>
    `;
    })
    .join("");

  refs.uploadQueueList.innerHTML = rows;
}

function renderVideosList() {
  if (!state.roomVideos.length) {
    refs.videosList.innerHTML = `<p class="empty">لا توجد فيديوهات مرفوعة</p>`;
    return;
  }

  const rows = state.roomVideos
    .map((video) => {
      const isCurrent = state.roomData?.currentVideoId === video.id;
      return `
      <div class="video-row">
        <div>
          <strong>${escapeHtml(video.title || "فيديو")}</strong>
          <small>${isCurrent ? "قيد التشغيل الآن" : "جاهز للعرض"}</small>
        </div>
        ${state.isHost ? `<button data-video-id="${video.id}" class="btn btn-secondary show-video-btn">عرض</button>` : ""}
      </div>
    `;
    })
    .join("");

  refs.videosList.innerHTML = rows;

  refs.videosList.querySelectorAll(".show-video-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const videoId = button.getAttribute("data-video-id");
      const video = state.roomVideos.find((v) => v.id === videoId);
      if (!video) {
        return;
      }
      state.switchTargetVideo = video;
      refs.switchVideoText.textContent = `هل تريد تشغيل "${video.title}" الآن؟`;
      openModal(refs.switchVideoModal);
    });
  });
}

async function onConfirmSwitchVideo() {
  if (!state.roomId || !state.isHost || !state.switchTargetVideo) {
    return;
  }

  const video = state.switchTargetVideo;

  try {
    await updateDoc(doc(state.db, "rooms", state.roomId), {
      currentVideoId: video.id,
      currentVideoUrl: video.url,
      currentVideoTitle: video.title,
      playback: {
        time: 0,
        paused: true,
        byUid: state.user.uid,
        updatedAt: Date.now(),
        videoId: video.id
      },
      lastActivity: serverTimestamp()
    });

    showToast("تم تبديل الفيديو");
  } catch (error) {
    console.error(error);
    showToast("فشل تبديل الفيديو");
  } finally {
    state.switchTargetVideo = null;
    closeModal(refs.switchVideoModal);
  }
}

function watchOpenRooms() {
  if (state.openRoomsUnsub) {
    state.openRoomsUnsub();
  }

  const roomsRef = query(collection(state.db, "rooms"), where("isOpen", "==", true));

  state.openRoomsUnsub = onSnapshot(roomsRef, (snapshot) => {
    const rooms = snapshot.docs
      .map((roomDoc) => ({ id: roomDoc.id, ...roomDoc.data() }))
      .sort((a, b) => {
        const aTime = a.lastActivity?.seconds || 0;
        const bTime = b.lastActivity?.seconds || 0;
        return bTime - aTime;
      });

    if (!rooms.length) {
      refs.roomsList.innerHTML = `<p class="empty">لا توجد غرف مفتوحة حالياً</p>`;
      return;
    }

    refs.roomsList.innerHTML = rooms
      .map((room) => {
        return `
        <article class="room-row">
          <div class="room-host">
            <img class="avatar" src="${room.hostAvatar || state.profile.avatar}" alt="${escapeHtml(room.hostName || "مدير")}" />
            <div>
              <strong>${escapeHtml(room.name || "غرفة")}</strong>
              <small>المدير: ${escapeHtml(room.hostName || "-")}</small>
            </div>
          </div>
          <div class="room-meta">
            <span>${room.viewerCount || 0} متصل الآن</span>
            <button class="btn btn-primary join-room-btn" data-room-id="${room.id}">انضمام</button>
          </div>
        </article>
      `;
      })
      .join("");

    refs.roomsList.querySelectorAll(".join-room-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const roomId = button.getAttribute("data-room-id");
        if (roomId) {
          joinRoom(roomId);
        }
      });
    });
  });
}

async function uploadVideoWithProgress({ roomId, file, onProgress }) {
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `rooms/${roomId}/videos/${Date.now()}_${sanitizedName}`;
  const storageRef = ref(state.storage, filePath);

  return await new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type || "video/mp4"
    });

    task.on(
      "state_changed",
      (snapshot) => {
        const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        if (typeof onProgress === "function") {
          onProgress(percent);
        }
      },
      (error) => {
        reject(error);
      },
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve({
            url,
            filePath,
            title: file.name,
            size: file.size
          });
        } catch (error) {
          reject(error);
        }
      }
    );
  });
}

async function copyRoomLink() {
  if (!state.roomId) {
    return;
  }

  const link = `${APP_DOMAIN}?room=${encodeURIComponent(state.roomId)}`;

  try {
    await navigator.clipboard.writeText(link);
    showToast("تم نسخ الرابط");
  } catch {
    const input = document.createElement("input");
    input.value = link;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    document.body.removeChild(input);
    showToast("تم نسخ الرابط");
  }
}

async function onEditName() {
  const nextName = window.prompt("اكتب الاسم الجديد", state.profile.name)?.trim();
  if (!nextName) {
    return;
  }

  state.profile.name = nextName;
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(state.profile));

  refs.homeProfileName.textContent = state.profile.name;
  refs.roomProfileName.textContent = state.profile.name;

  if (state.roomId) {
    await setDoc(
      doc(state.db, `rooms/${state.roomId}/participants`, state.user.uid),
      {
        name: state.profile.name,
        lastSeen: Date.now()
      },
      { merge: true }
    );

    if (state.isHost) {
      await updateDoc(doc(state.db, "rooms", state.roomId), {
        hostName: state.profile.name
      }).catch(() => {});
    }
  }

  closeModal(refs.profileMenuModal);
  showToast("تم تعديل الاسم");
}

async function onChangeAvatar(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  try {
    const avatar = await convertImageFileToAvatar(file);
    state.profile.avatar = avatar;
    refs.profileAvatarPreview.src = avatar;
    refs.roomProfileAvatar.src = avatar;
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(state.profile));

    if (state.roomId) {
      await setDoc(
        doc(state.db, `rooms/${state.roomId}/participants`, state.user.uid),
        {
          avatar: avatar,
          lastSeen: Date.now()
        },
        { merge: true }
      );

      if (state.isHost) {
        await updateDoc(doc(state.db, "rooms", state.roomId), {
          hostAvatar: avatar
        }).catch(() => {});
      }
    }

    showToast("تم تغيير الصورة");
  } catch (error) {
    console.error(error);
    showToast("فشل تغيير الصورة");
  } finally {
    event.target.value = "";
    closeModal(refs.profileMenuModal);
  }
}

async function onLogout() {
  try {
    await leaveRoom({ keepHome: true });
    await signOut(state.auth);
  } catch (error) {
    console.error(error);
  }

  localStorage.removeItem(PROFILE_STORAGE_KEY);
  state.profile = { name: "", avatar: "" };

  refs.profileForm.reset();
  refs.profileAvatarPreview.src = "";
  refs.avatarHint.textContent = "لم يتم اختيار صورة بعد";
  refs.homeProfileName.textContent = "";
  refs.roomProfileName.textContent = "";

  await signInAnonymously(state.auth);
  state.user = state.auth.currentUser;
  showScreen("profile");
  closeModal(refs.profileMenuModal);
  showToast("تم تسجيل الخروج");
}

function openDrawer() {
  refs.sideDrawer.classList.add("open");
  refs.drawerOverlay.classList.remove("hidden");
}

function closeDrawer() {
  refs.sideDrawer.classList.remove("open");
  refs.drawerOverlay.classList.add("hidden");
}

function openModal(modal) {
  modal.classList.remove("hidden");
}

function closeModal(modal) {
  modal.classList.add("hidden");
}

function showScreen(name) {
  const target = refs.screens[name];
  if (!target) {
    return;
  }

  Object.values(refs.screens).forEach((screen) => screen.classList.remove("screen-active"));
  target.classList.add("screen-active");
}

function updateProgress(progressEl, textEl, value) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  progressEl.style.width = `${safeValue}%`;
  textEl.textContent = `${safeValue}%`;
}

function generateRoomId() {
  return Math.random().toString(36).slice(2, 10);
}

function setRoomInUrl(roomId) {
  const params = new URLSearchParams(window.location.search);
  params.set("room", roomId);
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}`;
  window.history.replaceState({}, "", url);
}

function clearRoomInUrl() {
  const params = new URLSearchParams(window.location.search);
  params.delete("room");
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}`;
  window.history.replaceState({}, "", url);
}

function showToast(text) {
  refs.toast.textContent = text;
  refs.toast.classList.add("show");
  setTimeout(() => refs.toast.classList.remove("show"), 2400);
}

function humanizeFirebaseError(error) {
  const code = error?.code || "";
  if (code.includes("permission-denied")) {
    return "الصلاحيات مرفوضة. راجع قواعد Firestore/Storage";
  }
  if (code === "storage/unauthorized") {
    return "رفع الفيديو مرفوض. تحقق من قواعد Firebase Storage";
  }
  if (code === "storage/invalid-default-bucket") {
    return "اسم storageBucket غير صحيح في إعدادات Firebase";
  }
  if (code === "auth/admin-restricted-operation") {
    return "Anonymous Auth غير مفعّل في Firebase Authentication";
  }
  if (code === "storage/retry-limit-exceeded") {
    return "انقطع رفع الفيديو. جرّب اتصال أقوى أو ملف أصغر";
  }
  if (code === "storage/canceled") {
    return "تم إلغاء رفع الفيديو";
  }
  if (code === "storage/unknown") {
    return "خطأ غير متوقع في التخزين. تحقق من bucket والقواعد";
  }
  if (code) {
    return `خطأ Firebase: ${code}`;
  }
  return "حدث خطأ غير متوقع";
}

function formatTime(inputSeconds) {
  const seconds = Math.max(0, Math.floor(inputSeconds || 0));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function convertImageFileToAvatar(file) {
  const fileDataUrl = await fileToDataUrl(file);
  const image = await loadImage(fileDataUrl);

  const maxSize = 180;
  const canvas = document.createElement("canvas");
  canvas.width = maxSize;
  canvas.height = maxSize;
  const ctx = canvas.getContext("2d");

  const minSide = Math.min(image.width, image.height);
  const sx = (image.width - minSide) / 2;
  const sy = (image.height - minSide) / 2;

  ctx.drawImage(image, sx, sy, minSide, minSide, 0, 0, maxSize, maxSize);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

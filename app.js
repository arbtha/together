import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  remove,
  push,
  onValue,
  onChildAdded,
  onDisconnect
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

const userConfig = {
  apiKey: "AIzaSyAcIwwapktH2nxyZczVKFacTrLh1o-EgdM",
  authDomain: "shakkak-8f90f.firebaseapp.com",
  projectId: "shakkak-8f90f",
  storageBucket: "shakkak-8f90f.firebasestorage.app",
  messagingSenderId: "1039276785290",
  appId: "1:1039276785290:web:ed874a451b37fb3210f773",
  measurementId: "G-QRH0Z1HM5R",
  databaseURL: "https://shakkak-8f90f-default-rtdb.firebaseio.com"
};

const APP_DOMAIN = "https://arbtha.github.io/together/";
const PROFILE_STORAGE_KEY = "together_watch_profile";
const PRESENCE_TIMEOUT_MS = 35_000;
const HEARTBEAT_MS = 10_000;
const OFFER_REQUEST_COOLDOWN_MS = 2_200;
const RTC_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

const state = {
  app: null,
  auth: null,
  db: null,
  user: null,
  profile: {
    name: "",
    avatar: ""
  },
  pendingRoomFromLink: null,
  roomId: null,
  roomData: null,
  isHost: false,
  participants: new Map(),
  roomVideos: [],
  localVideos: new Map(),
  uploadQueue: [],
  isUploadingQueue: false,
  switchTargetVideo: null,
  roomUnsubs: [],
  openRoomsUnsub: null,
  heartbeatInterval: null,
  presenceDisconnect: null,
  hostPeers: new Map(),
  viewerPeer: null,
  viewerHostUid: null,
  hostStream: null,
  lastOfferRequestAt: 0,
  hasRequestedInitialOffer: false
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
  showToast("فشل تشغيل التطبيق");
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
  state.db = getDatabase(state.app);
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
  refs.roomVideo.addEventListener("play", onVideoPlayStateChange);
  refs.roomVideo.addEventListener("pause", onVideoPlayStateChange);

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
      leaveRoom({ keepHome: true, goingOffline: true }).catch(() => {});
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
  }

  state.user = state.auth.currentUser;
  if (!state.user) {
    throw new Error("anonymous-auth-not-available");
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
    showToast("فعّل Anonymous Authentication في Firebase");
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

  refs.createRoomSubmitBtn.disabled = true;
  refs.initialUploadArea.classList.remove("hidden");
  refs.initialUploadFileName.textContent = firstVideo.name;
  updateProgress(refs.initialUploadBar, refs.initialUploadPercent, 0);

  try {
    const localVideo = await prepareLocalVideo(firstVideo, (percent) => {
      updateProgress(refs.initialUploadBar, refs.initialUploadPercent, percent);
    });

    state.localVideos.set(localVideo.id, localVideo);

    const roomId = generateRoomId();
    const now = Date.now();
    const meta = {
      id: roomId,
      name: roomName,
      hostUid: state.user.uid,
      hostName: state.profile.name,
      hostAvatar: state.profile.avatar,
      currentVideoId: localVideo.id,
      currentVideoTitle: localVideo.title,
      isOpen: true,
      viewerCount: 1,
      createdAt: now,
      updatedAt: now
    };

    const updates = {};
    updates[`rooms/${roomId}/meta`] = meta;
    updates[`rooms/${roomId}/videos/${localVideo.id}`] = buildVideoRecord(localVideo);
    updates[`publicRooms/${roomId}`] = buildPublicRoomRecord(meta);

    await update(ref(state.db), updates);
    await joinRoom(roomId, { preferredHostVideoId: localVideo.id });

    refs.createRoomForm.reset();
    refs.initialUploadArea.classList.add("hidden");
    showToast("تم إنشاء الغرفة");
  } catch (error) {
    console.error(error);
    showToast(humanizeFirebaseError(error));
  } finally {
    refs.createRoomSubmitBtn.disabled = false;
  }
}

async function joinRoom(roomId, { preferredHostVideoId = "" } = {}) {
  if (!roomId) {
    return;
  }

  if (state.roomId && state.roomId !== roomId) {
    await leaveRoom({ keepHome: true });
  }

  try {
    const metaSnap = await get(ref(state.db, `rooms/${roomId}/meta`));
    if (!metaSnap.exists()) {
      showToast("الغرفة غير موجودة");
      showScreen("home");
      clearRoomInUrl();
      return;
    }

    const meta = metaSnap.val();
    if (!meta.isOpen) {
      showToast("هذه الغرفة مغلقة");
      showScreen("home");
      clearRoomInUrl();
      return;
    }

    state.roomId = roomId;
    state.roomData = meta;
    state.isHost = meta.hostUid === state.user.uid;
    state.hasRequestedInitialOffer = false;

    await upsertParticipant(roomId, { initial: true });
    await setupPresenceDisconnect(roomId);
    subscribeRoomListeners(roomId);
    startHeartbeat(roomId);

    showScreen("room");
    setRoomInUrl(roomId);
    closeDrawer();
    closeModal(refs.participantsModal);
    closeModal(refs.profileMenuModal);

    refs.chatInput.value = "";
    refs.chatMessages.innerHTML = "";

    applyRoomHeader(meta);
    applyRoleBasedControls();

    if (state.isHost) {
      const targetVideoId = preferredHostVideoId || meta.currentVideoId;
      if (targetVideoId) {
        loadHostLocalVideo(targetVideoId, { autoPlay: false });
      }
    } else {
      enableViewerModeVideoElement();
      requestOfferFromCurrentHost();
    }
  } catch (error) {
    console.error(error);
    showToast(humanizeFirebaseError(error));
  }
}

async function leaveRoom({ keepHome = false, goingOffline = false } = {}) {
  if (!state.roomId) {
    if (!keepHome) {
      showScreen("home");
    }
    return;
  }

  const leavingRoomId = state.roomId;
  const wasHost = state.isHost;

  stopHeartbeat();
  cleanupRoomListeners();
  closeAllHostPeers();
  closeViewerPeer();

  if (state.presenceDisconnect) {
    try {
      await state.presenceDisconnect.cancel();
    } catch {
      // no-op
    }
    state.presenceDisconnect = null;
  }

  if (!goingOffline) {
    try {
      if (wasHost) {
        await transferHostOnLeave(leavingRoomId);
      }
      await remove(ref(state.db, `rooms/${leavingRoomId}/participants/${state.user.uid}`));
      await cleanupRoomIfEmpty(leavingRoomId);
    } catch (error) {
      console.error(error);
    }
  }

  state.roomId = null;
  state.roomData = null;
  state.isHost = false;
  state.participants.clear();
  state.roomVideos = [];
  state.uploadQueue = [];
  state.isUploadingQueue = false;
  state.switchTargetVideo = null;
  state.hostStream = null;
  state.lastOfferRequestAt = 0;

  refs.uploadQueueList.innerHTML = "";
  refs.videosList.innerHTML = "";
  refs.viewerCount.textContent = "0";
  refs.chatMessages.innerHTML = "";
  refs.currentVideoStatus.textContent = "لا يوجد";
  resetVideoElement();

  clearRoomInUrl();
  if (!keepHome) {
    showScreen("home");
  }
}

function subscribeRoomListeners(roomId) {
  cleanupRoomListeners();

  const roomMetaRef = ref(state.db, `rooms/${roomId}/meta`);
  const participantsRef = ref(state.db, `rooms/${roomId}/participants`);
  const chatRef = ref(state.db, `rooms/${roomId}/chat`);
  const videosRef = ref(state.db, `rooms/${roomId}/videos`);
  const signalsRef = ref(state.db, `rooms/${roomId}/signals/${state.user.uid}`);

  const unsubMeta = onValue(roomMetaRef, async (snapshot) => {
    if (!snapshot.exists()) {
      showToast("تم إغلاق الغرفة");
      await leaveRoom({ keepHome: true });
      showScreen("home");
      return;
    }

    const prevHostUid = state.roomData?.hostUid || "";
    const nextMeta = snapshot.val();
    const prevVideoId = state.roomData?.currentVideoId || "";

    state.roomData = nextMeta;
    const wasHost = state.isHost;
    state.isHost = nextMeta.hostUid === state.user.uid;

    applyRoomHeader(nextMeta);
    applyRoleBasedControls();
    refs.currentVideoStatus.textContent = nextMeta.currentVideoTitle || "لا يوجد";

    if (!wasHost && state.isHost) {
      startHostMode();
      await upsertParticipant(roomId, { initial: false });
    }

    if (wasHost && !state.isHost) {
      stopHostMode();
      enableViewerModeVideoElement();
      requestOfferFromCurrentHost();
    }

    if (prevHostUid !== nextMeta.hostUid && !state.isHost) {
      closeViewerPeer();
      requestOfferFromCurrentHost();
    }

    if (state.isHost && nextMeta.currentVideoId && nextMeta.currentVideoId !== prevVideoId) {
      loadHostLocalVideo(nextMeta.currentVideoId, { autoPlay: false });
    }
  });

  const unsubParticipants = onValue(participantsRef, async (snapshot) => {
    const raw = snapshot.val() || {};
    const now = Date.now();
    const map = new Map();

    for (const [uid, participant] of Object.entries(raw)) {
      if ((participant.lastSeen || 0) > now - PRESENCE_TIMEOUT_MS) {
        map.set(uid, participant);
      }
    }

    state.participants = map;
    refs.viewerCount.textContent = String(map.size);
    renderParticipants();

    if (state.roomData && !map.has(state.roomData.hostUid)) {
      await tryElectHostIfMissing();
    }

    if (state.isHost) {
      await syncViewerCount(map.size);
      reconcileHostPeers([...map.keys()].filter((uid) => uid !== state.user.uid));
    } else if (!state.hasRequestedInitialOffer) {
      requestOfferFromCurrentHost();
    }
  });

  const unsubChat = onValue(chatRef, (snapshot) => {
    const raw = snapshot.val() || {};
    const messages = Object.values(raw).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    refs.chatMessages.innerHTML = messages.map((message) => renderMessageHtml(message)).join("");
    refs.chatMessages.scrollTop = refs.chatMessages.scrollHeight;
  });

  const unsubVideos = onValue(videosRef, (snapshot) => {
    const raw = snapshot.val() || {};
    state.roomVideos = Object.entries(raw)
      .map(([id, payload]) => ({ id, ...payload }))
      .sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));

    renderVideosList();
  });

  const unsubSignals = onChildAdded(signalsRef, async (snapshot) => {
    const signal = snapshot.val();
    if (!signal) {
      return;
    }

    try {
      await handleSignal(signal);
    } catch (error) {
      console.error(error);
    } finally {
      remove(snapshot.ref).catch(() => {});
    }
  });

  state.roomUnsubs.push(unsubMeta, unsubParticipants, unsubChat, unsubVideos, unsubSignals);
}

function cleanupRoomListeners() {
  state.roomUnsubs.forEach((unsub) => {
    try {
      unsub();
    } catch {
      // no-op
    }
  });
  state.roomUnsubs = [];
}

async function setupPresenceDisconnect(roomId) {
  const participantRef = ref(state.db, `rooms/${roomId}/participants/${state.user.uid}`);
  state.presenceDisconnect = onDisconnect(participantRef);
  await state.presenceDisconnect.remove();
}

function startHeartbeat(roomId) {
  stopHeartbeat();
  state.heartbeatInterval = setInterval(() => {
    upsertParticipant(roomId).catch(() => {});
    if (state.isHost) {
      touchRoomActivity().catch(() => {});
    }
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

  const payload = {
    uid: state.user.uid,
    name: state.profile.name,
    avatar: state.profile.avatar,
    isHost: state.isHost,
    lastSeen: Date.now()
  };

  if (initial) {
    payload.joinedAt = Date.now();
  }

  await update(ref(state.db, `rooms/${roomId}/participants/${state.user.uid}`), payload);
}

function applyRoomHeader(roomData) {
  refs.roomTitle.textContent = roomData.name || "الغرفة";
  refs.roomProfileAvatar.src = state.profile.avatar;
  refs.roomProfileName.textContent = state.profile.name;

  if (state.isHost) {
    refs.hostBadge.textContent = "أنت مدير الغرفة";
  } else {
    refs.hostBadge.textContent = `المدير: ${roomData.hostName || "-"}`;
  }
}

function applyRoleBasedControls() {
  const hostControls = document.querySelectorAll(".control-host");
  hostControls.forEach((node) => {
    node.style.display = state.isHost ? "" : "none";
  });

  refs.playPauseBtn.style.display = state.isHost ? "inline-flex" : "none";
  refs.seekBackBtn.style.display = state.isHost ? "inline-flex" : "none";
  refs.seekForwardBtn.style.display = state.isHost ? "inline-flex" : "none";
}

function startHostMode() {
  closeViewerPeer();
  refs.currentVideoStatus.textContent = state.roomData?.currentVideoTitle || "لا يوجد";

  if (state.roomData?.currentVideoId) {
    loadHostLocalVideo(state.roomData.currentVideoId, { autoPlay: false });
  } else {
    resetVideoElement();
  }

  reconcileHostPeers([...state.participants.keys()].filter((uid) => uid !== state.user.uid));
}

function stopHostMode() {
  closeAllHostPeers();
  state.hostStream = null;
}

function resetVideoElement() {
  const video = refs.roomVideo;
  video.pause();
  if (video.srcObject) {
    video.srcObject = null;
  }
  video.removeAttribute("src");
  video.load();
  refs.playPauseBtn.textContent = "تشغيل";
  refs.seekRange.value = "0";
  updateTimeLabel();
}

function enableViewerModeVideoElement() {
  const video = refs.roomVideo;
  video.pause();
  if (video.src) {
    video.removeAttribute("src");
    video.load();
  }
  refs.playPauseBtn.textContent = "تشغيل";
}

function loadHostLocalVideo(videoId, { autoPlay = false } = {}) {
  if (!state.isHost) {
    return;
  }

  const localVideo = state.localVideos.get(videoId);
  if (!localVideo) {
    showToast("هذا الفيديو غير متاح على جهاز المدير الحالي");
    return;
  }

  const video = refs.roomVideo;
  video.pause();
  if (video.srcObject) {
    video.srcObject = null;
  }
  video.src = localVideo.url;
  video.load();

  refs.currentVideoStatus.textContent = localVideo.title;
  refs.playPauseBtn.textContent = "تشغيل";

  if (autoPlay) {
    video.play().catch(() => {
      showToast("اضغط تشغيل لبدء البث");
    });
  }
}

function onVideoLoadedMetadata() {
  updateTimeLabel();
  if (state.isHost) {
    ensureHostCaptureStream();
    renegotiateAllHostPeers();
  }
}

function onVideoPlayStateChange() {
  refs.playPauseBtn.textContent = refs.roomVideo.paused ? "تشغيل" : "إيقاف";
  if (state.isHost) {
    ensureHostCaptureStream();
    renegotiateAllHostPeers();
    touchRoomActivity().catch(() => {});
  }
}

function onVideoTimeUpdate() {
  updateTimeLabel();

  if (state.isHost && refs.roomVideo.duration && Number.isFinite(refs.roomVideo.duration)) {
    refs.seekRange.value = String((refs.roomVideo.currentTime / refs.roomVideo.duration) * 100);
  }
}

function updateTimeLabel() {
  const current = formatTime(refs.roomVideo.currentTime || 0);
  const duration = formatTime(refs.roomVideo.duration || 0);
  refs.timeLabel.textContent = `${current} / ${duration}`;
}

function onPlayPauseToggle() {
  if (!state.isHost) {
    showToast("التحكم للمدير فقط");
    return;
  }

  const video = refs.roomVideo;
  if (!video.src) {
    showToast("لا يوجد فيديو محلي جاهز");
    return;
  }

  if (video.paused) {
    video.play().catch(() => {
      showToast("تعذر تشغيل الفيديو");
    });
  } else {
    video.pause();
  }
}

function hostSeekBy(seconds) {
  if (!state.isHost) {
    return;
  }

  const video = refs.roomVideo;
  if (!Number.isFinite(video.currentTime)) {
    return;
  }

  video.currentTime = Math.max(0, video.currentTime + seconds);
}

function onHostSeekRangeInput(event) {
  if (!state.isHost) {
    return;
  }

  const video = refs.roomVideo;
  if (!video.duration || !Number.isFinite(video.duration)) {
    return;
  }

  const percent = Number(event.target.value || 0);
  video.currentTime = (percent / 100) * video.duration;
}

function openFullscreen() {
  const player = refs.roomVideo;

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
    await push(ref(state.db, `rooms/${state.roomId}/chat`), {
      uid: state.user.uid,
      name: state.profile.name,
      avatar: state.profile.avatar,
      text,
      createdAt: Date.now()
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

      const target = state.participants.get(targetUid);
      if (!target) {
        showToast("المشاهد غير متاح");
        return;
      }

      await assignHost(targetUid, target.name, target.avatar);
      showToast(`تم تعيين ${target.name} كمدير`);
    });
  });
}

async function assignHost(targetUid, targetName, targetAvatar) {
  if (!state.roomId) {
    return;
  }

  const updates = {};
  updates[`rooms/${state.roomId}/meta/hostUid`] = targetUid;
  updates[`rooms/${state.roomId}/meta/hostName`] = targetName;
  updates[`rooms/${state.roomId}/meta/hostAvatar`] = targetAvatar;
  updates[`rooms/${state.roomId}/meta/updatedAt`] = Date.now();
  updates[`rooms/${state.roomId}/participants/${targetUid}/isHost`] = true;
  updates[`rooms/${state.roomId}/participants/${state.user.uid}/isHost`] = false;
  updates[`publicRooms/${state.roomId}/hostUid`] = targetUid;
  updates[`publicRooms/${state.roomId}/hostName`] = targetName;
  updates[`publicRooms/${state.roomId}/hostAvatar`] = targetAvatar;
  updates[`publicRooms/${state.roomId}/updatedAt`] = Date.now();

  await update(ref(state.db), updates);
}

async function transferHostOnLeave(roomId) {
  const participantsSnap = await get(ref(state.db, `rooms/${roomId}/participants`));
  const raw = participantsSnap.val() || {};

  const candidates = Object.values(raw)
    .filter((participant) => participant.uid !== state.user.uid)
    .filter((participant) => (participant.lastSeen || 0) > Date.now() - PRESENCE_TIMEOUT_MS)
    .sort((a, b) => {
      const byJoin = (a.joinedAt || 0) - (b.joinedAt || 0);
      if (byJoin !== 0) {
        return byJoin;
      }
      return (a.lastSeen || 0) - (b.lastSeen || 0);
    });

  if (!candidates.length) {
    await remove(ref(state.db, `publicRooms/${roomId}`));
    await remove(ref(state.db, `rooms/${roomId}`));
    return;
  }

  const nextHost = candidates[0];
  const updates = {};
  updates[`rooms/${roomId}/meta/hostUid`] = nextHost.uid;
  updates[`rooms/${roomId}/meta/hostName`] = nextHost.name;
  updates[`rooms/${roomId}/meta/hostAvatar`] = nextHost.avatar;
  updates[`rooms/${roomId}/meta/updatedAt`] = Date.now();
  updates[`rooms/${roomId}/participants/${nextHost.uid}/isHost`] = true;
  updates[`publicRooms/${roomId}/hostUid`] = nextHost.uid;
  updates[`publicRooms/${roomId}/hostName`] = nextHost.name;
  updates[`publicRooms/${roomId}/hostAvatar`] = nextHost.avatar;
  updates[`publicRooms/${roomId}/updatedAt`] = Date.now();

  await update(ref(state.db), updates);
}

async function cleanupRoomIfEmpty(roomId) {
  const participantsSnap = await get(ref(state.db, `rooms/${roomId}/participants`));
  const raw = participantsSnap.val() || {};
  const active = Object.values(raw).filter((participant) => (participant.lastSeen || 0) > Date.now() - PRESENCE_TIMEOUT_MS);

  if (!active.length) {
    await remove(ref(state.db, `publicRooms/${roomId}`));
    await remove(ref(state.db, `rooms/${roomId}`));
  }
}

async function tryElectHostIfMissing() {
  if (!state.roomId || !state.roomData) {
    return;
  }

  if (state.participants.has(state.roomData.hostUid)) {
    return;
  }

  const sorted = [...state.participants.values()].sort((a, b) => {
    const byJoin = (a.joinedAt || 0) - (b.joinedAt || 0);
    if (byJoin !== 0) {
      return byJoin;
    }
    return (a.lastSeen || 0) - (b.lastSeen || 0);
  });

  if (!sorted.length) {
    return;
  }

  const shouldClaim = sorted[0].uid === state.user.uid;
  if (!shouldClaim) {
    return;
  }

  const me = sorted[0];
  const updates = {};
  updates[`rooms/${state.roomId}/meta/hostUid`] = me.uid;
  updates[`rooms/${state.roomId}/meta/hostName`] = me.name;
  updates[`rooms/${state.roomId}/meta/hostAvatar`] = me.avatar;
  updates[`rooms/${state.roomId}/meta/updatedAt`] = Date.now();
  updates[`rooms/${state.roomId}/participants/${me.uid}/isHost`] = true;
  updates[`publicRooms/${state.roomId}/hostUid`] = me.uid;
  updates[`publicRooms/${state.roomId}/hostName`] = me.name;
  updates[`publicRooms/${state.roomId}/hostAvatar`] = me.avatar;
  updates[`publicRooms/${state.roomId}/updatedAt`] = Date.now();

  await update(ref(state.db), updates);
}

async function syncViewerCount(count) {
  if (!state.roomId) {
    return;
  }

  const updates = {};
  updates[`rooms/${state.roomId}/meta/viewerCount`] = count;
  updates[`rooms/${state.roomId}/meta/updatedAt`] = Date.now();
  updates[`publicRooms/${state.roomId}/viewerCount`] = count;
  updates[`publicRooms/${state.roomId}/updatedAt`] = Date.now();

  await update(ref(state.db), updates);
}

async function touchRoomActivity() {
  if (!state.roomId) {
    return;
  }

  const now = Date.now();
  await update(ref(state.db), {
    [`rooms/${state.roomId}/meta/updatedAt`]: now,
    [`publicRooms/${state.roomId}/updatedAt`]: now
  });
}

async function onQueueVideosPicked(event) {
  if (!state.roomId) {
    return;
  }

  if (!state.isHost) {
    showToast("تحميل الفيديوهات متاح للمدير فقط");
    event.target.value = "";
    return;
  }

  const files = Array.from(event.target.files || []);
  if (!files.length) {
    return;
  }

  const items = files.map((file) => ({
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    file,
    progress: 0,
    status: "queued",
    title: file.name,
    error: ""
  }));

  state.uploadQueue.push(...items);
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
    const localVideo = await prepareLocalVideo(next.file, (percent) => {
      next.progress = percent;
      renderUploadQueue();
    });

    state.localVideos.set(localVideo.id, localVideo);

    await set(ref(state.db, `rooms/${state.roomId}/videos/${localVideo.id}`), buildVideoRecord(localVideo));

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

  refs.uploadQueueList.innerHTML = state.uploadQueue
    .map((item) => {
      const statusText =
        item.status === "done"
          ? "مكتمل"
          : item.status === "error"
            ? "خطأ"
            : `${Math.round(item.progress)}%`;

      return `
      <div class="queue-row">
        <div class="upload-header">
          <span>${escapeHtml(item.title)}</span>
          <span>${statusText}</span>
        </div>
        <div class="progress-track"><div class="progress-bar" style="width:${Math.round(item.progress)}%"></div></div>
        ${item.error ? `<small class="error-text">${escapeHtml(item.error)}</small>` : ""}
      </div>
    `;
    })
    .join("");
}

function renderVideosList() {
  if (!state.roomVideos.length) {
    refs.videosList.innerHTML = `<p class="empty">لا توجد فيديوهات مضافة</p>`;
    return;
  }

  refs.videosList.innerHTML = state.roomVideos
    .map((video) => {
      const isCurrent = state.roomData?.currentVideoId === video.id;
      const availableLocally = state.localVideos.has(video.id);

      let action = "";
      if (state.isHost) {
        if (availableLocally) {
          action = `<button data-video-id="${video.id}" class="btn btn-secondary show-video-btn">عرض</button>`;
        } else {
          action = `<button class="btn btn-ghost" disabled>غير متاح محلياً</button>`;
        }
      }

      return `
      <div class="video-row">
        <div>
          <strong>${escapeHtml(video.title || "فيديو")}</strong>
          <small>${isCurrent ? "قيد التشغيل الآن" : availableLocally ? "جاهز للعرض" : "موجود لدى مدير آخر"}</small>
        </div>
        ${action}
      </div>
    `;
    })
    .join("");

  refs.videosList.querySelectorAll(".show-video-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const videoId = button.getAttribute("data-video-id");
      const video = state.roomVideos.find((item) => item.id === videoId);
      if (!video) {
        return;
      }

      state.switchTargetVideo = video;
      refs.switchVideoText.textContent = `هل تريد عرض "${video.title}" الآن؟`;
      openModal(refs.switchVideoModal);
    });
  });
}

async function onConfirmSwitchVideo() {
  if (!state.roomId || !state.isHost || !state.switchTargetVideo) {
    return;
  }

  const target = state.switchTargetVideo;
  if (!state.localVideos.has(target.id)) {
    showToast("هذا الفيديو غير متاح على جهازك");
    closeModal(refs.switchVideoModal);
    state.switchTargetVideo = null;
    return;
  }

  try {
    const now = Date.now();
    const updates = {};
    updates[`rooms/${state.roomId}/meta/currentVideoId`] = target.id;
    updates[`rooms/${state.roomId}/meta/currentVideoTitle`] = target.title;
    updates[`rooms/${state.roomId}/meta/updatedAt`] = now;
    updates[`publicRooms/${state.roomId}/updatedAt`] = now;

    await update(ref(state.db), updates);

    loadHostLocalVideo(target.id, { autoPlay: true });
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

  state.openRoomsUnsub = onValue(ref(state.db, "publicRooms"), (snapshot) => {
    const raw = snapshot.val() || {};
    const rooms = Object.values(raw)
      .filter((room) => room.isOpen)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

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

async function copyRoomLink() {
  if (!state.roomId) {
    return;
  }

  const link = `${APP_DOMAIN}?room=${encodeURIComponent(state.roomId)}`;

  try {
    await navigator.clipboard.writeText(link);
    showToast("تم نسخ الرابط");
  } catch {
    const temp = document.createElement("input");
    temp.value = link;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand("copy");
    document.body.removeChild(temp);
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
    const updates = {};
    updates[`rooms/${state.roomId}/participants/${state.user.uid}/name`] = state.profile.name;
    updates[`rooms/${state.roomId}/participants/${state.user.uid}/lastSeen`] = Date.now();

    if (state.isHost) {
      updates[`rooms/${state.roomId}/meta/hostName`] = state.profile.name;
      updates[`publicRooms/${state.roomId}/hostName`] = state.profile.name;
      updates[`publicRooms/${state.roomId}/updatedAt`] = Date.now();
    }

    await update(ref(state.db), updates);
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
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(state.profile));

    refs.profileAvatarPreview.src = avatar;
    refs.roomProfileAvatar.src = avatar;

    if (state.roomId) {
      const updates = {};
      updates[`rooms/${state.roomId}/participants/${state.user.uid}/avatar`] = avatar;
      updates[`rooms/${state.roomId}/participants/${state.user.uid}/lastSeen`] = Date.now();

      if (state.isHost) {
        updates[`rooms/${state.roomId}/meta/hostAvatar`] = avatar;
        updates[`publicRooms/${state.roomId}/hostAvatar`] = avatar;
        updates[`publicRooms/${state.roomId}/updatedAt`] = Date.now();
      }

      await update(ref(state.db), updates);
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
  state.localVideos.forEach((video) => {
    URL.revokeObjectURL(video.url);
  });
  state.localVideos.clear();

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

async function prepareLocalVideo(file, onProgress) {
  onProgress?.(0);

  await fakeProgress(onProgress);

  const objectUrl = URL.createObjectURL(file);
  const duration = await probeVideoDuration(objectUrl);

  onProgress?.(100);

  return {
    id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: file.name,
    file,
    url: objectUrl,
    size: file.size,
    duration,
    addedAt: Date.now(),
    addedByUid: state.user.uid,
    addedByName: state.profile.name,
    availableHostUid: state.user.uid
  };
}

function buildVideoRecord(video) {
  return {
    title: video.title,
    size: video.size,
    duration: video.duration,
    addedAt: video.addedAt,
    addedByUid: video.addedByUid,
    addedByName: video.addedByName,
    availableHostUid: video.availableHostUid
  };
}

function buildPublicRoomRecord(meta) {
  return {
    id: meta.id,
    name: meta.name,
    hostUid: meta.hostUid,
    hostName: meta.hostName,
    hostAvatar: meta.hostAvatar,
    viewerCount: meta.viewerCount || 0,
    isOpen: meta.isOpen,
    updatedAt: meta.updatedAt || Date.now()
  };
}

async function fakeProgress(onProgress) {
  const steps = 18;
  for (let i = 1; i <= steps; i += 1) {
    await sleep(38);
    const value = Math.min(95, Math.round((i / steps) * 95));
    onProgress?.(value);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function probeVideoDuration(objectUrl) {
  return new Promise((resolve) => {
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.src = objectUrl;

    const done = (value) => {
      probe.removeAttribute("src");
      probe.load();
      resolve(value);
    };

    probe.onloadedmetadata = () => {
      done(Number.isFinite(probe.duration) ? probe.duration : 0);
    };
    probe.onerror = () => done(0);
  });
}

function ensureHostCaptureStream() {
  if (!state.isHost) {
    return null;
  }

  if (state.hostStream && state.hostStream.active) {
    return state.hostStream;
  }

  const video = refs.roomVideo;

  if (typeof video.captureStream === "function") {
    state.hostStream = video.captureStream();
  } else if (typeof video.webkitCaptureStream === "function") {
    state.hostStream = video.webkitCaptureStream();
  } else {
    showToast("المتصفح لا يدعم بث الفيديو المباشر من الصفحة");
    return null;
  }

  return state.hostStream;
}

function closeAllHostPeers() {
  for (const pc of state.hostPeers.values()) {
    try {
      pc.close();
    } catch {
      // no-op
    }
  }
  state.hostPeers.clear();
}

function closeViewerPeer() {
  if (state.viewerPeer) {
    try {
      state.viewerPeer.close();
    } catch {
      // no-op
    }
  }

  state.viewerPeer = null;
  state.viewerHostUid = null;

  if (!state.isHost) {
    const video = refs.roomVideo;
    if (video.srcObject) {
      video.srcObject = null;
    }
  }
}

function reconcileHostPeers(targetViewerUids) {
  if (!state.isHost) {
    return;
  }

  const setOfTargets = new Set(targetViewerUids);

  for (const [viewerUid, pc] of state.hostPeers.entries()) {
    if (!setOfTargets.has(viewerUid)) {
      try {
        pc.close();
      } catch {
        // no-op
      }
      state.hostPeers.delete(viewerUid);
    }
  }

  targetViewerUids.forEach((viewerUid) => {
    ensureHostPeer(viewerUid, { sendOffer: true }).catch((error) => {
      console.error(error);
    });
  });
}

async function ensureHostPeer(viewerUid, { sendOffer = false } = {}) {
  if (!state.roomId || !state.isHost || viewerUid === state.user.uid) {
    return;
  }

  let pc = state.hostPeers.get(viewerUid);

  if (!pc) {
    pc = new RTCPeerConnection(RTC_CONFIG);
    state.hostPeers.set(viewerUid, pc);

    pc.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }
      sendSignal(viewerUid, {
        type: "candidate",
        candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate
      }).catch(() => {});
    };

    pc.onconnectionstatechange = () => {
      const status = pc.connectionState;
      if (status === "failed" || status === "closed" || status === "disconnected") {
        try {
          pc.close();
        } catch {
          // no-op
        }
        state.hostPeers.delete(viewerUid);
      }
    };

    attachHostTracksToPeer(pc);
  }

  if (sendOffer && pc.signalingState === "stable") {
    await createAndSendOffer(viewerUid, pc);
  }
}

function attachHostTracksToPeer(pc) {
  const stream = ensureHostCaptureStream();
  if (!stream) {
    return;
  }

  const existingTrackIds = new Set(pc.getSenders().map((sender) => sender.track?.id).filter(Boolean));

  stream.getTracks().forEach((track) => {
    if (!existingTrackIds.has(track.id)) {
      pc.addTrack(track, stream);
    }
  });
}

async function renegotiateAllHostPeers() {
  if (!state.isHost) {
    return;
  }

  for (const [viewerUid, pc] of state.hostPeers.entries()) {
    if (pc.signalingState === "stable") {
      attachHostTracksToPeer(pc);
      await createAndSendOffer(viewerUid, pc).catch(() => {});
    }
  }
}

async function createAndSendOffer(targetUid, pc) {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await sendSignal(targetUid, {
    type: "offer",
    sdp: {
      type: offer.type,
      sdp: offer.sdp
    }
  });
}

function createViewerPeer(hostUid) {
  if (state.viewerPeer && state.viewerHostUid === hostUid) {
    return state.viewerPeer;
  }

  closeViewerPeer();

  const pc = new RTCPeerConnection(RTC_CONFIG);
  state.viewerPeer = pc;
  state.viewerHostUid = hostUid;

  pc.onicecandidate = (event) => {
    if (!event.candidate) {
      return;
    }

    sendSignal(hostUid, {
      type: "candidate",
      candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate
    }).catch(() => {});
  };

  pc.ontrack = (event) => {
    const [stream] = event.streams;
    if (!stream) {
      return;
    }

    const video = refs.roomVideo;
    if (video.src) {
      video.removeAttribute("src");
      video.load();
    }
    video.srcObject = stream;
    video.play().catch(() => {});
  };

  pc.onconnectionstatechange = () => {
    const status = pc.connectionState;
    if (status === "failed" || status === "disconnected" || status === "closed") {
      if (!state.isHost) {
        state.hasRequestedInitialOffer = false;
      }
    }
  };

  return pc;
}

async function handleSignal(signal) {
  if (!state.roomId) {
    return;
  }

  const fromUid = signal.from;
  if (!fromUid || fromUid === state.user.uid) {
    return;
  }

  if (signal.type === "request-offer") {
    if (state.isHost) {
      await ensureHostPeer(fromUid, { sendOffer: true });
    }
    return;
  }

  if (signal.type === "offer") {
    if (state.isHost) {
      return;
    }

    const pc = createViewerPeer(fromUid);

    if (pc.signalingState !== "stable") {
      closeViewerPeer();
      const fresh = createViewerPeer(fromUid);
      await fresh.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      const answer = await fresh.createAnswer();
      await fresh.setLocalDescription(answer);

      await sendSignal(fromUid, {
        type: "answer",
        sdp: {
          type: answer.type,
          sdp: answer.sdp
        }
      });

      state.hasRequestedInitialOffer = true;
      return;
    }

    await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await sendSignal(fromUid, {
      type: "answer",
      sdp: {
        type: answer.type,
        sdp: answer.sdp
      }
    });

    state.hasRequestedInitialOffer = true;
    return;
  }

  if (signal.type === "answer") {
    if (!state.isHost) {
      return;
    }

    const pc = state.hostPeers.get(fromUid);
    if (!pc) {
      return;
    }

    await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
    return;
  }

  if (signal.type === "candidate") {
    if (state.isHost) {
      const pc = state.hostPeers.get(fromUid);
      if (!pc) {
        return;
      }
      await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      return;
    }

    if (!state.viewerPeer || state.viewerHostUid !== fromUid) {
      return;
    }

    await state.viewerPeer.addIceCandidate(new RTCIceCandidate(signal.candidate));
  }
}

async function sendSignal(targetUid, payload) {
  if (!state.roomId || !targetUid) {
    return;
  }

  await push(ref(state.db, `rooms/${state.roomId}/signals/${targetUid}`), {
    ...payload,
    from: state.user.uid,
    ts: Date.now()
  });
}

function requestOfferFromCurrentHost() {
  if (!state.roomId || state.isHost || !state.roomData?.hostUid) {
    return;
  }

  const now = Date.now();
  if (now - state.lastOfferRequestAt < OFFER_REQUEST_COOLDOWN_MS) {
    return;
  }

  state.lastOfferRequestAt = now;
  sendSignal(state.roomData.hostUid, { type: "request-offer" }).catch(() => {});
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
  const safe = Math.max(0, Math.min(100, Math.round(value)));
  progressEl.style.width = `${safe}%`;
  textEl.textContent = `${safe}%`;
}

function generateRoomId() {
  return Math.random().toString(36).slice(2, 10);
}

function setRoomInUrl(roomId) {
  const params = new URLSearchParams(window.location.search);
  params.set("room", roomId);
  const query = params.toString();
  const next = `${window.location.pathname}${query ? `?${query}` : ""}`;
  window.history.replaceState({}, "", next);
}

function clearRoomInUrl() {
  const params = new URLSearchParams(window.location.search);
  params.delete("room");
  const query = params.toString();
  const next = `${window.location.pathname}${query ? `?${query}` : ""}`;
  window.history.replaceState({}, "", next);
}

function showToast(text) {
  refs.toast.textContent = text;
  refs.toast.classList.add("show");
  setTimeout(() => refs.toast.classList.remove("show"), 2400);
}

function humanizeFirebaseError(error) {
  const code = error?.code || "";
  const msg = String(error?.message || "").toLowerCase();

  if (code.includes("permission-denied")) {
    return "الصلاحيات مرفوضة. راجع قواعد Realtime Database";
  }
  if (code.includes("network-request-failed")) {
    return "مشكلة اتصال بالشبكة";
  }
  if (code.includes("auth/admin-restricted-operation")) {
    return "فعّل Anonymous Authentication في Firebase";
  }
  if (msg.includes("databaseurl") || msg.includes("database url")) {
    return "databaseURL غير صحيح. خذه من Firebase Console > Realtime Database";
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

  const size = 180;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  const minSide = Math.min(image.width, image.height);
  const sx = (image.width - minSide) / 2;
  const sy = (image.height - minSide) / 2;

  ctx.drawImage(image, sx, sy, minSide, minSide, 0, 0, size, size);
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

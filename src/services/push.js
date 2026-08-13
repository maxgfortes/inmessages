import { app, db } from "../../public/firebase-config.js";
import { authService } from "./auth.js";
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported,
} from "https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging.js";
import { doc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";

const VAPID_KEY = "BMpg2CcuEI_FYDIXS-SpiRT7B7FRMYe3LvTsBI9WGbGLA5OnuHNJSfVAxTQNuKnKrpp8r8bNxcRDiy3R68W6Vls";

function getDeviceId() {
  let id = localStorage.getItem("push_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("push_device_id", id);
  }
  return id;
}

let messagingInstance = null;

async function getMessagingSafe() {
  if (messagingInstance) return messagingInstance;
  if (!(await isSupported())) return null;
  messagingInstance = getMessaging(app);
  return messagingInstance;
}

export async function registerPushForCurrentUser() {
  try {
    const messaging = await getMessagingSafe();
    if (!messaging) return;

    if (Notification.permission === "denied") return;

    const permission =
      Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();

    if (permission !== "granted") return;

    const registration = await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) return;

    const uid = authService.currentUser?.uid;
    if (!uid) return;

    await updateDoc(doc(db, "users", uid), {
      fcmTokens: arrayUnion(token),
    });

    localStorage.setItem("push_token_" + getDeviceId(), token);
    onMessage(messaging, (payload) => {
      console.log("[push] mensagem em primeiro plano (ignorada na UI):", payload.data);
    });
  } catch (err) {
    console.warn("[push] falha ao registrar:", err);
  }
}

export async function unregisterPushForCurrentUser() {
  try {
    const uid = authService.currentUser?.uid;
    if (!uid) return;

    const savedToken = localStorage.getItem("push_token_" + getDeviceId());
    if (!savedToken) return;

    await updateDoc(doc(db, "users", uid), {
      fcmTokens: arrayRemove(savedToken),
    });

    localStorage.removeItem("push_token_" + getDeviceId());
  } catch (err) {
    console.warn("[push] falha ao remover token:", err);
  }
}
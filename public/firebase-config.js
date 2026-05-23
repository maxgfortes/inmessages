import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA9LsyhJbEY7zR2J8u-L6Mpd-Wh756YBcM",
  authDomain: "inmessages.firebaseapp.com",
  projectId: "inmessages",
  storageBucket: "inmessages.firebasestorage.app",
  messagingSenderId: "259201940965",
  appId: "1:259201940965:web:b82ae81257063e8594c30c"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

console.log("Firebase Firestore initialized successfully!");
import { auth, db } from "../../public/firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  arrayUnion,
  arrayRemove,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";

class AuthService {
  constructor() {
    this.currentUser = null;
    this.currentUserData = null;
  }

  async register(email, password, username, displayName) {
    try {
      const usernameRef = doc(db, 'usernames', username.toLowerCase());
      const usernameDoc = await getDoc(usernameRef);
      
      if (usernameDoc.exists()) {
        throw new Error('Username already taken');
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      await setDoc(doc(db, 'users', uid), {
        uid: uid,
        email: email,
        username: username.toLowerCase(),
        displayName: displayName,
        createdAt: serverTimestamp(),
        blocked: [],
        blockedBy: []
      });

      await setDoc(usernameRef, {
        uid: uid,
        createdAt: serverTimestamp()
      });

      this.currentUser = userCredential.user;
      this.currentUserData = {
        uid: uid,
        email: email,
        username: username.toLowerCase(),
        displayName: displayName,
        blocked: [],
        blockedBy: []
      };

      return { success: true, user: this.currentUser };
    } catch (error) {
      console.error('Register error:', error);
      return { success: false, error: error.message };
    }
  }

  async login(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      this.currentUser = userCredential.user;
      
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      this.currentUserData = userDoc.data();

      return { success: true, user: this.currentUser };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  }

  async logout() {
    try {
      await signOut(auth);
      this.currentUser = null;
      this.currentUserData = null;
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  }

  onAuthStateChanged(callback) {
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        this.currentUser = user;
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        this.currentUserData = userDoc.data();
      } else {
        this.currentUser = null;
        this.currentUserData = null;
      }
      callback(user);
    });
  }

  async getUserByUsername(username) {
    try {
      const usernameRef = doc(db, 'usernames', username.toLowerCase());
      const usernameDoc = await getDoc(usernameRef);
      
      if (!usernameDoc.exists()) return null;
      
      const uid = usernameDoc.data().uid;
      const userDoc = await getDoc(doc(db, 'users', uid));
      return userDoc.data();
    } catch (error) {
      console.error('Get user error:', error);
      return null;
    }
  }

  async blockUser(blockUsername) {
    try {
      const currentUid = this.currentUser.uid;
      const targetUser = await this.getUserByUsername(blockUsername);
      
      if (!targetUser) throw new Error('User not found');
      if (targetUser.uid === currentUid) throw new Error('Cannot block yourself');

      await updateDoc(doc(db, 'users', currentUid), {
        blocked: arrayUnion(targetUser.uid)
      });

      await updateDoc(doc(db, 'users', targetUser.uid), {
        blockedBy: arrayUnion(currentUid)
      });

      this.currentUserData.blocked.push(targetUser.uid);

      return { success: true };
    } catch (error) {
      console.error('Block user error:', error);
      return { success: false, error: error.message };
    }
  }

  async unblockUser(blockUsername) {
    try {
      const currentUid = this.currentUser.uid;
      const targetUser = await this.getUserByUsername(blockUsername);
      
      if (!targetUser) throw new Error('User not found');

      await updateDoc(doc(db, 'users', currentUid), {
        blocked: arrayRemove(targetUser.uid)
      });

      await updateDoc(doc(db, 'users', targetUser.uid), {
        blockedBy: arrayRemove(currentUid)
      });

      this.currentUserData.blocked = this.currentUserData.blocked.filter(id => id !== targetUser.uid);

      return { success: true };
    } catch (error) {
      console.error('Unblock user error:', error);
      return { success: false, error: error.message };
    }
  }

  isUserBlocked(uid) {
    return this.currentUserData && this.currentUserData.blocked.includes(uid);
  }

  isUserBlockingMe(uid) {
    return this.currentUserData && this.currentUserData.blockedBy.includes(uid);
  }
}

export const authService = new AuthService();

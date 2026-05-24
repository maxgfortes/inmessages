import { auth, db } from "../../public/firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import {
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
    this._isRegistering = false;
  }

  async register(email, password, username, displayName) {
    // Validate locally first
    const cleanUsername = username.toLowerCase().trim();
    const cleanDisplay = displayName.trim();

    if (!cleanUsername || cleanUsername.length < 1 || cleanUsername.length > 20) {
      return { success: false, error: 'Username must be between 1 and 20 characters' };
    }
    if (!/^[a-z0-9._]+$/.test(cleanUsername)) {
      return { success: false, error: 'Username can only have letters, numbers, dots and underscores' };
    }
    if (!cleanDisplay || cleanDisplay.length < 1 || cleanDisplay.length > 50) {
      return { success: false, error: 'Display name must be between 1 and 50 characters' };
    }
    if (password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' };
    }

    try {
      // Check username availability
      const usernameRef = doc(db, 'usernames', cleanUsername);
      const usernameSnap = await getDoc(usernameRef);
      if (usernameSnap.exists()) {
        return { success: false, error: 'Username already taken' };
      }

      // Pause auth listener
      this._isRegistering = true;

      // Create auth user
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const user = credential.user;
      const uid = user.uid;

      // Wait for token to be ready
      await user.getIdToken();

      // Write user doc
      await setDoc(doc(db, 'users', uid), {
        uid,
        email,
        username:    cleanUsername,
        displayName: cleanDisplay,
        createdAt:   serverTimestamp(),
        blocked:     [],
        blockedBy:   []
      });

      // Write username doc
      await setDoc(usernameRef, {
        uid,
        createdAt: serverTimestamp()
      });

      // Set local state
      this.currentUser = user;
      this.currentUserData = {
        uid,
        email,
        username:    cleanUsername,
        displayName: cleanDisplay,
        blocked:     [],
        blockedBy:   []
      };

      this._isRegistering = false;
      return { success: true };

    } catch (error) {
      this._isRegistering = false;
      console.error('Register error:', error);

      // Friendly error messages
      if (error.code === 'auth/email-already-in-use') {
        return { success: false, error: 'This email is already registered' };
      }
      if (error.code === 'auth/invalid-email') {
        return { success: false, error: 'Invalid email address' };
      }
      if (error.code === 'auth/weak-password') {
        return { success: false, error: 'Password is too weak' };
      }
      return { success: false, error: 'Failed to create account. Try again.' };
    }
  }

  async login(email, password) {
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      this.currentUser = credential.user;

      const userDoc = await getDoc(doc(db, 'users', credential.user.uid));
      this.currentUserData = userDoc.exists() ? userDoc.data() : null;

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        return { success: false, error: 'Invalid email or password' };
      }
      return { success: false, error: 'Failed to sign in. Try again.' };
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
      if (this._isRegistering) return;

      if (user) {
        this.currentUser = user;
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        this.currentUserData = userDoc.exists() ? userDoc.data() : null;
      } else {
        this.currentUser = null;
        this.currentUserData = null;
      }
      callback(user);
    });
  }

  async getUserByUsername(username) {
    try {
      const usernameSnap = await getDoc(doc(db, 'usernames', username.toLowerCase()));
      if (!usernameSnap.exists()) return null;

      const uid = usernameSnap.data().uid;
      const userSnap = await getDoc(doc(db, 'users', uid));
      return userSnap.exists() ? userSnap.data() : null;
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

      await updateDoc(doc(db, 'users', currentUid), { blocked: arrayUnion(targetUser.uid) });
      await updateDoc(doc(db, 'users', targetUser.uid), { blockedBy: arrayUnion(currentUid) });

      this.currentUserData.blocked.push(targetUser.uid);
      return { success: true };
    } catch (error) {
      console.error('Block error:', error);
      return { success: false, error: error.message };
    }
  }

  async unblockUser(blockUsername) {
    try {
      const currentUid = this.currentUser.uid;
      const targetUser = await this.getUserByUsername(blockUsername);

      if (!targetUser) throw new Error('User not found');

      await updateDoc(doc(db, 'users', currentUid), { blocked: arrayRemove(targetUser.uid) });
      await updateDoc(doc(db, 'users', targetUser.uid), { blockedBy: arrayRemove(currentUid) });

      this.currentUserData.blocked = this.currentUserData.blocked.filter(id => id !== targetUser.uid);
      return { success: true };
    } catch (error) {
      console.error('Unblock error:', error);
      return { success: false, error: error.message };
    }
  }

  isUserBlocked(uid) {
    return this.currentUserData?.blocked?.includes(uid) ?? false;
  }

  isUserBlockingMe(uid) {
    return this.currentUserData?.blockedBy?.includes(uid) ?? false;
  }
}

export const authService = new AuthService();
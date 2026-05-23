import { auth, db } from "../../public/firebase-config.js";
import { authService } from "./auth.js";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  deleteField
} from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";

class MessagesService {
  constructor() {
    this.conversations = {};
    this.unsubscribes = [];
  }

  async createOrGetConversation(otherUsername) {
    try {
      const currentUid = authService.currentUser.uid;
      const otherUser = await authService.getUserByUsername(otherUsername);

      if (!otherUser) {
        throw new Error('User not found');
      }

      const otherUid = otherUser.uid;

      if (authService.isUserBlocked(otherUid) || authService.isUserBlockingMe(otherUid)) {
        throw new Error('Cannot message this user');
      }

      const conversationId = [currentUid, otherUid].sort().join('_');

      const convDoc = await getDoc(doc(db, 'conversations', conversationId));
      
      if (!convDoc.exists()) {
        await setDoc(doc(db, 'conversations', conversationId), {
          participants: [currentUid, otherUid],
          participantsData: {
            [currentUid]: authService.currentUserData,
            [otherUid]: otherUser
          },
          lastMessage: null,
          lastMessageTime: serverTimestamp(),
          createdAt: serverTimestamp()
        });
      }

      return { success: true, conversationId, otherUser };
    } catch (error) {
      console.error('Create conversation error:', error);
      return { success: false, error: error.message };
    }
  }

  async sendMessage(conversationId, text, replyTo = null) {
    try {
      const currentUid = authService.currentUser.uid;

      const messageData = {
        sender: currentUid,
        senderData: authService.currentUserData,
        text: text,
        timestamp: serverTimestamp(),
        read: false,
        replyTo: replyTo
      };
      const messageRef = await addDoc(
        collection(db, 'conversations', conversationId, 'messages'),
        messageData
      );

      await updateDoc(doc(db, 'conversations', conversationId), {
        lastMessage: text,
        lastMessageTime: serverTimestamp()
      });

      return { success: true, messageId: messageRef.id };
    } catch (error) {
      console.error('Send message error:', error);
      return { success: false, error: error.message };
    }
  }

  listenToMessages(conversationId, callback) {
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = [];
      snapshot.forEach((doc) => {
        messages.push({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate()
        });
      });
      callback(messages);
    }, (error) => {
      console.error('Listen messages error:', error);
    });

    this.unsubscribes.push(unsubscribe);
    return unsubscribe;
  }

  async setTyping(conversationId, isTyping) {
    try {
      const currentUid = authService.currentUser.uid;
      const typingKey = `typing_${currentUid}`;

      if (isTyping) {
        await updateDoc(doc(db, 'conversations', conversationId), {
          [typingKey]: serverTimestamp()
        });
      } else {
        await updateDoc(doc(db, 'conversations', conversationId), {
          [typingKey]: deleteField()
        });
      }
    } catch (error) {
      console.error('Set typing error:', error);
    }
  }

  listenToTyping(conversationId, otherUid, callback) {
    const unsubscribe = onSnapshot(doc(db, 'conversations', conversationId), (doc) => {
      const data = doc.data() || {};
      const typingKey = `typing_${otherUid}`;
      const isTyping = data[typingKey] ? true : false;
      callback(isTyping);
    }, (error) => {
      console.error('Listen typing error:', error);
    });

    this.unsubscribes.push(unsubscribe);
    return unsubscribe;
  }

  // Get conversations list
  listenToConversations(callback) {
    const currentUid = authService.currentUser.uid;
    const conversationsRef = collection(db, 'conversations');
    const q = query(
      conversationsRef,
      where('participants', 'array-contains', currentUid),
      orderBy('lastMessageTime', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const conversations = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const otherUid = data.participants.find(id => id !== currentUid);
        conversations.push({
          id: doc.id,
          otherUser: data.participantsData[otherUid],
          lastMessage: data.lastMessage,
          lastMessageTime: data.lastMessageTime?.toDate(),
          ...data
        });
      });
      callback(conversations);
    }, (error) => {
      console.error('Listen conversations error:', error);
    });

    this.unsubscribes.push(unsubscribe);
    return unsubscribe;
  }

  async markAsRead(conversationId, messageId) {
    try {
      await updateDoc(
        doc(db, 'conversations', conversationId, 'messages', messageId),
        {
          read: true
        }
      );
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  }
  unsubscribeAll() {
    this.unsubscribes.forEach(unsubscribe => unsubscribe());
    this.unsubscribes = [];
  }
}

export const messagesService = new MessagesService();

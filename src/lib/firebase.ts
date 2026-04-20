import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use experimentalForceLongPolling to resolve connection timeouts in sandboxed environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId || '(default)');

export const dbDefault = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, '(default)');

/**
 * Interface and handler for rich Firestore error reporting.
 */
export interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    providerInfo: any[] | undefined;
  };
}

export function handleFirestoreError(error: any, operation: FirestoreErrorInfo['operationType'], path: string | null = null): never {
  if (error.code === 'permission-denied' || error.code === 'resource-exhausted') {
    const errorInfo: FirestoreErrorInfo = {
      error: error.code === 'resource-exhausted' 
        ? 'Quota Limit Exceeded: Firestore free tier write units exhausted for today. Please try again tomorrow or upgrade your plan.' 
        : error.message,
      operationType: operation,
      path: path,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        providerInfo: auth.currentUser?.providerData,
      },
    };
    throw new Error(JSON.stringify(errorInfo));
  }
  throw error;
}

export let connectionStatus: 'loading' | 'online' | 'offline' | 'restricted' = 'loading';

// CRITICAL CONSTRAINT: Test connection on boot
export async function testFirebaseConnection() {
  try {
    const docRef = doc(db, 'test', 'connection');
    await getDocFromServer(docRef);
    console.log('Firebase: connection verified (Online)');
    connectionStatus = 'online';
    return 'online';
  } catch (error: any) {
    if (error.message && error.message.includes('the client is offline')) {
      console.error("Firebase: Client is offline.");
      connectionStatus = 'offline';
      return 'offline';
    } else if (error.code === 'permission-denied') {
      console.warn("Firebase: restricted (Permission Denied). This is normal if document is protected.");
      connectionStatus = 'restricted';
      return 'restricted';
    } else {
      console.error("Firebase: connection error:", error.code, error.message);
      connectionStatus = 'offline';
      return 'offline';
    }
  }
}

testFirebaseConnection();

import { initializeApp }  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, enableIndexedDbPersistence }
                          from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage }     from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);

export const db      = getFirestore(app);
export const storage = getStorage(app);
export const auth    = getAuth(app);

enableIndexedDbPersistence(db).catch(() => {});

export default app;

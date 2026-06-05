import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDsGPw7v36WMsA7UUciebuxC5zrF0tGcyU",
  authDomain: "test-eat-ffb8a.firebaseapp.com",
  projectId: "test-eat-ffb8a",
  storageBucket: "test-eat-ffb8a.firebasestorage.app",
  messagingSenderId: "82713357778",
  appId: "1:82713357778:web:41c760378bf868ec34ac0b"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
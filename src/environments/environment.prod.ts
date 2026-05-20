/**
 * ENVIRONMENT CONFIG - TapHoa39KeToan
 * Production Environment
 */
export const environment = {
  production: true,
  firebaseConfig: {
    apiKey: "AIzaSyBJ2dpIxA0th0HXp1r5UasWEjcf5TlIfp4",
    authDomain: "songminhketoan-15041989.firebaseapp.com",
    projectId: "songminhketoan-15041989",
    storageBucket: "songminhketoan-15041989.firebasestorage.app",
    messagingSenderId: "343799939126",
    appId: "1:343799939126:web:ebe361ff99b03eb268d897",
    measurementId: "G-NJ3ZPEZ260"
  }, 
  firebaseGmail: {
    apiKey: "AIzaSyD6BQL55uF9zGLG0daKiZln8knS8_BoXS8",
    authDomain: "quanlysongminh.firebaseapp.com",
    projectId: "quanlysongminh",
    storageBucket: "quanlysongminh.firebasestorage.app",
    messagingSenderId: "245620111851",
    appId: "1:245620111851:web:110acf5f993691c14f81ae",
    measurementId: "G-Y0FXR6CW04"
  },
  domainUrl: 'https://songminhketoanbackend.onrender.com',  // Production API
  apiUrl: 'https://api.taphoa39.com/api',  // Backend API base URL (HDDT proxy)
  ketoanBackendUrl: 'https://songminhketoanbackend.onrender.com',  // KeToan FastAPI BE
  appName: 'Kế Toán Doanh Nghiệp',
  version: '1.0.0'
};

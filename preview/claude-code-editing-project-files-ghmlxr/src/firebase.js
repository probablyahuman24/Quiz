npm install firebase
// Import the functions you need from the SDKs you need 
import { initializeApp } from "firebase/app"; 
// TODO: Add SDKs for Firebase products that you want to use 
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration 
const firebaseConfig = { 
apiKey: "AIzaSyAfamSetZvn7D1eylX07uZo8tOpB8pB4M4", 
authDomain: "rcdd-quiz.firebaseapp.com", 
projectId: "rcdd-quiz", 
storageBucket: "rcdd-quiz.firebasestorage.app", 
messagingSenderId: "310905770336", 
appId: "1:310905770336:web:3b8eec2bc9475a86874e05" 
};

// Initialize Firebase 
const app = initializeApp(firebaseConfig);

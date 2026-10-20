# Pedal Pulse 🚲

Welcome to **Pedal Pulse**, the ultimate group cycling tracking application!

## 📥 Download the App (Android APK)

You can download the latest Android build representing the current state of the application from the Expo Dashboard:
👉 **[Download Android APK Here](https://expo.dev/accounts/sriram731/projects/pedal-pulse/builds/cccecf64-de13-4df0-825e-adb16fb4a350)**

*(Note: If the link shows the build is still processing, please give it a few minutes to complete before downloading.)*

---

## 🚀 How to Use Pedal Pulse

Pedal Pulse is designed to make group rides safer, more engaging, and easier to track.

### 1. Getting Started
- **Sign Up / Login:** Launch the app and sign in. You can use any email to sign up. 
- **Location Permissions:** The app requires location permissions to track your ride and share it with your group in real-time. Please grant "Allow all the time" for the best experience.

### 2. Joining or Creating a Community
- Navigate to the **Community Tab**.
- Here you can browse existing cycling communities, view events, and join group rides.
- Once you join a community, you can access community-specific leaderboards and chats.

### 3. Starting a Group Ride
- Go to the **Ride Tab** and tap **Create Group** to start a new ride.
- Share the group link or have friends join directly from the community page.
- Once the ride starts, all participants' locations will be synchronized live on the map.

### 4. Interactive Navigation & Maps
- The **Map Tab** shows a 3D-enabled map using MapLibre.
- You can freely rotate (two-finger drag) and tilt (two-finger swipe up/down) the map.
- Fellow riders' locations update in real-time, preventing anyone from getting lost!

### 5. Chat & Communication
- Use the built-in real-time **Chat Platform** to communicate with your group or community.
- The chat syncs across devices instantly and supports typing indicators and read receipts.

### 6. Safety Features
- **Crash Detection:** Uses your phone's accelerometer to detect falls. If detected, an emergency overlay appears with a loud alarm. If not dismissed, it will alert your emergency contacts.

---

## 🛠️ Tech Stack & Architecture

- **Frontend:** React Native (Expo) & Zustand (State Management)
- **Backend/Database:** Supabase (PostgreSQL, Realtime, Edge Functions)
- **Maps:** MapLibre GL
- **Geospatial Processing:** PostGIS & Turf.js

For backend setup instructions, please refer to the `DEPLOYMENT.md` file.

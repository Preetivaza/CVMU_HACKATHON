# 🖥️ RDD Frontend Implementation Guide

This guide is for the Frontend Developer building the UI (Dashboard, Maps, Analytics, Login) for the Road Damage Detection platform. It covers practical API usage, authentication handling, and business rules.

## 1. Authentication (The First Step)

All user-facing APIs (except login and register) are **protected** and require a JSON Web Token (JWT).

### 1.1 Logging In
* **Endpoint:** `POST /api/auth/login`
* **Body:** `{ "email": "admin@rdd.test", "password": "password123" }`
* **Flow:**
  1. User enters credentials.
  2. Send POST request.
  3. On HTTP 200, you will receive a `token` (JWT string) and a `user` object.
  4. **Action:** Save the `token` in `localStorage`, `sessionStorage`, or an HTTP-only cookie. Save the `user` object to your global state (Zustand, Redux, Context).

### 1.2 Attaching the Token
For every subsequent API request (e.g., getting clusters, map data, areas), you **must** append this token as an Authorization header.

**Axios Interceptor Example:**
```javascript
import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:3000/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token'); // Retrieve stored token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

### 1.3 Handling Expiry (401 Unauthorized)
Tokens expire. If the backend returns a `401 Unauthorized` with the message `"Token has expired"` or `"No token provided"`, your frontend should intercept this, clear the `localStorage` token, and immediately redirect the user to the `/login` screen.

---

## 2. Interactive Map Implementation

The map is the heart of the application. The backend provides a special **zoom-aware** endpoint to keep rendering fast.

### 2.1 The Map Data Endpoint
* **Endpoint:** `GET /api/v1/map-data`
* **Triggers:** Fetch this every time the user pans the map OR changes the zoom level.

You must pass the bounding box of the user's current screen and their integer zoom level:
```javascript
// Triggered on Map 'moveend' event
const bounds = map.getBounds();
const { data } = await api.get('/v1/map-data', {
  params: {
    zoom: map.getZoom(),                  // e.g., 10, 13, 16
    min_lon: bounds.getWest(),
    max_lon: bounds.getEast(),
    min_lat: bounds.getSouth(),
    max_lat: bounds.getNorth(),
  }
});
```

### 2.2 Handling the Response (`display_mode`)
The API decides what to show based on the zoom level:

* **Zoom ≤ 12 (City Level):** `display_mode: 'heatmap'` -> Render the `layers.heatmap` Features as coloured grid cell polygons.
* **Zoom 13 - 15 (Neighborhood):** `display_mode: 'clusters'` -> Render `layers.clusters` Features as circles. Use `properties.risk_level` to color them (Critical = Red, High = Orange, Medium = Yellow).
* **Zoom ≥ 16 (Street Level):** `display_mode: 'points'` -> Render `layers.points` Features as tiny individual dots mapping the exact pothole locations, while keeping `layers.clusters` visible for context.

---

## 3. Analytics & Dashboard

Use the analytics endpoints to populate the charts.

### 3.1 Monthly Trend Line Chart
* **Endpoint:** `GET /api/v1/analytics/monthly-trend?months=6`
* Returns an array of monthly data. Perfect for a Recharts `<LineChart />` or BarChart showing pothole creation vs repairs over time.

### 3.2 High Priority List
* **Endpoint:** `GET /api/v1/analytics/priority-ranking?limit=5`
* Returns the most critical, un-repaired clusters. Put this in a "To-Do" table on the right side of the dashboard. When a user clicks a row, fly the map to the coordinates of that cluster.

---

## 4. Work Order Details (Cluster Flyout)

When a user clicks a cluster circle on the map or an item in the Priority list, open a side-panel.

1. **Fetch details:** `GET /api/v1/clusters/:id`
2. **Display Data:** Show the `avg_severity`, `aging_index`, and `damage_types`.
3. **Dispatch a Repair:** Build a status dropdown (`pending`, `in_progress`, `repaired`).
4. **Submit Update:** When the user changes status to `repaired`:
   ```javascript
   await api.patch(`/v1/clusters/${clusterId}`, {
     status: 'repaired',
     notes: 'Filled pothole with fresh asphalt.'
   });
   ```
   *Note: Updating status to `repaired` automatically tells the ML Service to zero out the risk score.*

---

## 5. Video Uploads

If the user wants to upload fresh dashcam footage:
* **Endpoint:** `POST /api/upload/video`
* **Important:** This is a file upload. Set your header to `Content-Type: multipart/form-data`.
* **Flow:** Attach the `.mp4` file to a `FormData` object under the key `video`.

---

## Summary of Typical Frontend Flow

1. User arrives at `/login`.
2. Enter credentials -> success -> save token -> Redirect to `/dashboard`.
3. Dashboard loads.
4. Issue parallel requests: User Profile (`/api/auth/me`), Priority List (`/api/v1/analytics/priority-ranking`), Monthly Trend (`/api/v1/analytics/monthly-trend`).
5. Map component mounts. Reads initial bounds -> Calls `/api/v1/map-data` -> Renders initial heatmap.
6. User zooms in -> new Map Data request -> Renders cluster circles.
7. User clicks a cluster -> opens side panel. Changes repair status to "in_progress". Updates database via `PATCH`.
8. Dashboard live re-fetches or manually updates local state.

# LivAround Worker App — Feature Summary

## Overview

The LivAround Worker App is a React Native (Expo) mobile application for service workers who manage jobs at hospitality properties. Workers can receive and claim jobs, communicate with hosts and guests, track their work with checklists and media, and manage their availability — all with real-time updates, AI-powered message analysis, multilingual voice transcription and translation, and multi-language support.

**Tech stack:** Expo (React Native), Expo Router, Socket.IO, TypeScript

---

## 1. Authentication

- Email and password login
- Role-based access control (only users with the WORKER role can access the app)
- JWT token stored securely via Expo Secure Store
- Automatic push notification registration and location tracking on login
- Language toggle (English / Hindi) on the login screen

**Screen:** `app/(auth)/login.tsx`

---

## 2. Jobs Management

The Jobs tab is the primary screen with two sub-tabs:

### My Jobs
- Lists the worker's active jobs filtered by status: DISPATCHED, ACCEPTED, IN_PROGRESS
- Each job card shows: job type icon, property name, city, status badge, scheduled date/time, and guest name

### Available Jobs
- Lists open/unassigned jobs the worker can claim
- "Claim Job" button to take ownership of a pending job

### Job Types
| Type | Icon |
|------|------|
| Cleaning | Broom |
| Cooking | Pan |
| Driving | Car |
| Maintenance | Wrench |

### Job Status Flow
```
PENDING → DISPATCHED → ACCEPTED → IN_PROGRESS → COMPLETED
                                                 CANCELLED
```

- **PENDING:** Unassigned, available for worker to claim
- **DISPATCHED:** Assigned to a specific worker by the host
- **ACCEPTED:** Worker accepted the dispatched job
- **IN_PROGRESS:** Work has started
- **COMPLETED:** Work finished (with optional photo/video proof)
- **CANCELLED:** Job was cancelled

Pull-to-refresh is supported on both tabs.

**Screen:** `app/(tabs)/index.tsx`

---

## 3. Job Detail & Actions

Tapping a job opens the detail screen with contextual actions based on the current status:

- **DISPATCHED →** "Accept Job" button
- **ACCEPTED →** "Start Job" button
- **IN_PROGRESS →** "Mark Complete" button (with checklist validation)

### Information Displayed
- Job title, type icon, and property name
- Scheduled date and time
- Guest name, check-in/check-out dates
- Custom notes from the host

### Property Briefing (shown after job is accepted)
- Property address
- Wi-Fi network name and password
- Door/lock code

### Checklist
- Interactive toggle for each checklist item
- Progress bar showing completion (e.g. "3/5")
- Warning alert if the worker attempts to complete the job with unchecked items

### Report Issue
- Available for ACCEPTED and IN_PROGRESS jobs
- Navigates to the dedicated issue reporting screen

**Screen:** `app/job/[id].tsx`

---

## 4. Issue Reporting

Workers can report problems encountered during a job.

- **Severity levels:** Low, Medium, High (color-coded)
- **Description:** Free-text input with voice-to-text support (English and Hindi)
- **Media attachments:**
  - Take photos with camera
  - Select photos from library (multi-select)
  - Record video (up to 60 seconds)
  - Select video from library
  - Thumbnail previews with remove buttons
- Upload progress indicator
- Success confirmation via toast notification

**Screen:** `app/job/[id]/issue.tsx`

---

## 5. Job Completion

When marking a job complete, the worker can attach proof-of-work media:

- Take a completion photo or record a video (up to 60 seconds)
- Photo/video preview with remove option
- Media upload progress tracking
- Success dialog with navigation back to the jobs list

**Screen:** `app/job/[id]/complete.tsx`

---

## 6. Properties

Lists all properties the worker is assigned to as staff.

- Property cards show: type icon (Villa, Apartment, House, Hotel), name, city, address, and staff role badge
- **"Start New Job" button** per property opens a modal to self-start a job:
  - Select job type (Cleaning, Cooking, Driving, Maintenance)
  - Add optional notes
  - Submit creates and navigates directly to the new job detail
- Pull-to-refresh and empty state messaging

**Screen:** `app/(tabs)/properties.tsx`

---

## 7. Messages

The Messages tab shows all conversations sorted by most recent activity.

### Conversation Types
- **Guest conversations** — with guests staying at properties
- **Internal conversations** — with hosts and supervisors

### Conversation List Features
- Sender name with "Guest" / "Host" / "Supervisor" badge (color-coded)
- Last message preview text
- Relative timestamps (now, Xm, Xh, Xd)
- Property name
- Unread message count badge with visual highlight

### New Conversation
- Floating action button with options:
  - "Message Host"
  - "Message Guest" (with guest picker modal if multiple active guests)

- Auto-refresh every 30 seconds
- Empty state messaging

**Screen:** `app/(tabs)/messages.tsx`

---

## 8. Chat / Conversation Detail

Full-featured chat screen supporting multiple message types:

### Message Types
- **Text** — standard text messages
- **Images/Photos** — inline media display
- **Videos** — inline video player with controls
- **Voice messages** — press-and-hold to record, waveform visualization, play/pause, duration display
- **AI suggestions** — read-only cards with category, urgency level, and summary (see [Section 13: AI-Powered Features](#13-ai-powered-features))
- **System messages** — automated notifications

### Voice Features
- Press-and-hold microphone button to record
- Real-time waveform and duration display during recording
- Playback with waveform visualization
- Automatic voice-to-text transcription (English and Hindi)
- Translation display

### Conversation Visibility Toggle (guest conversations)
- **"Everyone"** mode — messages visible to the guest
- **"Team only"** mode — internal notes hidden from the guest
- Color-coded input area to indicate current mode

### Message Metadata
- Sender name and role badge (Host, Guest, Supervisor, You)
- Timestamps (HH:MM)
- Team-only indicator badge
- Read status marking

### Input Bar
- Multi-line text input (2000 character limit)
- Camera and gallery buttons for media sharing
- Microphone button for voice messages
- Send button (disabled when empty)

Real-time message delivery via Socket.IO with auto-scroll to the latest message.

**Screen:** `app/conversation/[id].tsx`

---

## 9. Profile

### User Information
- Avatar with initials
- Full name, email, and phone number

### Statistics
- Jobs completed count
- Star rating (to 1 decimal place)

### Availability Toggle
- Switch between "Available" and "Not Available"
- Controls whether the worker receives new job dispatches

### Skills
- Displayed as badges: Cleaning, Cooking, Driving, Maintenance

### Language Selection
- English and Hindi buttons with visual indicator for the active language

### Job History
- List of completed and cancelled jobs
- Each entry shows: job type icon, property name, job type, date, and status badge

### Sign Out
- Confirmation dialog before logging out
- Clears token and returns to login screen

**Screen:** `app/(tabs)/profile.tsx`

---

## 10. Background Services

### Location Tracking
- Background location tracking via Expo Task Manager
- Updates every 15 seconds or 10 meters of movement
- Foreground and background permission requests
- Persistent Android notification: "Location tracking is active"
- Location sent to backend API (`POST /api/workers/me/location`)

**File:** `src/lib/location.ts`

### Push Notifications
- Expo Push Notifications with EAS integration
- Android notification channel with max importance, vibration, and lock-screen visibility
- Push token registered on login and app startup
- In-app foreground notification banner (auto-dismiss after 6 seconds)
- Tap notification to navigate to the relevant job

**File:** `src/lib/notifications.ts`

### Real-Time Communication (Socket.IO)
- WebSocket connection with polling fallback
- Automatic infinite reconnection
- Events: `new_message`, `voice_translated`, conversation join/leave
- JWT-authenticated socket connection

**File:** `src/lib/socket.ts`

---

## 11. Internationalization (i18n)

- Two supported languages: English (`en`) and Hindi (`hi`)
- 162+ translated strings covering all screens
- Language preference persisted to AsyncStorage
- Global listener pattern for instant language switching across the app
- Voice input supports both English and Hindi locale codes

**File:** `src/lib/i18n.ts`

---

## 12. API Integration

Centralized REST API client with Bearer token authentication.

| Area | Key Endpoints |
|------|--------------|
| Auth | `POST /api/auth/login`, `GET /api/auth/me` |
| Jobs | `GET /api/jobs`, `GET /api/jobs/available`, `POST /api/jobs/self-start`, `POST /api/jobs/{id}/claim`, `/accept`, `/start`, `/complete` |
| Issues | `POST /api/jobs/{id}/issues` |
| Upload | `POST /api/upload` (FormData) |
| Conversations | `GET /api/internal-conversations`, `GET /api/conversations/worker-guest`, send messages, mark read |
| Worker | `PUT /api/workers/{id}` (availability, push token), `POST /api/workers/me/location`, `GET /api/workers/me/properties` |

**File:** `src/lib/api.ts`

---

## 13. AI-Powered Features

The worker app surfaces several AI capabilities powered by the backend and commercial extensions. Workers see AI outputs as read-only information; hosts approve all AI-suggested actions.

### AI Message Analysis & Suggestions

When guests or workers send messages in a conversation, the backend analyzes them using Claude AI:

- **Claude Haiku** for text-only messages; **Claude Sonnet** for messages with images
- Detects **category** (MAINTENANCE, CLEANING, SAFETY, APPLIANCE, PEST, NOISE, AMENITY_REQUEST, CHECKIN_ISSUE, CHECKOUT, COMPLIMENT, GENERAL, JOB_UPDATE, SUPPLY_REQUEST, SCHEDULE_CONFLICT, QUALITY_CONCERN)
- Assesses **urgency** (LOW, MEDIUM, HIGH, CRITICAL) and **sentiment** (POSITIVE, NEUTRAL, NEGATIVE, DISTRESSED)
- Generates a summary, suggested reply, and recommended action (CREATE_ISSUE, CREATE_JOB, DISPATCH_WORKER, AUTO_REPLY, NOTIFY_ONLY)
- 10-second debounce to batch rapid messages; rate-limited to 20 analyses per conversation per day
- Skips trivial messages (yes/no/ok/thanks/hi) unless they contain images

**Worker app display:** Read-only suggestion cards attached to messages showing category, color-coded urgency badge, and summary text with a "Host will review this suggestion" note.

**Backend:** `commercial/backend-extensions/src/lib/ai-analyzer.ts`
**Worker UI:** `app/conversation/[id].tsx`

### AI Issue Analysis (Vision)

When workers report issues with photos or videos, Claude Sonnet performs vision analysis:

- Analyzes all attached photos and extracted video frames (1 frame per 10 seconds, max 10 frames via ffmpeg)
- Recommends actions: CREATE_JOB, DISPATCH_WORKER, CALL_TRADESMAN, NOTIFY_ONLY
- Suggests specific worker roles (CLEANER, COOK, CARETAKER, SUPERVISOR) or trades (Plumber, Electrician, Pest Control, Carpenter, Locksmith, AC Technician, Painter, Mason)
- Evaluates impact on the current guest's stay
- Results delivered in real-time via Socket.IO `ai_issue_suggestion` event

**Backend:** `commercial/backend-extensions/src/lib/ai-analyzer.ts`

### Voice Transcription & Translation

Voice messages are automatically transcribed and translated by the backend:

- **Google Cloud Speech-to-Text** transcribes audio with auto-language detection
- Supports 10+ Indian languages: Hindi, Marathi, Kannada, Tamil, Telugu, Bengali, Gujarati, Punjabi, Malayalam, Urdu, plus English
- **Smart directional translation:**
  - Worker voice messages → translated to English (for host/guest)
  - Host/guest voice messages → translated to Hindi (for worker)
- Audio format conversion (M4A/AAC → WAV) via ffmpeg for Speech API compatibility
- Rate-limited to 50 translations per conversation per day
- Translated text triggers AI message analysis (creating linked suggestions)
- Results delivered in real-time via Socket.IO `voice_translated` event

**Worker app display:** Voice messages show the transcript and translation inline beneath the audio waveform player.

**Backend:** `commercial/backend-extensions/src/lib/voice-translator.ts`

### Real-Time AI Events (Socket.IO)

| Event | Description |
|-------|-------------|
| `ai_suggestion` | New AI suggestion generated for a conversation message |
| `ai_issue_suggestion` | New AI suggestion generated for a reported issue |
| `voice_translated` | Voice transcription and translation completed |

### AI Suggestion Actions (Host-Side)

While workers see suggestions as read-only, hosts can approve or dismiss them. Approved actions include:

- **CREATE_ISSUE** — automatically creates an issue from the suggestion
- **CREATE_JOB** — creates and optionally auto-dispatches a job to available workers
- **DISPATCH_WORKER** — assigns the best available worker based on suggested role
- **CALL_TRADESMAN** — flags the need for an external tradesperson with the suggested trade
- **AUTO_REPLY** — sends the AI-suggested reply to the conversation

**API:** `GET /api/ai-suggestions`, `POST /api/ai-suggestions/{id}/approve`, `POST /api/ai-suggestions/{id}/dismiss`

---

## App Structure

```
worker-app/
├── app/
│   ├── (auth)/
│   │   └── login.tsx              # Login screen
│   ├── (tabs)/
│   │   ├── _layout.tsx            # Tab bar (Properties, Jobs, Messages, Profile)
│   │   ├── index.tsx              # Jobs screen (My Jobs / Available)
│   │   ├── properties.tsx         # Assigned properties
│   │   ├── messages.tsx           # Conversation list
│   │   └── profile.tsx            # Worker profile
│   ├── job/
│   │   ├── [id].tsx               # Job detail & actions
│   │   └── [id]/
│   │       ├── issue.tsx          # Report issue
│   │       └── complete.tsx       # Complete job with media
│   ├── conversation/
│   │   └── [id].tsx               # Chat screen
│   └── _layout.tsx                # Root layout (auth check, notifications)
├── src/lib/
│   ├── api.ts                     # REST API client
│   ├── socket.ts                  # Socket.IO client
│   ├── location.ts                # Background location tracking
│   ├── notifications.ts           # Push notification setup
│   ├── i18n.ts                    # Internationalization
│   └── useVoice.ts                # Voice input hook
└── app.json                       # Expo configuration
```

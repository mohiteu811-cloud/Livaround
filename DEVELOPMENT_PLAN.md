# LivAround Development Plan: Host Android App & Two-Way Messaging

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Part A: Host Android App](#part-a-host-android-app)
3. [Part B: Two-Way Guest-Host Messaging](#part-b-two-way-guest-host-messaging)
4. [Shared Infrastructure](#shared-infrastructure)
5. [Implementation Phases](#implementation-phases)

---

## Executive Summary

This plan covers two major features:

- **Host Android App** - A React Native/Expo mobile app (mirroring the existing `worker-app` architecture) that gives hosts on-the-go access to manage properties, bookings, jobs, workers, and guest communications.
- **Two-Way Guest-Host Messaging** - A real-time chat system enabling guests (via their guest link) to message hosts, and hosts to reply, with support in the dashboard, the new host app, and the guest web portal.

Both features share a common real-time infrastructure (WebSockets) and a new messaging database schema.

---

## Part A: Host Android App

### A.1 Overview

A new `host-app/` directory at the monorepo root, built with **React Native + Expo Router** (same stack as `worker-app/`), targeting Android first. The app gives property managers mobile access to the most time-sensitive operations.

### A.2 Core Screens & Features

#### Authentication
| Screen | Description |
|--------|-------------|
| **Login** | Email/password login using existing `POST /api/auth/login` endpoint |
| **Biometric Unlock** | Optional fingerprint/face unlock after first login (expo-local-authentication) |
| **Session Management** | JWT stored in expo-secure-store, auto-refresh logic |

#### Dashboard (Home Tab)
| Feature | Description |
|---------|-------------|
| **Today's Summary** | Active bookings, pending jobs, open issues count |
| **Quick Actions** | Create job, view messages, scan QR |
| **Alerts Feed** | Low inventory, new issues, maintenance requests, new guest messages |
| **Revenue Snapshot** | Current month gross/net from revenue reports |

#### Properties Tab
| Feature | Description |
|---------|-------------|
| **Property List** | Card-based list with occupancy status indicators |
| **Property Detail** | All property info, current/upcoming bookings, assigned staff |
| **Operations Guide** | View/edit areas and docs per property |
| **Inventory** | View stock levels, mark items as restocked |

#### Bookings Tab
| Feature | Description |
|---------|-------------|
| **Calendar View** | Monthly calendar with booking bars across properties |
| **Booking List** | Filterable list (by property, status, channel) |
| **Booking Detail** | Guest info, check-in/out times, guest code, lock code status |
| **Create Booking** | Form to log new booking (channel, dates, guest count, amount) |
| **Guest Link Share** | One-tap share guest link via WhatsApp/SMS/email |

#### Jobs & Workers Tab
| Feature | Description |
|---------|-------------|
| **Active Jobs** | Jobs grouped by status (pending, in-progress, completed today) |
| **Create Job** | Select property, type, date, assign worker |
| **Worker Map** | Live GPS map of worker locations (reuse worker-app tracking data) |
| **Worker Roster** | List of workers with availability, skills, rating |
| **Job Audit** | Rate completed jobs, view checklists/photos |

#### Issues & Maintenance Tab
| Feature | Description |
|---------|-------------|
| **Issue Feed** | Worker-reported issues with photos, severity badges |
| **Maintenance Queue** | Pending approval requests, one-tap approve/reject |
| **Tradesman Directory** | Assigned tradesmen per property, tap to call |

#### Messages Tab (Part B integration)
| Feature | Description |
|---------|-------------|
| **Conversation List** | All guest conversations, sorted by latest message |
| **Chat Screen** | Real-time messaging with a specific guest/booking |
| **Push Alerts** | Notification for new guest messages |

#### Profile & Settings
| Feature | Description |
|---------|-------------|
| **Host Profile** | Company name, contact info |
| **Notification Preferences** | Toggle push categories |
| **App Settings** | Theme, language, logout |

### A.3 Technical Architecture

```
host-app/
  app/
    _layout.tsx                  # Root layout + auth guard
    (auth)/
      login.tsx                  # Login screen
    (tabs)/
      _layout.tsx                # Bottom tab navigator
      index.tsx                  # Dashboard/Home
      properties.tsx             # Properties list
      bookings.tsx               # Bookings calendar + list
      jobs.tsx                   # Jobs & workers
      messages.tsx               # Conversations list (Part B)
    property/
      [id].tsx                   # Property detail
      [id]/inventory.tsx         # Property inventory
      [id]/guide.tsx             # Operations guide
    booking/
      [id].tsx                   # Booking detail
      create.tsx                 # New booking form
    job/
      [id].tsx                   # Job detail
      create.tsx                 # New job form
    worker/
      [id].tsx                   # Worker profile
      map.tsx                    # Live worker map
    maintenance/
      index.tsx                  # Maintenance queue
      [id].tsx                   # Request detail
    messages/
      [conversationId].tsx       # Chat screen (Part B)
    profile.tsx                  # Host profile & settings
  src/
    lib/
      api.ts                     # API client (axios + JWT interceptor)
      socket.ts                  # WebSocket client (Part B)
      auth.ts                    # Auth helpers (login, token refresh, biometric)
      notifications.ts           # Push notification setup
      storage.ts                 # expo-secure-store helpers
    hooks/
      useAuth.ts                 # Auth context hook
      useSocket.ts               # WebSocket connection hook (Part B)
      useJobs.ts                 # Jobs data hook
      useProperties.ts           # Properties data hook
      useBookings.ts             # Bookings data hook
    components/
      PropertyCard.tsx
      BookingCard.tsx
      JobCard.tsx
      IssueCard.tsx
      WorkerMapView.tsx
      ChatBubble.tsx             # (Part B)
      ConversationItem.tsx       # (Part B)
    context/
      AuthContext.tsx
      SocketContext.tsx           # (Part B)
  app.json                       # Expo config (com.livaround.host)
  package.json
  tsconfig.json
```

### A.4 Android Permissions Required

```json
{
  "android": {
    "permissions": [
      "INTERNET",
      "NOTIFICATIONS",
      "RECEIVE_BOOT_COMPLETED",
      "VIBRATE",
      "CAMERA",
      "READ_EXTERNAL_STORAGE",
      "WRITE_EXTERNAL_STORAGE"
    ]
  }
}
```

### A.5 Key Dependencies

| Package | Purpose |
|---------|---------|
| `expo-router` | File-based navigation |
| `expo-secure-store` | JWT token storage |
| `expo-notifications` | Push notifications |
| `expo-image-picker` | Photo capture for bookings |
| `expo-local-authentication` | Biometric unlock |
| `react-native-maps` | Worker location map |
| `@react-native-firebase/app` | Firebase integration |
| `@react-native-firebase/messaging` | FCM push |
| `socket.io-client` | Real-time messaging (Part B) |
| `axios` | HTTP client |
| `date-fns` | Date formatting |
| `zustand` or `react-query` | State management / server caching |

### A.6 Backend Changes for Host App

Most endpoints already exist. New/modified endpoints needed:

| Endpoint | Change |
|----------|--------|
| `POST /api/auth/register-push-token` | Store host's Expo push token (new) |
| `GET /api/dashboard/summary` | Aggregated today-view stats (new) |
| `GET /api/bookings/calendar` | Calendar-optimized booking query with date range (new) |
| Existing endpoints | No changes needed - host app reuses all current authenticated APIs |

---

## Part B: Two-Way Guest-Host Messaging

### B.1 Overview

A real-time messaging system where:
- **Guests** can send messages to hosts from the guest portal (no auth, identified by `guestCode`)
- **Hosts** can reply from the dashboard or host mobile app
- Messages are tied to a **booking** (one conversation per booking)
- Supports **text messages** and **image attachments**

### B.2 Database Schema (Prisma)

```prisma
model Conversation {
  id          String    @id @default(cuid())
  bookingId   String    @unique
  booking     Booking   @relation(fields: [bookingId], references: [id])
  hostId      String
  host        Host      @relation(fields: [hostId], references: [id])
  propertyId  String
  property    Property  @relation(fields: [propertyId], references: [id])

  // Guest info (no user account needed)
  guestName   String
  guestEmail  String?
  guestPhone  String?

  messages    Message[]

  // Status
  lastMessageAt   DateTime?
  hostUnreadCount Int       @default(0)
  guestUnreadCount Int      @default(0)

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([hostId, lastMessageAt])
  @@index([bookingId])
}

model Message {
  id              String       @id @default(cuid())
  conversationId  String
  conversation    Conversation @relation(fields: [conversationId], references: [id])

  // Sender identification
  senderType      SenderType   // HOST or GUEST
  senderName      String       // Display name

  // Content
  content         String       // Text content
  messageType     MessageType  @default(TEXT) // TEXT, IMAGE, SERVICE_UPDATE
  imageUrl        String?      // For image attachments

  // Metadata
  readAt          DateTime?    // When the other party read it

  createdAt       DateTime     @default(now())

  @@index([conversationId, createdAt])
}

enum SenderType {
  HOST
  GUEST
}

enum MessageType {
  TEXT
  IMAGE
  SERVICE_UPDATE  // System messages (e.g., "Service request confirmed")
}
```

### B.3 API Endpoints

#### Guest Endpoints (No Auth - identified by guestCode)

```
GET  /api/stay/:code/messages
  → Returns conversation + messages for this booking
  → Creates conversation if it doesn't exist
  → Marks host messages as read
  → Response: { conversation, messages[] }

POST /api/stay/:code/messages
  → Guest sends a message
  → Body: { content: string, messageType?: "TEXT"|"IMAGE", imageUrl?: string }
  → Increments hostUnreadCount
  → Emits WebSocket event to host
  → Response: { message }

POST /api/stay/:code/messages/read
  → Marks all host messages as read for this guest
  → Resets guestUnreadCount to 0
```

#### Host Endpoints (Authenticated)

```
GET  /api/conversations
  → List all conversations for this host
  → Sorted by lastMessageAt desc
  → Includes last message preview, unread count
  → Query params: ?propertyId=&search=&status=active|archived
  → Response: { conversations[] }

GET  /api/conversations/:id
  → Full conversation with messages (paginated)
  → Query: ?cursor=&limit=50
  → Marks guest messages as read
  → Response: { conversation, messages[], nextCursor }

POST /api/conversations/:id/messages
  → Host sends a message
  → Body: { content: string, messageType?: "TEXT"|"IMAGE", imageUrl?: string }
  → Increments guestUnreadCount
  → Emits WebSocket event to guest
  → Response: { message }

POST /api/conversations/:id/read
  → Marks all guest messages as read
  → Resets hostUnreadCount to 0

GET  /api/conversations/unread-count
  → Total unread messages across all conversations
  → Response: { count: number }
```

### B.4 WebSocket Architecture

Using **Socket.IO** for real-time delivery (integrates well with Express).

#### Server Setup (backend)

```
backend/
  src/
    socket/
      index.ts          # Socket.IO server initialization
      handlers/
        messaging.ts    # Message event handlers
      middleware/
        auth.ts         # JWT auth for host sockets, guestCode for guest sockets
```

#### Connection Model

```
Host connects:    socket.io with JWT token → joins room "host:{hostId}"
Guest connects:   socket.io with guestCode → joins room "booking:{bookingId}"
```

#### Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `message:new` | Server → Client | `{ message, conversationId }` |
| `message:send` | Client → Server | `{ conversationId, content, messageType }` |
| `message:read` | Client → Server | `{ conversationId }` |
| `message:read-receipt` | Server → Client | `{ conversationId, readAt }` |
| `typing:start` | Client → Server | `{ conversationId }` |
| `typing:stop` | Client → Server | `{ conversationId }` |
| `typing:indicator` | Server → Client | `{ conversationId, senderType }` |
| `conversation:updated` | Server → Client | `{ conversation }` (unread counts) |

#### Fallback

If WebSocket is unavailable (poor connection), the REST endpoints still work. The client can poll `GET /messages` as a fallback. Socket.IO handles reconnection automatically.

### B.5 Guest Web Portal Changes (Dashboard)

New/modified files in `dashboard/`:

```
dashboard/
  app/
    stay/
      [code]/
        page.tsx              # Existing - add "Message Host" button
        messages/
          page.tsx            # NEW - Guest chat interface
  components/
    stay/
      ChatWidget.tsx          # Floating chat widget on guest portal
      ChatWindow.tsx          # Full chat window
      MessageBubble.tsx       # Individual message component
      MessageInput.tsx        # Text input + image upload
      TypingIndicator.tsx     # "Host is typing..." indicator
```

#### Guest Chat UX

1. **Entry Point**: Floating chat button (bottom-right) on the guest portal at `/stay/:code`
2. **Chat Widget**: Expandable panel showing conversation
3. **No Login Required**: Guest identified by `guestCode` from URL
4. **Guest Name**: Pulled from booking's `guestName` field, or prompted on first message
5. **Persistence**: Messages persist across browser sessions (tied to booking)
6. **Notifications**: Browser notification API for new host replies (if permitted)

### B.6 Host Dashboard Changes

New/modified files in `dashboard/`:

```
dashboard/
  app/
    dashboard/
      messages/
        page.tsx              # NEW - Conversations list
        [id]/
          page.tsx            # NEW - Chat thread view
  components/
    messages/
      ConversationList.tsx    # Sidebar list of conversations
      ConversationItem.tsx    # Preview card (guest name, last message, unread badge)
      ChatThread.tsx          # Message thread view
      MessageBubble.tsx       # Shared with guest (different styling)
      MessageComposer.tsx     # Rich input (text + image upload)
      TypingIndicator.tsx
    layout/
      Sidebar.tsx             # MODIFIED - add Messages nav item with unread badge
      Header.tsx              # MODIFIED - add notification bell with unread count
```

#### Host Chat UX

1. **Sidebar**: New "Messages" nav item with unread count badge
2. **Split View**: Conversation list on left, active chat on right
3. **Search**: Filter conversations by guest name or property
4. **Quick Reply**: Pre-built templates ("Check-in is at 3 PM", "WiFi password is...", etc.)
5. **Context Panel**: Shows booking details alongside conversation
6. **Push Notifications**: New guest message triggers push to host app + browser notification

### B.7 Host Mobile App Chat (Part A integration)

```
host-app/
  app/
    (tabs)/messages.tsx           # Conversations list
    messages/[conversationId].tsx # Chat screen
  src/
    lib/socket.ts                 # Socket.IO client
    hooks/useSocket.ts            # Connection management
    hooks/useMessages.ts          # Message data hook
    components/
      ChatBubble.tsx              # Message bubble
      ConversationItem.tsx        # List item
      MessageInput.tsx            # Text + image input
```

### B.8 Service Request Integration

When a guest submits a service request, automatically create a system message in the conversation:

```
"[Service Request] Housekeeping requested for March 28, 10:00 AM"
```

When a host confirms/declines a service request, auto-message:

```
"[Service Update] Your housekeeping request has been confirmed for March 28, 10:00 AM"
```

This keeps all communication in one thread.

### B.9 Push Notification Flow

```
Guest sends message
  → Backend saves to DB
  → Socket.IO emits to "host:{hostId}" room
  → If host is NOT connected via socket:
      → Send Expo push notification to host app
      → Send browser notification via web push (if subscribed)
  → Update hostUnreadCount

Host replies
  → Backend saves to DB
  → Socket.IO emits to "booking:{bookingId}" room
  → If guest browser tab not focused:
      → Browser Notification API (if permitted)
  → Update guestUnreadCount
```

---

## Shared Infrastructure

### WebSocket Server Setup

Add Socket.IO to the existing Express server:

```typescript
// backend/src/index.ts (modified)
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';

const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: { origin: process.env.CORS_ORIGIN?.split(',') }
});

// Auth middleware for socket connections
io.use(socketAuthMiddleware);

// Register handlers
registerMessagingHandlers(io);

httpServer.listen(PORT);
```

### New Backend Dependencies

| Package | Purpose |
|---------|---------|
| `socket.io` | WebSocket server |
| `socket.io-client` | For testing |

### New Dashboard Dependencies

| Package | Purpose |
|---------|---------|
| `socket.io-client` | WebSocket client |

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Backend:**
- [ ] Add `Conversation` and `Message` models to Prisma schema
- [ ] Run migration
- [ ] Set up Socket.IO on the Express server
- [ ] Implement socket auth middleware (JWT for hosts, guestCode for guests)
- [ ] Build guest messaging REST endpoints (`/api/stay/:code/messages`)
- [ ] Build host messaging REST endpoints (`/api/conversations`)
- [ ] Wire up Socket.IO event handlers for real-time delivery
- [ ] Add push notification triggers for new messages

### Phase 2: Guest Chat Widget (Week 2-3)

**Dashboard (Guest Portal):**
- [ ] Build `ChatWidget` component (floating button + expandable panel)
- [ ] Build `ChatWindow` with message list and input
- [ ] Connect to Socket.IO for real-time updates
- [ ] Add REST fallback for initial load
- [ ] Handle guest name prompt on first message
- [ ] Add image upload support in chat
- [ ] Add browser notification for host replies
- [ ] Test with existing guest link flow

### Phase 3: Host Dashboard Messaging (Week 3-4)

**Dashboard (Host View):**
- [ ] Build Messages page with conversation list + chat thread
- [ ] Add unread badge to sidebar navigation
- [ ] Connect to Socket.IO for real-time updates
- [ ] Add conversation search and property filtering
- [ ] Add quick-reply templates
- [ ] Show booking context alongside conversation
- [ ] Add browser notifications for new guest messages
- [ ] Integrate service request auto-messages

### Phase 4: Host Android App - Core (Week 4-6)

**Host App:**
- [ ] Initialize Expo project (`host-app/`)
- [ ] Set up Expo Router with tab navigation
- [ ] Build auth flow (login screen + JWT storage + auth guard)
- [ ] Build API client with interceptors (reuse patterns from worker-app)
- [ ] Build Dashboard/Home screen with summary cards
- [ ] Build Properties tab (list + detail screens)
- [ ] Build Bookings tab (list + detail + create form)
- [ ] Set up push notifications (Expo + FCM)

### Phase 5: Host App - Operations (Week 6-8)

**Host App:**
- [ ] Build Jobs tab (list + detail + create + dispatch)
- [ ] Build Worker map with live GPS tracking
- [ ] Build Issues feed screen
- [ ] Build Maintenance queue with approve/reject
- [ ] Build Inventory view per property
- [ ] Add `POST /api/dashboard/summary` backend endpoint
- [ ] Add `GET /api/bookings/calendar` backend endpoint

### Phase 6: Host App - Messaging (Week 8-9)

**Host App:**
- [ ] Build Messages tab with conversation list
- [ ] Build Chat screen with real-time messaging
- [ ] Connect Socket.IO client
- [ ] Add push notifications for new guest messages
- [ ] Add image sending support
- [ ] Add typing indicators
- [ ] Handle offline message queue

### Phase 7: Polish & Testing (Week 9-10)

- [ ] End-to-end testing of message flow (guest web → host app → guest web)
- [ ] Load testing WebSocket connections
- [ ] Offline handling and message retry logic
- [ ] Error states and empty states across all screens
- [ ] Android build optimization (ProGuard, bundle size)
- [ ] Security audit (rate limiting on guest endpoints, message sanitization)
- [ ] Add rate limiting to guest message endpoints (prevent spam)
- [ ] Performance profiling on low-end Android devices

---

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| Guest message spam | Rate limit: 10 messages/minute per guestCode |
| XSS in messages | Sanitize HTML in message content before storage and rendering |
| Unauthorized access | Guests can only access their booking's conversation; hosts can only see their conversations |
| WebSocket abuse | Connection rate limiting, max message size (10KB text, 5MB images) |
| Image uploads | Validate file types, scan for malware, store in Firebase Storage |
| Guest code enumeration | guestCode is 8-char hex (4 billion combinations), add rate limiting on lookups |
| Data retention | Auto-archive conversations 30 days after checkout |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Message delivery latency | < 500ms (WebSocket), < 2s (push notification) |
| Guest chat adoption | > 30% of bookings use messaging |
| Host response time | < 30 min average during business hours |
| App crash rate | < 1% of sessions |
| WebSocket uptime | > 99.5% |

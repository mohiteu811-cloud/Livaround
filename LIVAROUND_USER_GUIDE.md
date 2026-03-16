# LivAround — User Guide & FAQ

> **Platform version:** 1.0
> **Portals:** Host Dashboard · Owner Portal · Worker App (mobile) · Worker Portal (web) · Business / Client Portal · Guest Stay Page

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Roles & Portals — Who Logs In Where?](#2-roles--portals--who-logs-in-where)
3. [Host / Property Manager Guide](#3-host--property-manager-guide)
   - 3.1 [Getting Started](#31-getting-started)
   - 3.2 [Properties](#32-properties)
   - 3.3 [Bookings](#33-bookings)
   - 3.4 [Jobs & Dispatch](#34-jobs--dispatch)
   - 3.5 [Workers](#35-workers)
   - 3.6 [Inventory](#36-inventory)
   - 3.7 [Issues](#37-issues)
   - 3.8 [Maintenance Requests](#38-maintenance-requests)
   - 3.9 [Revenue Reports](#39-revenue-reports)
   - 3.10 [Property Operations Guide](#310-property-operations-guide)
   - 3.11 [Tradesmen Database](#311-tradesmen-database)
   - 3.12 [Live Worker Tracking](#312-live-worker-tracking)
4. [Owner / Investor Guide](#4-owner--investor-guide)
5. [Business / Client Guide (Shift Hiring)](#5-business--client-guide-shift-hiring)
6. [Worker Guide — Mobile App](#6-worker-guide--mobile-app)
7. [Worker Guide — Web Portal](#7-worker-guide--web-portal)
8. [Guest — Stay Page](#8-guest--stay-page)
9. [Frequently Asked Questions](#9-frequently-asked-questions)
   - [For Hosts & Managers](#faq-hosts)
   - [For Owners](#faq-owners)
   - [For Workers](#faq-workers)
   - [For Businesses](#faq-businesses)

---

## 1. Platform Overview

LivAround is an end-to-end property operations platform. It connects **hosts** (property managers), **owners** (investors/landlords), **workers** (cleaners, cooks, drivers, maintenance staff) and **clients** (venues / businesses hiring shift workers) in a single system.

**What it handles:**
- Property listings with full operations documentation
- Booking management (Airbnb, Booking.com, direct, etc.)
- Job creation and worker dispatch
- Real-time worker location tracking
- Inventory & stock alerts
- Maintenance request workflows
- Revenue reporting and owner payouts
- Shift hiring for hospitality businesses

---

## 2. Roles & Portals — Who Logs In Where?

| Role | Portal URL | Description |
|---|---|---|
| **Host / Manager** | `/login` → Dashboard | Manages properties, bookings, jobs, workers, finances |
| **Property Owner** | `/owner/login` | Investor view — bookings, revenue reports, maintenance (scoped to their involvement level) |
| **Worker** | Worker App (iOS/Android) or `/worker` on web | Accepts and completes jobs, reports issues |
| **Business / Client** | `/client` | Posts shifts and hires hospitality workers |
| **Guest** | `/stay/[code]` | View-only stay information page (no login needed) |

---

## 3. Host / Property Manager Guide

### 3.1 Getting Started

**Create your account**
1. Go to the platform URL and click **Sign Up**.
2. Enter your name, email and password.
3. You are taken directly to the **Dashboard** overview.

**Dashboard at a glance**
The dashboard shows your key metrics at the top:
- Total properties and active bookings
- Pending jobs waiting to be dispatched
- Total workers on your account
- Monthly revenue and growth
- Jobs completed this month
- Low stock alerts

Below the metrics you will see:
- A **revenue trend chart** for the last 6 months
- A **booking sources chart** (Airbnb, Direct, Booking.com, VRBO, LivAround)
- A **recent bookings** table
- An **upcoming jobs** table
- A **low stock alerts** list

---

### 3.2 Properties

**Adding a property**
1. Go to **Properties** → click **Add Property**.
2. Fill in the required details:
   - Name, type (Villa / Apartment / House / Condo)
   - Address, city, country
   - Bedrooms, bathrooms, max guests
   - Description, Airbnb URL (optional)
3. Select **Amenities** (WiFi, Pool, Air Conditioning, Kitchen, Parking, etc.).
4. Fill in the **Guest Experience** section:
   - WiFi network and password (shared with guests and workers once accepted)
   - Google Maps link
   - Check-in instructions
   - House rules
5. In the **Owner** section you can skip, link an existing owner, or create a new one inline.
6. Click **Save Property**.

**Editing or deleting a property**
From the Properties list, click the pencil icon to edit or the bin icon to delete. Deleting a property removes all associated data — this cannot be undone.

**Quick links from a property card**
- **Guide** — Opens the operations documentation for that property.
- **Staff** — Manages which workers are assigned to the property and their roles.

---

### 3.3 Bookings

**Creating a booking**
1. Go to **Bookings** → **Add Booking**.
2. Select the property.
3. Choose the booking source (Direct, Airbnb, Booking.com, VRBO, LivAround).
4. Enter guest details: name, email, phone.
5. Set check-in and check-out dates and times (defaults: check-in 3 PM, check-out 11 AM).
6. Enter guest count, total amount and currency (USD, EUR, GBP, INR, AED).
7. Optionally add a lock code (shown to the guest on their stay page).
8. Click **Create Booking**.

**Managing booking status**

| Current Status | Available Actions |
|---|---|
| Confirmed | Check In, Cancel |
| Checked In | Check Out, Cancel |
| Checked Out | Delete |
| Cancelled | Delete |

Use the icons in the bookings table row to trigger these transitions.

**Searching and filtering**
Use the search bar to find bookings by guest name or email. Use the status dropdown to filter by Confirmed / Checked In / Checked Out / Cancelled.

---

### 3.4 Jobs & Dispatch

#### Creating a job

1. Go to **Jobs** → **Create Job**.
2. Select the **property**.
3. Choose the **job type**:
   - 🧹 Cleaning
   - 🍳 Cooking
   - 🚗 Driving
   - 🔨 Maintenance
4. Optionally link to a **booking** (auto-filters bookings for that property).
5. Set the **scheduled date and time**.
6. Add any **notes** for the worker.
7. Review the **checklist** — each job type comes with a default checklist that you can customise:
   - Cleaning: Vacuum all rooms, Change bed linens, Clean bathrooms, Restock toiletries, Clean kitchen, Empty bins
   - Cooking: Confirm meal preference, Grocery prep, Cook and plate, Clean up kitchen
   - Driving: Confirm pickup location/time, Vehicle fuelled, Arrival confirmation
   - Maintenance: Identify issue, Document with photos, Carry out repair, Test and sign off
8. Dispatch to a worker immediately or save as **Pending** and dispatch later.

#### Dispatching a job

- From the jobs table, click the **Dispatch** button on any Pending or already-dispatched job.
- The dispatch panel shows workers who have the matching skill and are marked as available.
- Each worker card shows their **completed jobs count** and **star rating**.
- Click a worker to assign the job (status changes to DISPATCHED).

#### Job status flow

```
PENDING → DISPATCHED → ACCEPTED → IN_PROGRESS → COMPLETED
```

At any stage before COMPLETED you can **cancel** the job. Completed and cancelled jobs can be **archived** to keep your active view clean.

#### Job views

- **Active tab** — All jobs currently in progress (Pending, Dispatched, Accepted, In Progress)
- **Weekly tab** — A Monday–Sunday calendar grid showing jobs per day. Today is highlighted.
- **Archived tab** — Completed and cancelled jobs. You can unarchive a job from here.

#### Viewing completion media

When a worker marks a job complete and attaches a photo or video, a **View Media** button appears in the archived job row. Click it to view the completion evidence.

---

### 3.5 Workers

**Adding a worker**
1. Go to **Workers** → **Add Worker**.
2. Enter name, email, phone, location.
3. Select **skills** (at least one): Cleaning, Cooking, Driving, Maintenance.
4. Optionally add a bio.
5. Click **Create Worker**.
6. A confirmation screen shows a **temporary password** — share this with the worker. They will log in and change it.

**Managing workers**

| Action | How |
|---|---|
| Toggle availability | Switch on the worker card |
| Reset password | Click Reset Password on the worker card |
| Assign to a property | Click the property assign button, select properties |
| Delete worker | Click the bin icon on the worker card |

**Assigning workers to properties**
A worker can be assigned to multiple properties. Assignments appear in the **Staff** tab of each property. You can set a role per property:
- 🏠 **Caretaker** — Can raise maintenance requests and (if enabled) assign tradespeople
- 🧹 **Cleaner** — Can raise maintenance requests
- 🔍 **Supervisor** — Audits cleaner work and submits rated reports

**Maintenance approval settings (per property)**
In the **Property → Staff** page you can configure:
- **Require host approval** — All maintenance requests go through you before dispatch.
- **Allow caretaker to assign tradespeople** — Caretaker can skip approval and assign directly.
- **Auto-assign trade roles** — Specific trade types automatically bypass approval.

---

### 3.6 Inventory

**Adding an inventory item**
1. Go to **Inventory** → **Add Item**.
2. Select the property and category:
   - 🧴 Cleaning Supplies · 🚿 Toiletries · 🍽️ Kitchen · 🛏️ Linens · 📦 Other
3. Enter the item name, current stock, minimum stock threshold and unit (rolls, litres, kg, etc.).
4. Enter the storage location.
5. Upload photos (optional but recommended for identification).

**Low stock alerts**
Any item below its minimum threshold shows a **low-stock indicator** in the table and appears in the Dashboard's low stock list. Use the **Low stock only** toggle in Inventory to filter these quickly.

**Restocking an item**
Click the **Restock** icon (circular arrow) on any item row, enter the new stock level and save.

---

### 3.7 Issues

Issues are created by workers via the app when they encounter a problem during a job.

**Viewing issues**
- Go to **Issues** to see all reported problems.
- Filter by **status** (Open, In Review, Resolved) or **severity** (Low, Medium, High).

**Issue detail**
Click any issue to open the detail panel:
- Severity, status and timestamp
- Linked job type, property and worker
- Description
- Attached photo (full-size)
- Attached video (embedded player)

**Updating an issue**

| Transition | Button |
|---|---|
| Open → In Review | Mark In Review (amber) |
| In Review / Open → Resolved | Resolve (emerald) |

---

### 3.8 Maintenance Requests

Maintenance requests are submitted by on-site staff (caretakers or cleaners via the worker portal) and follow an approval workflow before work is dispatched.

**Status flow**
```
PENDING → APPROVED → ASSIGNED / AUTO-ASSIGNED → IN_PROGRESS → COMPLETED
```

**Reviewing a request**
1. Go to **Maintenance** — new requests appear with status **Pending**.
2. Click **Review** on a request.
3. You see the full details: title, description, trade role needed, priority and any attached photo.
4. Choose **Approve** or **Reject**:
   - If approving: optionally assign a worker, set a scheduled date and add notes for the caretaker.
   - If rejecting: add a reason in the notes.

**Priority levels:** Low · Medium · High · Urgent

---

### 3.9 Revenue Reports

**Creating a report manually**
1. Go to **Revenue** → **Add Report**.
2. Select property, month and year.
3. Enter gross revenue, platform fees and net revenue.
4. Set the commission percentage — the system calculates the commission amount.
5. Add notes and save.

**Importing from Airbnb CSV**
1. Download your earnings statement from Airbnb.
2. In the Add Report form, upload the CSV file.
3. LivAround parses gross earnings, service fees and net payout automatically.
4. Review the pre-filled values and save.

**Expense tracking**
Inside a revenue report you can log expenses. Owners with **Financial** or **Full** access can approve or reject expenses. The final **Net to Owner** figure is calculated after expenses.

**Publishing a report**
Change the report status from **Draft** to **Published** to make it visible in the owner's portal.

---

### 3.10 Property Operations Guide

The Operations Guide lives under **Properties → [Property] → Guide**. It is a structured knowledge base for each property, accessible to assigned workers and (optionally) guests.

**Areas and documentation**
1. Click **Add Area** and name a zone (e.g. "Master Bedroom", "Pool Area", "Utility Room").
2. Inside an area, click **Add Doc** to create a documentation entry:
   - Title and instructions
   - Category: Storage · Appliance · Electrical · Utility · Access · Safety · Procedure · Other
   - Upload multiple photos
3. Each doc gets a **Print QR Label** button that generates a QR code linking directly to that doc entry — stick it near the appliance or storage area.

**Vendor contacts**
Under the same Guide page, add vendor/supplier contacts:
- Agency name, contact person, phone numbers, company, notes
- Use **Save to Tradesmen** to add the contact to your Tradesmen database automatically.

**Entry QR code**
The **Entry QR** button on the Guide page generates a QR code linking to the worker check-in page for that property. Print and stick it by the front door so workers can scan on arrival.

**Guest stay page**
Guests receive a unique link (`/stay/[code]`) in their booking confirmation. It shows the WiFi credentials, check-in instructions, house rules, and map link — all sourced from the property record.

---

### 3.11 Tradesmen Database

A central directory of all your contractors and suppliers.

**Adding a tradesman**
1. Go to **Tradesmen** → **Add Tradesman**.
2. Enter name, trade type, phone numbers, company, area and associated properties.

**Importing from a property guide**
Click **Import from Vendor Contacts**, select a property, and LivAround imports all vendor contacts from that property's guide — skipping any duplicates.

**Filtering**
Filter by trade type, villa/property or area to find the right contractor quickly.

---

### 3.12 Live Worker Tracking

Go to **Tracking** to see an interactive map showing the last known GPS position of all your workers.

- **Green dot** = worker has shared location
- **Grey dot** = no location data available
- Map refreshes every **15 seconds** automatically
- Click a worker in the sidebar to centre the map on their position
- Each marker shows: worker name, availability status, last seen time

Workers share location via the mobile app when location permission is granted.

---

## 4. Owner / Investor Guide

### Logging in

Go to `/owner/login` and enter the email and temporary password your property manager shared with you. You will be prompted to change your password on first login.

### Your Dashboard

The dashboard shows your portfolio at a glance. What you can see depends on the **involvement level** your manager set for each property:

| Involvement Level | What You See |
|---|---|
| **None** | No data |
| **Reports Only** | Active bookings (guest names, dates, status) |
| **Financial** | Bookings + revenue from active bookings |
| **Full** | Bookings + revenue + open maintenance requests |

### Revenue Reports

Under each property you will see published revenue reports. Each report shows:
- Month and year
- Gross revenue from bookings
- Platform fees deducted
- Net revenue
- Commission paid to the manager
- Logged expenses
- **Net to Owner** — your actual payout

If you have **Financial** or **Full** access, you can approve or reject expenses the manager has logged against the property.

### Frequently Asked Questions (Owners)

**Q: I can't see any revenue figures.**
A: Your involvement level is set to Reports Only or None. Ask your manager to update your access to Financial or Full.

**Q: I received a login email but it says "Access Denied".**
A: Make sure you're logging in at `/owner/login`, not the main host dashboard login.

**Q: Can I contact my manager through the platform?**
A: Not directly. Use your usual contact method. The platform is for reporting visibility, not messaging.

---

## 5. Business / Client Guide (Shift Hiring)

### What is the Client Portal?

The client portal is for **venues, hotels, restaurants and event businesses** that need to hire hospitality workers (cleaners, cooks, drivers, maintenance) on a shift basis.

### Logging in

Go to `/client` and log in with your business credentials.

### Your Dashboard

The dashboard shows:
- Active shifts (Open, Partially Filled, Filled)
- Upcoming shifts in the next 7 days
- Completed shift history
- Total workers hired to date

### Posting a shift

1. Click **Post a Shift**.
2. Select your **venue**.
3. Choose the **role** (Cleaning, Cooking, Driving, Maintenance).
4. Set the **date**, **start time** and **end time**.
5. Set the **number of workers needed**.
6. Enter the **hourly rate** and **currency**.
7. Add a **description** — include any requirements or instructions.
8. **Publish** immediately or save as a Draft.

### Managing applications

1. Go to **Shifts** → click on any shift to open its detail page.
2. Under **Worker Applications** you will see all workers who have applied.
3. Use **Accept** or **Decline** buttons against each candidate.
4. The shift status updates automatically:
   - **Open** → **Partially Filled** → **Filled** as workers are accepted

### Editing a shift

Open the shift detail page and click **Edit**. You can update time, rate, description and worker count at any time before the shift starts.

---

## 6. Worker Guide — Mobile App

The LivAround Worker app is available for **iOS and Android**. Your manager will create your account and share your login credentials.

### First login

1. Open the app and enter your **email** and **temporary password**.
2. You will be taken to the **Jobs** screen.

### Language

Tap the language toggle (top right on the login screen, or in **Profile → Language**) to switch between **English** and **हिन्दी (Hindi)**.

### Jobs screen

The Jobs screen has two tabs:

**My Jobs**
Shows your active jobs: Dispatched (new, awaiting acceptance), Accepted and In Progress.

**Available**
Shows jobs that have not yet been claimed. Tap **Claim Job** under a card to take it on.

Pull down on the list at any time to refresh.

### Viewing a job

Tap any job card to open the detail screen. You will see:
- Job type and property name
- Scheduled date and time
- Linked guest name, check-in and check-out (if applicable)
- Any notes from the host
- **Checklist** with a progress bar — tap each item to mark it done
- **Property Briefing** (visible once you accept the job): address, WiFi credentials, door code

### Job actions

Your action button changes based on the job status:

| Status | Button | What it does |
|---|---|---|
| Dispatched | Accept Job | Confirms you will do the job |
| Accepted | Start Job | Marks job as In Progress |
| In Progress | Mark Complete ✅ | Opens the completion screen |
| Accepted or In Progress | ⚠️ Report an Issue | Opens the issue report screen |

### Marking a job complete

1. Tap **Mark Complete ✅**.
2. On the completion screen, optionally take or upload a **photo** and/or **video** of the finished work.
3. Tap **✅ Mark Complete**.
4. The host is notified.

> If any checklist items are unchecked, the app will warn you and ask whether you want to proceed anyway.

### Reporting an issue

1. Tap **⚠️ Report an Issue** on a job.
2. Select severity:
   - **Low** — Minor / non-urgent
   - **Medium** — Needs attention soon
   - **High** — Urgent / safety concern
3. Describe the issue.
4. Optionally attach a **photo** (camera) and/or **video**.
5. Tap **Submit Issue Report**.

The host is notified immediately.

### Profile

Tap **Profile** (bottom navigation) to:
- View your name and contact details
- See your jobs completed count and rating
- Toggle your **availability** on or off
  - When On (🟢): You receive new job assignments
  - When Off (🔴): No new jobs will be dispatched to you
- View your skills
- Switch language between English and हिन्दी
- **Sign Out**

---

## 7. Worker Guide — Web Portal

If you do not have the mobile app, you can access the worker portal in a browser at `/worker`.

### Jobs page (`/worker/jobs`)

Three tabs are available:

- **My Jobs** — Active jobs assigned to you
- **Available** — Unclaimed jobs you can pick up (tap Claim Job)
- **History** — Past completed and cancelled jobs

### Job detail page

Same information as the mobile app: scheduled time, checklist, property briefing (post-acceptance), and action buttons.

There is also a **📖 Property Guide** button that opens the full operations guide for the property — useful for locating equipment, WiFi instructions, and emergency contacts.

### Check-in via QR code

If the property has an **Entry QR code** posted at the door, scan it with your phone camera to open the check-in page directly in your browser. This marks your arrival and shows your active job for that property.

### Profile (`/worker/profile`)

Same availability toggle and skills view as the mobile app.

---

## 8. Guest — Stay Page

Guests do not need an account. The host automatically includes a unique link in the booking confirmation.

**What guests can see:**
- WiFi network name and password
- Check-in instructions
- House rules
- Google Maps link to the property
- Operations guide content (areas and docs) if the host has set up the guide
- Vendor/emergency contact information

Guests cannot create accounts, modify bookings or contact workers.

---

## 9. Frequently Asked Questions

### FAQ: Hosts

**Q: A worker accepted the job but it is still showing as Dispatched in my dashboard.**
A: Tap or click the refresh icon on the jobs page. Status updates are pushed from the worker app in real time but the dashboard may need a manual refresh if you've had the page open for a while.

**Q: I dispatched a job to the wrong worker. Can I reassign it?**
A: Yes. Open the job and click **Dispatch** again. Select the correct worker. The previous worker will no longer see the job in their app.

**Q: The worker says they didn't receive the job notification.**
A: Check that the worker's availability is toggled **On** in the Workers page. Also confirm they granted notification permissions in the app (iOS/Android settings). You can try dispatching again — this sends a fresh push notification.

**Q: How do I remove a worker who has left the company?**
A: Go to **Workers**, find the worker and click the bin icon. If they have jobs in progress, cancel those jobs first.

**Q: Can I have more than one manager (user) on my account?**
A: Multi-manager support (team accounts) is planned. At present, one host account manages all properties on that login.

**Q: My Airbnb CSV import is showing incorrect revenue figures.**
A: Ensure you are downloading the **Earnings Summary** (not the Transaction History) CSV from Airbnb. The parser expects Airbnb's standard earnings statement format. If figures still look wrong, use manual entry as a fallback.

**Q: How does the guest stay page get sent to guests?**
A: The stay link is automatically generated when you create a booking. Copy it from the booking detail and paste it into your usual welcome message or Airbnb/Booking.com automated message template.

**Q: A maintenance request was submitted but I can't find it.**
A: Go to **Maintenance** and make sure you have no status filter applied. New requests arrive with status **Pending** and appear at the top of the list.

**Q: Can I use LivAround without the mobile worker app?**
A: Yes. Workers can use the web portal at `/worker`. The mobile app provides additional features such as GPS location tracking and push notifications.

---

### FAQ: Owners

**Q: I can log in but cannot see my properties.**
A: Your manager has not yet linked any properties to your account, or your involvement level is set to None. Contact your manager.

**Q: I can see bookings but not revenue figures.**
A: Your involvement level is **Reports Only**. Ask your manager to upgrade it to **Financial** or **Full**.

**Q: I see an expense marked as "Pending Approval" — what do I do?**
A: Open the revenue report for that property and month. You will see the expense line with **Approve** and **Reject** buttons.

**Q: I want to see maintenance history, not just open requests.**
A: Currently the owner portal shows open/active maintenance requests. Completed requests are visible to the host manager. This may be expanded in a future update.

---

### FAQ: Workers

**Q: I forgot my password.**
A: Contact your manager. They can reset your password from the Workers page. A new temporary password will be shown to them to pass on to you.

**Q: I can't see any jobs.**
A: Make sure your availability is turned **On** in the Profile tab. If availability is Off, no jobs will be dispatched to you and the Available tab will be empty.

**Q: I accepted a job but the property address is not showing.**
A: The address and property briefing (WiFi, door code) appear only after you **Accept** the job (status moves from Dispatched to Accepted). Tap **Accept Job** first, then scroll down to the Property Briefing section.

**Q: The checklist is empty.**
A: The host may not have added a checklist to this specific job. Complete the work as described in the Notes section and proceed to mark complete.

**Q: I submitted an issue report but the host hasn't responded.**
A: The host receives a notification immediately. Issue resolution timelines depend on the host. You can continue with or complete the job even with an open issue.

**Q: The app is showing in English but I want Hindi.**
A: Tap **Profile** → **Language** → select **हिन्दी**. Or tap the language toggle on the login screen before signing in.

**Q: I completed a job but forgot to attach a photo. Can I add it afterwards?**
A: Once a job is marked Complete it cannot be reopened from the app. Contact your manager to add notes or media manually.

**Q: My location is not showing on the host's map.**
A: Make sure you granted **Always** location permission to the LivAround app in your phone's settings (iOS: Settings → LivAround → Location → Always; Android: Settings → Apps → LivAround → Permissions → Location → Allow all the time).

---

### FAQ: Businesses

**Q: Can I reuse a shift template for recurring weeks?**
A: Shift templates are on the product roadmap. For now, create a new shift each time. The form pre-fills from the previous shift for the same venue as a convenience.

**Q: A worker I accepted is no longer available. How do I replace them?**
A: Open the shift, decline the accepted worker and the shift status returns to Partially Filled or Open so new applicants can apply.

**Q: Can I message workers through the platform?**
A: In-platform messaging is on the roadmap. Currently, worker contact details are shown on the shift detail page once they are accepted so you can reach them directly.

**Q: My shift is showing as "Filled" but I need an extra person.**
A: Edit the shift and increase the **workers needed** count. The status will update back to Partially Filled and workers can apply again.

---

*For further assistance, contact your LivAround account manager or raise a support request at the help desk.*

# EventDeck Design System & UI Implementation Prompt

## Latest Implemented Revision — September 28, 2026

This section documents the current implemented UI and **supersedes conflicting guidance later in this file**. The screenshots in `design/` were regenerated from the implementation at a 1672×941 viewport on September 28, 2026 and are the latest visual source of truth.

### Current Reference Images

```text
design/eventdeck_analytics_loading_screen.png
design/eventdeck_local_server_guide.png
design/eventdeck_live_stream_dashboard.png
design/eventdeck_live_stream_dashboardv2.png
design/eventdeck_event_rules_dashboard.png
design/eventdeck_build_flow_dashboard.png
design/eventdeck_flow_execution_dashboard.png
design/flow_execution_card_reference.png
```

`eventdeck_live_stream_dashboardv2.png` is the latest focused Live Stream reference. `flow_execution_card_reference.png` is the latest focused Flow Execution Card reference.

### Global Density and Viewport Behavior

- The application uses a compact 64px sticky header.
- Page content fills the viewport below the header; document-level scrolling is avoided.
- Lists, tables, JSON, and ordered event areas own their scrolling where applicable.
- Page titles, inputs, buttons, badges, icons, and panel padding use compact developer-tool density.
- The workspace uses subtle top-center blue, lower-left blue, and upper-right purple radial gradients.
- Desktop layouts target 1280px and wider with internal scrolling at reduced viewport heights.

### Current Shared Header

On the Live Stream tab, the global header contains only the device selector.

On Event Rules, Build Flow, and Flow Execution, it contains:

```text
Device selector
Play / Pause icon control
Stop icon control
Right-aligned Live / Inactive status
```

Do not restore session date/time, the duplicate stream toggle, theme control, notifications, or profile controls to the shared header.

### Live Stream v2

- The top view contains the title and description on the left and a naturally sized `Stream Controls` panel on the right.
- Stream Controls contains one stateful Play/Pause action, Stop, Clear, and Record/Stop Session.
- A subtle horizontal gradient divider separates the top and bottom views.
- Search and All Tags align only with the left event-list column.
- The live count appears once, right-aligned above Event Details.
- The bottom view fills all remaining height.
- The event list remains virtualized and scrolls internally.
- Event Details is not scrollable as a whole. Its header is sticky and contains the title and close action.
- Event Details shows Event Name only; Timestamp and Event Tag metadata rows are omitted.
- The divider beneath Event Name uses the subtle EventDeck gradient.
- Event JSON wraps and flexes into the available panel rather than overflowing.

### Event Rules

- Event Information is a fixed panel, not a panel-wide scroll view.
- Title, description, Event Name, Event Value, Event Rules heading, and bottom actions remain static.
- Only the rules table scrolls; its column header remains sticky.

### Build Flow

- Flow Creation is a fixed panel, not a panel-wide scroll view.
- Title, description, Flow Name, divider, and Add Events header remain static.
- Only the ordered event list scrolls.
- The divider below Flow Name uses the subtle EventDeck gradient.

### Flow Execution Top View

- The title and description align with a compact `Flow Execution Controls` panel.
- Controls contain Add Flow, stateful Play/Pause validation, Stop, and Source.
- Hover/focus tooltips explain each icon action.
- While validation runs, an animated loader and `Validating` status appear beside the controls title.
- Paused validation shows a static `Paused` indicator; stopped validation shows no activity indicator.
- A subtle gradient divider separates this top view from the execution workspace.

### Selected Flows and Flow Execution Cards

- The Selected Flows title and description are sticky while cards scroll beneath them.
- The empty state explains that flows are created in Build Flow and provides an Add Flow action.
- Cards show flow name, optional instance number, direct Delete action, timeline, and compact helper row.
- Do not show card-level Running/Failed labels or a three-dots menu.
- Timeline circles show centered indices only (`01`, `02`, …, `999+`).
- Do not show event names or status glyphs inside timeline circles.
- Circle color communicates Passed (green), In Progress (blue), Pending (gray), and Failed (red).
- The timeline is vertically centered, horizontally scrollable, fixed to one row, and spans edge-to-edge with safe internal padding.
- Timelines that fit within the card are horizontally centered.
- Selected/focused steps use a circular halo; do not show a rectangular button focus outline.
- The helper row shows selected step, selected event name, and the inspection hint.

### Selected Flow Details

- The sticky top view contains title, description, flow selector, and four compact status tiles.
- Tiles use a green filled marker for Passed, blue ring for In Progress, gray ring for Pending, and red filled marker for Failed.
- Tiles show compact counts (`1.1K`) and reveal the status name plus exact count (`Passed: 1,100`) on hover/focus.
- `Events in this Flow` and the table column header remain fixed below the top view.
- Only event rows scroll; the table must not overflow horizontally.
- Long event names truncate with an ellipsis.
- Event rows show compact status signs only, without Passed/Failed text. Accessible labels and hover titles remain required.
- Do not render the redundant divider above `Events in this Flow`.

### Current Large-Flow Mock State

The UI includes `Large Validation Flow` for scale testing:

```text
Total events: 1,500
Passed: 1,100
Failed: 400
In Progress: 0
Pending: 0
```

This validates compact-number rendering, the 1,500-step horizontal timeline, selected-flow card scrolling, and the internally scrolling event table.


# 0. Screenshot References

The following final screenshots are the **visual source of truth** for EventDeck.

Codex must inspect the relevant screenshot before implementing each screen or state.

## Main Application Screens

```text
/design/eventdeck_live_stream_dashboard.png
/design/eventdeck_event_rules_dashboard.png
/design/eventdeck_build_flow_dashboard.png
/design/eventdeck_flow_execution_dashboard.png
```

Screen-to-file mapping:

| Screen / Tab | Screenshot |
|---|---|
| Live Stream | `eventdeck_live_stream_dashboard.png` |
| Event Rules | `eventdeck_event_rules_dashboard.png` |
| Build Flow | `eventdeck_build_flow_dashboard.png` |
| Flow Execution | `eventdeck_flow_execution_dashboard.png` |

## Startup / Connection Screens

```text
/design/eventdeck_analytics_loading_screen.png
/design/eventdeck_local_server_guide.png
```

Screen-to-file mapping:

| App State | Screenshot |
|---|---|
| Initial Splash / Loading Screen | `eventdeck_analytics_loading_screen.png` |
| Local Server Not Connected / Setup Help Screen | `eventdeck_local_server_guide.png` |

### Initial Splash / Loading Screen

Use:

```text
eventdeck_analytics_loading_screen.png
```

This screen is shown immediately when the webpage first opens while EventDeck is initializing and checking whether the local EventDeck server is available.

It should include the minimal EventDeck loading experience shown in the screenshot, including:

```text
EventDeck logo
EventDeck product name
short product tagline
minimal loading/progress indication
"Preparing your workspace..." or equivalent loading text
```

Do not show the normal sidebar or application tabs during this short initialization state.

### Local Server Not Connected / Setup Help Screen

Use:

```text
eventdeck_local_server_guide.png
```

If the initial server connection check fails after the splash state, transition to this screen.

This is the post-splash disconnected state.

The purpose of this screen is to clearly explain that EventDeck cannot continue until the local server/CLI is installed and running.

The screen should include:

```text
Disconnected status
"Local server not connected"

short explanation of why the local server is required

Step 1:
Install EventDeck

npm install -g eventdeck

Step 2:
Start the local server

eventdeck start

copy button for each command

message explaining that the page will connect automatically
once the local server starts
```

The page must keep retrying the local server connection automatically.

The user should **not** need to manually refresh the browser.

When the local server becomes available:

```text
Disconnected screen
        ↓
connection detected automatically
        ↓
main EventDeck application opens
        ↓
Live Stream tab is the default selected tab
```

If the local server disconnects later while the application is already open, preserve the current application architecture and show an appropriate disconnected state/indicator rather than silently failing.

## Recommended Repository Structure

```text
design/
├── EVENTDECK_DESIGN_SYSTEM.md
├── eventdeck_analytics_loading_screen.png
├── eventdeck_local_server_guide.png
├── eventdeck_live_stream_dashboard.png
├── eventdeck_event_rules_dashboard.png
├── eventdeck_build_flow_dashboard.png
└── eventdeck_flow_execution_dashboard.png
```

These six screenshots define the approved visual system, layout, proportions, information density, visual hierarchy, and startup experience.

Do not use older EventDeck mockups if multiple versions are present in the repository.

Use only the screenshot filenames listed above unless explicitly instructed otherwise.

# 1. Product Summary

EventDeck is a local analytics-event inspection and validation tool.

A local server:

- reads `adb logcat`
- filters logs using the `AnalyticsEvent` tag
- parses each log message as JSON
- exposes connected Android devices/emulators
- hosts the EventDeck web application
- communicates with the web UI through WebSocket

Typical event structure:

```json
{
  "eventName": "purchase",
  "eventParams": {
    "product_id": "P1001",
    "price": 999
  },
  "eventTag": "google_analytics"
}
```

The frontend has four main tabs:

```text
Live Stream
Event Rules
Build Flow
Flow Execution
```

The overall product should feel like a lightweight developer tool rather than a business analytics dashboard.

---

# 2. Technology

Use the existing project stack if it is already defined.

If the frontend stack is not yet fixed, prefer:

```text
React
TypeScript
Vite
CSS Modules / Tailwind CSS / existing project styling system
WebSocket API
TanStack Query only if useful for non-stream server state
Lucide React for icons
Inter for application typography
```

Recommended packages:

```bash
npm install lucide-react
npm install @fontsource/inter
```

Do not introduce heavy UI libraries unless the existing project already depends on one.

Avoid chart libraries because the approved UI does not require charts.

---

# 3. Design Direction

The visual direction is inspired by the **Cursor editor**.

This means:

- near-black application background
- dark charcoal panels
- subtle gray/blue gradients
- very thin borders
- low-contrast separators
- clean typography
- compact controls
- restrained use of accent colors
- no unnecessary dashboards, KPI cards, graphs, illustrations, or decorative widgets
- focus on content and developer workflows

The UI should feel:

```text
minimal
technical
premium
quiet
focused
dense but readable
```

It should NOT feel:

```text
marketing-heavy
colorful SaaS dashboard
gaming UI
glassmorphism-heavy
over-decorated
```

---

# 4. Global Color Tokens

Use CSS variables instead of hardcoding colors throughout components.

Example:

```css
:root {
  --bg-app: #080a0f;
  --bg-sidebar: #090c12;
  --bg-header: #0a0d13;

  --surface-1: #0d1117;
  --surface-2: #111620;
  --surface-3: #151a24;

  --border-subtle: #202632;
  --border-default: #29313d;
  --border-active: #5c5cff;

  --text-primary: #f4f6f8;
  --text-secondary: #a5adbb;
  --text-muted: #6f7886;

  --accent: #6c5cff;
  --accent-hover: #786cff;
  --accent-soft: rgba(108, 92, 255, 0.14);

  --success: #20d67a;
  --success-soft: rgba(32, 214, 122, 0.12);

  --danger: #ff5268;
  --danger-soft: rgba(255, 82, 104, 0.12);

  --warning: #f5b942;
  --info: #3b82f6;
  --pending: #748197;
}
```

Main application background:

```css
background:
  radial-gradient(circle at 55% 0%, rgba(40, 52, 90, 0.20), transparent 35%),
  linear-gradient(135deg, #080a0f 0%, #0b0f15 55%, #10151e 100%);
```

Keep gradients subtle.

Do not use bright gradient fills on every component.

---

# 5. Typography

Use **Inter** as the primary application font.

```css
font-family:
  "Inter",
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

Suggested weights:

| Usage | Weight |
|---|---:|
| Page title | 700 |
| Section heading | 600 |
| Event / Flow name | 600 |
| Button | 500 / 600 |
| Body text | 400 |
| Metadata | 400 |
| Status | 500 |

Suggested sizes:

```text
Page title          30-36px
Section title       18-22px
Card title          15-17px
Body                14-15px
Input               14px
Button              14px
Metadata            12-13px
Small status        11-12px
```

Use monospace only for JSON, raw event values when useful, commands, and technical identifiers.

Recommended monospace fallback:

```css
font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
```

---

# 6. Icons

Use **Lucide React** for all common UI icons.

Do not manually draw icons and do not mix multiple icon libraries without a strong reason.

Suggested mapping:

```text
Live Stream       -> Radio / Activity
Event Rules       -> FileSliders / ListChecks / FileText
Build Flow        -> Workflow / GitBranch
Flow Execution    -> CirclePlay / PlayCircle

Search            -> Search
Add               -> Plus
Delete            -> Trash2
More              -> MoreVertical
Play              -> Play
Pause             -> Pause
Stop              -> Square
Clear             -> Trash2
Record Session    -> Circle
Copy              -> Copy
Device            -> Smartphone
Tag               -> Tag
Success           -> Check
Failure           -> X
Pending           -> Circle
Chevron           -> ChevronDown
Drag              -> GripVertical
Close             -> X
```

Default icon rules:

```text
Sidebar icons      19-20px
Button icons       16-18px
Inline icons       14-16px
Stroke width       1.5-2
```

The EventDeck product logo may use a custom asset.

If the logo asset is available in the repository, use it.

Do not reproduce the Cursor logo.

---

# 7. Global Application Layout

The core layout is shared by all four screens.

```text
┌──────────────────────────────────────────────────────────────┐
│ Sticky Header                                                │
├──────────────┬───────────────────────────────────────────────┤
│              │                                               │
│ Sidebar      │ Main Page Content                             │
│              │                                               │
│              │                                               │
└──────────────┴───────────────────────────────────────────────┘
```

## Sidebar

Fixed left sidebar.

Contains:

```text
EventDeck logo + product name

Live Stream
Event Rules
Build Flow
Flow Execution
```

Rules:

- active tab gets a subtle purple/blue background
- active item may have a 2-3px accent line on the left
- inactive items should remain low contrast
- no unrelated navigation entries
- no dashboard, analytics, settings, sessions, etc. unless explicitly added later

---

# 8. Sticky Header

The header is shared across tabs and must stay fixed/sticky while the page content changes.

Primary content:

```text
Device selector
Live stream state
Stream controls on non-Live-Stream tabs
```

Example:

```text
[ iPhone 15 Pro ▼ ]   [ ● Live ON ▼ ]   [ ▶ ] [ ❚❚ ] [ ■ ]
```

## On Live Stream tab

The full stream controls already exist in the page content.

Do not duplicate unnecessary controls in the sticky header.

## On Event Rules / Build Flow / Flow Execution

Keep lightweight live-stream control available in the sticky header.

Show Play/Pause and Stop.

The controls should reflect the current live-stream state.

Examples:

```text
stream stopped -> Play enabled
stream running -> Pause + Stop enabled
stream paused  -> Play + Stop enabled
```

The header also shows the currently selected device and whether the stream is ON/OFF.

---

# 9. Reusable Component System

Create shared components before building individual pages.

Recommended:

```text
AppShell
Sidebar
StickyHeader
PageHeader
Panel
Card
Button
IconButton
Input
Select
Checkbox
StatusBadge
TagBadge
SearchField
EmptyState
Modal
EventRow
FlowCard
FlowEventNode
FlowEventList
```

All four screens must reuse these components.

Do not independently style the same type of element in each screen.

---

# 10. Common Shape / Spacing Tokens

Use an 8px-oriented spacing system.

```text
4px
8px
12px
16px
20px
24px
32px
```

Suggested radius:

```text
small control      6px
input/button       8px
card               10px
large panel        12px
```

Suggested border:

```css
border: 1px solid var(--border-subtle);
```

Selected panel:

```css
border-color: var(--accent);
box-shadow:
  0 0 0 1px rgba(108, 92, 255, 0.20),
  0 0 30px rgba(108, 92, 255, 0.08);
```

Avoid strong shadows.

---

# 11. Screen 1 — Live Stream

Purpose:

> View analytics events coming from the selected device in real time.

Approved layout concept:

```text
Page Title: Live Stream

[ Play/Pause ] [ Stop ] [ Clear ] [ Record Session ]

[ Search by event name................ ] [ Tag Dropdown ]

Events count / stream activity indicator

┌─────────────────────────────┬──────────────────────────┐
│ Live Event List             │ Event Details            │
│                             │                          │
│ event rows                  │ selected event JSON      │
│                             │                          │
└─────────────────────────────┴──────────────────────────┘
```

## Controls

### Play / Pause

One stateful CTA:

```text
not running -> Play
running     -> Pause
```

### Stop

Only enabled while a stream is running or paused.

Stopping is different from pausing.

### Clear

Clears the currently displayed event list.

It can be used while the stream is running.

### Record Session / Stop Session

Stateful CTA:

```text
not recording -> Record Session
recording     -> Stop Session
```

When Stop Session is clicked, open a modal:

```text
Save recorded session?

Session name: [................]

[Discard] [Save]
```

Session name is required to save.

---

# 12. Live Stream Search and Filtering

Search input:

```text
Search by event name...
```

Search should match:

```text
eventName
eventParams
```

Tag should be a dropdown.

Do not render all tags permanently as chips.

Possible values may include:

```text
All Tags
google_analytics
firebase_analytics
branch
moengage
other future tags
```

Filtering should happen on the frontend for the current visible/in-memory dataset unless future scale measurements indicate server-side filtering is required.

---

# 13. Live Stream Event List

Each event row/card should contain only useful information.

Example:

```text
001

purchase
Apr 26, 2026  10:24:18

google_analytics

⋮
```

Rules:

- event name should be visually prominent / bold
- sequence number visible
- timestamp smaller and secondary
- event tag shown as a small badge
- overflow/detail affordance on the right
- clicking an event opens/updates Event Details

The event list must use virtualization.

Do NOT render millions of event DOM nodes.

Preferred implementation if not already chosen:

```text
@tanstack/react-virtual
```

---

# 14. Live Stream Event Details

The right panel shows the selected event.

Example:

```text
Event Details

Event Name
purchase

Timestamp
...

Event Tag
google_analytics

Event JSON
{
  "eventName": "purchase",
  ...
}

[Copy]
```

JSON must be easy to select and copy.

A dedicated copy button is required.

---

# 15. Recorded Session Viewing

When the live stream is stopped, the user may choose a recorded session.

The UI may use a source dropdown:

```text
Source
[ Live Stream ▼ ]
```

When choosing a recorded session while the live stream is active, show a confirmation:

```text
The live stream must be stopped before opening a recorded session.

[Cancel]
[Stop Stream & Continue]
```

Recorded sessions support search, tag filtering, and event details.

They are read-only playback/view sources.

---

# 16. Screen 2 — Event Rules

Purpose:

> Define reusable events and optional matching rules.

Approved layout:

```text
┌──────────────────────────────┬───────────────────────────────┐
│ Events                       │ Event Information             │
│                              │                               │
│ Add Event                    │ Event Name (optional)         │
│ Delete                       │ Event Value (required)        │
│ Delete All                   │                               │
│                              │ Event Rules (optional)        │
│ Search                       │                               │
│ Tag dropdown                 │ parameter / match / value     │
│                              │                               │
│ Event list                   │ Clear           Save          │
└──────────────────────────────┴───────────────────────────────┘
```

---

# 17. Event Rules — Left Pane

Controls:

```text
Add Event
Delete
Delete All
```

Selection logic:

```text
nothing selected   -> delete disabled
one selected       -> Delete
multiple selected  -> Delete All / Delete Selected
```

Search:

```text
Search events...
```

Tag:

```text
[ All Tags ▼ ]
```

Each event row shows:

```text
checkbox
sequence number if useful
event display name / value
rule-state indicator
more menu
```

Do not show timestamp because this is a configuration screen.

---

# 18. Event Rules — Rule Indicator

An event with rules should have a distinct rule indicator.

Example:

```text
document/rule icon + "3 rules"
```

No rules:

```text
neutral icon + "No rules"
```

Use subtle green for rules and muted gray for no rules.

---

# 19. Event Rules — Event Information

Fields:

```text
Event Name (Optional)
Event Value (Required)
Event Rules (Optional)
```

## Event Name

Human-readable alias.

Example:

```text
Premium Purchase
```

Optional.

If omitted, use Event Value as the display name.

## Event Value

Actual analytics event identifier.

Example:

```text
housing_premium_subscription_purchase
```

Required.

Save remains disabled until a valid Event Value exists.

---

# 20. Event Rule Definition

Each rule includes:

```text
Event Parameter
Match Type
Expected Value
Priority / order if needed
```

Supported matching modes:

```text
Exact Match
Contains
Regex
```

Recommended internal values:

```text
exact
contains
regex
```

Allow adding multiple rules.

Controls:

```text
+ Add Rule
trash icon per rule
```

Actions:

```text
Clear
Save
```

---

# 21. Screen 3 — Build Flow

Purpose:

> Build reusable validation flows using Event Rules definitions.

Approved split-screen layout:

```text
┌──────────────────────────────┬──────────────────────────────┐
│ Existing Flows               │ Flow Creation                │
│                              │                              │
│ Add Flow                     │ Flow Name                    │
│ Delete Flow                  │                              │
│ Search flows                 │ Add Events                   │
│                              │                              │
│ flow list                    │ ordered event list           │
│                              │                              │
└──────────────────────────────┴──────────────────────────────┘
```

---

# 22. Build Flow — Existing Flow List

Controls:

```text
Add Flow
Delete Flow
Search flows...
```

Each flow row/card shows:

```text
checkbox
flow name
event count
delete / overflow icon
```

Example:

```text
Purchase Flow               12 events
User Onboarding Flow         8 events
Payment Flow                10 events
```

The event count is important because it quickly communicates flow complexity.

---

# 23. Build Flow — Flow Creation

Right pane:

```text
Flow Creation

Flow Name
[........................]

Add Events
[ + Add Event ]

event 1
event 2
event 3
...
```

The user builds a flow from events already created in Event Rules.

Events inside a flow should be ordered.

Allow drag-and-drop or another clear ordering mechanism.

Each selected event row may show:

```text
drag handle
event name / alias
remove icon
```

A flow should not duplicate event-rule definitions.

It stores references to Event Rules definitions.

---

# 24. Build Flow Data Principle

Keep the data model conceptually separated:

```text
EventDefinition
      ↓
Flow
      ↓
FlowExecution
```

Example:

```text
EventDefinition
- id
- alias
- eventValue
- tag
- rules[]

Flow
- id
- name
- ordered eventDefinitionIds[]

FlowExecution
- id
- selectedFlowIds[]
- source
- runtime states
```

---

# 25. Screen 4 — Flow Execution

Purpose:

> Validate one or multiple flows against a live stream or recorded session.

Approved structure:

```text
[ Add ] [ Validate ] [ Source ▼ ]

┌───────────────────────────────────┬─────────────────────────┐
│ Selected Flows                    │ Selected Flow Details   │
│                                   │                         │
│ flow card                         │ event status list       │
│ flow card                         │                         │
│                                   │                         │
└───────────────────────────────────┴─────────────────────────┘
```

Do NOT add an extra page-level `Start / Stop` CTA.

That was explicitly removed from the approved design.

The sticky header controls the live stream independently.

---

# 26. Flow Execution — Add

`Add` lets the user select one or multiple existing flows.

Multiple flows can execute/validate in parallel.

---

# 27. Flow Execution — Source

Source can be:

```text
Live Stream
Recorded Session
```

If Recorded Session is selected, allow selecting the saved session.

Do not allow recorded-session playback to conflict with an active live stream without confirmation.

---

# 28. Flow Execution — Validate

`Validate` starts validation for the selected flows against the selected source.

Before execution:

```text
all events = Pending
```

While execution is happening:

```text
Pending
In Progress / Waiting
Passed
Failed
```

When the source finishes:

```text
remaining Pending -> Failed
```

A flow is not considered successfully validated unless the expected events were matched according to its rules.

---

# 29. Flow Execution — Flow Card

Each flow card shows:

```text
Flow Name
flow sequence / instance number if useful
current overall status
horizontal event sequence
```

Example:

```text
Zomato Premium+    #1

✓────✓────✓────✓────●────○

E1   E2   E3   E4   E5   E6
```

Status colors:

```text
Passed       green
In Progress  blue
Pending      muted gray
Failed       red
```

---

# 30. Handling Long Event Names in Flow Execution

Timeline nodes must remain fixed width.

Never allow a long event name to expand the timeline node.

Use:

```text
fixed-width label area
single-line text
ellipsis by default
```

Example:

```text
premium_subscription_plan_selected
```

becomes:

```text
premium_subscri...
```

On hover:

- reveal full text using tooltip, or
- gently horizontally scroll the overflowing text within its fixed-width container

Do NOT have every long name constantly moving.

Preferred behavior:

```text
normal -> ellipsis
hover  -> reveal / marquee
```

The node itself may show E1, E2, E3 or 1, 2, 3.

The right pane is the authoritative full-name view.

---

# 31. Flow Execution — Selected Flow Details

Clicking any flow card should populate the right panel even before validation starts.

Right pane example:

```text
Selected Flow Details

Zomato Premium+ #1

4 Passed
1 In Progress
1 Pending
0 Failed

Events in this Flow

01  app_open                              Passed
02  premium_subscription_plan_selected   Passed
03  view_details                         Passed
04  add_payment_info                     Passed
05  purchase_confirmed                   In Progress
06  subscription_activated               Pending
```

During validation, statuses update live.

---

# 32. Flow Failure Behavior

Example:

```text
E1 -> Passed
E2 -> Passed
E3 -> Passed
E4 -> Failed
E5 -> Pending
E6 -> Pending
```

If the source ends:

```text
E5 -> Failed
E6 -> Failed
```

Detailed failure messaging may be shown in the right panel.

---

# 33. Stream and Flow Execution Are Separate Concerns

The live event stream can continue while the user moves between Event Rules, Build Flow, and Flow Execution.

That is why the sticky header keeps stream state and controls visible.

Flow execution consumes a selected source but does not replace the global stream control.

---

# 34. Initial Loading / Splash Screen

When EventDeck first loads, show a minimal splash screen.

Approved visual direction:

```text
centered EventDeck logo
EventDeck
Analytics made visible
minimal loading indicator
Preparing your workspace...
```

Keep the same dark Cursor-inspired background.

No sidebar or application shell is required during the brief splash state.

---

# 35. Local Server Not Running Screen

The hosted/public webpage may be opened while the local EventDeck server is unavailable.

In that case show a setup/connection screen instead of the main application.

Example:

```text
● Disconnected

Local server not connected

EventDeck requires the local server to access devices,
capture analytics events, and run validation.

Get started

1. Install EventDeck

npm install -g eventdeck

2. Start the local server

eventdeck start

Once the local server starts,
this page will connect automatically.
```

Each command should have a copy icon.

The page should automatically retry the local connection.

Do not make the user manually refresh if the server appears.

---

# 36. Empty States

Keep empty states minimal.

Examples:

## No device selected

```text
Select a device to start viewing events.
```

## No live events

```text
Waiting for events...
```

## No event rules

```text
No events added yet.
Add your first event to create reusable validation rules.
```

## No flows

```text
No flows created yet.
Create a flow using your saved events.
```

## No flow execution

```text
Add one or more flows to begin validation.
```

Do not add illustrations unless later explicitly requested.

---

# 37. Responsiveness

Primary target is desktop developer tooling.

Design for approximately:

```text
1280px+
1440px
1600px
```

The sidebar can remain fixed.

For smaller widths:

- preserve usable main content
- allow inner panels to scroll when necessary
- Flow Execution timelines may horizontally scroll
- never squeeze event nodes until labels become unreadable

Mobile support is not the primary goal unless added later.

---

# 38. Performance Requirements

The live event list may contain extremely large numbers of events.

Mandatory:

```text
virtualized rendering
stable keys
memoized rows where appropriate
avoid rerendering the full list per event
batch incoming WebSocket updates if necessary
```

Do not retain unlimited event DOM elements.

Potential implementation:

```text
@tanstack/react-virtual
```

The UI should remain responsive with long-running streams.

---

# 39. Accessibility

Even with the dark visual style:

- maintain adequate text contrast
- buttons need visible focus states
- icon-only buttons require `aria-label`
- keyboard navigation should work for primary controls
- do not rely on color alone for Passed / Failed / Pending
- status icons and text should accompany status color

Example:

```text
✓ Passed
× Failed
○ Pending
```

---

# 40. Interaction Principles

Use predictable developer-tool behavior.

Prefer:

```text
single click -> select
hover -> reveal secondary controls or tooltip
checkbox -> bulk selection
trash -> destructive action
three dots -> secondary actions
```

Do not hide primary workflow actions behind menus.

Destructive actions may require confirmation when data loss is meaningful.

---

# 41. Data State Principles

Separate persisted configuration from runtime state.

Persisted:

```text
Event Rules
Flows
Recorded Sessions
```

Runtime/transient:

```text
current device
stream running/paused/stopped
current event list
selected event
current flow execution state
validation progress
```

Do not couple UI state directly to WebSocket transport internals.

---

# 42. Reference Screen Summary

Use the provided final screenshots as the visual reference for the following.

## Screenshot 1 — Live Stream

Must include:

```text
EventDeck sidebar
sticky header
device selection
live state
Play / Pause
Stop
Clear
Record Session
event search
tag dropdown
live event count
virtualized event list
event details pane
JSON view
copy action
```

## Screenshot 2 — Event Rules

Must include:

```text
EventDeck sidebar
sticky header
live stream control in header
Add Event
Delete / Delete Selected
search
tag dropdown
event definitions list
rule-state indicators
Event Information pane
optional Event Name
required Event Value
optional Event Rules
Exact / Contains / Regex matching
Clear
Save
```

## Screenshot 3 — Build Flow

Must include:

```text
EventDeck sidebar
sticky header
Add Flow
Delete Flow
search flows
existing flow list
event count per flow
Flow Creation pane
Flow Name
Add Event
ordered selected events
remove event action
```

## Screenshot 4 — Flow Execution

Must include:

```text
EventDeck sidebar
sticky header
live Play/Pause + Stop controls in header
Add
Validate
Source
multiple selected flow cards
horizontal event progress timeline
fixed-width event labels
ellipsis for long names
status coloring
Selected Flow Details right pane
full event-name list
Passed / In Progress / Pending / Failed states
```

---

# 43. What NOT to Add

Do not add anything that was not requested simply to make the UI look fuller.

Specifically avoid:

```text
analytics charts
events-per-minute cards
active session KPI cards
system health dashboards
marketing banners
extra settings panels
unrequested navigation tabs
device-statistics cards
decorative charts
large gradients
unnecessary icons
extra status widgets
```

The product intentionally uses a minimal developer-tool UI.

---

# 44. Implementation Priority

Build in this order:

```text
1. Design tokens
2. AppShell
3. Sidebar
4. StickyHeader
5. Shared form/control components
6. Live Stream
7. Event Rules
8. Build Flow
9. Flow Execution
10. Splash state
11. Local-server disconnected state
```

After completing each page:

- compare it with its reference screenshot
- fix spacing and proportions
- ensure shared components remain visually identical across pages

---

# 45. Codex Instruction

Use this document and the following exact screenshot files together:

```text
/design/eventdeck_analytics_loading_screen.png
/design/eventdeck_local_server_guide.png
/design/eventdeck_live_stream_dashboard.png
/design/eventdeck_event_rules_dashboard.png
/design/eventdeck_build_flow_dashboard.png
/design/eventdeck_flow_execution_dashboard.png
```

The screenshots define visual composition and startup-state appearance.

The expected startup flow is:

```text
Webpage opened
      ↓
eventdeck_analytics_loading_screen.png
      ↓
check local EventDeck server
      ↓
┌───────────────────────────────┐
│ Server available              │
│ → open main application       │
│ → default to Live Stream tab  │
└───────────────────────────────┘

OR

┌────────────────────────────────────────┐
│ Server unavailable                     │
│ → eventdeck_local_server_guide.png     │
│ → keep retrying automatically          │
│ → enter main app once connected        │
└────────────────────────────────────────┘
```

Do not skip these startup states when implementing the frontend.

The screenshots define visual composition.

This markdown defines:

```text
component behavior
terminology
technology
design tokens
interaction rules
state behavior
performance expectations
```

Do not invent new product functionality.

When something is visually ambiguous, choose the simplest implementation consistent with:

```text
Cursor-inspired
minimal
dark
developer-oriented
easy to understand
```

Do not introduce additional information density merely because screen space is available.

The application should look like one coherent product across all four tabs.

# Mission Control Panel - Quick Start (3 Steps)

## How to Control Mission via Mission Report Tab

**Step 1: Load Mission**
POST `/mission/load` with waypoints → Controller receives waypoint list

**Step 2: Start/Control**
POST `/mission/{start|pause|resume|next|skip}` → Rover executes commands

**Step 3: Monitor Status**
WebSocket `mission_status` events → Table updates with waypoint completion status

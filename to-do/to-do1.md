I have successfully analyzed the PathPlanScreen and found the waypoint table with editor, add block, row, and pile options. Here's what I discovered:

**Main Location:** The waypoint table is in `src/components/pathplan/PathSequenceSidebar.tsx`, displayed on the left side of PathPlanScreen.

**Waypoint Table Features:**

1. **Basic Table** (visible in sidebar):
   - Sequence Number, Latitude, Longitude, Distance, Delete button

2. **Full-Screen Enhanced Table** (accessed via ↗ button):
   - **#** - Sequence number
   - **Block** - Clickable header opens Block assignment dialog
   - **Row** - Clickable header opens Row assignment dialog  
   - **Pile** - Clickable header opens Pile assignment dialog
   - **Latitude/Longitude/Altitude** - GPS coordinates
   - **Dist (m)** - Distance calculations
   - **Delete** - Individual delete buttons

3. **Editor Functionality** (`src/components/pathplan/RowBlockPileDialogs.tsx`):
   - **Block Assignment**: Assign block numbers to waypoint ranges with start/end sequences
   - **Row Assignment**: Assign row numbers to waypoint ranges with start/end sequences
   - **Pile Assignment**: Auto-generate pile numbers or use custom prefix
   - All dialogs support multiple assignments and sequence validation

4. **Waypoint Data Structure** (`src/types/pathplan.ts`):
   ```typescript
   interface PathPlanWaypoint {
       id: number;
       lat: number; 
       lon: number;
       alt: number;
       row?: string;      // Optional row assignment
       block?: string;    // Optional block assignment  
       pile?: string;     // Optional pile assignment
       distance?: number; // Distance from previous waypoint
   }
   ```

5. **Additional Features**:
   - Bulk delete mode, individual waypoint editing, export functionality
   - Mission statistics showing totals for waypoints, rows, blocks, distance
   - Manual path connection for custom waypoint ordering

The waypoint table provides comprehensive editing capabilities for managing agricultural marking points with block, row, and pile assignments in a user-friendly interface.
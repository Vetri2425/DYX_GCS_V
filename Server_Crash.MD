DETAILED REPORT: Server Crash on Mission Start
---
1. ERROR FLOW ANALYSIS
Execution Sequence (What Happens)
POST /api/mission/start
  ↓
server.py:4263 - api_mission_start()
  ↓
server.py:4266 - _publish_controller_cmd_or_error({'command': 'start'})
  ↓
server.py:4247 - mission_controller.process_command(cmd)
  ↓
integrated_mission_controller.py:336 - start_mission()
  ↓
integrated_mission_controller.py:641 - ensure_pixhawk_armed()
  ↓
integrated_mission_controller.py:686 - execute_current_waypoint()
  ↓
integrated_mission_controller.py:1060 - upload_single_waypoint()
  ↓
integrated_mission_controller.py:1605 - bridge.clear_waypoints()
  ↓
❌ CLEAR_WAYPOINTS FAILS/TIMES OUT
  ↓
integrated_mission_controller.py:1098 - raise Exception("Failed to upload waypoint to Pixhawk")
  ↓
📡 MAVROS TELEMETRY TEMPORARILY STOPS (due to failed bridge operation)
  ↓
server.py:1706 - maintain_mavros_connection() loop detects disconnect
  ↓
server.py:1706 - bridge.is_pixhawk_disconnect_detected() → True
  ↓
server.py:1718 - os._exit(1)  ← SERVER KILLS ITSELF!
---
2. ROOT CAUSE ANALYSIS
CRITICAL ISSUE #1: Self-Destruct Logic
File: server.py:1718
# ❌ PROBLEMATIC CODE
async def maintain_mavros_connection():
    """Establish and monitor the MAVROS bridge connection."""
    while True:
        try:
            bridge = _init_mavros_bridge()
            if bridge.is_connected:
                # Check if Pixhawk disconnection or MAVROS crash was detected
                if bridge.is_pixhawk_disconnect_detected():
                    log_message("MAVROS telemetry loss detected - restarting service", "ERROR")
                    bridge.clear_disconnect_flag()
                    bridge.close()
                    is_vehicle_connected = False
                    sync_emit('connection_status', {
                        'status': 'WAITING_FOR_ROVER',
                        'message': 'MAVROS node crashed - service restart required'
                    })
                    # Exit process to trigger systemd restart
                    log_message("Exiting to trigger systemd service restart", "ERROR")
                    await asyncio.sleep(1.0)
                    os._exit(1)  # ⚠️ IMMEDIATE PROCESS KILL - NO CLEANUP
Problem: 
- os._exit(1) kills the entire process without cleanup
- It's triggered by temporary telemetry loss during waypoint operations
- Causes systemd to respawn the service
---
CRITICAL ISSUE #2: Race Condition - Initialization vs. Requests
File: server.py:1720-1745
# ❌ PROBLEMATIC CODE
async def maintain_mavros_connection():
    while True:
        try:
            bridge = _init_mavros_bridge()
            if bridge.is_connected:
                # Initialize mission controller if not already done
                if mission_controller is None:
                    initialize_mission_controller()  # Runs asynchronously
                await asyncio.sleep(2.0)
                continue
File: server.py:4263
# ❌ PROBLEMATIC CODE
@app.post("/api/mission/start")
def api_mission_start():
    try:
        ok, err = _publish_controller_cmd_or_error({'command': 'start'})  # May hit before init completes!
        if err:
            return err
File: server.py:4243
def _publish_controller_cmd_or_error(cmd: dict):
    """Helper to process mission command via integrated controller or return an error tuple."""
    global mission_controller
    
    try:
        if not mission_controller:  # ⚠️ Can be None when request arrives!
            return None, _http_error("Mission controller not initialized", 503)
        
        # Process command through integrated controller
        result = mission_controller.process_command(cmd)  # ⚠️ If partially initialized, this may crash!
Problem:
- HTTP endpoint is immediately available on startup
- Mission controller initializes asyncynchronously in background
- Request can arrive before initialization completes
- If initialization fails but returns True, subsequent operations crash
---
CRITICAL ISSUE #3: No Initialization Tracking
File: server.py:1522-1538
# ❌ PROBLEMATIC CODE
def initialize_mission_controller():
    """Initialize the integrated mission controller after MAVROS bridge connects"""
    global mission_controller
    try:
        bridge = _init_mavros_bridge()
        mission_controller = IntegratedMissionController(
            mavros_bridge=bridge,
            status_callback=handle_mission_status,
            logger=None
        )
        # Apply loaded GPS failsafe mode from config
        mission_controller.set_failsafe_mode(current_state.gps_failsafe_mode)
        log_message(f"Integrated mission controller initialized with GPS failsafe: {current_state.gps_failsafe_mode}", "SUCCESS", event_type='mission')
        return True  # ⚠️ Returns True even if controller isn't fully initialized!
    except Exception as e:
        log_message(f"Failed to initialize mission controller: {e}", "ERROR", event_type='mission')
        return False  # ⚠️ Returns False but mission_controller variable may be set!
Problem:
- No flag to track complete initialization
- If exception occurs during set_failsafe_mode(), mission_controller is still non-None but broken
- Subsequent code checks if not mission_controller which passes, then crashes on broken object
---
CRITICAL ISSUE #4: Waypoint Upload Failure Triggers Disconnect
File: integrated_mission_controller.py:1565-1666
# ❌ PROBLEMATIC CODE
def upload_single_waypoint(self, waypoint: Dict[str, Any]) -> bool:
    """Upload waypoint with HOME position - ArduPilot requires HOME + mission waypoint"""
    try:
        # Clear existing waypoints
        self.log(f"🗑️ Clearing existing waypoints...")
        try:
            # Try roslibpy first, fall back to CLI if it fails
            clear_response = self.bridge.clear_waypoints()
            if not clear_response.get('success', False):
                # Fall back to CLI method
                self.log(f"⚠ roslibpy clear failed, trying CLI...")
                clear_response = self.bridge.clear_waypoints_cli()
            if clear_response.get('success', False):
                self.log(f"✓ Cleared existing waypoints")
            else:
                self.log(f"⚠ Clear waypoints returned: {clear_response}", "warning")
        except Exception as clear_error:
            # Try CLI as fallback
            try:
                self.log(f"⚠ roslibpy failed, trying CLI: {clear_error}")
                clear_response = self.bridge.clear_waypoints_cli()
                if clear_response.get('success', False):
                    self.log(f"✓ Cleared existing waypoints (CLI)")
                else:
                    self.log(f"⚠ CLI also failed: {clear_response}", "warning")
            except Exception as cli_error:
                self.log(f"⚠ Failed to clear waypoints (non-fatal): {cli_error}", "warning")
        # Upload HOME + mission waypoint (2 waypoints total)
        self.log(f"📤 Uploading HOME + waypoint to Pixhawk...")
        # Try roslibpy first, fall back to CLI if it fails
        response = self.bridge.push_waypoints([home_waypoint, mission_waypoint])
        if not response.get('success', False):
            self.log(f"⚠ roslibpy push failed, trying CLI...")
            response = self.bridge.push_waypoints_cli([home_waypoint, mission_waypoint])
        if response.get('success', False):
            self.log(f"✅ HOME + waypoint uploaded successfully")
            # ... rest of success path ...
            return True
        else:
            self.log(f"❌ Failed to upload waypoints: {response}", "error")
            return False  # ⚠️ Returns False
File: integrated_mission_controller.py:1036-1114
def execute_current_waypoint(self):
    """Execute the current waypoint - send one waypoint at a time"""
    if self.current_waypoint_index >= len(self.waypoints):
        self.complete_mission()
        return
    waypoint = self.waypoints[self.current_waypoint_index]
    try:
        # ... logging ...
        
        # Step 2: Upload waypoint (includes HOME position for ArduPilot compatibility)
        self.log(f'📤 Uploading waypoint {self.current_waypoint_index + 1}...')
        mavros_waypoint = self.create_single_waypoint(waypoint, seq=0)
        if self.upload_single_waypoint(mavros_waypoint):
            self.log(f'✅ Waypoint ready for navigation')
            # ... continue with success path ...
        else:
            raise Exception("Failed to upload waypoint to Pixhawk")  # ⚠️ CRASH HERE!
Problem:
- When waypoint upload fails, exception is raised
- This may cause MAVROS bridge to temporarily lose connection
- The connection loss is detected by maintain_mavros_connection()
- Server kills itself with os._exit(1)
---
3. SOLUTION CODE
SOLUTION 1: Replace Self-Destruct with Graceful Recovery
File: server.py:1698-1757
Replace the entire maintain_mavros_connection() function with:
# ✅ FIXED CODE
_mission_operation_in_progress = False  # Global flag to track active operations
async def maintain_mavros_connection():
    """Establish and monitor the MAVROS bridge connection."""
    global is_vehicle_connected, mavros_connection_last_attempt, mission_controller, manual_control_handler
    
    disconnect_recovery_attempt = 0
    max_recovery_attempts = 3
    
    while True:
        try:
            bridge = _init_mavros_bridge()
            if bridge.is_connected:
                # Check if Pixhawk disconnection or MAVROS crash was detected
                # BUT: Only if no mission operation is in progress (to avoid false positives)
                if bridge.is_pixhawk_disconnect_detected() and not _mission_operation_in_progress:
                    disconnect_recovery_attempt += 1
                    
                    if disconnect_recovery_attempt >= max_recovery_attempts:
                        # Critical: After 3 failed recovery attempts, trigger full restart
                        log_message(f"CRITICAL: {max_recovery_attempts} recovery attempts failed - triggering service restart", "ERROR")
                        bridge.clear_disconnect_flag()
                        bridge.close()
                        is_vehicle_connected = False
                        sync_emit('connection_status', {
                            'status': 'WAITING_FOR_ROVER',
                            'message': 'MAVROS critical failure - service restart required'
                        })
                        # Exit process to trigger systemd restart (ONLY after retries exhausted)
                        log_message("Exiting to trigger systemd service restart", "ERROR")
                        await asyncio.sleep(1.0)
                        os._exit(1)
                    else:
                        # Graceful recovery attempt
                        log_message(f"MAVROS telemetry loss detected (attempt {disconnect_recovery_attempt}/{max_recovery_attempts}) - attempting recovery", "WARNING")
                        bridge.clear_disconnect_flag()
                        # Attempt reconnection
                        try:
                            bridge.close()
                            is_vehicle_connected = False
                            await asyncio.sleep(2.0)
                            bridge.connect(timeout=10.0)
                            disconnect_recovery_attempt = 0  # Reset on success
                            log_message("MAVROS connection recovered", "SUCCESS")
                        except Exception as recovery_error:
                            log_message(f"Recovery attempt failed: {recovery_error}", "ERROR")
                else:
                    # Reset recovery counter on successful connection
                    disconnect_recovery_attempt = 0
                # Initialize mission controller if not already done and bridge is connected
                if mission_controller is None:
                    initialize_mission_controller()
                # Initialize manual control handler if not already done
                if manual_control_handler is None:
                    initialize_manual_control_handler()
                await asyncio.sleep(2.0)
                continue
            now = time.time()
            if now - mavros_connection_last_attempt < 1.0:
                await asyncio.sleep(1.0)
                continue
            mavros_connection_last_attempt = now
            log_message(f"Attempting MAVROS connection to {bridge.host}:{bridge.port}")
            bridge.connect(timeout=float(os.getenv("MAVROS_CONNECT_TIMEOUT", "10")))
            log_message("MAVROS bridge connected to rosbridge", "SUCCESS")
            # Initialize mission controller after successful connection
            if mission_controller is None:
                initialize_mission_controller()
            # Initialize manual control handler after successful connection
            if manual_control_handler is None:
                initialize_manual_control_handler()
        except Exception as exc:
            if is_vehicle_connected:
                is_vehicle_connected = False
                log_message("Vehicle connection lost via MAVROS", "ERROR")
                sync_emit('connection_status', {
                    'status': 'WAITING_FOR_ROVER',
                    'message': str(exc)
                })
            log_message(f"MAVROS connection error: {exc}", "ERROR")
            await asyncio.sleep(2.0)
        await asyncio.sleep(2.0)
Explanation:
1. Added _mission_operation_in_progress flag to prevent false disconnect detection during waypoint operations
2. Added retry logic (3 attempts) before triggering server restart
3. Graceful recovery attempts before killing the process
4. Only kills server after 3 consecutive recovery failures
---
SOLUTION 2: Add Initialization Tracking
File: server.py:759 (near global variables)
Add global flag:
# ✅ ADD THIS
mission_controller: Optional[IntegratedMissionController] = None
mission_controller_initialized: bool = False  # <-- NEW FLAG
latest_mission_status: dict = {}
File: server.py:1522-1538
Replace initialize_mission_controller() with:
# ✅ FIXED CODE
def initialize_mission_controller():
    """Initialize the integrated mission controller after MAVROS bridge connects"""
    global mission_controller, mission_controller_initialized
    
    # Prevent duplicate initialization
    if mission_controller_initialized:
        log_message("Mission controller already initialized, skipping", "DEBUG")
        return True
    
    try:
        bridge = _init_mavros_bridge()
        mission_controller = IntegratedMissionController(
            mavros_bridge=bridge,
            status_callback=handle_mission_status,
            logger=None
        )
        # Apply loaded GPS failsafe mode from config
        mission_controller.set_failsafe_mode(current_state.gps_failsafe_mode)
        
        # Mark as fully initialized
        mission_controller_initialized = True
        log_message(f"✅ Integrated mission controller initialized with GPS failsafe: {current_state.gps_failsafe_mode}", "SUCCESS", event_type='mission')
        return True
    except Exception as e:
        # Reset on error
        mission_controller = None
        mission_controller_initialized = False
        log_message(f"❌ Failed to initialize mission controller: {e}", "ERROR", event_type='mission')
        return False
File: server.py:4238-4260
Update _publish_controller_cmd_or_error():
# ✅ FIXED CODE
def _publish_controller_cmd_or_error(cmd: dict):
    """Helper to process mission command via integrated controller or return an error tuple."""
    global mission_controller, mission_controller_initialized
    
    try:
        # Check both object existence AND initialization flag
        if not mission_controller or not mission_controller_initialized:
            return None, _http_error("Mission controller not initialized", 503)
        
        # Process command through integrated controller
        result = mission_controller.process_command(cmd)
        
        if result.get('success', False):
            log_message(f"Mission command '{cmd.get('command')}' executed successfully", "INFO", event_type='mission')
            return True, None
        else:
            error_msg = result.get('error', 'Unknown error')
            log_message(f"Mission command '{cmd.get('command')}' failed: {error_msg}", "WARNING", event_type='mission')
            return None, _http_error(error_msg, 400)
        
    except AttributeError as ae:
        # Mission controller object exists but methods are missing (partial initialization)
        error_msg = f"Mission controller partially initialized: {str(ae)}"
        log_message(error_msg, "ERROR", event_type='mission')
        mission_controller_initialized = False  # Mark as broken
        return None, _http_error("Mission controller initialization incomplete", 503)
    except Exception as exc:
        error_msg = f"Mission command error: {str(exc)}"
        log_message(error_msg, "ERROR", event_type='mission')
        return None, _http_error(error_msg, 500)
Explanation:
1. Added mission_controller_initialized flag to track complete initialization
2. Prevents duplicate initialization attempts
3. Proper cleanup on initialization failure
4. Added AttributeError handling for partial initialization
5. Controllers disabled on initialization failure
---
SOLUTION 3: Protect Mission Operations from Disconnect Detection
File: server.py:4263-4273
Update /api/mission/start endpoint:
# ✅ FIXED CODE
@app.post("/api/mission/start")
def api_mission_start():
    global _mission_operation_in_progress
    
    try:
        # Set operation flag to prevent false disconnect detection
        _mission_operation_in_progress = True
        
        ok, err = _publish_controller_cmd_or_error({'command': 'start'})
        if err:
            _mission_operation_in_progress = False
            return err
        _record_mission_event('Mission controller started', status='MISSION_STARTED')
        
        # Reset flag after successful start
        _mission_operation_in_progress = False
        return _http_success('Mission controller started')
    except Exception as exc:
        _mission_operation_in_progress = False
        log_message(f"/api/mission/start error: {exc}", "ERROR")
        return _http_error(str(exc), 500)
File: server.py:4282-4292
Update /api/mission/stop endpoint:
# ✅ FIXED CODE
@app.post("/api/mission/stop")
def api_mission_stop():
    global _mission_operation_in_progress
    
    try:
        _mission_operation_in_progress = True
        
        ok, err = _publish_controller_cmd_or_error({'command': 'stop'})
        if err:
            _mission_operation_in_progress = False
            return err
        _record_mission_event('Mission controller stopped', status='MISSION_STOPPED')
        
        _mission_operation_in_progress = False
        return _http_success('Mission controller stopped')
    except Exception as exc:
        _mission_operation_in_progress = False
        log_message(f"/api/mission/stop error: {exc}", "ERROR")
        return _http_error(str(exc), 500)
File: integrated_mission_controller.py:615-692
Update start_mission() to use try-catch around waypoint operations:
# ✅ FIXED CODE
def start_mission(self) -> Dict[str, Any]:
    """Start mission execution"""
    with self.lock:
        self.log(f"🎬 START command received")
        self.log(f"Current state: {self.mission_state.value}")
        self.log(f"Waypoints loaded: {len(self.waypoints)}")
        # PHASE 3 FIX: Allow starting from COMPLETED state (in case auto-transition fails)
        # Allow starting from READY, PAUSED, IDLE, or COMPLETED (if waypoints are loaded)
        if self.mission_state not in [MissionState.READY, MissionState.PAUSED, MissionState.IDLE, MissionState.COMPLETED]:
            self.log(f"❌ Cannot start - invalid state: {self.mission_state.value}", "error")
            return {'success': False, 'error': f'Cannot start mission - invalid state: {self.mission_state.value}'}
        if not self.waypoints:
            self.log(f"❌ Cannot start - no waypoints loaded", "error")
            return {'success': False, 'error': 'No waypoints loaded'}
        # ARM CHECK: Always verify armed state before starting mission.
        self.log("⚡ Verifying vehicle armed state before mission start...")
        self.emit_status(
            "Verifying vehicle armed state...",
            "info",
            extra_data={"event_type": "mission_arming"}
        )
        arm_ok = self.ensure_pixhawk_armed()
        if not arm_ok:
            msg = 'Arm failed. Mission cannot start until the vehicle is armed.'
            self.log(f"❌ {msg}", "error")
            self.emit_status(msg, "error", extra_data={"event_type": "mission_arm_error"})
            return {'success': False, 'error': msg}
        self.log("✅ Vehicle armed — proceeding with mission start")
        # Remember if we're resuming from pause
        was_paused = self.mission_state == MissionState.PAUSED
        self.mission_state = MissionState.RUNNING
        self.mission_start_time = time.time()
        
        # Only reset waypoint index if not resuming from pause
        if not was_paused:
            self.current_waypoint_index = 0
        
        # Initialize failsafe monitor
        if self.failsafe_monitor:
            self.failsafe_monitor.start_mission()
        
        # Start RTK monitoring if in STRICT mode
        if self.failsafe_mode == "strict":
            self._start_rtk_monitoring()
        # Start obstacle detection (if enabled by frontend)
        if self.obstacle_monitor and self.obstacle_detection_enabled:
            self.obstacle_monitor.start()
        self.log(f'═══════════════════════════════════════════════════')
        self.log(f'🚀 MISSION STARTED')
        self.log(f'Starting from waypoint {self.current_waypoint_index + 1}/{len(self.waypoints)}')
        self.log(f'Mission Mode: {self.mission_mode.value}')
        self.log(f'GPS Failsafe Mode: {self.failsafe_mode}')
        self.log(f'═══════════════════════════════════════════════════')
        self.emit_status(
            "Mission started",
            "success",
            extra_data={
                "event_type": "mission_started"
            }
        )
        
        # ✅ NEW: Execute waypoint with error handling
        try:
            # Execute first/current waypoint
            self.execute_current_waypoint()
        except Exception as exec_error:
            error_msg = f"Failed to execute first waypoint: {str(exec_error)}"
            self.log(error_msg, "error")
            self.mission_state = MissionState.ERROR
            self.emit_status(
                error_msg,
                "error",
                extra_data={
                    "event_type": "mission_error",
                    "error_source": "start_mission",
                    "error_message": error_msg
                }
            )
            return {'success': False, 'error': error_msg}
        
        return {
            'success': True,
            'message': 'Mission started',
            'current_waypoint': self.current_waypoint_index + 1
        }
Explanation:
1. Set _mission_operation_in_progress flag before mission operations
2. Wrap waypoint execution in try-catch to prevent unhandled exceptions
3. Reset flag on success or failure
4. Prevent cascading failures from crashing the server
---
SOLUTION 4: Add Connection Status Check Before Operations
File: integrated_mission_controller.py:1565-1666
Update upload_single_waypoint() to check connection:
# ✅ FIXED CODE
def upload_single_waypoint(self, waypoint: Dict[str, Any]) -> bool:
    """Upload waypoint with HOME position - ArduPilot requires HOME + mission waypoint"""
    try:
        # ✅ NEW: Check bridge connection before attempting operations
        if not self.bridge.is_connected:
            self.log("❌ MAVROS bridge not connected - cannot upload waypoint", "error")
            # Try to reconnect
            try:
                self.log("⚠ Attempting MAVROS reconnection...", "warning")
                self.bridge.connect(timeout=5.0)
            except Exception as reconnect_error:
                self.log(f"❌ Reconnection failed: {reconnect_error}", "error")
                return False
        # CRITICAL: ArduPilot requires HOME waypoint (seq=0) + mission waypoint (seq=1)
        # Cannot upload single waypoint alone - AUTO mode will reject it
        if not self.current_position:
            self.log("❌ No current position available for HOME", "error")
            return False
        # Create HOME waypoint (seq=0) - REQUIRED by ArduPilot
        home_waypoint = {
            'frame': 0,  # MAV_FRAME_GLOBAL (absolute altitude)
            'command': 16,  # MAV_CMD_NAV_WAYPOINT
            'is_current': True,  # HOME is initially current
            'autocontinue': True,
            'param1': 0,  # Hold time
            'param2': 0,  # Accept radius
            'param3': 0,  # Pass through radius
            'param4': 0,  # Yaw
            'x_lat': float(self.current_position['lat']),
            'y_long': float(self.current_position['lng']),
            'z_alt': float(self.current_position.get('alt', 0.0))
        }
        # Create mission waypoint (seq=1) - This is the actual target
        mission_waypoint = {
            'frame': 3,  # MAV_FRAME_GLOBAL_RELATIVE_ALT (relative to HOME)
            'command': 16,  # MAV_CMD_NAV_WAYPOINT
            'is_current': False,  # Will become current after upload
            'autocontinue': True,
            'param1': 0,  # Hold time
            'param2': float(self.waypoint_reached_threshold),  # Accept radius
            'param3': 0,  # Pass through radius
            'param4': 0,  # Yaw
            'x_lat': float(waypoint['x_lat']),
            'y_long': float(waypoint['y_long']),
            'z_alt': float(waypoint['z_alt'])
        }
        # Clear existing waypoints
        self.log(f"🗑️ Clearing existing waypoints...")
        try:
            # Try roslibpy first, fall back to CLI if it fails
            clear_response = self.bridge.clear_waypoints()
            if not clear_response.get('success', False):
                # Fall back to CLI method
                self.log(f"⚠ roslibpy clear failed, trying CLI...")
                clear_response = self.bridge.clear_waypoints_cli()
            if clear_response.get('success', False):
                self.log(f"✓ Cleared existing waypoints")
            else:
                self.log(f"⚠ Clear waypoints returned: {clear_response}", "warning")
        except Exception as clear_error:
            # Try CLI as fallback
            try:
                self.log(f"⚠ roslibpy failed, trying CLI: {clear_error}")
                clear_response = self.bridge.clear_waypoints_cli()
                if clear_response.get('success', False):
                    self.log(f"✓ Cleared existing waypoints (CLI)")
                else:
                    self.log(f"⚠ CLI also failed: {clear_response}", "warning")
            except Exception as cli_error:
                self.log(f"⚠ Failed to clear waypoints (non-fatal): {cli_error}", "warning")
        # Upload HOME + mission waypoint (2 waypoints total)
        self.log(f"📤 Uploading HOME + waypoint to Pixhawk...")
        # Try roslibpy first, fall back to CLI if it fails
        response = self.bridge.push_waypoints([home_waypoint, mission_waypoint])
        if not response.get('success', False):
            self.log(f"⚠ roslibpy push failed, trying CLI...")
            response = self.bridge.push_waypoints_cli([home_waypoint, mission_waypoint])
        if response.get('success', False):
            self.log(f"✅ HOME + waypoint uploaded successfully")
            # Set current waypoint to 1 (mission waypoint, since 0 is HOME)
            self.log(f"🎯 Setting current waypoint to 1 (mission target)")
            try:
                response = self.bridge.set_current_waypoint(1)
                if not response.get('success', False):
                    # Fall back to CLI
                    self.log(f"⚠ roslibpy set_current failed, trying CLI...")
                    response = self.bridge.set_current_waypoint_cli(1)
            except Exception as e:
                # Try CLI as fallback
                self.log(f"⚠ roslibpy failed, trying CLI: {e}")
                try:
                    response = self.bridge.set_current_waypoint_cli(1)
                except Exception as cli_error:
                    self.log(f"⚠ CLI also failed: {cli_error}", "warning")
            # Simple verification delay
            time.sleep(0.5)
            return True
        else:
            self.log(f"❌ Failed to upload waypoints: {response}", "error")
            return False
    except Exception as e:
        self.log(f"❌ Waypoint upload error: {e}", "error")
        return False
Explanation:
1. Check MAVROS bridge connection before attempting operations
2. Attempt automatic reconnection if bridge is disconnected
3. Return False gracefully instead of crashing
4. Better logging of connection state
---
4. STEP-BY-STEP INSTRUCTIONS
Step 1: Add Global Variables
1. Open server.py
2. Find line ~759 where mission_controller is declared
3. Add mission_controller_initialized: bool = False below it
4. Add _mission_operation_in_progress = False at module level (near other globals)
Step 2: Update initialize_mission_controller()
1. Replace the function at line 1522 with the fixed version
2. Ensure proper cleanup on error
3. Set the initialization flag only on complete success
Step 3: Update _publish_controller_cmd_or_error()
1. Replace the function at line 4238 with the fixed version
2. Check both mission_controller and mission_controller_initialized
3. Add AttributeError handling
Step 4: Update /api/mission/start endpoint
1. Set _mission_operation_in_progress = True at start
2. Reset to False on success or in except block
3. Repeat for /api/mission/stop and other mission endpoints
Step 5: Fix maintain_mavros_connection()
1. Replace entire function (line 1698+) with fixed version
2. Add retry logic before calling os._exit(1)
3. Check _mission_operation_in_progress before detecting disconnect
Step 6: Add Error Handling to start_mission()
1. Wrap execute_current_waypoint() in try-catch
2. Return proper error response instead of raising exception
3. Ensure state is cleaned up on error
Step 7: Add Connection Check to upload_single_waypoint()
1. Check self.bridge.is_connected at start
2. Attempt reconnection if needed
3. Return False gracefully on connection issues
---
5. TESTING CHECKLIST
- [ ] Start server and verify no immediate crashes
- [ ] Call /api/mission/start before MAVROS connects - should return 503
- [ ] Connect MAVROS, then call /api/mission/start - should work
- [ ] Simulate waypoint upload failure - server should NOT crash
- [ ] Verify mission controller initialization only happens once
- [ ] Check logs for "Mission controller not initialized" when appropriate
- [ ] Verify os._exit(1) only called after 3 consecutive disconnects
- [ ] Test graceful recovery from temporary disconnects
---
6. DIAGNOSTIC LOGGING
Add these log statements to track the issue:
# At start of mission operations
_log_message(f"Mission operation started: {cmd.get('command')}", "DEBUG")
_mission_operation_in_progress = True
# Inside maintain_mavros_connection disconnect detection
if bridge.is_pixhawk_disconnect_detected():
    if not _mission_operation_in_progress:
        _log_message("Disconnect detected (NO mission in progress) - checking severity", "WARNING")
    else:
        _log_message("Disconnect detected (MISSION IN PROGRESS) - ignoring false positive", "DEBUG")
---
SUMMARY
Root Cause: Server commits suicide with os._exit(1) when temporary telemetry loss occurs during waypoint operations.
Primary Fixes:
1. ✅ Replace immediate os._exit(1) with retry logic (3 attempts)
2. ✅ Add initialization tracking to prevent race conditions
3. ✅ Use operation flag to prevent false disconnect detection
4. ✅ Better error handling in mission operations
Result: Server will gracefully recover from temporary issues and only restart after genuine critical failures (3+ consecutive disconnects without successful recovery).
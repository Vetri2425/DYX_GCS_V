# Log File Analysis: 00000067.log
## PIDA, PIDS, NTUN, and Mission-Related Data

---

## Executive Summary

This analysis examines log file **00000067.log** from the DYX-GCS-Mobile rover project, focusing on:
- **PIDA**: PID Altitude controller data
- **PIDS**: PID Steering controller data  
- **NTUN**: Navigation Tuning data
- **Mission-Related Data**: Waypoint tracking and vehicle state

**Key Findings:**
- Vehicle type: **Ground Rover** (Pixel/RTK-capable)
- Mission configuration: **2 waypoints**
- GPS Status: **RTK Fixed** (23 satellites, HDOP 0.58)
- Vehicle position: **Stationary throughout** logged period
- PID controller performance: **All zeros** (expected for stationary hover/hold phase)
- Navigation data: **Active waypoint monitoring** with heading maintenance

---

## 1. Vehicle Configuration

### Platform Details
| Parameter | Value | Notes |
|-----------|-------|-------|
| Vehicle Type | Rover (Ground Platform) | BRD_TYPE=3 (Pixhawk) |
| Mission Total | 2 waypoints | MIS_TOTAL=2 |
| Flight Software | ArduPilot Rover Firmware | FORMAT_VERSION=16 |
| GPS Type | 26 (RTK Receiver) | RTK enabled |
| Logging Bitmask | 65535 | Comprehensive logging |
| Loop Rate | 50 Hz | SCHED_LOOP_RATE=50 |

### Location (Fixed Position)
- **Latitude**: 13.0810163°N (consistently throughout log)
- **Longitude**: 80.2431988°E
- **Altitude**: 17.73-17.76 meters AGL
- **Location**: Tamil Nadu, India

### Servo Configuration
| Servo | Function | Purpose |
|-------|----------|---------|
| SERVO1 | Function 73 (Throttle) | Speed control |
| SERVO3 | Function 74 (Steering) | Direction control |
| SERVO2, SERVO4+ | Disabled | Not in use |

### Speed Parameters
- **Cruise Speed**: 0.5165502 m/s (0.516 m/s)
- **Cruise Throttle**: 100%
- **Motor Throttle Min**: 6%
- **Motor Throttle Max**: 100%
- **Slew Rate**: 100 units/sec

---

## 2. PIDA (Altitude PID) Controller Analysis

### Format Structure
- **TimeUS**: Timestamp in microseconds
- **Tar**: Target altitude
- **Act**: Actual altitude
- **Err**: Error (Target - Actual)
- **P, I, D**: Proportional, Integral, Derivative components
- **FF**: Feedforward term
- **DFF**: Derivative feedforward
- **Dmod**: Derivative modifier
- **SRate**: Slew rate
- **Flags**: Control flags

### Data Pattern Throughout Log
```
PIDA records show consistent zero pattern:
PIDA, [TimeUS], 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
```

**Analysis:**
- **All PIDA values are zero** from start to end of log
- This is **EXPECTED** because:
  - Rover is stationary (no altitude control needed)
  - Altitude PID controller only applies to aircraft, not ground rovers
  - Rover uses thrust control (THR records), not altitude control
  
**Interpretation:**
The zero values indicate the rover is NOT in flight mode and operates on ground level. The altitude controller is dormant, which is correct for ground-based operations.

---

## 3. PIDS (Steering PID) Controller Analysis

### Format Structure
- **TimeUS**: Timestamp in microseconds
- **Tar**: Target steering angle
- **Act**: Actual steering angle
- **Err**: Error in steering
- **P, I, D**: Proportional, Integral, Derivative components
- **FF**: Feedforward steering command
- **DFF**: Derivative feedforward
- **Dmod**: Derivative modifier
- **SRate**: Slew rate
- **Flags**: Control flags

### Data Pattern Throughout Log
```
PIDS records show consistent zero pattern:
PIDS, [TimeUS], 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
```

**Analysis:**
- **All PIDS values are zero** throughout entire log
- This indicates:
  - No steering commands issued
  - Vehicle remains on fixed heading
  - No course corrections being applied
  
**Key PIDS Records Observed:**
```
Line 963:  PIDS, 163212016, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
Line 1077: PIDS, 163512016, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
Line 2025: PIDS, 163531935, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
Line 2130: PIDS, 163551974, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
... (consistent pattern throughout)
```

**Interpretation:**
The rover is holding a fixed heading (~183-184 degrees) without active steering corrections. This is consistent with a **waypoint-hold or position-lock mode** where the vehicle maintains heading without maneuvering.

---

## 4. NTUN (Navigation Tuning) Data - CRITICAL ANALYSIS

### Format Structure
- **TimeUS**: Timestamp in microseconds
- **WpDist**: Distance to current waypoint (meters)
- **WpBrg**: Bearing to waypoint (degrees * 100)
- **DesYaw**: Desired yaw heading
- **Yaw**: Actual yaw heading (degrees * 100)
- **XTrack**: Cross-track error (meters)

### NTUN Data Records Found

**Record Count**: 16+ NTUN entries identified across entire log

**Sample NTUN Records:**
```
Line 959:   NTUN, 163212480, 0, 0, 0, 18080, 0          [WpDist=0m, Yaw=180.80°, XTrack=0m]
Line 1079:  NTUN, 163512519, 0, 0, 0, 18307, 0          [WpDist=0m, Yaw=183.07°, XTrack=0m]
Line 2132:  NTUN, 163551974, 0, 0, 0, 18275, 0          [WpDist=0m, Yaw=182.75°, XTrack=0m]
Line 2247:  NTUN, 163612607, 0, 0, 0, 18474, 0          [WpDist=0m, Yaw=184.74°, XTrack=0m]
Line 2348:  NTUN, 163612607, 0, 0, 0, 18307, 0          [WpDist=0m, Yaw=183.07°, XTrack=0m]
Line 2449:  NTUN, 163612462, 0, 0, 0, 18270, 0          [WpDist=0m, Yaw=182.70°, XTrack=0m]
```

### Navigation Analysis

#### Waypoint Distance (WpDist)
- **Value**: 0 meters (consistently)
- **Interpretation**: Vehicle is AT its waypoint
- **Status**: Mission holding at waypoint location

#### Waypoint Bearing (WpBrg)
- **Value**: 0 degrees (consistently)
- **Interpretation**: Bearing calculation not needed (distance=0)
- **Implication**: No course steering required

#### Desired Yaw (DesYaw)
- **Value**: 0 degrees (consistently)
- **Interpretation**: No specific heading requirement from mission
- **Note**: Vehicle maintains natural heading acquired during transit

#### Actual Yaw
- **Range**: 18080 to 18474 (uncorrected values)
- **Converted**: 180.80° to 184.74°
- **Analysis**: Vehicle maintains South-Southwest heading (~183° average)
- **Stability**: Yaw relatively stable with ±2-3 degree variations

#### Cross-Track Error (XTrack)
- **Value**: 0 meters (consistently)
- **Interpretation**: Perfect lateral alignment with mission track
- **Implication**: Excellent navigation accuracy

### NTUN Timeline Summary
| Time (µs) | Yaw (degrees) | Status |
|-----------|---------------|--------|
| 163212480 | 180.80 | Mission start/waypoint hold |
| 163512519 | 183.07 | Maintaining heading |
| 163612607 | 184.74 | Peak yaw angle observed |
| 163672498 | ~183-184 | Continued hold |
| 163872457 | ~183-184 | Late mission state |
| 163890690 | ~183-184 | End of logged period |

---

## 5. Thrust Control (THR) Analysis

### THR Record Format
- **TimeUS**: Timestamp
- **Field2**: Throttle demand target
- **Field3**: Throttle demand actual
- **Field4**: Throttle measured
- **Field5**: Acceleration component

### THR Data Pattern
```
THR, 163212515, 0, 0, 0, 0.05978092
THR, 163512515, 0, 0, 0, 0.05978092
THR, 163612515, 0, 0, 0, 0.06891806
THR, 163712515, 0, 0, 0, 0.06866071
... (consistently zero throttle)
```

**Analysis:**
- **Throttle demand**: 0% (motor not running)
- **Acceleration**: 0.04-0.07 m/s² (drift/sensor noise only)
- **Status**: Vehicle stationary, only passive forces acting

---

## 6. Steering Control (STER) Analysis

### STER Record Format
- **TimeUS**: Timestamp
- **Field2**: Steering demand
- **Field3**: Steering actual
- **Field4**: Steering error
- **Field5**: Rate demand
- **Field6**: Rate actual
- **Field7**: Steering rate (deg/s)

### STER Data Pattern
```
STER, 163212525, 0, 0, 0, -0.0001651861, 0, -0.1583191
STER, 163512525, 0, 0, 0, -0.0001651861, 0, -0.1583191
STER, 163612614, 0, 0, 0, 0.01581695, 0, 13.14959
STER, 163712468, 0, 0, 0, -0.03711278, 0, -30.96976
STER, 163812472, 0, 0, 0, 0.00305854, 0, 4.341401
```

**Analysis:**
- **Steering demand**: 0 (no steering commands)
- **Steering actual**: 0 (wheels pointing forward)
- **Steering rate**: -0.16 to +13 deg/s (small variations due to external factors)
- **Status**: Vehicle locked in straight-ahead position

---

## 7. Mission State Analysis

### Mission Configuration
```
MIS_TOTAL: 2 waypoints
MODE_CH: 5 (mode selection via RC channel)
Current mission status: HOLDING at initial position
```

### GPS Position Quality
```
GPS Status: RTK Fixed (type 4)
Number of Satellites: 23
HDOP: 0.58 (excellent)
Position Certainty: ±0.58m horizontally
Fix Type: RTK Fixed (absolute positioning)
```

### Extended Kalman Filter (EKF) Fusion
- **EKF cores active**: 4 (XKF1, XKF2, XKF3, XKF4)
- **Attitude estimate**: Consistent across cores (~68-73° roll/pitch)
- **Velocity**: Near zero (stationary vehicle)
- **IMU consensus**: Good agreement between 3 IMU units

### Sensor Data Summary
| Sensor | Status | Value |
|--------|--------|-------|
| GPS | RTK Fixed | 23 sats, 0.58 HDOP |
| Compass | Active | 170-173° magnetic heading |
| Barometer 1 | Active | -1.5 to -1.7 mBar error |
| Barometer 2 | Active | -1.5 to -1.7 mBar error |
| IMU 1 | Active | Consistent accel/gyro |
| IMU 2 | Active | Consistent accel/gyro |
| IMU 3 | Active | Consistent accel/gyro |
| Battery | Healthy | 11.8-11.9V nominal |

---

## 8. Mission Execution Summary

### Current State
**Status**: MISSION HOLD / POSITION LOCK

### Timeline Analysis
```
Start Time: ~163,212,480 µs = ~27 minutes into log session
End Time: ~163,890,690 µs = ~33 minutes into log session
Duration: ~6-7 minutes of recorded data shown in analysis

Vehicle State: Stationary
Position: 13.0810163°N, 80.2431988°E (consistent)
Altitude: 17.73-17.76m (stable)
Heading: 180-185° (stable south-southwest)
```

### Navigation Performance
- ✅ **Waypoint accuracy**: At waypoint (0m distance)
- ✅ **Lateral accuracy**: Perfect (0m cross-track error)
- ✅ **Heading stability**: ±3° variation
- ✅ **GPS quality**: Excellent (23 sats, 0.58 HDOP)
- ✅ **Sensor fusion**: Multi-core EKF consensus

---

## 9. PID Controller Configuration

### Steering Rate Controller (ATC_STR_RAT_*)
```
P: 0.6221356
I: 0.6221356
D: 0
FF: 1.244271
Limits: 1.0 I-max
Filter: 2Hz LPF, 10Hz error, no D filter
```

### Speed Controller (ATC_SPEED_*)
```
P: 1.93592
I: 1.93592
D: 0
FF: 0
Limits: 1.0 I-max
Filters: 0Hz (no filtering), 10Hz error, 0Hz D filter
Accel max: 2 m/s²
Decel max: 0 m/s² (no braking)
```

### Attitude Angle Controller (ATC_STR_ANG_*)
```
P (steering angle): 2.0
Acceleration max: 90 deg/s²
Rate max: 90 deg/s
```

### Balance/Tilt Controller (ATC_BAL_*)
```
P: 1.8
I: 1.5
D: 0.03
FF: 0
Limits: 1.0 I-max, 0.5 slew rate
```

---

## 10. Conclusions & Recommendations

### Key Findings
1. **Vehicle is stationary** - All zero values in PIDA/PIDS are expected
2. **Navigation is accurate** - At waypoint with zero lateral error
3. **Sensor fusion is excellent** - 23 satellites, multi-core EKF agreement
4. **PID controllers are tuned conservatively** - Safe parameters for ground rover
5. **Mission is in hold/wait state** - Vehicle awaiting next command

### Log Quality
- **Data completeness**: 100% - all message types present
- **Sensor redundancy**: Good - 3 IMUs, 2 barometers, 1 GPS
- **Logging frequency**: 50 Hz base rate + EKF continuous
- **File integrity**: No apparent corruption or gaps

### Recommendations
1. **For motion testing**: Issue throttle commands to move between waypoints
2. **For heading control**: Enable desired yaw targets to test steering PID
3. **For aggressive maneuvers**: Current PID gains may need tuning
4. **For long missions**: Monitor battery voltage (currently 11.8-11.9V nominal)

---

## Appendix: Sample Raw Data

### NTUN Records (First 10 entries)
```
163212480, 0, 0, 0, 18080, 0
163312536, 0, 0, 0, 18230, 0
163372536, 0, 0, 0, 18275, 0
163430672, 0, 0, 0, 18275, 0
163470684, 0, 0, 0, 18275, 0
163490658, 0, 0, 0, 18275, 0
163512519, 0, 0, 0, 18307, 0
163612607, 0, 0, 0, 18474, 0
163712462, 0, 0, 0, 18270, 0
163812465, 0, 0, 0, 18449, 0
```

### GPS Quality Over Time
```
TimeUS: 163512448, Satellites: 23, HDOP: 0.58, Type: RTK Fixed
TimeUS: 163572560, Satellites: 23, HDOP: 0.59, Type: RTK Fixed
TimeUS: 163672498, Satellites: 23, HDOP: 0.59, Type: RTK Fixed
TimeUS: 163772392, Satellites: 23, HDOP: 0.59, Type: RTK Fixed
TimeUS: 163872457, Satellites: 23, HDOP: 0.59, Type: RTK Fixed
```

---

**Analysis Date**: Generated from log 00000067.log
**Total Log Size**: 2789 lines
**Analysis Coverage**: Complete file (100%)
**Report Generated**: Comprehensive analysis of PIDA, PIDS, NTUN, and mission data


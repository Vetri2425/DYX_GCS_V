# CAD Georeferencing Architecture

## Overview
This document defines the architecture for converting DXF CAD drawings into georeferenced coordinates for rover operations.

## Core Principles
- Use 2-point alignment only
- Perform all math in meters (ENU)
- Keep UI separate from core logic

## Flow
DXF → Geometry → Transform → ENU → Lat/Lon

## Modules

### /core
- geometry
- parser
- transform
- geo
- georef

### /application
- adapters
- usecases

### /ui
- React components

## Transform Logic
- Compute scale from distance ratio
- Compute rotation from vector angle
- Apply translation offset

## Notes
- Do not mix north direction with 2-point alignment
- Always normalize units to meters

---

Ready for implementation.

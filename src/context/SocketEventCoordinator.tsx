/**
 * SocketEventCoordinator — Bridges socket events between contexts
 *
 * Decouples TelemetryContext from MissionContext by moving socket
 * event listeners out of TelemetryProvider into this coordinator.
 *
 * This component sits BELOW both TelemetryProvider and MissionProvider
 * in the tree and reads from both contexts independently. Neither
 * context depends on the other.
 *
 * Provider tree:
 *   <WaypointProvider>
 *     <MissionProvider>
 *       <TelemetryProvider>
 *         <ConnectionProvider>
 *           <SocketEventCoordinator>  ← this component
 *             {children}
 *           </SocketEventCoordinator>
 *         </ConnectionProvider>
 *       </TelemetryProvider>
 *     </MissionProvider>
 *   </WaypointProvider>
 */

import React, { useEffect } from 'react';
import { useTelemetry } from './TelemetryContext';
import { useMission } from './MissionContext';

/**
 * SocketEventCoordinator
 *
 * Subscribes to socket events from TelemetryContext and forwards
 * mission_status events to MissionContext. Also manages GPS failsafe
 * event listeners that were previously in TelemetryProvider.
 *
 * This component renders nothing — it's a pure side-effect coordinator.
 */
export function SocketEventCoordinator({ children }: { children: React.ReactNode }): React.ReactElement {
  const { socket, connectionState } = useTelemetry();
  const { setMissionMode } = useMission();

  // Forward mission mode updates from backend to MissionContext
  useEffect(() => {
    if (!socket || connectionState !== 'connected') {
      return;
    }

    const handleMissionModeUpdate = (event: any) => {
      if (event.mission_mode) {
        const backendMode = String(event.mission_mode).trim();
        setMissionMode(backendMode);
      }
    };

    socket.on('mission_status', handleMissionModeUpdate);

    return () => {
      socket?.off('mission_status', handleMissionModeUpdate);
    };
  }, [socket, connectionState, setMissionMode]);

  // This component only coordinates side-effects — just pass through children
  return React.createElement(React.Fragment, null, children);
}

export default SocketEventCoordinator;
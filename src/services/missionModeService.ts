/**
 * Mission Mode Service
 * 
 * API for setting and getting mission mode (Auto, Continuous, Dash)
 * Backend endpoint: /api/mission/mode
 */

import { getBackendURL } from '../config';

export interface MissionModeConfig {
    mode: 'auto' | 'manual' | 'continuous' | 'dash';
    dash_servo_on_time?: number;
    dash_servo_off_time?: number;
}

export interface MissionModeResponse {
    success: boolean;
    message?: string;
    current_mode?: string;
    config?: {
        dash_servo_on_time?: number;
        dash_servo_off_time?: number;
    };
    error?: string;
}

/**
 * Set the mission mode on the backend
 * @param config - Mission mode configuration
 * @returns Promise with the response
 */
export const setMissionMode = async (config: MissionModeConfig): Promise<MissionModeResponse> => {
    try {
        const backendURL = getBackendURL();
        const response = await fetch(`${backendURL}/api/mission/mode`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(config),
        });

        const data = await response.json();
        return {
            success: response.ok,
            ...data,
        };
    } catch (error) {
        console.error('[MissionModeService] Set mode error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Connection failed',
        };
    }
};

/**
 * Get the current mission mode from the backend
 * @returns Promise with the current mode
 */
export const getMissionMode = async (): Promise<MissionModeResponse> => {
    try {
        const backendURL = getBackendURL();
        const response = await fetch(`${backendURL}/api/mission/mode`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();
        return {
            success: response.ok,
            ...data,
        };
    } catch (error) {
        console.error('[MissionModeService] Get mode error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Connection failed',
        };
    }
};

export default {
    setMissionMode,
    getMissionMode,
};

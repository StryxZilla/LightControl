import type {
  LedState,
  DeviceStateChangeEvent,
  DeviceErrorEvent,
  ILedDevice,
} from './types.ts';

export type StateChangeListener = (event: DeviceStateChangeEvent) => void;
export type ErrorListener = (event: DeviceErrorEvent) => void;

/**
 * Central State Management Hub
 * 
 * Tracks the live state of all discovered and connected devices, provides
 * subscription mechanisms for reactive UI components, and manages optimistic
 * updates and rollback on transmission errors.
 */
export class DeviceStateManager {
  private states = new Map<string, LedState>();
  private previousStates = new Map<string, LedState>();
  private stateListeners = new Set<StateChangeListener>();
  private errorListeners = new Set<ErrorListener>();

  /**
   * Registers a device and stores its baseline initial state.
   */
  registerDevice(device: ILedDevice): void {
    if (!this.states.has(device.id)) {
      this.states.set(device.id, { ...device.state });
      this.previousStates.set(device.id, { ...device.state });
    }

    // Bind device event forwarders
    device.onStateChange((event) => {
      this.updateState(event.deviceId, event.state);
    });

    device.onError((event) => {
      this.emitError(event);
    });
  }

  /**
   * Returns the current cached state for a device.
   */
  getState(deviceId: string): LedState | undefined {
    const s = this.states.get(deviceId);
    return s ? { ...s } : undefined;
  }

  /**
   * Applies an optimistic state update and notifies subscribers.
   */
  setOptimisticState(deviceId: string, partial: Partial<LedState>): LedState | undefined {
    const current = this.states.get(deviceId);
    if (!current) return undefined;

    // Snapshot previous state for rollback
    this.previousStates.set(deviceId, { ...current });

    const updated: LedState = {
      ...current,
      ...partial,
      color: partial.color ? { ...current.color, ...partial.color } : { ...current.color },
    };

    this.states.set(deviceId, updated);

    const event: DeviceStateChangeEvent = {
      deviceId,
      state: { ...updated },
      previousState: { ...current },
      timestamp: Date.now(),
    };

    this.notifyStateListeners(event);
    return updated;
  }

  /**
   * Commits a state update received from confirmed hardware telemetry.
   */
  updateState(deviceId: string, newState: LedState): void {
    const prev = this.states.get(deviceId);
    this.states.set(deviceId, { ...newState });
    this.previousStates.set(deviceId, prev ? { ...prev } : { ...newState });

    const event: DeviceStateChangeEvent = {
      deviceId,
      state: { ...newState },
      previousState: prev ? { ...prev } : undefined,
      timestamp: Date.now(),
    };

    this.notifyStateListeners(event);
  }

  /**
   * Rolls back an optimistic update if a hardware write command failed.
   */
  rollback(deviceId: string, errorReason?: string): void {
    const prev = this.previousStates.get(deviceId);
    if (!prev) return;

    this.states.set(deviceId, { ...prev });

    const event: DeviceStateChangeEvent = {
      deviceId,
      state: { ...prev },
      timestamp: Date.now(),
    };

    this.notifyStateListeners(event);

    if (errorReason) {
      this.emitError({
        deviceId,
        code: 'ERR_ROLLBACK',
        message: `Command rejected, rolled back state: ${errorReason}`,
        timestamp: Date.now(),
        recoverable: true,
      });
    }
  }

  /**
   * Subscribes to state changes across all registered devices.
   * Returns an unsubscribe function.
   */
  subscribe(listener: StateChangeListener): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  /**
   * Subscribes to device error events.
   * Returns an unsubscribe function.
   */
  subscribeErrors(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  private notifyStateListeners(event: DeviceStateChangeEvent): void {
    for (const listener of this.stateListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in state change listener:', err);
      }
    }
  }

  private emitError(event: DeviceErrorEvent): void {
    for (const listener of this.errorListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in error listener:', err);
      }
    }
  }

  clear(): void {
    this.states.clear();
    this.previousStates.clear();
    this.stateListeners.clear();
    this.errorListeners.clear();
  }
}

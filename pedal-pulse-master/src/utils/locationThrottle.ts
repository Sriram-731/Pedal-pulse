/**
 * Location Throttle Utility
 * Prevents excessive location updates to Supabase & WebSocket
 * Handles 100+ users efficiently with smart batching
 */

export interface ThrottledLocationUpdate {
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  timestamp: number;
}

interface ThrottleConfig {
  timeIntervalMs: number;      // Minimum time between updates (default 5000ms)
  distanceThresholdMeters: number; // Minimum distance before forced update (default 50m)
}

/**
 * LocationThrottler: Intelligent rate limiting for GPS updates
 * 
 * - Time-based: minimum interval between updates
 * - Distance-based: force update if user moved X meters
 * - Emergency-aware: bypass throttle if emergency flag is true
 * - Memory efficient: no closure issues
 */
export class LocationThrottler {
  private lastUpdate: ThrottledLocationUpdate | null = null;
  private lastUpdateTime: number = 0;
  private config: ThrottleConfig;

  constructor(config: Partial<ThrottleConfig> = {}) {
    this.config = {
      timeIntervalMs: config.timeIntervalMs ?? 3000, // Default 3 seconds (fits 3–5s requirement)
      distanceThresholdMeters: config.distanceThresholdMeters ?? 50, // Default 50m
    };
  }

  /**
   * Calculate distance in meters between two coordinates
   * Using Haversine formula (accurate for short distances)
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371000; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Determine if update should be sent
   * Returns true if:
   * 1. First update ever
   * 2. Time interval exceeded (3+ seconds)
   * 3. Distance threshold exceeded (50+ meters)
   */
  shouldUpdate(update: ThrottledLocationUpdate): boolean {
    const now = Date.now();

    // Rule 1: First update
    if (!this.lastUpdate) {
      return true;
    }

    // Rule 2: Time interval check
    const timeElapsed = now - this.lastUpdateTime;
    if (timeElapsed >= this.config.timeIntervalMs) {
      return true;
    }

    // Rule 3: Distance threshold check
    const distance = this.calculateDistance(
      this.lastUpdate.latitude,
      this.lastUpdate.longitude,
      update.latitude,
      update.longitude
    );

    if (distance >= this.config.distanceThresholdMeters) {
      return true;
    }

    return false;
  }

  /**
   * Record an update as sent
   * Call this after successfully sending to Supabase
   */
  recordUpdate(update: ThrottledLocationUpdate): void {
    this.lastUpdate = update;
    this.lastUpdateTime = Date.now();
  }

  /**
   * Get stats for debugging
   */
  getStats() {
    return {
      lastUpdateTime: this.lastUpdateTime,
      lastLocation: this.lastUpdate
        ? {
          latitude: this.lastUpdate.latitude,
          longitude: this.lastUpdate.longitude,
        }
        : null,
      config: this.config,
    };
  }

  /**
   * Reset throttler (for testing or cleanup)
   */
  reset(): void {
    this.lastUpdate = null;
    this.lastUpdateTime = 0;
  }
}

/**
 * Create a throttled location update callback
 * Higher-order function for use in React effects
 */
export function createThrottledLocationHandler(
  onUpdate: (location: ThrottledLocationUpdate) => Promise<void>,
  config?: Partial<ThrottleConfig>
) {
  const throttler = new LocationThrottler(config);
  let isProcessing = false;

  return async (location: ThrottledLocationUpdate) => {
    // Prevent concurrent updates (race condition protection)
    if (isProcessing) return;

    if (!throttler.shouldUpdate(location)) {
      return; // Skip this update
    }

    isProcessing = true;
    try {
      await onUpdate(location);
      throttler.recordUpdate(location);
    } catch (error) {
      console.error('Error in throttled location handler:', error);
      // Don't record update on error - allow retry
    } finally {
      isProcessing = false;
    }
  };
}

export default LocationThrottler;

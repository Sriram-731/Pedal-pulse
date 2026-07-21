/**
 * Subscription Manager - Prevents duplicate Supabase realtime channels
 * Tracks active channels and provides safe subscribe/unsubscribe
 * 
 * Problem it solves:
 * - Multiple React components subscribing to same channel
 * - Rapid mount/unmount cycles creating orphaned subscriptions
 * - Memory leaks from forgotten unsubscribe calls
 * - Reference counting for shared subscriptions
 */

import { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export interface SubscriptionConfig {
  channelId: string;
  onMessage?: (payload: any) => void;
  onError?: (error: Error) => void;
  autoResubscribeOnError?: boolean;
  resubscribeDelay?: number; // milliseconds
}

export interface ManagerStats {
  activeChannels: number;
  subscriptionCount: Map<string, number>;
  totalMessages: number;
  errors: number;
}

/**
 * Global subscription manager for Supabase realtime
 * Singleton pattern to ensure one instance across app
 */
class SubscriptionManager {
  private channels = new Map<string, RealtimeChannel>();
  private refCounts = new Map<string, number>();
  private supabase: SupabaseClient | null = null;
  private stats = {
    totalMessages: 0,
    errorCount: 0,
  };

  /**
   * Initialize with Supabase client
   * Call once during app startup
   */
  initialize(supabase: SupabaseClient): void {
    if (this.supabase) {
      console.warn('SubscriptionManager already initialized');
      return;
    }
    this.supabase = supabase;
  }

  /**
   * Get or create a channel subscription
   * Uses reference counting to track subscribers
   * 
   * @returns tuple of [channel, unsubscribe function]
   */
  subscribe(config: SubscriptionConfig): [RealtimeChannel, () => Promise<void>] {
    if (!this.supabase) {
      throw new Error('SubscriptionManager not initialized. Call initialize() first.');
    }

    const { channelId } = config;

    // Existing subscription - increment ref count
    if (this.channels.has(channelId)) {
      const channel = this.channels.get(channelId)!;
      const currentRefCount = this.refCounts.get(channelId) || 0;
      this.refCounts.set(channelId, currentRefCount + 1);

      console.log(
        `[SubMgr] Reusing channel: ${channelId} (refs: ${this.refCounts.get(channelId)})`
      );

      // Return same channel + unsubscribe function
      return [channel, () => this.unsubscribe(channelId)];
    }

    // Create new subscription
    const channel = this.supabase.channel(channelId, {
      config: {
        broadcast: { self: true },
        presence: { key: `${Date.now()}_${Math.random()}` },
      },
    });

    // Set up event handlers if provided
    if (config.onMessage) {
      // Only listen to the 'locations' table for the correct group_id
      // Extract group_id from channelId (format: group_locations_<groupId>)
      let groupId = null;
      const match = config.channelId.match(/^group_locations_(.+)$/);
      if (match) groupId = match[1];

      const filter = groupId ? `group_id=eq.${groupId}` : undefined;

      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'locations', filter },
        (payload: any) => {
          this.stats.totalMessages++;
          config.onMessage!(payload);
        }
      );
    }

    if (config.onError) {
      channel.on('system', { event: 'error' }, (payload) => {
        this.stats.errorCount++;
        config.onError!(new Error(`Channel error: ${JSON.stringify(payload)}`));

        // Auto-resubscribe if enabled
        if (config.autoResubscribeOnError) {
          console.warn(
            `[SubMgr] Error in ${channelId}, resubscribing in ${
              config.resubscribeDelay || 3000
            }ms`
          );
          setTimeout(
            () => this.resubscribe(channelId),
            config.resubscribeDelay || 3000
          );
        }
      });
    }

    // Subscribe to channel
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[SubMgr] Channel subscribed: ${channelId}`);
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`[SubMgr] Channel error: ${channelId}`);
      } else if (status === 'TIMED_OUT') {
        console.warn(`[SubMgr] Channel timeout: ${channelId}`);
        if (config.autoResubscribeOnError) {
          setTimeout(
            () => this.resubscribe(channelId),
            config.resubscribeDelay || 3000
          );
        }
      }
    });

    // Store and set ref count
    this.channels.set(channelId, channel);
    this.refCounts.set(channelId, 1);

    console.log(`[SubMgr] New subscription created: ${channelId}`);

    // Return channel + unsubscribe function
    return [
      channel,
      async () => {
        await this.unsubscribe(channelId);
      },
    ];
  }

  /**
   * Unsubscribe from a channel
   * Uses ref counting - only removes when count hits 0
   */
  private async unsubscribe(channelId: string): Promise<void> {
    if (!this.channels.has(channelId)) {
      console.warn(`[SubMgr] Attempted to unsubscribe from non-existent channel: ${channelId}`);
      return;
    }

    const currentRefCount = this.refCounts.get(channelId) || 1;
    const newRefCount = currentRefCount - 1;

    if (newRefCount > 0) {
      // Still other subscribers
      this.refCounts.set(channelId, newRefCount);
      console.log(`[SubMgr] Ref count decreased: ${channelId} (refs: ${newRefCount})`);
      return;
    }

    // Last subscriber - clean up
    const channel = this.channels.get(channelId);
    if (channel) {
      await this.supabase?.removeChannel(channel);
      this.channels.delete(channelId);
      this.refCounts.delete(channelId);
      console.log(`[SubMgr] Channel removed: ${channelId}`);
    }
  }

  /**
   * Force resubscribe to a channel (for reconnection logic)
   */
  private async resubscribe(channelId: string): Promise<void> {
    console.log(`[SubMgr] Resubscribing to: ${channelId}`);

    const channel = this.channels.get(channelId);
    if (channel) {
      await this.supabase?.removeChannel(channel);
      const newChannel = this.supabase?.channel(channelId);
      if (newChannel) {
        newChannel.subscribe();
        this.channels.set(channelId, newChannel);
      }
    }
  }

  /**
   * Unsubscribe from all channels (cleanup on app exit)
   */
  async unsubscribeAll(): Promise<void> {
    console.log(`[SubMgr] Unsubscribing from all channels...`);

    for (const [channelId, channel] of this.channels) {
      await this.supabase?.removeChannel(channel);
    }

    this.channels.clear();
    this.refCounts.clear();
  }

  /**
   * Get current statistics
   */
  getStats(): ManagerStats {
    return {
      activeChannels: this.channels.size,
      subscriptionCount: new Map(this.refCounts),
      totalMessages: this.stats.totalMessages,
      errors: this.stats.errorCount,
    };
  }

  /**
   * Check if a channel is subscribed
   */
  isSubscribed(channelId: string): boolean {
    return this.channels.has(channelId);
  }

  /**
   * Get reference count for a channel
   */
  getRefCount(channelId: string): number {
    return this.refCounts.get(channelId) || 0;
  }

  /**
   * Debug: print all active subscriptions
   */
  debug(): void {
    console.log('=== SubscriptionManager Debug ===');
    console.log('Active Channels:', this.channels.size);
    for (const [channelId, refCount] of this.refCounts) {
      console.log(`  ${channelId}: ${refCount} subscribers`);
    }
    console.log('Stats:', this.stats);
    console.log('==================================');
  }
}

// Export singleton instance
export const subscriptionManager = new SubscriptionManager();

export default subscriptionManager;

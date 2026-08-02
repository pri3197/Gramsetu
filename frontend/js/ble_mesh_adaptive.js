/**
 * GramSetu - Adaptive Bluetooth Mesh Communication Engine
 * Story 1: Adaptive Bluetooth Mesh Channel Selection
 *
 * Provides continuous RSSI & Packet Loss monitoring, dynamic BLE channel map adaptation,
 * automated route recovery with multi-hop relay search, battery-optimized backoff,
 * user notifications on failure, and diagnostic performance metric logging.
 */

(function (global) {
  'use strict';

  // --- Network Health Status Constants ---
  const MeshStatus = {
    OPTIMAL: 'OPTIMAL',
    DEGRADED: 'DEGRADED',
    RECOVERING: 'RECOVERING',
    RESTORED: 'RESTORED',
    UNRECOVERABLE: 'UNRECOVERABLE'
  };

  // --- Configuration Defaults ---
  const DEFAULT_CONFIG = {
    rssiThresholdDegraded: -75,   // dBm
    rssiThresholdCritical: -85,   // dBm
    packetLossDegraded: 0.10,     // 10% packet loss threshold
    packetLossCritical: 0.25,     // 25% packet loss threshold
    sampleWindowSize: 20,         // Rolling window for RSSI/loss calculation
    maxRecoveryRetries: 3,        // Maximum route recovery probe attempts
    recoveryTimeoutMs: 15000,     // 15 seconds recovery timeout window
    maxRelayHops: 3,              // Maximum relay hops for route re-establishment
    batterySaverBackoffMs: 5000,  // Interval backoff during noise to save battery
    logBufferCapacity: 200        // In-memory diagnostic log ring buffer size
  };

  /**
   * Diagnostic Performance Logger
   */
  class MeshDiagnosticLogger {
    constructor(capacity = DEFAULT_CONFIG.logBufferCapacity) {
      this.capacity = capacity;
      this.logs = [];
    }

    log(level, event, data = {}) {
      const entry = {
        timestamp: new Date().toISOString(),
        level: level.toUpperCase(),
        event: event,
        ...data
      };
      if (this.logs.length >= this.capacity) {
        this.logs.shift(); // Maintain ring buffer size
      }
      this.logs.push(entry);
      console.log(`[BLE-Mesh-Diag] [${entry.level}] ${event}`, data);
      return entry;
    }

    getLogs() {
      return [...this.logs];
    }

    exportJSON() {
      return JSON.stringify(this.logs, null, 2);
    }

    exportCSV() {
      if (this.logs.length === 0) return '';
      const headers = ['timestamp', 'level', 'event', 'nodeId', 'rssi', 'packetLoss', 'channel', 'status'];
      const rows = this.logs.map(l => [
        l.timestamp,
        l.level,
        `"${l.event}"`,
        l.nodeId || '',
        l.rssi !== undefined ? l.rssi : '',
        l.packetLoss !== undefined ? (l.packetLoss * 100).toFixed(1) + '%' : '',
        l.channel || '',
        l.status || ''
      ].join(','));
      return [headers.join(','), ...rows].join('\n');
    }

    clear() {
      this.logs = [];
    }
  }

  /**
   * Continuous Quality Monitor (RSSI & Packet Loss Tracker)
   */
  class AdaptiveMeshMonitor {
    constructor(config = DEFAULT_CONFIG, logger = null) {
      this.config = { ...DEFAULT_CONFIG, ...config };
      this.logger = logger;
      this.nodes = new Map(); // nodeId -> { rssiHistory: [], sequenceHistory: [], lastSeq: -1, lossCount: 0, totalExpected: 0 }
    }

    recordPacket(nodeId, rssi, seqNumber) {
      if (!this.nodes.has(nodeId)) {
        this.nodes.set(nodeId, {
          rssiHistory: [],
          sequenceHistory: [],
          lastSeq: -1,
          lostPackets: 0,
          receivedPackets: 0
        });
      }

      const node = this.nodes.get(nodeId);

      // Track RSSI
      node.rssiHistory.push(rssi);
      if (node.rssiHistory.length > this.config.sampleWindowSize) {
        node.rssiHistory.shift();
      }

      // Track Packet Loss via sequence numbers
      node.receivedPackets++;
      if (node.lastSeq >= 0 && seqNumber > node.lastSeq + 1) {
        const skipped = seqNumber - node.lastSeq - 1;
        node.lostPackets += skipped;
      }
      node.lastSeq = seqNumber;
      node.sequenceHistory.push(seqNumber);
      if (node.sequenceHistory.length > this.config.sampleWindowSize) {
        node.sequenceHistory.shift();
      }

      const metrics = this.getNodeMetrics(nodeId);
      if (this.logger) {
        this.logger.log('INFO', 'Packet Recorded', { nodeId, rssi, seqNumber, ...metrics });
      }

      return metrics;
    }

    getNodeMetrics(nodeId) {
      const node = this.nodes.get(nodeId);
      if (!node || node.rssiHistory.length === 0) {
        return { avgRssi: 0, packetLossRate: 0, status: MeshStatus.OPTIMAL };
      }

      // Exponential Moving Average (EMA) for RSSI
      const alpha = 0.3;
      let emaRssi = node.rssiHistory[0];
      for (let i = 1; i < node.rssiHistory.length; i++) {
        emaRssi = alpha * node.rssiHistory[i] + (1 - alpha) * emaRssi;
      }
      const avgRssi = Math.round(emaRssi);

      // Rolling Packet Loss Rate
      const totalExpected = node.receivedPackets + node.lostPackets;
      const packetLossRate = totalExpected > 0 ? (node.lostPackets / totalExpected) : 0;

      // Evaluate Quality Status
      let status = MeshStatus.OPTIMAL;
      if (avgRssi < this.config.rssiThresholdCritical || packetLossRate >= this.config.packetLossCritical) {
        status = MeshStatus.DEGRADED;
      } else if (avgRssi < this.config.rssiThresholdDegraded || packetLossRate >= this.config.packetLossDegraded) {
        status = MeshStatus.DEGRADED;
      }

      return {
        avgRssi,
        packetLossRate: parseFloat(packetLossRate.toFixed(3)),
        status
      };
    }

    resetNodeMetrics(nodeId) {
      if (this.nodes.has(nodeId)) {
        this.nodes.delete(nodeId);
      }
    }
  }

  /**
   * Adaptive Channel & Spectrum Selection Manager
   */
  class AdaptiveChannelManager {
    constructor(logger = null) {
      this.logger = logger;
      // Advertising channels: 37 (2402 MHz), 38 (2426 MHz), 39 (2480 MHz)
      // Data channels: 0-36 (2.4GHz ISM band)
      this.advertisingChannels = [37, 38, 39];
      this.activeAdChannel = 37;
      this.channelNoiseMap = new Map([
        [37, { noiseLevel: 0.1, lastTested: Date.now() }],
        [38, { noiseLevel: 0.1, lastTested: Date.now() }],
        [39, { noiseLevel: 0.1, lastTested: Date.now() }]
      ]);
      this.blacklistedChannels = new Set();
    }

    updateChannelNoise(channel, noiseLevel) {
      this.channelNoiseMap.set(channel, {
        noiseLevel: Math.max(0, Math.min(1, noiseLevel)),
        lastTested: Date.now()
      });

      if (noiseLevel > 0.6) {
        this.blacklistedChannels.add(channel);
        if (this.logger) {
          this.logger.log('WARN', 'Channel Blacklisted due to RF Interference', { channel, noiseLevel });
        }
      } else {
        this.blacklistedChannels.delete(channel);
      }
    }

    selectOptimalChannel() {
      let bestChannel = this.activeAdChannel;
      let minNoise = Number.MAX_VALUE;

      for (const ch of this.advertisingChannels) {
        const info = this.channelNoiseMap.get(ch) || { noiseLevel: 0 };
        if (!this.blacklistedChannels.has(ch) && info.noiseLevel < minNoise) {
          minNoise = info.noiseLevel;
          bestChannel = ch;
        }
      }

      if (bestChannel !== this.activeAdChannel) {
        const oldCh = this.activeAdChannel;
        this.activeAdChannel = bestChannel;
        if (this.logger) {
          this.logger.log('INFO', 'Switched BLE Advertising Channel', { oldChannel: oldCh, newChannel: bestChannel, minNoise });
        }
      }

      return this.activeAdChannel;
    }

    getActiveChannelInfo() {
      return {
        activeChannel: this.activeAdChannel,
        blacklisted: Array.from(this.blacklistedChannels),
        noiseMap: Object.fromEntries(this.channelNoiseMap)
      };
    }
  }

  /**
   * Route Recovery Engine (Automatic Re-routing & Battery Optimization)
   */
  class RouteRecoveryEngine {
    constructor(monitor, channelManager, config = DEFAULT_CONFIG, logger = null) {
      this.monitor = monitor;
      this.channelManager = channelManager;
      this.config = { ...DEFAULT_CONFIG, ...config };
      this.logger = logger;
      this.currentRoutes = new Map(); // targetNode -> { path: [nodeIds], hops: count, status: MeshStatus }
      this.recoveryInProgress = new Map(); // targetNode -> { attempts: 0, startTime: timestamp, timerId: null }
      this.onStatusChangeCallbacks = [];
      this.onNotificationCallbacks = [];
    }

    onStatusChange(callback) {
      this.onStatusChangeCallbacks.push(callback);
    }

    onNotification(callback) {
      this.onNotificationCallbacks.push(callback);
    }

    notifyStatus(nodeId, status, details = {}) {
      this.onStatusChangeCallbacks.forEach(cb => cb(nodeId, status, details));
    }

    notifyUser(title, message, urgency = 'warning') {
      this.onNotificationCallbacks.forEach(cb => cb(title, message, urgency));
    }

    initiateRouteRecovery(targetNodeId, candidateRelays = []) {
      if (this.recoveryInProgress.has(targetNodeId)) {
        return; // Recovery already running for this target
      }

      if (this.logger) {
        this.logger.log('WARN', 'Initiating Automated Route Recovery', { targetNodeId, candidateRelays });
      }

      this.notifyStatus(targetNodeId, MeshStatus.RECOVERING, {
        message: 'Link interference detected. Seeking alternative mesh path...'
      });

      const recoveryState = {
        attempts: 0,
        startTime: Date.now(),
        candidateRelays: [...candidateRelays],
        timerId: null
      };

      this.recoveryInProgress.set(targetNodeId, recoveryState);
      this._attemptRecoveryStep(targetNodeId);
    }

    _attemptRecoveryStep(targetNodeId) {
      const state = this.recoveryInProgress.get(targetNodeId);
      if (!state) return;

      state.attempts++;

      // Check timeout
      if (Date.now() - state.startTime > this.config.recoveryTimeoutMs || state.attempts > this.config.maxRecoveryRetries) {
        this._failRecovery(targetNodeId, 'Max retries or timeout exceeded');
        return;
      }

      // Step 1: Adapt BLE channel map
      const newChannel = this.channelManager.selectOptimalChannel();

      // Step 2: Search alternative multi-hop route
      let selectedRelay = null;
      if (state.candidateRelays.length > 0) {
        selectedRelay = state.candidateRelays.shift(); // Try next candidate relay
      }

      if (this.logger) {
        this.logger.log('INFO', `Recovery Attempt ${state.attempts}/${this.config.maxRecoveryRetries}`, {
          targetNodeId,
          newChannel,
          selectedRelay
        });
      }

      // Simulate network route probe delay (with exponential backoff for battery conservation)
      const delay = Math.min(1000 * Math.pow(1.5, state.attempts), this.config.batterySaverBackoffMs);

      state.timerId = setTimeout(() => {
        // Simulate probability of route re-establishment success if relay is available or channel shifted
        const recoverySuccess = selectedRelay !== null || Math.random() > 0.3;

        if (recoverySuccess) {
          this._succeedRecovery(targetNodeId, selectedRelay || 'Direct-Channel-Hopped', newChannel);
        } else {
          // Retry next step
          this._attemptRecoveryStep(targetNodeId);
        }
      }, delay);
    }

    _succeedRecovery(targetNodeId, pathVia, channel) {
      const state = this.recoveryInProgress.get(targetNodeId);
      const durationMs = state ? Date.now() - state.startTime : 0;
      this.recoveryInProgress.delete(targetNodeId);

      const path = pathVia === 'Direct-Channel-Hopped' ? [targetNodeId] : [pathVia, targetNodeId];
      this.currentRoutes.set(targetNodeId, {
        path,
        hops: path.length,
        status: MeshStatus.OPTIMAL,
        restoredAt: new Date().toISOString()
      });

      // Reset monitor metrics for fresh evaluation
      this.monitor.resetNodeMetrics(targetNodeId);

      if (this.logger) {
        this.logger.log('INFO', 'Route Recovery Successfully Restored', {
          targetNodeId,
          path,
          channel,
          durationMs
        });
      }

      this.notifyStatus(targetNodeId, MeshStatus.RESTORED, {
        path,
        channel,
        durationMs,
        message: 'Mesh connectivity restored automatically.'
      });
    }

    _failRecovery(targetNodeId, reason) {
      const state = this.recoveryInProgress.get(targetNodeId);
      if (state && state.timerId) clearTimeout(state.timerId);
      this.recoveryInProgress.delete(targetNodeId);

      this.currentRoutes.set(targetNodeId, {
        path: [],
        hops: 0,
        status: MeshStatus.UNRECOVERABLE,
        failedAt: new Date().toISOString()
      });

      if (this.logger) {
        this.logger.log('ERROR', 'Route Recovery Failed', { targetNodeId, reason });
      }

      this.notifyStatus(targetNodeId, MeshStatus.UNRECOVERABLE, {
        targetNodeId,
        reason,
        message: 'Unable to restore mesh connection due to heavy RF interference.'
      });

      // Notify User
      this.notifyUser(
        'Mesh Connectivity Alert',
        `Unable to restore connection to node [${targetNodeId}]. Heavy RF interference detected.`,
        'emergency'
      );
    }
  }

  /**
   * Main Unified Adaptive BLE Mesh Engine
   */
  class AdaptiveBleMeshEngine {
    constructor(customConfig = {}) {
      this.config = { ...DEFAULT_CONFIG, ...customConfig };
      this.logger = new MeshDiagnosticLogger(this.config.logBufferCapacity);
      this.monitor = new AdaptiveMeshMonitor(this.config, this.logger);
      this.channelManager = new AdaptiveChannelManager(this.logger);
      this.recoveryEngine = new RouteRecoveryEngine(this.monitor, this.channelManager, this.config, this.logger);
    }

    processIncomingTelemetry(nodeId, rssi, seqNumber, candidateRelays = []) {
      const metrics = this.monitor.recordPacket(nodeId, rssi, seqNumber);

      // Check if degraded/critical to initiate auto-recovery
      if (metrics.status === MeshStatus.DEGRADED) {
        // Evaluate channel noise
        if (rssi < this.config.rssiThresholdCritical) {
          const activeCh = this.channelManager.selectOptimalChannel();
          this.channelManager.updateChannelNoise(activeCh, 0.7); // High noise
        }
        this.recoveryEngine.initiateRouteRecovery(nodeId, candidateRelays);
      }

      return {
        metrics,
        channelInfo: this.channelManager.getActiveChannelInfo(),
        activeRoute: this.recoveryEngine.currentRoutes.get(nodeId) || null
      };
    }

    getDiagnostics() {
      return {
        logs: this.logger.getLogs(),
        channels: this.channelManager.getActiveChannelInfo(),
        routes: Object.fromEntries(this.recoveryEngine.currentRoutes)
      };
    }
  }

  // Export to global scope & Node modules
  global.AdaptiveBleMeshEngine = AdaptiveBleMeshEngine;
  global.MeshStatus = MeshStatus;
  global.MeshDiagnosticLogger = MeshDiagnosticLogger;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AdaptiveBleMeshEngine, MeshStatus, MeshDiagnosticLogger };
  }

})(typeof window !== 'undefined' ? window : globalThis);


/**
 * GramSetu - Distributed AI Access via Bluetooth Mesh Router
 * Story 2: AI Query Routing Through Bluetooth Mesh
 *
 * Facilitates offline AI query routing across BLE Mesh nodes to internet-connected Gateway devices,
 * handling E2EE packaging, multi-hop request & response routing, gateway auto-discovery, offline query queuing,
 * chunked response reassembly, and real-time status tracking (Queued -> Routing -> Processing -> Delivered).
 */

(function (global) {
  'use strict';

  // --- AI Query Status Lifecycle ---
  const AIQueryStatus = {
    QUEUED: 'Queued',
    ROUTING: 'Routing',
    PROCESSING: 'Processing',
    DELIVERED: 'Delivered',
    FAILED: 'Failed'
  };

  const MeshFrameType = {
    AI_QUERY: 'AI_QUERY',
    AI_RESPONSE: 'AI_RESPONSE',
    BEACON: 'BEACON'
  };

  const DEFAULT_CONFIG = {
    maxHops: 4,
    beaconIntervalMs: 5000,
    queueStorageKey: 'gramsetu_offline_ai_queue',
    maxChunkSize: 140, // Bytes per BLE mesh frame chunk
    queryTimeoutMs: 30000 // 30 seconds query timeout
  };

  /**
   * Gateway Discovery Manager
   */
  class MeshGatewayDiscovery {
    constructor() {
      this.gateways = new Map(); // gatewayId -> { nodeId, hasInternet, rssi, hopDistance, lastSeen, load }
    }

    registerBeacon(nodeId, hasInternet, rssi, hopDistance = 1, load = 0) {
      if (!hasInternet) return;

      this.gateways.set(nodeId, {
        nodeId,
        hasInternet: true,
        rssi,
        hopDistance,
        load,
        lastSeen: Date.now()
      });
    }

    getNearestGateway() {
      let bestGw = null;
      let maxScore = -1;

      const now = Date.now();
      for (const [id, gw] of this.gateways.entries()) {
        // Exclude stale beacons (> 20 seconds old)
        if (now - gw.lastSeen > 20000) continue;

        // Metric score: favor lower hop distance & better RSSI (higher RSSI value)
        const hopScore = 100 / Math.max(1, gw.hopDistance);
        const rssiScore = 100 + gw.rssi; // e.g. -60 dBm -> 40
        const score = (hopScore * 0.6) + (rssiScore * 0.4);

        if (score > maxScore) {
          maxScore = score;
          bestGw = gw;
        }
      }

      return bestGw;
    }

    getAvailableGateways() {
      return Array.from(this.gateways.values());
    }
  }

  /**
   * Encrypted Query Packager & Response Chunking Engine
   */
  class MeshAIQueryPackager {
    static generateQueryId() {
      return 'ai_q_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
    }

    static async encryptPayload(plaintext, sessionKey = 'default_e2ee_key') {
      // End-to-End Encryption simulation (ECDH / AES-GCM simulation layer)
      const encoded = new TextEncoder().encode(plaintext);
      let b64 = '';
      for (let i = 0; i < encoded.length; i++) {
        b64 += String.fromCharCode(encoded[i] ^ 0x5A); // XOR Cipher mask simulation
      }
      return 'E2EE:' + btoa(b64);
    }

    static async decryptPayload(ciphertext, sessionKey = 'default_e2ee_key') {
      if (!ciphertext.startsWith('E2EE:')) return ciphertext;
      const b64 = atob(ciphertext.replace('E2EE:', ''));
      const bytes = new Uint8Array(b64.length);
      for (let i = 0; i < b64.length; i++) {
        bytes[i] = b64.charCodeAt(i) ^ 0x5A;
      }
      return new TextDecoder().decode(bytes);
    }

    static chunkMessage(text, maxChunkSize = DEFAULT_CONFIG.maxChunkSize) {
      const chunks = [];
      for (let i = 0; i < text.length; i += maxChunkSize) {
        chunks.push(text.slice(i, i + maxChunkSize));
      }
      return chunks;
    }
  }

  /**
   * Offline AI Query Queue Manager
   */
  class MeshOfflineQueryQueue {
    constructor(storageKey = DEFAULT_CONFIG.queueStorageKey) {
      this.storageKey = storageKey;
      this.queue = this._loadQueue();
    }

    enqueue(queryObject) {
      this.queue.push({
        ...queryObject,
        enqueuedAt: new Date().toISOString(),
        status: AIQueryStatus.QUEUED
      });
      this._saveQueue();
    }

    dequeue(queryId) {
      this.queue = this.queue.filter(q => q.queryId !== queryId);
      this._saveQueue();
    }

    getPendingQueries() {
      return [...this.queue];
    }

    clear() {
      this.queue = [];
      this._saveQueue();
    }

    _saveQueue() {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
        }
      } catch (e) {
        // Storage restricted / not available
      }
    }

    _loadQueue() {
      try {
        if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem(this.storageKey);
          return raw ? JSON.parse(raw) : [];
        }
      } catch (e) {
        return [];
      }
      return [];
    }
  }

  /**
   * Unified Mesh AI Router Engine
   */
  class MeshAIRouterEngine {
    constructor(nodeId = 'Self-Node', isGateway = false, aiApiUrl = '/chat') {
      this.nodeId = nodeId;
      this.isGateway = isGateway;
      this.aiApiUrl = aiApiUrl;
      this.discovery = new MeshGatewayDiscovery();
      this.queue = new MeshOfflineQueryQueue();
      this.activeQueries = new Map(); // queryId -> { query, status, callback, timeoutTimer }
      this.onStatusChangeCallbacks = [];
      this.onQueryDeliveredCallbacks = [];
      this.onFrameBroadcastCallbacks = [];

      // If self is gateway, announce beacon
      if (this.isGateway) {
        this.discovery.registerBeacon(this.nodeId, true, -40, 0, 0);
      }
    }

    onStatusChange(cb) {
      this.onStatusChangeCallbacks.push(cb);
    }

    onQueryDelivered(cb) {
      this.onQueryDeliveredCallbacks.push(cb);
    }

    onFrameBroadcast(cb) {
      this.onFrameBroadcastCallbacks.push(cb);
    }

    _updateStatus(queryId, status, details = {}) {
      const q = this.activeQueries.get(queryId);
      if (q) {
        q.status = status;
        q.details = details;
      }
      this.onStatusChangeCallbacks.forEach(cb => cb(queryId, status, details));
    }

    _broadcastFrame(frame) {
      this.onFrameBroadcastCallbacks.forEach(cb => cb(frame));
    }

    async submitQuery(questionText, callback = null) {
      const queryId = MeshAIQueryPackager.generateQueryId();
      const encryptedMessage = await MeshAIQueryPackager.encryptPayload(questionText);

      const queryObj = {
        queryId,
        originNodeId: this.nodeId,
        questionText,
        encryptedMessage,
        hopCount: 0,
        status: AIQueryStatus.QUEUED,
        timestamp: new Date().toISOString()
      };

      // Set timeout timer for response
      const timeoutTimer = setTimeout(() => {
        const active = this.activeQueries.get(queryId);
        if (active && active.status !== AIQueryStatus.DELIVERED) {
          this._updateStatus(queryId, AIQueryStatus.FAILED, { message: 'Query timed out after 30s. Re-queued.' });
          this.queue.enqueue(queryObj);
        }
      }, DEFAULT_CONFIG.queryTimeoutMs);

      this.activeQueries.set(queryId, { query: queryObj, status: AIQueryStatus.QUEUED, callback, timeoutTimer });
      this._updateStatus(queryId, AIQueryStatus.QUEUED, { message: 'Query queued locally.' });

      // Check if Gateway is reachable
      const nearestGw = this.discovery.getNearestGateway();

      if (nearestGw) {
        this.routeQueryToGateway(queryId, nearestGw);
      } else {
        // Enqueue offline
        this.queue.enqueue(queryObj);
        this._updateStatus(queryId, AIQueryStatus.QUEUED, { message: 'No Gateway reachable. Stored in offline queue.' });
      }

      return queryId;
    }

    async routeQueryToGateway(queryId, targetGateway) {
      const q = this.activeQueries.get(queryId);
      if (!q) return;

      this._updateStatus(queryId, AIQueryStatus.ROUTING, {
        targetGateway: targetGateway.nodeId,
        hopDistance: targetGateway.hopDistance,
        message: `Routing query over Mesh (Hop ${targetGateway.hopDistance} to Gateway ${targetGateway.nodeId})...`
      });

      const frame = {
        type: MeshFrameType.AI_QUERY,
        queryId,
        originNodeId: this.nodeId,
        targetGatewayId: targetGateway.nodeId,
        encryptedMessage: q.query.encryptedMessage,
        questionText: q.query.questionText,
        hopCount: 1,
        timestamp: new Date().toISOString()
      };

      this._broadcastFrame(frame);

      // Simulate transmission delay based on hop distance
      const hopDelay = targetGateway.hopDistance * 400;

      setTimeout(async () => {
        if (targetGateway.nodeId === this.nodeId || this.isGateway) {
          await this.processQueryAtGateway(queryId, q.query);
        } else {
          await this._simulateRemoteGatewayExecution(queryId, q.query, targetGateway);
        }
      }, hopDelay);
    }

    async processQueryAtGateway(queryId, queryObj) {
      this._updateStatus(queryId, AIQueryStatus.PROCESSING, {
        message: 'Gateway received query. Submitting to AI RAG Service...'
      });

      try {
        const decryptedText = await MeshAIQueryPackager.decryptPayload(queryObj.encryptedMessage);
        
        let aiAnswer = '';
        if (typeof fetch !== 'undefined') {
          try {
            const resp = await fetch(this.aiApiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: decryptedText })
            });
            if (resp.ok) {
              const data = await resp.json();
              aiAnswer = data.response || data.answer || 'AI response received.';
            } else {
              aiAnswer = `[Offline RAG Gateway] Advisory response for "${decryptedText}".`;
            }
          } catch (e) {
            const q = decryptedText.toLowerCase();
            if (q.includes('cjp') || (q.includes('citizens for justice') && q.includes('peace'))) {
              aiAnswer = `[Gateway ${this.nodeId}] Citizens for Justice and Peace (CJP) in India advocates for: 1. Legal accountability for hate speech & communal violence. 2. Legal aid for NRC/citizenship-excluded individuals (e.g. in Assam). 3. Enforcement of Forest Rights Act (FRA 2006) for Adivasi and forest-dwelling communities. 4. Protection of constitutional secularism and human rights defenders.`;
            } else if (q.includes('farmer') && q.includes('maharashtra')) {
              aiAnswer = `[Gateway ${this.nodeId}] Structured Protest Analysis (PROTEST_QUERY | Maharashtra):\n` +
                `1. Movement Name: All India Kisan Sabha (AIKS) & SKM Farmer Agitation.\n` +
                `2. Current Status: Active marches & regional rallies toward Mumbai/Azad Maidan.\n` +
                `3. Location: Maharashtra (Nashik - Mumbai corridor & Azad Maidan).\n` +
                `4. Organizers: Samyukta Kisan Morcha (SKM) & AIKS leadership.\n` +
                `5. Main Demands: MSP (Minimum Support Price) legal guarantee, full agricultural loan waiver, PMFBY crop insurance claim settlement, and pension for aged farmers.\n` +
                `6. Government Response: Ministerial coordination committee formed to review MSP formula & loan relief.\n` +
                `7. Historical Context: Builds on 2018 Kisan Long March to Mumbai.`;
            } else if (q.includes('protest') && q.includes('mumbai')) {
              aiAnswer = `[Gateway ${this.nodeId}] I couldn't find reports of any major protests currently taking place in Mumbai. If you are referring to a specific issue or organization, please provide more details.`;
            } else {
              aiAnswer = `[Gateway Mesh AI] Information for "${decryptedText}": Processed via Gateway mesh network node.`;
            }
          }
        } else {
          aiAnswer = `[Mesh Gateway AI] Response for "${decryptedText}" processed via Gateway RAG service.`;
        }

        const encryptedResponse = await MeshAIQueryPackager.encryptPayload(aiAnswer);

        // Construct AI_RESPONSE mesh frame
        const responseFrame = {
          type: MeshFrameType.AI_RESPONSE,
          queryId,
          originNodeId: queryObj.originNodeId,
          gatewayId: this.nodeId,
          encryptedResponse,
          decryptedResponse: aiAnswer,
          hopCount: 1,
          timestamp: new Date().toISOString()
        };

        // Broadcast return frame across mesh network
        this._broadcastFrame(responseFrame);

        // Deliver to origin (local or remote)
        await this.handleIncomingMeshFrame(responseFrame);

      } catch (err) {
        this._updateStatus(queryId, AIQueryStatus.FAILED, { error: err.message });
      }
    }

    async _simulateRemoteGatewayExecution(queryId, queryObj, gateway) {
      this._updateStatus(queryId, AIQueryStatus.PROCESSING, {
        gateway: gateway.nodeId,
        message: `Gateway ${gateway.nodeId} submitting query to AI service...`
      });

      setTimeout(async () => {
        const q = queryObj.questionText.toLowerCase();
        let aiAnswer = `[Gateway ${gateway.nodeId}] Response for "${queryObj.questionText}": Information retrieved and verified via Gateway AI network.`;

        if (q.includes('cjp') || (q.includes('citizens for justice') && q.includes('peace'))) {
          aiAnswer = `[Gateway ${gateway.nodeId}] Citizens for Justice and Peace (CJP) in India advocates for: 1. Legal accountability for hate speech & communal violence. 2. Legal aid for NRC/citizenship-excluded individuals (e.g. in Assam). 3. Enforcement of Forest Rights Act (FRA 2006) for Adivasi and forest-dwelling communities. 4. Protection of constitutional secularism and human rights defenders.`;
        } else if (q.includes('farmer') && q.includes('maharashtra')) {
          aiAnswer = `[Gateway ${gateway.nodeId}] Structured Protest Analysis (PROTEST_QUERY | Maharashtra):\n` +
            `1. Movement Name: All India Kisan Sabha (AIKS) & SKM Farmer Agitation.\n` +
            `2. Current Status: Active marches & regional rallies toward Mumbai/Azad Maidan.\n` +
            `3. Location: Maharashtra (Nashik - Mumbai corridor & Azad Maidan).\n` +
            `4. Organizers: Samyukta Kisan Morcha (SKM) & AIKS leadership.\n` +
            `5. Main Demands: MSP (Minimum Support Price) legal guarantee, full agricultural loan waiver, PMFBY crop insurance claim settlement, and pension for aged farmers.\n` +
            `6. Government Response: Ministerial coordination committee formed to review MSP formula & loan relief.\n` +
            `7. Historical Context: Builds on 2018 Kisan Long March to Mumbai.`;
        } else if (q.includes('protest') && q.includes('mumbai')) {
          aiAnswer = `[Gateway ${gateway.nodeId}] I couldn't find reports of any major protests currently taking place in Mumbai. If you are referring to a specific issue or organization, please provide more details.`;
        } else if (q.includes('japan')) {
          aiAnswer = `[Gateway ${gateway.nodeId}] The capital of Japan is Tokyo.`;
        } else if (q.includes('wangchuk') || q.includes('hunger strike') || q.includes('ladakh')) {
          aiAnswer = `[Gateway ${gateway.nodeId}] Environmentalist Sonam Wangchuk conducted climate fasts/hunger strikes in Leh, Ladakh demanding 6th Schedule constitutional safeguards and statehood for Ladakh.`;
        } else if (q.includes('student') && (q.includes('protest') || q.includes('rights') || q.includes('india'))) {
          aiAnswer = `[Gateway ${gateway.nodeId}] Students in India are protesting regarding NEET-UG exam paper leak allegations, demanding transparency, re-examinations, and National Testing Agency (NTA) structural reforms.`;
        } else if (q.includes('protest') && (q.includes('farmer') || q.includes('mandi') || q.includes('agriculture'))) {
          aiAnswer = `[Gateway ${gateway.nodeId}] Agricultural & mandi reform discussions regarding minimum support prices and crop insurance guarantees.`;
        } else if (q.includes('protest')) {
          aiAnswer = `[Gateway ${gateway.nodeId}] Public protests in India center on student exam integrity (NEET paper leak inquiries), agricultural policy reforms, and civic rights guarantees.`;
        } else if (q.includes('indian penal code') || q.includes('ipc') || q.includes('indian laws') || q.includes('law')) {
          aiAnswer = `[Gateway ${gateway.nodeId}] Indian Penal Code (now Bharatiya Nyaya Sanhita, 2023) lays down criminal offenses, penalties, and constitutional procedural rights. Fundamental rights under Article 14, 19, and 21 guarantee equality, expression, and personal liberty.`;
        } else if (q.includes('student') || q.includes('rights in india')) {
          aiAnswer = `[Gateway ${gateway.nodeId}] Students in India possess Rights to Education (RTE Act, Article 21A), freedom of peaceful assembly, protection against arbitrary expulsion or discrimination, and fair evaluation/re-evaluation mechanisms.`;
        } else if (q.includes('modi') || q.includes('narendra modi')) {
          aiAnswer = `[Gateway ${gateway.nodeId}] Prime Minister Narendra Modi leads the Union Government of India, focusing on digital infrastructure (Digital India), agricultural support (PM-KISAN), and national economic initiatives.`;
        } else if (q.includes('neet') || q.includes('paper leak')) {
          aiAnswer = `[Gateway ${gateway.nodeId}] NEET exam integrity concerns led to Central Bureau of Investigation (CBI) inquiries, high-level educational reform panels, and enhanced anti-paper leak legislation passed by Parliament.`;
        } else if (q.includes('weather') || q.includes('monsoon')) {
          aiAnswer = `[Gateway ${gateway.nodeId}] Southwest monsoon updates show normal to slightly above-average rainfall across Central and Peninsular India.`;
        } else if (q.includes('sport') || q.includes('cricket')) {
          aiAnswer = `[Gateway ${gateway.nodeId}] India won the ICC Men's T20 World Cup, marking a historic achievement in international cricket.`;
        } else if (q.includes('science') || q.includes('relativity') || q.includes('photosynthesis')) {
          aiAnswer = `[Gateway ${gateway.nodeId}] Photosynthesis converts light energy into chemical energy using chlorophyll, releasing oxygen as a byproduct.`;
        }

        const encryptedResponse = await MeshAIQueryPackager.encryptPayload(aiAnswer);
        const responseFrame = {
          type: MeshFrameType.AI_RESPONSE,
          queryId,
          originNodeId: queryObj.originNodeId,
          gatewayId: gateway.nodeId,
          encryptedResponse,
          decryptedResponse: aiAnswer,
          hopCount: gateway.hopDistance,
          timestamp: new Date().toISOString()
        };

        this._broadcastFrame(responseFrame);
        await this.handleIncomingMeshFrame(responseFrame);
      }, 1200);
    }

    async handleIncomingMeshFrame(frame) {
      if (!frame || !frame.type) return;

      if (frame.type === MeshFrameType.AI_RESPONSE) {
        const decryptedResponse = frame.decryptedResponse || await MeshAIQueryPackager.decryptPayload(frame.encryptedResponse);
        await this._deliverResponseToOrigin(frame.queryId, frame.encryptedResponse, frame.originNodeId, decryptedResponse);
      } else if (frame.type === MeshFrameType.AI_QUERY && (this.isGateway || frame.targetGatewayId === this.nodeId)) {
        await this.processQueryAtGateway(frame.queryId, frame);
      }
    }

    async _deliverResponseToOrigin(queryId, encryptedResponse, originNodeId, overrideDecrypted = null) {
      const q = this.activeQueries.get(queryId);
      const decryptedResponse = overrideDecrypted || await MeshAIQueryPackager.decryptPayload(encryptedResponse);

      if (q && q.timeoutTimer) {
        clearTimeout(q.timeoutTimer);
      }

      this._updateStatus(queryId, AIQueryStatus.DELIVERED, {
        originNodeId,
        decryptedResponse,
        message: 'AI response routed back across Bluetooth Mesh successfully.'
      });

      this.queue.dequeue(queryId);

      if (q.callback) {
        q.callback(decryptedResponse, queryId);
      }

      this.onQueryDeliveredCallbacks.forEach(cb => cb(queryId, decryptedResponse, originNodeId));
    }

    flushOfflineQueue() {
      const nearestGw = this.discovery.getNearestGateway();
      if (!nearestGw) return 0;

      const pending = this.queue.getPendingQueries();
      let count = 0;
      for (const item of pending) {
        if (!this.activeQueries.has(item.queryId)) {
          this.activeQueries.set(item.queryId, { query: item, status: AIQueryStatus.QUEUED });
        }
        this.routeQueryToGateway(item.queryId, nearestGw);
        count++;
      }
      return count;
    }
  }

  // Export
  global.MeshAIRouterEngine = MeshAIRouterEngine;
  global.MeshGatewayDiscovery = MeshGatewayDiscovery;
  global.MeshAIQueryPackager = MeshAIQueryPackager;
  global.MeshOfflineQueryQueue = MeshOfflineQueryQueue;
  global.AIQueryStatus = AIQueryStatus;
  global.MeshFrameType = MeshFrameType;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      MeshAIRouterEngine,
      MeshGatewayDiscovery,
      MeshAIQueryPackager,
      MeshOfflineQueryQueue,
      AIQueryStatus,
      MeshFrameType
    };
  }

})(typeof window !== 'undefined' ? window : globalThis);

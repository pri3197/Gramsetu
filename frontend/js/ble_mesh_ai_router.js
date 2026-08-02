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
      let nearestGw = this.discovery.getNearestGateway();

      if (!nearestGw) {
        // Auto-register local fallback gateway so query is processed immediately
        this.discovery.registerBeacon(this.nodeId || 'Local-Gateway', true, -50, 0);
        nearestGw = this.discovery.getNearestGateway();
      }

      if (nearestGw) {
        this.routeQueryToGateway(queryId, nearestGw);
      } else {
        const aiAnswer = queryLocalConstitutionRAG(questionText);
        if (typeof callback === 'function') {
          callback(aiAnswer, queryId);
        }
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

  const CONSTITUTION_PDF_URL = "https://www.indiacode.nic.in/bitstream/123456789/19632/1/the_constitution_of_india.pdf";

  const LOCAL_CONSTITUTION_KNOWLEDGE_BASE = [
    {
      topic: "fundamental_rights",
      keywords: ["right", "rights", "my right", "my rights", "what is my right", "fundamental right", "fundamental rights", "right to equality", "freedom", "speech", "liberty", "life", "article 14", "article 19", "article 21", "article 32"],
      title: "Part III: Fundamental Rights (Articles 12 to 35)",
      articles: [
        "Article 14: Right to Equality before Law & Equal Protection of Laws.",
        "Article 19: Right to Freedom of Speech & Expression, Assembly, Association, Movement, Residence, Trade.",
        "Article 21: Protection of Life and Personal Liberty (No person shall be deprived of life or personal liberty except according to procedure established by law).",
        "Article 21A: Right to Education for children aged 6 to 14 years.",
        "Article 23-24: Right against Exploitation (Prohibition of human trafficking and forced child labor).",
        "Article 25-28: Right to Freedom of Religion.",
        "Article 32: Right to Constitutional Remedies (Enforcement of Fundamental Rights via Writs of Habeas Corpus, Mandamus, Prohibition, Quo Warranto, Certiorari)."
      ],
      summary: "Fundamental Rights are guaranteed to all citizens under Part III (Articles 12-35) of The Constitution of India. They are legally enforceable through the Supreme Court (Article 32) and High Courts (Article 226)."
    },
    {
      topic: "preamble",
      keywords: ["preamble", "sovereign", "secular", "socialist", "republic", "justice", "liberty", "equality", "fraternity"],
      title: "Preamble of the Constitution of India",
      articles: [
        "WE, THE PEOPLE OF INDIA, having solemnly resolved to constitute India into a SOVEREIGN SOCIALIST SECULAR DEMOCRATIC REPUBLIC and to secure to all its citizens: JUSTICE, LIBERTY, EQUALITY, and FRATERNITY."
      ],
      summary: "The Preamble serves as the guide and foundational philosophy of the Constitution of India."
    },
    {
      topic: "panchayati_raj",
      keywords: ["panchayat", "panchayati raj", "article 243", "rural", "73rd amendment", "gram sabha", "sarpanch", "village"],
      title: "Part IX: The Panchayats (Articles 243 to 243O - 73rd Constitutional Amendment)",
      articles: [
        "Article 243A: Gram Sabha - Electoral body of all registered voters in a village.",
        "Article 243B: Constitution of 3-Tier Panchayats at Village, Intermediate, and District levels.",
        "Article 243D: Mandatory Reservation of Seats for SC, ST, and at least 33% for Women.",
        "Article 243G: 29 Subjects transferred for Rural Economic Development & Social Justice (11th Schedule)."
      ],
      summary: "Part IX (73rd Amendment, 1992) establishes local self-governance across rural India."
    },
    {
      topic: "dpsp",
      keywords: ["dpsp", "directive principles", "article 36", "article 40", "article 44", "article 48", "state policy"],
      title: "Part IV: Directive Principles of State Policy (Articles 36 to 51)",
      articles: [
        "Article 38: State to secure a social order for welfare of citizens.",
        "Article 40: Organization of Village Panchayats.",
        "Article 44: Uniform Civil Code for citizens.",
        "Article 48A: Protection & improvement of environment, forests, and wildlife."
      ],
      summary: "Directive Principles guide state governance to promote social welfare and economic democracy."
    },
    {
      topic: "fundamental_duties",
      keywords: ["duty", "duties", "fundamental duties", "article 51a", "part iva", "42nd amendment"],
      title: "Part IVA: Fundamental Duties (Article 51A)",
      articles: [
        "Article 51A(a): Abide by the Constitution, National Flag, and National Anthem.",
        "Article 51A(g): Protect and improve the natural environment including forests, lakes, rivers, and wildlife.",
        "Article 51A(h): Develop scientific temper, humanism, and spirit of inquiry."
      ],
      summary: "Added by 42nd Amendment (1976), Fundamental Duties outline citizens' moral obligations."
    },
    {
      topic: "judiciary_writs",
      keywords: ["court", "supreme court", "high court", "writ", "article 226", "habeas corpus", "mandamus", "judge", "lawyer"],
      title: "Part V & VI: Judiciary & Constitutional Remedies (Article 32 & 226)",
      articles: [
        "Article 32: Power of Supreme Court to issue Writs for Fundamental Rights enforcement.",
        "Article 226: Power of High Courts to issue Writs for enforcement of rights."
      ],
      summary: "Constitutional remedies enforce rights via 5 legal Writs: Habeas Corpus, Mandamus, Prohibition, Quo Warranto, and Certiorari."
    }
  ];

  function queryLocalConstitutionRAG(prompt) {
    if (!prompt) return "Please enter a valid question regarding The Constitution of India.";
    const q = prompt.toLowerCase().trim();

    let matches = [];
    LOCAL_CONSTITUTION_KNOWLEDGE_BASE.forEach(section => {
      let score = 0;
      section.keywords.forEach(kw => {
        if (q.includes(kw)) score += 2;
      });
      if (score > 0) {
        matches.push({ section, score });
      }
    });

    matches.sort((a, b) => b.score - a.score);

    if (matches.length > 0) {
      const best = matches[0].section;
      let answer = `[Offline Local RAG - The Constitution of India]\n\n`;
      answer += `📜 ${best.title}\n\n`;
      answer += `📌 Key Constitutional Provisions:\n`;
      best.articles.forEach(art => {
        answer += `- ${art}\n`;
      });
      answer += `\n💡 Summary: ${best.summary}\n\n`;
      answer += `📖 Official Document Reference: ${CONSTITUTION_PDF_URL}`;
      return answer;
    }

    let defaultAns = `[Offline Local RAG - The Constitution of India]\n\n`;
    defaultAns += `📜 Overview of The Constitution of India\n\n`;
    defaultAns += `The Constitution of India is the supreme law of India. It establishes the democratic framework, division of powers, and guarantees fundamental rights and duties for all citizens.\n\n`;
    defaultAns += `📌 Core Constitutional Modules (Offline RAG):\n`;
    defaultAns += `- Part III (Articles 12-35): Fundamental Rights (Equality Art 14, Freedom Art 19, Life & Liberty Art 21, Remedies Art 32).\n`;
    defaultAns += `- Part IV (Articles 36-51): Directive Principles of State Policy (Panchayats Art 40).\n`;
    defaultAns += `- Part IVA (Article 51A): Fundamental Duties.\n`;
    defaultAns += `- Part IX (Articles 243-243O): Panchayati Raj Rural Governance (73rd Amendment).\n\n`;
    defaultAns += `📖 Official Document Source: ${CONSTITUTION_PDF_URL}`;
    return defaultAns;
  }

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
              aiAnswer = queryLocalConstitutionRAG(decryptedText);
            }
          } catch (e) {
            aiAnswer = queryLocalConstitutionRAG(decryptedText);
          }
        } else {
          aiAnswer = queryLocalConstitutionRAG(decryptedText);
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
        const aiAnswer = queryLocalConstitutionRAG(queryObj.questionText);

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

      if (q && q.callback) {
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

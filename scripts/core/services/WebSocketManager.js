import { IWebSocketConnection } from '../interfaces/IWebSocketConnection.js';
import { DDBWebSocket } from '../../websocket/DDBWebSocket.js';

/**
 * WebSocket Connection Manager
 * Responsibility: Manage WebSocket lifecycle (connect, disconnect, reconnect)
 * SOLID: Single Responsibility - only handles connection management
 */
export class WebSocketManager extends EventTarget {
  constructor(cobaltCookie, campaignId, userId, proxyUrl, proxyUser, proxyPass) {
    super();
    this.cobaltCookie = cobaltCookie;
    this.campaignId = campaignId;
    this.userId = userId;
    this.proxyUrl = proxyUrl;
    this.proxyUser = proxyUser;
    this.proxyPass = proxyPass;
    this.websocket = null;
    this.logger = console;
  }

  /**
   * Connect to DDB WebSocket server
   * @returns {Promise<void>}
   */
  async connect() {
    let connectionUrl = this.proxyUrl;

    // Check for user / pass set
    const user = this.proxyUser?.trim();
    const pass = this.proxyPass?.trim();

    if (user && pass) {
        console.log("DDB Sync | Connecting to proxy with Basic Auth...");
        
        // Use a Regex to handle both ws:// and wss:// and inject user:pass@
        // This regex looks for the protocol part (ws/wss://) and replaces it
        connectionUrl = connectionUrl.replace(/^(wss?:\/\/)/, `$1${user}:${pass}@`);
    } else {
        console.log("DDB Sync | Connecting to proxy without extra authentication.");
    }

    if (this.websocket) {
      this.logger.log('DDB Sync | WebSocket already connected, disconnecting first');
      this.disconnect();
    }

    try {
      this.logger.log('DDB Sync | Creating WebSocket connection...');
      this.websocket = new DDBWebSocket(
        this.cobaltCookie,
        this.campaignId,
        this.userId,
        this.proxyUrl,
        this.proxyUser,
        this.proxyPass
      );

      // Forward events from internal WebSocket
      this.websocket.on('message', (detail) => {
        this.logger.log('DDB Sync | Forwarding message event');
        this.dispatchEvent(new CustomEvent('message', { detail }));
      });

      this.websocket.on('connected', () => {
        this.logger.log('DDB Sync | WebSocket connected successfully');
        this.dispatchEvent(new CustomEvent('connected'));
      });

      this.websocket.on('disconnected', () => {
        this.logger.log('DDB Sync | WebSocket disconnected');
        this.dispatchEvent(new CustomEvent('disconnected'));
      });

      this.websocket.on('cookieExpired', () => {
        this.logger.log('DDB Sync | Cookie expired');
        this.dispatchEvent(new CustomEvent('cookieExpired'));
      });

      await this.websocket.connect();
      this.logger.log('DDB Sync | WebSocket connection initiated');
    } catch (err) {
      this.logger.error('DDB Sync | Failed to connect WebSocket:', err);
      throw err;
    }
  }

  /**
   * Disconnect from DDB WebSocket server
   * @returns {void}
   */
  disconnect() {
    if (this.websocket) {
      this.websocket.disconnect();
      this.websocket = null;
      this.logger.log('DDB Sync | WebSocket disconnected');
    }
  }

  /**
   * Check if WebSocket is connected
   * @returns {boolean}
   */
  isConnected() {
    return this.websocket?.isConnected?.() || false;
  }

  /**
   * Register an event listener
   * @param {string} event - Event name
   * @param {Function} handler - Event handler function
   */
  on(event, handler) {
    this.addEventListener(event, (e) => {
      handler(e.detail);
    });
  }

  /**
   * Remove an event listener
   * @param {string} event - Event name
   * @param {Function} handler - Event handler function
   */
  off(event, handler) {
    this.removeEventListener(event, handler);
  }

  /**
   * Reconnect to WebSocket (internal use)
   * @returns {Promise<void>}
   */
  async reconnect() {
    this.disconnect();
    await this.connect();
  }
}

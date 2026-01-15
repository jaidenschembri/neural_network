export class NetworkWebSocket {
  constructor(url = 'ws://localhost:8001/ws') {
    this.url = url;
    this.ws = null;
    this.topology = null;
    this.onTopologyReceived = null;
    this.onActivationFrame = null;
    this.onConnected = null;
    this.onDisconnected = null;
    this.onReconnecting = null;
    this.onError = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect() {
    console.log(`Connecting to ${this.url}...`);

    try {
      this.ws = new WebSocket(this.url);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        console.log('✓ WebSocket connected');
        this.reconnectAttempts = 0;
        if (this.onConnected) {
          this.onConnected();
        }
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        if (this.onError) {
          this.onError(error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        if (this.onDisconnected) {
          this.onDisconnected();
        }

        // Attempt reconnection
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          if (this.onReconnecting) {
            this.onReconnecting(this.reconnectAttempts, this.maxReconnectAttempts);
          }
          console.log(`Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
          setTimeout(() => this.connect(), 2000);
        } else {
          console.error('Max reconnection attempts reached');
        }
      };

    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      if (this.onError) {
        this.onError(error);
      }
    }
  }

  handleMessage(data) {
    const text = new TextDecoder().decode(data);
    const message = JSON.parse(text);

    if (message.type === 'topology') {
      console.log('✓ Topology received:', message.metadata);
      this.topology = message;
      if (this.onTopologyReceived) {
        this.onTopologyReceived(message);
      }
    } else if (message.type === 'activation') {
      if (this.onActivationFrame) {
        this.onActivationFrame(message);
      }
    } else {
      console.warn('Unknown message type:', message.type);
    }
  }

  disconnect() {
    if (this.ws) {
      console.log('Disconnecting...');
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

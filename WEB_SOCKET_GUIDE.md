# WebSocket Complete Learning Guide

This guide teaches WebSockets from the ground up: what they are, when to use them, how to build them with browser JavaScript and Node.js, and how to scale them safely in production.

## Table of Contents

1. [What Is a WebSocket?](#what-is-a-websocket)
2. [HTTP vs WebSocket](#http-vs-websocket)
3. [When to Use WebSockets](#when-to-use-websockets)
4. [Core WebSocket Concepts](#core-websocket-concepts)
5. [The WebSocket Lifecycle](#the-websocket-lifecycle)
6. [Browser Client Example](#browser-client-example)
7. [Node.js Server with ws](#nodejs-server-with-ws)
8. [Broadcasting Messages](#broadcasting-messages)
9. [Rooms and Channels](#rooms-and-channels)
10. [Authentication and Authorization](#authentication-and-authorization)
11. [Heartbeats and Connection Health](#heartbeats-and-connection-health)
12. [Error Handling and Reconnection](#error-handling-and-reconnection)
13. [Message Design](#message-design)
14. [Scaling WebSockets](#scaling-websockets)
15. [Scaling with Redis Pub/Sub](#scaling-with-redis-pubsub)
16. [Load Balancing](#load-balancing)
17. [Security Checklist](#security-checklist)
18. [Performance Checklist](#performance-checklist)
19. [Testing WebSockets](#testing-websockets)
20. [Debugging WebSockets](#debugging-websockets)
21. [Common Interview Questions](#common-interview-questions)
22. [Learning Roadmap](#learning-roadmap)

## What Is a WebSocket?

A WebSocket is a persistent, full-duplex communication connection between a client and a server.

In simple terms:

- HTTP is usually request-response.
- WebSocket stays open.
- Both client and server can send messages anytime.

WebSockets are useful when the server needs to push data to the client immediately, without waiting for the client to ask again.

Examples:

- Chat apps
- Multiplayer games
- Live dashboards
- Stock price updates
- Notifications
- Collaborative editors
- Online auctions
- Realtime location tracking

## HTTP vs WebSocket

### HTTP

HTTP works like this:

```text
Client -> Request -> Server
Client <- Response <- Server
Connection usually ends
```

The client starts every interaction.

### WebSocket

WebSocket works like this:

```text
Client -> HTTP upgrade request -> Server
Client <- Upgrade accepted <- Server

Persistent connection remains open:

Client <-> Server
```

After the connection is upgraded, both sides can send messages independently.

### Comparison

| Feature | HTTP | WebSocket |
| --- | --- | --- |
| Communication | Request-response | Full-duplex |
| Connection | Short-lived or pooled | Long-lived |
| Server push | Needs polling/SSE | Native |
| Overhead | HTTP headers per request | Small frame overhead |
| Best for | APIs, pages, CRUD | Realtime communication |

## When to Use WebSockets

Use WebSockets when:

- You need low-latency updates.
- The server must push data instantly.
- Many messages are exchanged over time.
- The connection should remain interactive.

Do not use WebSockets just because they feel modern.

For normal CRUD APIs, use HTTP.

For one-way server updates, Server-Sent Events can be simpler.

For realtime bidirectional apps, WebSockets are usually a good fit.

## Core WebSocket Concepts

### Socket

A socket is one open connection between a client and a server.

In a chat app, each connected browser tab usually has its own socket.

### WebSocket Server

The server accepts WebSocket connections and listens for messages.

### WebSocket Client

The client connects to the server and sends/receives messages.

### Frame

WebSocket data travels in frames. A frame may contain text, binary data, ping, pong, or close information.

### Full-Duplex

Both sides can send messages at the same time.

### Upgrade

A WebSocket starts as an HTTP request with an `Upgrade: websocket` header. If the server accepts it, the protocol changes from HTTP to WebSocket.

## The WebSocket Lifecycle

```text
1. Client creates WebSocket connection
2. Browser sends HTTP upgrade request
3. Server accepts the upgrade
4. Connection opens
5. Client and server exchange messages
6. Either side closes the connection
```

Browser WebSocket states:

| State | Value | Meaning |
| --- | --- | --- |
| CONNECTING | 0 | Connection is being established |
| OPEN | 1 | Connection is ready |
| CLOSING | 2 | Connection is closing |
| CLOSED | 3 | Connection is closed |

## Browser Client Example

Create a simple browser client:

```html
<!DOCTYPE html>
<html>
  <head>
    <title>WebSocket Client</title>
  </head>
  <body>
    <h1>WebSocket Demo</h1>

    <input id="messageInput" placeholder="Type a message" />
    <button id="sendButton">Send</button>

    <ul id="messages"></ul>

    <script>
      const socket = new WebSocket("ws://localhost:3000");

      const input = document.getElementById("messageInput");
      const button = document.getElementById("sendButton");
      const messages = document.getElementById("messages");

      socket.addEventListener("open", () => {
        console.log("Connected to server");
      });

      socket.addEventListener("message", (event) => {
        const li = document.createElement("li");
        li.textContent = event.data;
        messages.appendChild(li);
      });

      socket.addEventListener("close", () => {
        console.log("Disconnected from server");
      });

      socket.addEventListener("error", (error) => {
        console.error("WebSocket error:", error);
      });

      button.addEventListener("click", () => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(input.value);
          input.value = "";
        }
      });
    </script>
  </body>
</html>
```

Use `ws://` for local development and `wss://` for secure production connections.

## Node.js Server with ws

Install dependencies:

```bash
npm install express ws
```

Create `server.js`:

```js
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.get("/", (req, res) => {
  res.send("WebSocket server is running");
});

wss.on("connection", (socket, request) => {
  console.log("Client connected from", request.socket.remoteAddress);

  socket.send("Welcome to the WebSocket server");

  socket.on("message", (data) => {
    console.log("Received:", data.toString());
    socket.send(`Server received: ${data.toString()}`);
  });

  socket.on("close", () => {
    console.log("Client disconnected");
  });

  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });
});

server.listen(3000, () => {
  console.log("Server listening on http://localhost:3000");
});
```

## Broadcasting Messages

Broadcasting means sending one message to many connected clients.

```js
wss.on("connection", (socket) => {
  socket.on("message", (data) => {
    const message = data.toString();

    wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(message);
      }
    });
  });
});
```

Usually, you should avoid sending a user's message back to them only if your UI already displays the local message optimistically:

```js
wss.clients.forEach((client) => {
  if (client !== socket && client.readyState === client.OPEN) {
    client.send(message);
  }
});
```

## Rooms and Channels

Rooms let you send messages only to selected users.

Example room manager:

```js
const rooms = new Map();

function joinRoom(roomId, socket) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }

  rooms.get(roomId).add(socket);
  socket.roomId = roomId;
}

function leaveRoom(socket) {
  if (!socket.roomId) {
    return;
  }

  const room = rooms.get(socket.roomId);

  if (room) {
    room.delete(socket);

    if (room.size === 0) {
      rooms.delete(socket.roomId);
    }
  }
}

function sendToRoom(roomId, payload) {
  const room = rooms.get(roomId);

  if (!room) {
    return;
  }

  const message = JSON.stringify(payload);

  room.forEach((socket) => {
    if (socket.readyState === socket.OPEN) {
      socket.send(message);
    }
  });
}

wss.on("connection", (socket) => {
  socket.on("message", (data) => {
    const event = JSON.parse(data.toString());

    if (event.type === "join_room") {
      joinRoom(event.roomId, socket);
      return;
    }

    if (event.type === "chat_message") {
      sendToRoom(socket.roomId, {
        type: "chat_message",
        roomId: socket.roomId,
        text: event.text
      });
    }
  });

  socket.on("close", () => {
    leaveRoom(socket);
  });
});
```

## Authentication and Authorization

WebSockets do not automatically make authentication easy. You must design it.

Common approaches:

1. Authenticate during the HTTP upgrade request.
2. Pass a short-lived token in the query string.
3. Pass a token using cookies.
4. Send an authentication message immediately after connecting.

### Token in Query String

Client:

```js
const token = "user-jwt-token";
const socket = new WebSocket(`wss://example.com?token=${encodeURIComponent(token)}`);
```

Server:

```js
import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";

const wss = new WebSocketServer({ server });

wss.on("connection", (socket, request) => {
  const url = new URL(request.url, "http://localhost");
  const token = url.searchParams.get("token");

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = user;
  } catch {
    socket.close(1008, "Unauthorized");
  }
});
```

Important: query strings can appear in logs. For sensitive systems, secure HTTP-only cookies or upgrade-level authentication may be better.

### Authorization

Authentication answers: "Who is this user?"

Authorization answers: "What is this user allowed to do?"

Example:

```js
function canJoinRoom(user, roomId) {
  return user.rooms.includes(roomId);
}

if (event.type === "join_room") {
  if (!canJoinRoom(socket.user, event.roomId)) {
    socket.send(JSON.stringify({
      type: "error",
      message: "You are not allowed to join this room"
    }));
    return;
  }

  joinRoom(event.roomId, socket);
}
```

## Heartbeats and Connection Health

Connections can die without a clean close event. A heartbeat helps detect dead clients.

Server heartbeat with `ws`:

```js
function heartbeat() {
  this.isAlive = true;
}

wss.on("connection", (socket) => {
  socket.isAlive = true;
  socket.on("pong", heartbeat);
});

const interval = setInterval(() => {
  wss.clients.forEach((socket) => {
    if (socket.isAlive === false) {
      socket.terminate();
      return;
    }

    socket.isAlive = false;
    socket.ping();
  });
}, 30000);

wss.on("close", () => {
  clearInterval(interval);
});
```

Browser clients automatically respond to ping frames. Browser JavaScript cannot manually send WebSocket ping frames, but you can send application-level heartbeat messages:

```js
setInterval(() => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "heartbeat" }));
  }
}, 30000);
```

## Error Handling and Reconnection

Production clients should reconnect with backoff.

```js
let socket;
let reconnectAttempt = 0;

function connect() {
  socket = new WebSocket("ws://localhost:3000");

  socket.addEventListener("open", () => {
    console.log("Connected");
    reconnectAttempt = 0;
  });

  socket.addEventListener("message", (event) => {
    console.log("Message:", event.data);
  });

  socket.addEventListener("close", () => {
    const delay = Math.min(1000 * 2 ** reconnectAttempt, 30000);
    reconnectAttempt += 1;

    console.log(`Reconnecting in ${delay}ms`);
    setTimeout(connect, delay);
  });

  socket.addEventListener("error", () => {
    socket.close();
  });
}

connect();
```

Add jitter in large systems so many clients do not reconnect at the exact same time:

```js
const jitter = Math.floor(Math.random() * 1000);
const delay = Math.min(1000 * 2 ** reconnectAttempt, 30000) + jitter;
```

## Message Design

Avoid sending plain strings in serious applications. Use structured JSON.

```json
{
  "type": "chat_message",
  "requestId": "abc-123",
  "roomId": "general",
  "payload": {
    "text": "Hello"
  },
  "timestamp": 1791518400000
}
```

Recommended fields:

| Field | Purpose |
| --- | --- |
| `type` | Tells the receiver how to handle the message |
| `requestId` | Helps match request and response |
| `roomId` | Identifies the target room/channel |
| `payload` | Carries event-specific data |
| `timestamp` | Helps with ordering/debugging |

### Example Message Router

```js
const handlers = {
  chat_message(socket, event) {
    sendToRoom(event.roomId, {
      type: "chat_message",
      payload: {
        userId: socket.user.id,
        text: event.payload.text
      }
    });
  },

  typing_started(socket, event) {
    sendToRoom(event.roomId, {
      type: "typing_started",
      payload: {
        userId: socket.user.id
      }
    });
  }
};

wss.on("connection", (socket) => {
  socket.on("message", (data) => {
    let event;

    try {
      event = JSON.parse(data.toString());
    } catch {
      socket.send(JSON.stringify({
        type: "error",
        message: "Invalid JSON"
      }));
      return;
    }

    const handler = handlers[event.type];

    if (!handler) {
      socket.send(JSON.stringify({
        type: "error",
        message: `Unknown event type: ${event.type}`
      }));
      return;
    }

    handler(socket, event);
  });
});
```

## Scaling WebSockets

A single WebSocket server is simple:

```text
Client A
Client B -> WebSocket Server
Client C
```

But real production systems usually need multiple server instances:

```text
Client A -> Server 1
Client B -> Server 2
Client C -> Server 3
```

Problem: Server 1 does not automatically know about clients connected to Server 2 or Server 3.

If Client A sends a chat message to Server 1, and Client B is connected to Server 2, Server 1 cannot directly send to Client B.

You need a shared messaging layer.

Common options:

- Redis Pub/Sub
- Redis Streams
- NATS
- Kafka
- RabbitMQ
- PostgreSQL LISTEN/NOTIFY for smaller systems
- Managed realtime platforms

## Scaling with Redis Pub/Sub

Redis Pub/Sub lets every WebSocket server publish and receive messages.

```text
Client A -> Server 1 -> Redis channel -> Server 2 -> Client B
                                  |
                                  -> Server 3 -> Client C
```

Install:

```bash
npm install ioredis
```

Redis connection:

```js
import { Redis } from "ioredis";

export const redisPub = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT || 6379)
});

export const redisSub = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT || 6379)
});
```

WebSocket server with Redis:

```js
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { redisPub, redisSub } from "./connection.js";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const REDIS_CHANNEL = "ws-messages";

await redisSub.subscribe(REDIS_CHANNEL);

redisSub.on("message", (channel, message) => {
  if (channel !== REDIS_CHANNEL) {
    return;
  }

  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  });
});

wss.on("connection", (socket) => {
  socket.on("message", async (data) => {
    const event = {
      type: "chat_message",
      payload: {
        text: data.toString()
      },
      timestamp: Date.now()
    };

    await redisPub.publish(REDIS_CHANNEL, JSON.stringify(event));
  });
});

server.listen(3000, () => {
  console.log("Server listening on port 3000");
});
```

### Running Multiple Instances

Run multiple copies of the same server on different ports:

```bash
PORT=3001 node server.js
PORT=3002 node server.js
PORT=3003 node server.js
```

On Windows PowerShell:

```powershell
$env:PORT=3001; node server.js
$env:PORT=3002; node server.js
$env:PORT=3003; node server.js
```

Each server instance subscribes to Redis. When one instance publishes a message, all instances receive it and broadcast to their own connected clients.

### Pub/Sub Limitation

Redis Pub/Sub does not store messages. If a server is offline when a message is published, it misses that message.

Use Redis Streams, Kafka, NATS JetStream, or a database-backed queue when you need persistence, replay, or stronger delivery guarantees.

## Load Balancing

A load balancer distributes clients across multiple WebSocket servers.

```text
Clients -> Load Balancer -> Server 1
                         -> Server 2
                         -> Server 3
```

Requirements:

- The load balancer must support WebSocket upgrade requests.
- Idle timeouts must be long enough.
- TLS should terminate at the load balancer or upstream proxy.
- Health checks should remove unhealthy servers.

### Sticky Sessions

Sticky sessions keep a client connected to the same server.

They can be useful, but a proper pub/sub or message broker layer is still needed for multi-server broadcasting.

### Nginx Example

```nginx
upstream websocket_backend {
  server 127.0.0.1:3001;
  server 127.0.0.1:3002;
  server 127.0.0.1:3003;
}

server {
  listen 80;
  server_name example.com;

  location / {
    proxy_pass http://websocket_backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
  }
}
```

## Security Checklist

### Use WSS in Production

Use encrypted WebSocket connections:

```text
ws://  local development
wss:// production
```

### Validate Origin

Reject connections from unknown origins:

```js
const allowedOrigins = new Set([
  "https://example.com",
  "https://www.example.com"
]);

const wss = new WebSocketServer({
  server,
  verifyClient(info, done) {
    const origin = info.origin;
    done(allowedOrigins.has(origin));
  }
});
```

### Validate Every Message

Never trust client messages.

Validate:

- JSON format
- Message type
- Required fields
- Field length
- User permissions
- Rate limits

### Limit Message Size

```js
const wss = new WebSocketServer({
  server,
  maxPayload: 1024 * 16
});
```

### Rate Limit

Simple per-socket rate limit:

```js
function createRateLimiter(limit, windowMs) {
  let count = 0;
  let windowStartedAt = Date.now();

  return function allow() {
    const now = Date.now();

    if (now - windowStartedAt > windowMs) {
      count = 0;
      windowStartedAt = now;
    }

    count += 1;
    return count <= limit;
  };
}

wss.on("connection", (socket) => {
  const allowMessage = createRateLimiter(30, 10000);

  socket.on("message", (data) => {
    if (!allowMessage()) {
      socket.close(1008, "Rate limit exceeded");
      return;
    }

    handleMessage(socket, data);
  });
});
```

### Use Proper Close Codes

Common close codes:

| Code | Meaning |
| --- | --- |
| 1000 | Normal closure |
| 1001 | Going away |
| 1002 | Protocol error |
| 1003 | Unsupported data |
| 1008 | Policy violation |
| 1009 | Message too big |
| 1011 | Internal server error |

## Performance Checklist

- Keep messages small.
- Prefer JSON for simple apps.
- Use binary formats for high-volume systems when needed.
- Compress only when useful; compression can cost CPU.
- Avoid broadcasting to every user when rooms/channels are enough.
- Use backpressure handling.
- Track connected clients.
- Track message rate.
- Track memory usage.
- Use heartbeat cleanup.
- Avoid synchronous CPU-heavy work inside message handlers.

### Backpressure

If a client is slow, messages can build up in memory.

With `ws`, check `bufferedAmount`:

```js
function safeSend(socket, message) {
  const maxBufferedAmount = 1024 * 1024;

  if (socket.bufferedAmount > maxBufferedAmount) {
    socket.close(1008, "Client too slow");
    return;
  }

  if (socket.readyState === socket.OPEN) {
    socket.send(message);
  }
}
```

## Testing WebSockets

### Browser DevTools

In Chrome:

1. Open DevTools.
2. Go to Network.
3. Filter by `WS`.
4. Click the WebSocket connection.
5. Inspect messages in the Messages tab.

### Command Line with wscat

Install:

```bash
npm install -g wscat
```

Connect:

```bash
wscat -c ws://localhost:3000
```

Send messages by typing into the terminal.

### Automated Test Example

Install:

```bash
npm install --save-dev jest ws
```

Example:

```js
import WebSocket from "ws";

test("server echoes messages", (done) => {
  const socket = new WebSocket("ws://localhost:3000");

  socket.on("open", () => {
    socket.send("hello");
  });

  socket.on("message", (data) => {
    expect(data.toString()).toContain("hello");
    socket.close();
    done();
  });
});
```

## Debugging WebSockets

Common problems:

| Problem | Possible Cause |
| --- | --- |
| Connection closes immediately | Auth failed, wrong path, proxy issue |
| Works locally but not in production | Missing proxy upgrade headers |
| Messages duplicate | Multiple subscriptions or multiple event listeners |
| Server memory grows | Dead sockets not cleaned up |
| Some users miss messages | No shared broker between server instances |
| Random disconnects | Load balancer idle timeout |

Useful logs:

```js
wss.on("connection", (socket, request) => {
  console.log("connected", {
    ip: request.socket.remoteAddress,
    url: request.url,
    userAgent: request.headers["user-agent"]
  });

  socket.on("close", (code, reason) => {
    console.log("closed", {
      code,
      reason: reason.toString()
    });
  });
});
```

## Common Interview Questions

### What is a WebSocket?

A persistent, full-duplex connection between client and server that allows both sides to send messages anytime.

### How is WebSocket different from HTTP?

HTTP is request-response. WebSocket starts with HTTP upgrade and then keeps a bidirectional connection open.

### What is the difference between WebSocket and polling?

Polling repeatedly asks the server for updates. WebSocket lets the server push updates instantly over one persistent connection.

### What is the difference between WebSocket and Server-Sent Events?

Server-Sent Events are one-way server-to-client updates over HTTP. WebSockets are bidirectional.

### How do you scale WebSockets?

Run multiple WebSocket server instances behind a load balancer and use a shared broker like Redis, NATS, or Kafka so instances can exchange events.

### Why might sticky sessions be needed?

They keep a client connected to the same backend server. They can simplify connection-specific state, but they do not replace pub/sub for cross-server messaging.

### What happens if a WebSocket server restarts?

All clients connected to that instance disconnect. Clients should reconnect with exponential backoff.

### How do you secure WebSockets?

Use WSS, authenticate users, validate origins, authorize actions, validate messages, limit payload size, and rate limit clients.

## Learning Roadmap

### Beginner

- Understand HTTP request-response.
- Learn what the WebSocket upgrade handshake does.
- Build a browser client.
- Build a Node.js `ws` server.
- Send and receive plain text messages.

### Intermediate

- Use JSON messages.
- Add rooms/channels.
- Add authentication.
- Add error handling and reconnect logic.
- Add heartbeat checks.
- Use browser DevTools to inspect frames.

### Advanced

- Add Redis Pub/Sub.
- Run multiple server instances.
- Put servers behind Nginx or another load balancer.
- Add metrics and logging.
- Handle backpressure.
- Design message schemas.
- Add rate limits and authorization.

### Production

- Use WSS.
- Use environment variables for config.
- Add health checks.
- Add graceful shutdown.
- Monitor connections, errors, message rate, latency, and memory.
- Test deploys with multiple instances.
- Plan for broker failures and reconnect storms.

## Production-Ready Server Skeleton

This example combines many production concepts in one place.

```js
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { Redis } from "ioredis";

const app = express();
const server = http.createServer(app);

const port = Number(process.env.PORT || 3000);
const redisHost = process.env.REDIS_HOST || "localhost";
const redisPort = Number(process.env.REDIS_PORT || 6379);
const channel = process.env.REDIS_CHANNEL || "ws-messages";

const redisPub = new Redis({ host: redisHost, port: redisPort });
const redisSub = new Redis({ host: redisHost, port: redisPort });

const wss = new WebSocketServer({
  server,
  maxPayload: 1024 * 16
});

function safeSend(socket, event) {
  if (socket.readyState !== socket.OPEN) {
    return;
  }

  if (socket.bufferedAmount > 1024 * 1024) {
    socket.close(1008, "Client too slow");
    return;
  }

  socket.send(JSON.stringify(event));
}

function heartbeat() {
  this.isAlive = true;
}

await redisSub.subscribe(channel);

redisSub.on("message", (receivedChannel, message) => {
  if (receivedChannel !== channel) {
    return;
  }

  let event;

  try {
    event = JSON.parse(message);
  } catch {
    return;
  }

  wss.clients.forEach((socket) => {
    safeSend(socket, event);
  });
});

wss.on("connection", (socket, request) => {
  socket.isAlive = true;
  socket.on("pong", heartbeat);

  console.log("connected", request.socket.remoteAddress);

  socket.on("message", async (data) => {
    let event;

    try {
      event = JSON.parse(data.toString());
    } catch {
      safeSend(socket, {
        type: "error",
        message: "Invalid JSON"
      });
      return;
    }

    if (event.type !== "chat_message") {
      safeSend(socket, {
        type: "error",
        message: "Unsupported event type"
      });
      return;
    }

    const outgoingEvent = {
      type: "chat_message",
      payload: {
        text: String(event.payload?.text || "").slice(0, 1000)
      },
      timestamp: Date.now()
    };

    await redisPub.publish(channel, JSON.stringify(outgoingEvent));
  });

  socket.on("close", (code, reason) => {
    console.log("closed", {
      code,
      reason: reason.toString()
    });
  });

  socket.on("error", (error) => {
    console.error("socket error", error);
  });
});

const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((socket) => {
    if (socket.isAlive === false) {
      socket.terminate();
      return;
    }

    socket.isAlive = false;
    socket.ping();
  });
}, 30000);

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    clients: wss.clients.size
  });
});

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

function shutdown() {
  console.log("Shutting down");

  clearInterval(heartbeatInterval);

  wss.clients.forEach((socket) => {
    socket.close(1001, "Server shutting down");
  });

  server.close(async () => {
    await redisPub.quit();
    await redisSub.quit();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
```

## Final Checklist

Before shipping a WebSocket app, confirm:

- The client reconnects safely.
- The server cleans up dead connections.
- Messages are validated.
- Authentication is enforced.
- Authorization is checked per action.
- Payload size is limited.
- Rate limits exist.
- WSS is enabled in production.
- Load balancer supports WebSocket upgrades.
- Idle timeouts are configured.
- Multiple server instances can exchange messages through a broker.
- Metrics and logs exist.
- Slow clients cannot exhaust server memory.

If you understand everything in this file and can build the examples yourself, you have a strong practical foundation in WebSockets and realtime application scaling.

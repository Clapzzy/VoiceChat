# WebRTC Voice Chat App

##  **Work in Progress** 

This is still very much a work in progress! If you run into connection issues or things just don’t work, it’s probably because **I haven’t set up a TURN server yet**. WebRTC needs that to work properly across different networks, so yeah… expect some problems for now.

-----

## What is this?

A Discord-like voice chat app where you can talk with people and send messages. The chat isn’t saved anywhere - it only exists while people are online and in the room.

## Technology Stack

**Frontend:**

- React for the UI
- WebRTC for voice chat

**Backend:**

- Go with WebSockets for:
  - WebRTC connection stuff
  - Sending messages around
  - Keeping track of who’s in voice channels

## Known Issues & Limitations

- **No TURN server** - This is the big one. Connections will probably fail if you’re on different networks
- **Network issues** - Might not work if you’re behind certain routers/firewalls
- **Audio quality** - Haven’t optimized this yet
- **Error handling** - Pretty basic right now, things might just break
- **Not tested much** - Only tried it with a few people at once

## Running it

You’ll need Node.js and Go installed. Frontend runs on vite and if you want to run the development server you would need to use `sudo npm run dev`, backend is just `go run server.go`. Messages and voice signaling go through WebSockets, actual voice is peer-to-peer.

-----


async function handleMessage(message, peerRef, webSocket, idAwaiter, setRemoteStreams, setPeerRoom, microphoneStreamRef) {
  try {
    switch (message.type) {
      case 'id':
        idAwaiter(message.id)
        break
      case 'offer':
        //mrazq prop drilling
        await handleOffer(message, peerRef, webSocket, setRemoteStreams, setPeerRoom, microphoneStreamRef)
        break
      case 'answer':
        await handleAnswer(message, peerRef)
        break
      case 'candidate':
        await handleCandidate(message, peerRef)
        break
      default:
        console.warn("Unknown message type: ", message.type)
    }
  } catch (error) {
    console.error("I got an error :", error)
  }
}

export const creatPeerConnection = () => {
  const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
  return new RTCPeerConnection(config)
}

export const addStreamToPeer = (peerConnection, streamRef) => {
  const sender = peerConnection.getSenders().find(s => s.track?.kind === 'audio')

  if (sender && streamRef.current) {
    sender.replaceTrack(streamRef.current.getAudioTracks()[0])

  } else if (!sender && streamRef.current) {

    peerConnection.addTrack(streamRef.current.getAudioTracks()[0],
      streamRef.current)
  }
}

export const setupWebSocket = async (wsUrl, roomId, idAwaiter, peerRef, setRemoteStreams, setPeerRoom, microphoneStreamRef) => {
  const webSocket = new WebSocket(`${wsUrl}`)
  let resolveId
  let idPromise = new Promise((res) => resolveId = res)

  webSocket.addEventListener("open", () => {
    webSocket.send(roomId)

    webSocket.addEventListener("message", (event) => {
      const userIds = JSON.parse(event.data)
      resolveId(userIds)

      webSocket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data)
        handleMessage(message, peerRef, webSocket, idAwaiter, setRemoteStreams, setPeerRoom, microphoneStreamRef)
      })

    }, { once: true })

  }
  )

  const userIds = await idPromise

  return [webSocket, userIds]
}

export const createPeerOffer = async (peerConnection, webSocket, clientToSendTo) => {
  const offer = await peerConnection.createOffer()
  await peerConnection.setLocalDescription(offer)

  webSocket.send(JSON.stringify({
    type: 'offer',
    sdp: offer.sdp,
    to: clientToSendTo
  }))
}

export const setupIceCandidateHandler = (peerConnection, webSocket, clientToSendTo) => {
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      webSocket.send(JSON.stringify({
        type: 'candidate',
        candidate: event.candidate,
        to: clientToSendTo
      }))
    }
  }
  peerConnection.oniceconnectionstatechange = () => {
    if (peerConnection.iceConnectionState === 'failed') {
      peerConnection.restartIce()
    }
  }
}

export const setupRemoteStreamHandler = (peerConnection, setRemoteStream) => {
  peerConnection.ontrack = (event) => {
    setRemoteStream(event.streams[0])
  }
}

export const initializePeerConnection = (setRemoteStreams, userId, peerRef, setPeerRoom, webSocketRoom, microphoneStreamRef) => {

  if (peerRef.current[userId]) return

  const newConnection = creatPeerConnection()

  addStreamToPeer(newConnection, microphoneStreamRef.current)

  setupRemoteStreamHandler(newConnection, (stream) => {
    setRemoteStreams(prev => ({ ...prev, [userId]: stream }))
  })

  setupIceCandidateHandler(
    newConnection,
    webSocketRoom,
    userId
  )

  setPeerRoom(prev => ({
    ...prev,
    [userId]: newConnection
  }))

  createPeerOffer(
    newConnection,
    webSocketRoom,
    userId
  )

  addStreamToPeer(newConnection, microphoneStreamRef.current)

}

const handleOffer = async (offer, peerRef, webSocket, setRemoteStreams, setPeerRoom, microphoneStreamRef) => {

  initializePeerConnection(setRemoteStreams, offer.from, peerRef, setPeerRoom, webSocket, microphoneStreamRef)
  await peerRef.current[offer.from].setRemoteDescription(new RTCSessionDescription({
    type: 'offer',
    sdp: offer.sdp,
  }))

  const answer = await peerRef.current[offer.from].createAnswer()
  await peerRef.current[offer.from].setLocalDescription(answer)

  webSocket.send(JSON.stringify({
    type: 'answer',
    sdp: answer.sdp,
    to: offer.from
  }))
}

const handleAnswer = async (message, peerRef) => {
  await peerRef.current[message.from].setRemoteDescription(new RTCSessionDescription({
    type: 'answer',
    sdp: message.sdp
  }))
}

const handleCandidate = async (message, peerRef) => {
  try {
    const candidate = JSON.parse(message.candidate)
    await peerRef.current[message.from].addIceCandidate(new RTCIceCandidate(candidate))
  } catch (error) {
    console.error("Got an error adding Ice candidate: ", error)
  }
}


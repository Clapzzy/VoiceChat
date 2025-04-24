async function handleMessage(message, peerConnection) {
  try {
    switch (message.type) {
      case 'offer':
        await handleOffer(message, peerConnection)
        break
      case 'answer':
        await handleAnswer(message, peerConnection)
        break
      case 'candidate':
        await handleCandidate(message, peerConnection)
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
  if (streamRef.current) {
    streamRef.current.getTracks().forEach(track => {
      peerConnection.addTrack(track, streamRef.current)
    })
  }
}

export const setupWebSocket = async (wsUrl, roomId) => {
  const webSocket = new WebSocket(`${wsUrl}`)
  let resolveId
  let idPromise = new Promise((res) => resolveId = res)

  webSocket.addEventListener("open", () => {
    webSocket.send(roomId)

    webSocket.addEventListener("message", (event) => {
      const userId = JSON.parse(event.data)
      resolveId(userId)

      webSocket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data)
        handleMessage(message)
      })

    }, { once: true })

  }
  )

  const userId = await idPromise

  return [webSocket, userId]
}

export const createPeerOffer = async (peerConnection, webSocket, clientId, clientToSendTo) => {
  const offer = await peerConnection.createOffer()
  await peerConnection.setLocalDescription(offer)

  webSocket.send(JSON.stringify({
    type: 'offer',
    sdp: offer.sdp,
    from: clientId,
    to: clientToSendTo
  }))
}

export const setupIceCandidateHandler = (peerConnection, webSocket, clientId, clientToSendTo) => {
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      webSocket.send(JSON.stringify({
        type: 'candidate',
        candidate: event.candidate,
        from: clientId,
        to: clientToSendTo
      }))
    }
  }
}

export const setupRemoteStreamHandler = (peerConnection, serRemoteStream) => {
  peerConnection.ontrack = (event) => {
    serRemoteStream(event.streams[0])
  }
}

const handleOffer = async (offer, peerConnection, webSocket, clientId) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription({
    type: 'offer',
    data: offer.sdp,
  }))

  const answer = await peerConnection.createAnswer()
  await peerConnection.setLocalDescription(answer)

  webSocket.send(JSON.stringify({
    type: 'answer',
    sdp: answer.sdp,
    from: clientId,
    to: offer.from
  }))
}

const handleAnswer = async (message, peerConnection) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription({
    type: 'answer',
    sdp: message.sdp
  }))
}

const handleCandidate = async (message, peerConnection) => {
  try {
    const candidate = JSON.parse(message.candidate)
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
  } catch (error) {
    console.error("Got an error adding Ice candidate: ", error)
  }
}


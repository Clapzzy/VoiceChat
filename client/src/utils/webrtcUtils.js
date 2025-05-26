function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const creatPeerConnection = () => {
  const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
  return new RTCPeerConnection(config)
}
export const handleNewIds = (newIds, setIdAwaiter, peerRef) => {
  setIdAwaiter(prev => [
    ...prev,
    ...newIds.filter(id =>
      !prev.includes(id) && !peerRef.current[id]
    )
  ]);
};

export const addStreamToPeer = (peerConnection, stream) => {
  const sender = peerConnection.getSenders().find(s => s.track?.kind === 'audio')

  if (sender && stream.current) {
    sender.replaceTrack(stream.current.getAudioTracks()[0])

  } else if (!sender && stream.current) {

    peerConnection.addTrack(stream.current.getAudioTracks()[0],
      stream.current)
  }
}

export const setupWebSocket = async (wsUrl, initObj, idAwaiter, peerRef, setRemoteStreams, setPeerRoom, microphoneStreamRef, audioContextRef) => {
  const webSocket = new WebSocket(`${wsUrl}`)
  let resolveId
  let idPromise = new Promise((res) => resolveId = res)

  webSocket.addEventListener("open", () => {
    webSocket.send(initObj)

    webSocket.addEventListener("message", (event) => {
      if (webSocket.readyState !== WebSocket.OPEN) return
      const userIds = JSON.parse(event.data)
      resolveId(userIds[0])
      userIds.shift()
      handleNewIds(userIds, idAwaiter, peerRef)

      webSocket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data)
        handleMessage(message, peerRef, webSocket, idAwaiter, setRemoteStreams, setPeerRoom, microphoneStreamRef, audioContextRef)
      })

    }, { once: true })

  }
  )

  const userIds = await idPromise

  return [webSocket, userIds]
}

export const createPeerOffer = async (peerConnection, webSocket, clientToSendTo) => {
  try {
    if (peerConnection.signalingState !== 'stable') {
      console.warn("Cannot create offer in current state: ", peerConnection.signalingState)
      return
    }
    const offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)

    webSocket.send(JSON.stringify({
      type: 'offer',
      sdp: offer.sdp,
      to: clientToSendTo
    }))
  } catch (error) {
    console.error("Offer creating failed :", error.message)
  }
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

export const initializePeerConnection = (setRemoteStreams, userInfo, peerRef, setPeerRoom, webSocketRoom, microphoneStreamRef, audioContextRef) => {

  if (peerRef?.current?.[userInfo.userId]) return

  console.log("creating a peer")
  const newConnection = creatPeerConnection()

  addStreamToPeer(newConnection, microphoneStreamRef)


  setupRemoteStreamHandler(newConnection, (stream) => {
    const source = audioContextRef.current.createMediaStreamSource(stream)
    let gainNode
    if (audioContextRef.current.state !== 'closed') {
      gainNode = audioContextRef.current.createGain();
    }

    gainNode.gain.value = 1

    source.connect(gainNode)
    gainNode.connect(audioContextRef.current.destination)

    setRemoteStreams(prev => {
      return ({
        ...prev, [userInfo.userId]: {
          username: userInfo.username,
          pfpNum: userInfo.pfpNum,
          stream: stream,
          nodes: { source, gainNode }
        }
      })
    })
  })
  setupIceCandidateHandler(
    newConnection,
    webSocketRoom,
    userInfo.userId
  )

  setPeerRoom(prev => ({
    ...prev,
    [userInfo.userId]: newConnection
  }))

  createPeerOffer(
    newConnection,
    webSocketRoom,
    userInfo.userId
  )

  addStreamToPeer(newConnection, microphoneStreamRef)

}

const handleOffer = async (offer, peerRef, webSocket, setRemoteStreams, setPeerRoom, microphoneStreamRef) => {
  let timeWaited = 0
  while (!peerRef.current[offer.from]) {
    await sleep(100)
    timeWaited++
    if (timeWaited > 50) {
      console.error("A peer couldnt be created. ID of peer : ", offer.from)
    }
  }
  const peer = peerRef.current[offer.from]

  try {

    await peer.setRemoteDescription(new RTCSessionDescription({
      type: 'offer',
      sdp: offer.sdp,
    }))

    const answer = await peer.createAnswer()
    await peer.setLocalDescription(answer)

    webSocket.send(JSON.stringify({
      type: 'answer',
      sdp: answer.sdp,
      to: offer.from
    }))
  } catch (error) {
    console.error("Offer handling failed: ", error.message)
  }
}

const handleAnswer = async (message, peerRef) => {
  const peer = peerRef.current[message.from]
  if (!peer || peer.signalingState !== 'have-local-offer') {
    console.warn("Peer not in a state for answer")
    return
  }
  try {
    await peerRef.current[message.from].setRemoteDescription(new RTCSessionDescription({
      type: 'answer',
      sdp: message.sdp
    }))
  } catch (error) {
    console.error("Falied ot set answer: ", error.message)
  }
}

const handleCandidate = async (message, peerRef) => {
  try {
    let candidate
    if (typeof message.candidate === 'string') {
      candidate = JSON.parse(message.candidate)
    } else {
      candidate = message.candidate
    }
    if (candidate && peerRef.current[message.from]) {
      await peerRef.current[message.from].addIceCandidate(new RTCIceCandidate(candidate))
    }

  } catch (error) {
    console.error("ICE Candidate error: ", {
      error: error.message,
      recieved: message.candidate
    })
  }
}

async function handleMessage(message, peerRef, webSocket, idAwaiter, setRemoteStreams, setPeerRoom, microphoneStreamRef, audioContextRef) {
  try {
    switch (message.type) {
      case 'id':
        handleNewIds([message.id], idAwaiter, peerRef)
        break
      case 'leave':
        let streamInfoToClean

        setRemoteStreams(prev => {
          streamInfoToClean = prev[message.from]
          const newStreams = { ...prev }
          delete newStreams[message.from]
          return newStreams
        })

        if (streamInfoToClean) {
          streamInfoToClean.forEach(node => {
            node?.disconnect()
          })
        }

        peerRef.current[message.from].getSenders().forEach(sender => {
          if (sender.track && sender.track.kind === 'audio') {
            sender.track.stop()
            peerRef.current[message.from].removeTrack(sender);
          }
        })

        peerRef.current[message.from].close()
        if (setPeerRoom) {
          setPeerRoom(prev => {
            const newPeers = { ...prev };
            delete newPeers[userId];
            return newPeers;
          });
        }

        break
      case 'offer':
        //malumno
        await handleOffer(message, peerRef, webSocket, setRemoteStreams, setPeerRoom, microphoneStreamRef, audioContextRef)
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

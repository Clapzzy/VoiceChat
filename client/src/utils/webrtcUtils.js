function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const hashString = (str) => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return hash
}

export const createTestAudioStream = async (microphoneRef, audioContextRef, frequency = 440, volume = 0.1) => {
  if (!audioContextRef.current) {
    console.error("AudioContext does not exist");
  }

  console.log("Test")
  const ctx = audioContextRef?.current
  const oscillator = ctx.createOscillator()
  const gainNode = ctx.createGain()
  const mediaStreamDestination = ctx.createMediaStreamDestination()

  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime)
  gainNode.gain.setValueAtTime(volume, ctx.currentTime)

  oscillator.connect(gainNode)
  //gainNode.connect(ctx.destination)
  gainNode.connect(mediaStreamDestination)
  microphoneRef.current = mediaStreamDestination.stream

  oscillator.start()

  return [oscillator, gainNode]
}
export const creatPeerConnection = () => {
  const config = {
    iceServers: [
      {
        urls: [
          'stun:martinkurtev.com:3478',
          'turn:martinkurtev.com:3478',
          'turns:martinkurtev.com:5349'
        ],
        username: 'webrtc',
        credential: 'password1'
      }
    ],
    iceCandidatePoolSize: 10
  };
  return new RTCPeerConnection(config)
}

export const handleNewIds = (newIds, setIdAwaiter, peerRef, currentUserId) => {
  setIdAwaiter(prev => [
    ...prev,
    ...newIds.filter(id =>
      !prev.some(existing => existing.userId === id.userId) &&
      !peerRef.current[id.userId] &&
      id.userId !== currentUserId?.current
    )
  ])
}

export const addStreamToPeer = (peerConnection, stream) => {
  if (!stream?.current || !stream.current.getAudioTracks().length) {
    console.warn('No auido stream available to add to peer')
    return
  }

  try {
    const audioTrack = stream.current.getAudioTracks()[0]
    const existingTransceiver = peerConnection.getTransceivers().find(t =>
      t.sender && t.sender.track && t.sender.track.kind === 'audio'
    )

    if (existingTransceiver) {
      existingTransceiver.sender.replaceTrack(audioTrack)
        .catch(error => console.error("Error replacing track:", error))
    } else {
      peerConnection.addTransceiver(audioTrack, {
        direction: 'sendrecv',
        streams: [stream.current]
      });
    }

  } catch (error) {
    console.error("Error in addStreamToPeer:", error)
  }
}

export const setupWebSocket = async (wsUrl, initObj, idAwaiter, peerRef, setRemoteStreams, setPeerRoom) => {
  const webSocket = new WebSocket(`${wsUrl}`)

  let currentUserId
  let resolveId
  let idPromise = new Promise((res) => resolveId = res)

  webSocket.addEventListener("open", () => {
    webSocket.send(JSON.stringify(initObj))

    webSocket.addEventListener("message", (event) => {
      if (webSocket.readyState !== WebSocket.OPEN) return
      const userIds = JSON.parse(event.data)
      handleNewIds(userIds, idAwaiter, peerRef, userIds[0])
      currentUserId = userIds[0].userId
      resolveId(userIds[0].userId)
      userIds.shift()

      webSocket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data)
        handleMessage(message, peerRef, webSocket, idAwaiter, setRemoteStreams, setPeerRoom, currentUserId)
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
      console.warn("Cannot make an offer in current peer state. Initilizing rollback. Peer signal state :", peerConnection.signalingState)
      return
    }

    if (peerConnection.isNegotiating) {
      console.warn('Already negotiating, skipping creation')
      return
    }

    peerConnection.isNegotiating = true

    const existingTransceiver = peerConnection.getTransceivers()
    if (existingTransceiver.length === 0) {
      peerConnection.addTransceiver('audio', { direction: 'sendrecv' })
    }

    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false
    })
    await peerConnection.setLocalDescription(offer)

    webSocket.send(JSON.stringify({
      type: 'offer',
      sdp: offer.sdp,
      to: clientToSendTo
    }))

  } catch (error) {
    console.error("Offer creating failed :", error.message)
    peerConnection.isNegotiating = false

    if (error.toString().includes('m-lines') || error.toString().includes('m-line')) {
      console.warn("resetting media. m-line inconsistency detected")

      peerConnection.getTransceivers().forEach(transceiver => {
        transceiver.stop()
      })

      await peerConnection.setLocalDescription({ type: 'rollback' })

      setTimeout(() => {
        peerConnection.addTransceiver('audio', { direction: 'sendrecv' })
      }, 100)
    }
  } finally {
    setTimeout(() => {
      peerConnection.isNegotiating = false
    }, 1000)
  }
}

export const setupIceCandidateHandler = (peerConnection, webSocket, clientToSendTo) => {
  peerConnection.onicecandidate = (event) => {
    if (event.candidate && peerConnection.localDescription) {
      webSocket.send(JSON.stringify({
        type: 'candidate',
        candidate: event.candidate,
        to: clientToSendTo
      }))
    }
  }
  peerConnection.oniceconnectionstatechange = () => {
    console.log("ICE connection state: ", peerConnection.iceConnectionState)
    if (peerConnection.iceConnectionState === 'failed') {
      peerConnection.restartIce()
    }
  }
}

export const setupRemoteStreamHandler = (peerConnection, setRemoteStream) => {
  peerConnection.ontrack = (event) => {
    if (event.streams && event.streams[0]) {
      setRemoteStream(event.streams[0])
    }
  }
}
export const initializePeerConnection = (setRemoteStreams, userInfo, peerRef, setPeerRoom, webSocketRoom, microphoneStreamRef, audioContextRef, currentUserId) => {
  if (peerRef?.current?.[userInfo.userId]) {
    console.warn("Peer connection already exists for: ", userInfo.userId)
    return
  }

  console.log("creating a peer with the id : ", userInfo.userId)
  const newConnection = creatPeerConnection()

  newConnection.polite = hashString(currentUserId.current) < hashString(userInfo.userId)

  if (microphoneStreamRef.current) {
    addStreamToPeer(newConnection, microphoneStreamRef)
  } else {
    console.log("mic not found to add to stream")
  }

  newConnection.onsignalingstatechange = () => {
    console.log('Sign`ling state : ', newConnection.signalingState)
  }

  newConnection.oniceconnectionstatechange = () => {
    console.log('Ice connection state : ', newConnection.iceConnectionState)
    if (newConnection.iceConnectionState === 'disconnected' ||
      newConnection.iceConnectionState === 'failed') {
      newConnection.restartIce()
    }
  }

  setupRemoteStreamHandler(newConnection, (stream) => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      console.warn("Audio context in undefined or closed")
      return
    }

    if (!stream || !stream.getAudioTracks || stream.getAudioTracks().length === 0) {
      console.warn("Invalid stream or no audio tracks available")
      return
    }
    try {

      const source = audioContextRef.current.createMediaStreamSource(stream)
      let gainNode = audioContextRef.current.createGain();
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
    } catch (error) {
      console.error("Error while setting up auido context for remote stream: ", error)
    }
  })

  let isNegotiating = false
  newConnection.onnegotiationneeded = async () => {
    if (isNegotiating) {
      console.log("Skipping concurent negotiation")
      return
    }

    if (newConnection.signalingState !== 'stable') {
      console.log("Skipping negotiation - not in stable state:", newConnection.signalingState)
      return
    }

    isNegotiating = true
    try {
      createPeerOffer(
        newConnection,
        webSocketRoom,
        userInfo.userId
      )
    } catch (error) {
      console.error('Negotiation error: ', error)
    } finally {
      setTimeout(() => {
        isNegotiating = false
      }, 1000)
    }
  }


  setupIceCandidateHandler(
    newConnection,
    webSocketRoom,
    userInfo.userId
  )

  setPeerRoom(prev => ({
    ...prev,
    [userInfo.userId]: newConnection
  }))
  console.log(newConnection)

  setTimeout(() => {
    if (newConnection.signalingState === 'stable' &&
      newConnection.iceConnectionState !== 'connected' &&
      newConnection.iceConnectionState !== 'completed') {
      console.log(`Forcing negotiation for ${userInfo.userId}`)
      newConnection.onnegotiationneeded()
    }
  }, 1000)
}

const handleOffer = async (offer, peerRef, webSocket) => {
  let timeWaited = 0
  console.log("Handling offer from: ", offer)

  while (!peerRef.current[offer.from] && timeWaited < 50) {
    await sleep(100)
    timeWaited++
  }

  const peer = peerRef?.current[offer.from]

  if (!peer) {
    console.warn("Peer not found after waiting")
    return
  }

  try {
    const offerDescription = new RTCSessionDescription({
      type: 'offer',
      sdp: offer.sdp
    })

    if (peer.signalingState === 'have-local-offer') {
      if (peer.polite) {
        console.log("Polite peer - performing rollback ")
        await peer.setLocalDescription({ type: "rollback" })
        await peer.setRemoteDescription(offerDescription)
      } else {
        console.warn("Impolite peer, ignoring offer ")
        return
      }
    } else if (peer.signalingState === 'stable') {
      console.log("Setting remote description for offer")
      await peer.setRemoteDescription(offerDescription)
    } else {
      console.warn("unexpected state for offer : ", peer.signalingState)
      return
    }

    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer)

    webSocket.send(JSON.stringify({
      type: 'answer',
      sdp: peer.localDescription.sdp,
      to: offer.from
    }))

    console.log("Answer setn successfully to : ", offer.from)

  } catch (error) {
    console.error("Omffer handling failed:", error);
    if (error.name === 'InvalidStateError') {
      console.log('Restarting ICE due to invalid state')
      peer.restartIce()
    }
  }
}

const handleAnswer = async (message, peerRef) => {
  const peer = peerRef.current[message.from]

  if (!peer) {
    console.warn("Peer connection not found for answer")
    return
  }

  try {
    if (peer.signalingState !== 'have-local-offer') {
      console.warn('Unexprected sginaling state : ', peer.signalingState)
      return;
    }

    await peer.setRemoteDescription(new RTCSessionDescription({
      type: 'answer',
      sdp: message.sdp
    }))

    await processQueuedCandidates(peer)

    console.log("Answer successfully set !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
  } catch (error) {
    console.error("Falied ot set answer: ", error.message)
    if (peer.signalingState === 'stable') {
      peer.restartIce()
    }
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

    const peer = peerRef.current[message.from]

    if (candidate && peer) {
      if (peer.remoteDescription) {
        await peer.addIceCandidate(new RTCIceCandidate(candidate))
      } else {
        if (!peer.pendingCandidates) {
          peer.pendingCandidates = []
        }
        peer.pendingCandidates.push(candidate)
      }
    }

  } catch (error) {
    console.error("ICE Candidate error: ", {
      error: error.message,
      recieved: message.candidate
    })
  }
}

const processQueuedCandidates = async (peer) => {
  if (peer.pendingCandidates && peer.remoteDescription) {
    for (const candidate of peer.pendingCandidates) {
      console.log("queued candidates !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate))
      } catch (error) {
        console.error("Error adding queued candidate : ", error)
      }
    }

    peer.pendingCandidates = []
  }
}

async function handleMessage(message, peerRef, webSocket, idAwaiter, setRemoteStreams, setPeerRoom, currentUserId) {
  try {
    switch (message.type) {
      case 'id':
        handleNewIds([{ userId: message.id, username: message.initDate[0], pfpNum: message.initDate[1] }], idAwaiter, peerRef, currentUserId)
        break
      case 'leave':
        let streamInfoToClean

        setRemoteStreams(prev => {
          streamInfoToClean = prev[message.from]
          const newStreams = { ...prev }
          delete newStreams[message.from]
          return newStreams
        })

        if (streamInfoToClean && streamInfoToClean.nodes) {
          const { source, gainNode } = streamInfoToClean.nodes
          source?.disconnect()
          gainNode?.disconnect()
        }

        const peerToClose = peerRef.current[message.from]
        if (peerToClose) {
          peerToClose?.getTransceivers().forEach(transceiver => {
            if (transceiver.sender.track) {
              transceiver.sender.track.stop()
              transceiver.sender.replaceTrack(null)
            }
            transceiver.stop()
          })
          peerToClose.close()
        }

        if (setPeerRoom) {
          setPeerRoom(prev => {
            const newPeers = { ...prev };
            delete newPeers[message.from];
            return newPeers;
          });
        }

        delete peerRef.current[message.from]

        break
      case 'offer':
        //malumno
        await handleOffer(message, peerRef, webSocket)
        break
      case 'answer':
        console.log("Answer recieved")
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

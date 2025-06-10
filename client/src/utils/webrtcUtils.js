function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
export const createTestAudioStream = (audioContext, frequency = 440, volume = 0.1) => {
  try {
    const oscillator = audioContext.current.createOscillator()
    const gainNode = audioContext.current.createGain()
    const mediaStreamDestination = audioContext.current.createMediaStreamDestination()
    
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(frequency, audioContext.current.currentTime)
    gainNode.gain.setValueAtTime(volume, audioContext.current.currentTime)
    
    oscillator.connect(gainNode)
    gainNode.connect(mediaStreamDestination)
    
    // Also connect to speakers so you can hear it locally (optional)
    gainNode.connect(audioContext.current.destination)
    
    // Start the oscillator
    oscillator.start()
    
    console.log(`Created test audio stream: ${frequency}Hz sine wave`)
    
    return {
      stream: mediaStreamDestination.stream,
      oscillator,
      gainNode,
      stop: () => {
        try {
          oscillator.stop()
          oscillator.disconnect()
          gainNode.disconnect()
          console.log("Test audio stopped and disconnected")
        } catch (error) {
          console.error("Error stopping test audio:", error)
        }
      }
    }
  } catch (error) {
    console.error("Error creating test audio stream:", error)
    return null
  }
}
export const creatPeerConnection = () => {
  const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
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
    const existingTransceiver = peerConnection.getTransceivers().find(t =>
      t.sender && t.sender.track && t.sender.track.kind === 'audio'
    )

    if (existingTransceiver) {
      existingTransceiver.sender.replaceTrack(stream.current.getAudioTracks()[0])
        .catch(error => console.error("Error replacing track:", error))
    } else {
      peerConnection.addTransceiver(stream.current.getAudioTracks()[0], {
        direction: 'sendrecv',
        streams: [stream.current]
      });
    }

  } catch (error) {
    console.error("Error in addStreamToPeer:", error)
  }
}

export const setupWebSocket = async (wsUrl, initObj, idAwaiter, peerRef, setRemoteStreams, setPeerRoom, microphoneStreamRef, audioContextRef, currentUserId) => {
  const webSocket = new WebSocket(`${wsUrl}`)

  let resolveId
  let idPromise = new Promise((res) => resolveId = res)

  webSocket.addEventListener("open", () => {
    webSocket.send(JSON.stringify(initObj))

    webSocket.addEventListener("message", (event) => {
      if (webSocket.readyState !== WebSocket.OPEN) return
      const userIds = JSON.parse(event.data)
      resolveId(userIds[0])
      userIds.shift()
      handleNewIds(userIds, idAwaiter, peerRef, currentUserId)

      webSocket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data)
        handleMessage(message, peerRef, webSocket, idAwaiter, setRemoteStreams, setPeerRoom, microphoneStreamRef, audioContextRef, currentUserId)
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
    }

    if (peerConnection.isNegotiating) {
      console.warn('Already negotiating, skipping creation')
      return false
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
    if (event.candidate &&
      peerConnection.iceGatheringState === 'complete' &&
      peerConnection.signalingState === 'stable') {
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

  newConnection.polite = String(currentUserId.current) > String(userInfo.userId)

  addStreamToPeer(newConnection, microphoneStreamRef)

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

  let isNegotiating = false
  newConnection.onnegotiationneeded = async () => {
    if (isNegotiating || newConnection.isNegotiating) {
      console.log("Skipping concurent negotiation")
      return
    }

    if(newConnection.polite){
      console.log("Polite peer, not initiating negotiation")
      return
    }

    await sleep(Math.random() * 100)

if (newConnection.signalingState !== 'stable') {
    console.log("Skipping negotiation - not in stable state:", newConnection.signalingState)
    return
  }

    isNegotiating = true
    try {
      if (!newConnection.polite) {
        createPeerOffer(
          newConnection,
          webSocketRoom,
          userInfo.userId
        )
      }
    } catch (error) {
      console.error('Negotiation error: ', error)
    } finally {
      isNegotiating = false
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

}

const handleOffer = async (offer, peerRef, webSocket, currentUserId) => {
  let timeWaited = 0
  console.log("Handling offer from: ", offer.from)

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
        console.log("Polite peer. roolback")
        await peer.setLocalDescription({ type: "rollback" }),
        await peer.setRemoteDescription(offerDescription)

      } else {
        console.warn("Impolite peer. Ignoring offer")
        return
      }
    }else if(peer.signalingState === 'stable'){
      await peer.setRemoteDescription(offerDescription)
    } else {
    console.warn("Unexpected singlaing state for offer: ", peer.signalingState)
    return
    }

    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer)

    //dont know weather to use
    /*
       const waitForICEGathering = new Promise(resolve => {
         if (peer.iceGatheringState === 'complete') {
           resolve()
         } else {
           const checkState = () => {
             if (peer.iceGatheringState === 'complete') {
               peer.removeEventListener('icegatheringstatechange', checkState)
               resolve()
             }
           }
           peer.addEventListener('icegatheringstatechange', checkState)
         }
       })
   
       await waitForICEGathering
      */

    webSocket.send(JSON.stringify({
      type: 'answer',
      sdp: peer.localDescription.sdp,
      to: offer.from
    }))

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

    await peerRef.current[message.from].setRemoteDescription(new RTCSessionDescription({
      type: 'answer',
      sdp: message.sdp
    }))

    console.log("Answer successfully set")
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
    if (candidate && peer && peer.remoteDescription) {
      await peer.addIceCandidate(new RTCIceCandidate(candidate))
    }

  } catch (error) {
    console.error("ICE Candidate error: ", {
      error: error.message,
      recieved: message.candidate
    })
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
        await handleOffer(message, peerRef, webSocket, currentUserId)
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

import { useEffect, useRef } from "react"
import { useState } from "react"

const wsUrl = "http://martinkurtev.com:8080/ws"

export function useSetUpWebrtc(roomId, userInfo, audioContextRef, microphoneStreamRef) {
  if (roomId) return

  //internal only (private)
  //
  const webSocketRoom = useRef()
  const processingRef = useRef(false)
  //used as a pointer to the peerRoom
  const peerRef = useRef()
  const isInitilizing = useRef(false)
  //holds the peerConnection for each peer
  const [peerRoom, setPeerRoom] = useState(null)
  //used as a less advaced golang channel to wait for new peers
  const [idAwaiter, setIdAwaiter] = useState(null)
  const [micStream, setMicStream] = useState()
  //isnt used anywhere
  const userId = useRef()

  // public
  //
  //holds the audioStream and the gainNode for each peer
  const [remoteStream, setRemoteStreams] = useState(null)

  //TODO: 4. Make settings page on the site. 5. Make endpoint that you get the users in a voicechat 6.make the chat function using websockets and some kind of persistent message.
  //TODO: 7. Make a simple auth system(give secret id to each user and check weather the secret id mathches the given to the user when making a request)

  useEffect(() => {
    peerRef.current = peerRoom
  }, [peerRoom])

  //when adding a user
  useEffect(() => {
    if (!idAwaiter || idAwaiter.length === 0 || processingRef.current) return
    const processNextId = async () => {
      processingRef.current = true
      const successfullyProcessed = []

      const queuedIds = [...idAwaiter]
      while (queuedIds.length > 0) {
        const userInfo = queuedIds[0]

        try {
          initializePeerConnection(setRemoteStreams, userInfo, peerRef, setPeerRoom, webSocketRoom.current, microphoneStreamRef, audioContextRef)
          successfullyProcessed.push(userInfo)
          queuedIds.shift()
        } catch (error) {
          console.error(`Failed to initialize a peer : ${userInfo} : `, error)
        }
      }
      setIdAwaiter(prev => prev.filter(id => !successfullyProcessed.includes(id)))
    }
    processNextId()

  }, [idAwaiter])

  useEffect(() => {
    if (peerRoom) {
      Object.values(peerRoom).forEach(peerConnection => {
        const sender = peerConnection.getSenders().find(s => s.track.kind == 'audio')
        if (sender) {
          sender.replaceTrack(microphoneStreamRef.current.getAudioTracks()[0])
        }
      })
    }
    return () => {
      if (peerRoom) {
        Object.values(peerRoom).forEach(peerConnection => {
          peerConnection.getSenders().forEach(sender => {
            if (sender.track && sender.track.kind === 'audio') {
              sender.track.stop()
              peerConnection.removeTrack(sender)
            }
          })
        })
      }
    }
  }, [micStream])

  useEffect(() => {
    //TODO : dont use this
    let lastStream = microphoneStreamRef.current

    const checkStream = () => {
      if (microphoneStreamRef.current !== lastStream) {
        lastStream = microphoneStreamRef.current
        setMicStream(microphoneStreamRef.current)
      }
    }

    const interval = setInterval(checkStream, 1000)

    return () => {
      clearInterval(interval)
      if (webSocketRoom.current) {
        webSocketRoom.current?.close()
      }

      if (peerRoom) {
        Object.entries(peerRoom).forEach(([peerId, peer]) => {
          peer.getSenders().forEach(sender => {
            if (sender.track && sender.track.kind === 'audio') {
              sender.track.stop()
              peer.removeTrack(sender)
            }
          })

          peer.close()

          if (setPeerRoom) {
            setPeerRoom(prev => {
              const newPeers = { ...prev }
              delete newPeers[peerId]
              return newPeers
            })
          }

          if (setRemoteStreams) {
            setRemoteStreams(prev => {
              const newStreams = { ...prev }
              delete newStreams[message.from]
              return newStreams
            })
            if (remoteStream[peerId]) {
              streamInfoToClean.forEach(node => {
                node?.disconnect()
              })
            }
          }

        })
      }

    }
  }, [])

  //inits webSocket conn
  const initFunc = async () => {
    if (webSocketRoom.current?.readyState === WebSocket.OPEN) return

    if (isInitilizing.current) return
    isInitilizing.current = true

    try {
      if (webSocketRoom.current) {
        webSocketRoom.current.close()
        await new Promise(resolve => {
          webSocketRoom.current.onclose = resolve
          setTimeout(resolve, 100)
        })
      }
      let objectToSendToWs = {
        ...userInfo,
        roomId: roomId
      }
      const [webSocket, userIdGiven] = await setupWebSocket(wsUrl, objectToSendToWs, setIdAwaiter, peerRef, setRemoteStreams, setPeerRoom, microphoneStreamRef, audioContextRef)
      webSocketRoom.current = webSocket
      userId.current = userIdGiven

      if (webSocket.readyState !== WebSocket.OPEN) {
        throw new Error("Connection failed")
      }

    } finally {
      isInitilizing.current = false
    }
  }

  initFunc()
}

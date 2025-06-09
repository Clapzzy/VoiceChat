import { useEffect, useRef } from "react"
import { useState } from "react"
import { initializePeerConnection, setupWebSocket } from "./webrtcUtils"

const wsUrl = "wss://martinkurtev.com/ws";

export function useSetUpWebrtc(roomId, userInfo, audioContextRef, microphoneStreamRef) {
  console.log(roomId)
  //should just return a bunch of null representing the values that should be ruturned

  //internal only (private)
  //
  const webSocketRoom = useRef()
  const processingRef = useRef(false)
  const isInitilizing = useRef(false)
  //holds the peerConnection for each peer
  const [peerRoom, setPeerRoom] = useState({})
  //used as a pointer to the peerRoom
  const peerRef = useRef(peerRoom)
  //used as a less advaced golang channel to wait for new peers
  const [idAwaiter, setIdAwaiter] = useState([])
  const [micStream, setMicStream] = useState()
  //isnt used anywhere
  const userId = useRef()

  // public
  //
  //holds the audioStream and the gainNode for each peer
  const [remoteStream, setRemoteStreams] = useState({})


  //TODO: 6.make the chat function using websockets and some kind of persistent message.
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
        console.log("userInfo be like : ", userInfo)

        try {
          initializePeerConnection(setRemoteStreams, userInfo, peerRef, setPeerRoom, webSocketRoom.current, microphoneStreamRef, audioContextRef, userId)
          successfullyProcessed.push(userInfo)
          queuedIds.shift()
        } catch (error) {
          console.error(`Failed to initialize a peer : ${userInfo} : `, error)
          queuedIds.shift()
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
        } else if (!sender && microphoneStreamRef.current) {
          peerConnection.addTrack(microphoneStreamRef.current.getAudioTracks()[0])
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
    const abortController = new AbortController()
    const { signal } = abortController;

    let lastStream = microphoneStreamRef.current

    const checkStream = () => {
      if (microphoneStreamRef.current !== lastStream) {
        lastStream = microphoneStreamRef.current
        setMicStream(microphoneStreamRef.current)
      }
    }

    //TODO : dont use this
    const interval = setInterval(checkStream, 1000)

    const initFunc = async () => {
      if (signal.aborted) return

      if (!roomId) return
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
        const [webSocket, userIdGiven] = await setupWebSocket(wsUrl, objectToSendToWs, setIdAwaiter, peerRef, setRemoteStreams, setPeerRoom, userId)
        if (signal.aborted) {
          webSocket.close()
          return;
        }
        webSocketRoom.current = webSocket
        userId.current = userIdGiven

        if (webSocket.readyState !== WebSocket.OPEN) {
          throw new Error("Connection failed")
        }

      } catch (error) {
        console.error("There has been an error in the setting up of the webrtc ws socket: ", error)
      } finally {
        isInitilizing.current = false
      }
    }
    initFunc()
    return () => {
      abortController.abort()
      clearInterval(interval)
      if (webSocketRoom.current?.readyState === WebSocket.OPEN) {
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

          peer.ontrack = null
          peer.onicecandidate = null
          peer.close()

          if (remoteStream[peerId]?.nodes) {
            remoteStream[peerId]?.nodes.forEach(node => {
              node?.disconnect()
            })
          }
        })

        if (setPeerRoom) {
          setPeerRoom({})
        }
        if (setRemoteStreams) {
          setRemoteStreams({})
        }
      }
    }
  }, [roomId, userId])

  if (!roomId) return [remoteStream]
  //inits webSocket conn

  return [remoteStream]
}

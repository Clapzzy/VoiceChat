import { useEffect, useRef } from "react"
import { useState } from "react"
import { createTestAudioStream, initializePeerConnection, setupWebSocket } from "./webrtcUtils"

const wsUrl = "wss://martinkurtev.com/ws";

export function useSetUpWebrtc(roomId, userInfo, audioContextRef, microphoneStreamRef) {
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

  const testAudioRef = useRef(null)
  const originalMicStreamRef = useRef(null)
  const [testMod, setTestMod] = useState(true)
  //isnt used anywhere
  const userId = useRef()

  // public
  //
  //holds the audioStream and the gainNode for each peer
  const [remoteStream, setRemoteStreams] = useState({})


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
      processingRef.current = false
    }
    processNextId()

  }, [idAwaiter])

  useEffect(() => {
    if (!peerRoom || !microphoneStreamRef.current) return

    Object.values(peerRoom).forEach(peerConnection => {
      if (peerConnection.connectionState === 'closed') return

      try {
        const audioTransceiver = peerConnection.getTransceivers().find(
          t => t.sender.track && t.sender.track.kind === 'audio'
        )
        if (audioTransceiver && microphoneStreamRef.current.getAudioTracks().length > 0) {
          audioTransceiver.sender.replaceTrack(microphoneStreamRef.current.getAudioTracks()[0])
            .catch(error => console.error("Error replacing track: ", error))
        } else if (!audioTransceiver && microphoneStreamRef.current.getAudioTracks()[0]) {
          peerConnection.addTransceiver(microphoneStreamRef.current.getAudioTracks()[0], {
            direction: 'sendrecv',
            streams: [microphoneStreamRef.current]
          })
        }
      } catch (error) {
        console.error("Error updating peer connecton with new mic stream : ", error)
      }
    })

    return () => {
      if (peerRoom) {
        Object.values(peerRoom).forEach(peerConnection => {
          if (peerConnection.connectionState === 'closed') return

          peerConnection.getTransceivers().forEach(transceiver => {
            if (transceiver.sender.track && transceiver.sender.track.kind === 'audio') {
              transceiver.sender.track.stop()
              transceiver.sender.replaceTrack(null).catch(console.error)
            }
          })
        })
      }
    }
  }, [micStream, peerRoom])

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

    const cleanUp = () => {
      clearInterval(interval)
      if (webSocketRoom.current) {
        webSocketRoom.current.onclose = null
        webSocketRoom.current?.close()
      }

      if (peerRoom) {
        Object.entries(peerRoom).forEach(([peerId, peer]) => {

          if (peer.connectionState !== "closed") {
            peer.getTransceivers().forEach(transceiver => {
              if (transceiver.sender.track) {
                transceiver.sender.track.stop()
                transceiver.sender.replaceTrack(null)
              }
              transceiver.stop()
            })

            peer.ontrack = null
            peer.onicecandidate = null
            peer.onnegotiationneeded = null
            peer.close()
          }

          if (remoteStream[peerId]?.nodes) {
            const { source, gainNode } = remoteStream[peerId].nodes
            source?.disconnect()
            gainNode?.disconnect()
          }
        })

        if (setPeerRoom) {
          setPeerRoom({})
        }
        if (setRemoteStreams) {
          setRemoteStreams({})
        }
        if (setIdAwaiter) {
          setIdAwaiter([])
        }
        peerRef.current = {}
      }
    }

    const initFunc = async () => {
      cleanUp()
      if (signal.aborted) return

      if (!roomId) return

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
        const [webSocket, userIdGiven] = await setupWebSocket(wsUrl, objectToSendToWs, setIdAwaiter, peerRef, setRemoteStreams, setPeerRoom)
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
      cleanUp()
    }
  }, [roomId, userInfo])

  if (!roomId) return [remoteStream, userId]
  //inits webSocket conn

  return [remoteStream, userId]
}

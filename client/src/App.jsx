import { useEffect, useRef, useState } from 'react'
import './App.css'
import { createPeerOffer, setupWebSocket, creatPeerConnection, setupIceCandidateHandler, addStreamToPeer, setupRemoteStreamHandler, initializePeerConnection } from './utils/webrtcUtils';

const roomId = 1;
const wsUrl = "http://localhost:8080/ws"

function VolumeSlider({ gainRef }) {
  if (!gainRef.current) {
    return
  }
  const [voiceChatVolume, setVoiceChatVolume] = useState(1)
  useEffect(() => {
    gainRef.current.gain.value = voiceChatVolume
  }, [voiceChatVolume])
  return (
    <>
      {gainRef.current && (
        <input
          className="w-full bg-[#98C1D9] text rounded-md h-4"
          type='range'
          defaultValue="1"
          step="0.01"
          min="0"
          max="2"
          value={voiceChatVolume}
          onChange={(e) => setVoiceChatVolume(parseFloat(e.target.value))}
        />
      )}
    </>

  )
}

function App() {
  const [count, setCount] = useState(0)
  const [mute, setMute] = useState(true)

  const audioContextRef = useRef()

  const gainRef = useRef()

  const webSocketRoom = useRef()
  const isInitilizing = useRef(false)
  const userId = useRef()
  const peerRef = useRef({})
  const [peerRoom, setPeerRoom] = useState()
  const [remoteStreams, setRemoteStreams] = useState()

  const [idAwaiter, setIdAwaiter] = useState([])
  const processingRef = useRef(false)

  const microphoneStreamRef = useRef()
  const micNodeRef = useRef()

  const [microphoneDevices, setMicrophoneDevices] = useState([])
  const [currentMic, setCurrentMic] = useState()

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
        const currentId = queuedIds[0]
        try {
          initializePeerConnection(setRemoteStreams, currentId, peerRef, setPeerRoom, webSocketRoom.current, microphoneStreamRef, audioContextRef)
          successfullyProcessed.push(currentId)
        } catch (error) {
          console.error(`Failed to initialize a peer : ${currentId} : `, error)
        }
      }
      setIdAwaiter(prev => prev.filter(id => !successfullyProcessed.includes(id)))
    }

  }, [idAwaiter])

  useEffect(() => {
    const initFunc = async () => {
      if (webSocketRoom.current?.readyState === WebSocket.OPEN) return

      if (isInitilizing.current) return;
      isInitilizing.current = true

      try {
        if (webSocketRoom.current) {
          webSocketRoom.current.close()
          await new Promise(resolve => {
            webSocketRoom.current.onclose = resolve
            setTimeout(resolve, 100)
          })
        }
        const [webSocket, userIdGiven] = await setupWebSocket(wsUrl, roomId, setIdAwaiter, peerRef, setRemoteStreams, setPeerRoom, microphoneStreamRef, audioContextRef)
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
    return () => {
      webSocketRoom.current?.close()
      if (peerRef.current) {
        Object.values(peerRef.current).forEach(peer => {
          peer.close()
          setPeerRoom(prev => {
            const newPeers = { ...prev };
            delete newPeers[userId];
            return newPeers;
          });
        })
      }

    }
  }, [setIdAwaiter, setPeerRoom, setRemoteStreams])

  useEffect(() => {
    audioContextRef.current = new AudioContext()

    audioContextRef.current.suspend()

    navigator.mediaDevices.enumerateDevices()
      .then((devices) => {
        const audioDevices = devices.filter((device) => device.kind === "audioinput")
        setMicrophoneDevices(audioDevices)
        if (!currentMic) {
          setCurrentMic(0)
        }
      })

    return () => {
      audioContextRef.current.close()
      microphoneStreamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [peerRef])

  useEffect(() => {
    let mic = microphoneDevices[currentMic];
    if (!mic) return

    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.getTracks().forEach(track => track.stop());
    }

    navigator.mediaDevices.getUserMedia({ audio: { deviceId: { ideal: mic.deviceId } }, video: false })
      .then((mediaStream) => {
        microphoneStreamRef.current = mediaStream
        if (audioContextRef.current.state !== 'closed') {
          gainRef.current = audioContextRef.current.createGain();
        }

        gainRef.current.gain.value = 1;
        micNodeRef.current = audioContextRef.current.createMediaStreamSource(microphoneStreamRef.current)

        micNodeRef.current.connect(gainRef.current)
        gainRef.current.connect(audioContextRef.current.destination)

        if (!mute) audioContextRef.current.resume()



      })
      .catch((err) => {
        console.log("Got an error :", err)
      })

    if (peerRoom) {
      Object.values(peerRoom).forEach(peerConnection => {
        const sender = peerConnection.getSenders().find(s => s.track.kind == 'audio')
        if (sender) {
          sender.replaceTrack(microphoneStreamRef.current.getAudioTracks()[0])
        }

      })
    }
  }, [currentMic])

  useEffect(() => {
    if (mute == true) {
      audioContextRef.current.suspend()
    } else {
      audioContextRef.current.resume()
    }
  }, [mute])

  return (
    <>
      <div>
      </div>
      <h1>Voice chat demo</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <button onClick={() => setMute((mute) => !mute)}>
          {mute
            ? (<div style={{ background: "#EE6C4D" }}>Disabled</div>)
            : (<div style={{ background: "#E0FBFC" }}>Enabled</div>)}
        </button>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
        <div>
          <VolumeSlider gainRef={gainRef} />
          <select className='w-full h-10 ' value={currentMic} onChange={(event) => setCurrentMic(event.target.value)}>
            {
              microphoneDevices.map((mic, index) => {
                return (
                  <option className='text-[#293241] bg-[#E0FBFC]' value={index}>{mic.label}</option>
                )
              })}
          </select>
        </div>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App

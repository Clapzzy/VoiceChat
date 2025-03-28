import { useEffect, useRef, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const [mute, setMute] = useState(true)

  const audioContextRef = useRef()

  const oscillatorRef = useRef()
  const gainRef = useRef()

  const microphoneStreamRef = useRef()
  const micNodeRef = useRef()
  const microphoneDevices = useRef([])
  const currentMic = useState()

  useEffect(() => {
    audioContextRef.current = new AudioContext()

    oscillatorRef.current = audioContextRef.current.createOscillator(); // Create a sound source
    oscillatorRef.current.connect(audioContextRef.current.destination)
    oscillatorRef.current.start()
    audioContextRef.current.suspend()

    navigator.mediaDevices.enumerateDevices()
      .then((devices) => {
        devices.forEach((device) => {
          if (device.kind == "audioinput") {

            if (device.deviceId == "default") {
              currentMic.current = device
            }
            microphoneDevices.current.push(device)
          }
        })
      })

    return () => {
      oscillatorRef.current.stop()
      audioContextRef.current.close()
    }
  }, [])

  useEffect(() => {

    navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: currentMic.current } }, video: false })
      .then((mediaStream) => {
        microphoneStreamRef.current = mediaStream
        gainRef.current = audioContextRef.current.createGain(); // Create a volume control node
        gainRef.current.gain.value = 1; // Set volume to 50%
        micNodeRef.current = audioContextRef.current.createMediaStreamSource(microphoneStreamRef.current)

        micNodeRef.current.connect(gainRef.current)
        gainRef.current.connect(audioContextRef.current.destination)
      })
      .catch((err) => {
        console.log("Got an error :", err)
      })

  }, [currentMic.current])

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
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <button onClick={() => setMute((mute) => !mute)}>
          {mute
            ? (<div class='hidden' style={{ background: "#EE6C4D" }}>Disabled</div>)
            : (<div className="" style={{ background: "#E0FBFC" }}>Enabled</div>)}
        </button>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App

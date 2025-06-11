import { useRef, useState } from "react"
import { useEffect } from "react"
import { createTestAudioStream } from "./webrtcUtils"

export function useSetUpAudioMic() {
  //neded for webSocket set up
  const audioContextRef = useRef(null)
  const microphoneStreamRef = useRef(null)
  //needed for setting mic volume
  const gainRef = useRef(null)
  const oscilatorRef = useRef(null)

  //needed to choose a mic
  const [microphoneDevices, setMicrophoneDevices] = useState([])
  const [currentMic, setCurrentMic] = useState(null)
  const [permissionGranted, setPermissionGranted] = useState(false)

  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      stream.getTracks().forEach(track => track.stop())

      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioDevices = devices.filter((device) => device.kind === "audioinput")

      setMicrophoneDevices(audioDevices)
      setPermissionGranted(true)

      if (audioDevices.length > 0 && currentMic === null) {
        console.log("didnt find any audio devices")
        setCurrentMic(0)
      }
    } catch (error) {
      console.error("MicrophonePermission denied : ", error)

      setMicrophoneDevices([{ deviceId: 'default', label: 'Default Microphone' }])
      setCurrentMic(0)
    }
  }

  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    audioContextRef.current.suspend()


    requestMicPermission()

    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close()
      }
    }
  }, [])

  // sets up mic and its gain node
  useEffect(() => {
    if (!microphoneDevices?.[currentMic]) return

    let mic = microphoneDevices[currentMic]
    let micNode

    if (!mic) return

    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.getTracks().forEach(track => track.stop())
    }

    const setupMicrophone = async () => {
      try {
        const constraints = {
          audio: mic.deviceId === 'default'
            ? true
            : { deviceId: { ideal: mic.deviceId } },
          video: false
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)

        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          andinRef.current = audioContextRef.current.createGain()

          const destinationNode = audioContextRef.current.createMediaStreamDestination()
          gainRef.current.gain.value = 1;
          micNode = audioContextRef.current.createMediaStreamSource(mediaStream)

          micNode.connect(gainRef.current)
          gainRef.current.connect(destinationNode)
          microphoneStreamRef.current = destinationNode.stream
          /*
          const returnArr = createTestAudioStream(microphoneStreamRef, audioContextRef, 440, 5)
          oscilatorRef.current = returnArr[0]
          gainRef.current = returnArr[1]
          */
        }
      } catch (error) {
        console.log('Error setting up the microphone', error)
      }
    }

    setupMicrophone()

    return () => {
      if (micNode) {
        micNode.disconnect()
      }

      if (gainRef.current) {
        gainRef.current.disconnect()
      }

      if (microphoneStreamRef.current) {
        microphoneStreamRef.current?.getTracks().forEach(t => t.stop())
      }
    }
  }, [currentMic, microphoneDevices])


  return [audioContextRef, microphoneStreamRef, gainRef, [setCurrentMic, currentMic, microphoneDevices]]
}

import { useState, useRef } from "react"
import { AnimatePresence, motion } from "motion/react"
import { VolumeSlider } from "./volumeSlider"
import { createTestAudioStream } from "../utils/webrtcUtils"

export function UserControls({ profilePictureUrl, username, gainNodeRef, audioContextRef, currentMic, setCurrentMic, microphoneDevices, currentVoiceChat, setVoiceChat }) {
  const [muteMic, setMuteMic] = useState(false)
  const [muteAudio, setMuteAudio] = useState(true)
  const [micVolume, setMicVolume] = useState(1)

  const dialogRef = useRef()
  const [isModalOpen, setModalOpen] = useState(false)

  const toggleMic = () => {
    if (gainNodeRef.current) {
      gainNodeRef.current.value = muteMic ? micVolume : 0
      setMuteMic(!muteMic)
    }
  }

  const toggleAudio = async () => {
    if (!audioContextRef.current) return

    if (audioContextRef.current.state === 'suspended') {
      console.log("Changing audioContextRef state from ", audioContextRef.current.state, " to running")
      await audioContextRef.current.resume()
      setMuteAudio(false)
    } else if (audioContextRef.current.state === 'running') {
      console.log("Changing audioContextRef state from ", audioContextRef.current.state, " to suspended")
      await audioContextRef.current.suspend()
      setMuteAudio(true)
    }
  }

  return (
    <div className='relative bottom-3 w-full h-14 bg-[#E7EFF0] border border-[#c7c7c7] shadow-md rounded-lg flex flex-row items-center justify-between pl-3 pr-6 '>
      <div className='flex flex-row gap-2 items-center'>
        <img
          src={profilePictureUrl}
          alt='profile picture'
          className='w-[36px] h-[36px]'
        />
        <p className='text-[16px]'>{username}</p>
      </div>
      <div className='flex flex-row gap-3 items-center mt-2'>
        <div
          className="select-none p-0.5 mb-1.5 hover:shadow-md hover:bg-[#C1CBD1] rounded flex justify-center items-center"
          onClick={() => {
            setVoiceChat(null)
          }}
        >
          {currentVoiceChat
            ?
            (<span
              className="material-symbols-rounded"
              style={{ color: "#284B62", fontSize: 24 }}
            >call_end</span>)
            :
            (<div></div>)
          }
        </div>
        <div
          className="select-none p-0.5 mb-1.5 hover:shadow-md hover:bg-[#C1CBD1] rounded flex justify-center items-center"
          onClick={toggleMic}
        >
          {!muteMic
            ?
            (<span
              className="material-symbols-rounded"
              style={{ color: "#284B62", fontSize: 24 }}
            >mic</span>)
            :
            (<span
              className="material-symbols-rounded text-red-600"
              style={{ fontSize: 24 }}
            >mic_off</span>)

          }
        </div>
        <div
          className="select-none p-0.5 mb-1.5 hover:shadow-md hover:bg-[#C1CBD1] rounded flex justify-center items-center"
          onClick={toggleAudio}
        >
          {!muteAudio
            ?
            (<span
              className="material-symbols-rounded"
              style={{ color: "#284B62", fontSize: 24 }}
            >headset_mic</span>)
            :
            (<span
              className="material-symbols-rounded text-red-600"
              style={{ fontSize: 24 }}
            >headset_off</span>)
          }
        </div>
        <div
          className="select-none p-0.5 mb-1.5 hover:shadow-md hover:bg-[#C1CBD1] rounded flex justify-center items-center"
          onClick={() => {
            setModalOpen(true)
            dialogRef.current.showModal()
          }}
        >
          <span
            className="material-symbols-rounded"
            style={{ color: "#284B62", fontSize: 24, fontVariationSettings: "'FILL' 1" }}
          >settings</span>
        </div>
        <dialog
          ref={dialogRef}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 outline-none backdrop:bg-black backdrop:opacity-35"
          onClick={(e) => {
            const dialogDimensions = dialogRef.current.getBoundingClientRect()
            if (
              e.clientX < dialogDimensions.left ||
              e.clientX > dialogDimensions.right ||
              e.clientY < dialogDimensions.top ||
              e.clientY > dialogDimensions.bottom
            ) {
              dialogRef.current.close();
              setModalOpen(false);
            }
          }}
        >
          <div className=" bg-[#00000059]">
            <AnimatePresence>
              {isModalOpen && (
                <motion.div
                  key="modalContent"
                  initial={{ opacity: 0, scale: 1 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1 }}
                  transition={{ duration: 0.25 }}
                  className=" rounded-lg shadow-lg bg-[#F4F6F7] px-12 py-6 "
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="mb-1 text-[18px] select-none">Volume</p>
                  <VolumeSlider gainRef={gainNodeRef} micVolume={micVolume} setMicVolume={setMicVolume} />
                  <div className="flex justify-between items-center row w-full mb-6">
                    <p className="text-sm select-none">0%</p>
                    <p className="text-sm select-none">150%</p>
                    <p className="text-sm select-none">300%</p>
                  </div>
                  <p className="mb-1 text-[18px] select-none">Microphone input device</p>
                  <select className='w-full h-10 p-2 border rounded-lg' value={currentMic} onChange={(event) => setCurrentMic(event.target.value)}>
                    {
                      microphoneDevices.map((mic, index) => {
                        return (
                          <option
                            className='text-[#293241] bg-[#E0FBFC]'
                            value={index}
                            key={mic.label}
                          >{mic.label}</option>
                        )
                      })}
                  </select>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </dialog>
      </div>
    </div>


  )
}

import { useState, useRef } from "react"
import { AnimatePresence, motion } from "motion/react"

export function UserControls({ profilePictureUrl, gainNodeRef, audioContextRef }) {
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
      await audioContextRef.current.resume()
      setMuteAudio(false)
    } else if (audioContextRef.current.state === 'running') {
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
        <p className='text-[16px]'>!Clapzzy █▬█</p>
      </div>
      <div className='flex flex-row gap-3 items-center mt-2'>
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
          className="fixed top-1/2 left-1/2 outline-none backdrop:bg-black backdrop:opacity-35"
          onClick={(e) => {
            const dialogDimensions = dialogRef.current.getBoundingClientRect()
            if (
              e.clientX < dialogDimensions.left ||
              e.clientX > dialogDimensions.right ||
              e.clientY < dialogDimensions.top ||
              e.clientY > dialogDimensions.bottom
            ) {
              dialogRef.current.close()
              setModalOpen(false)
            }
          }}
        >
          <AnimatePresence>
            {isModalOpen && (
              <motion.div
                key="modalContent"
                initial={{ opacity: 0, scale: 1 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1 }}
                transition={{ duration: 0.25 }}
                className="w-12 h-12 border-none bg-amber-800"
              >
              </motion.div>

            )}
          </AnimatePresence>
        </dialog>
      </div>
    </div>


  )
}

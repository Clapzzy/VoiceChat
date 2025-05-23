import { useState } from "react"
export function UserControls({ profilePictureUrl, gainNodeRef, audioContextRef }) {
  const [muteMic, setMuteMic] = useState(false)
  const [muteAudio, setMuteAudio] = useState(true)

  const [micVolume, setMicVolume] = useState(1)

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
          className='w-[40px] h-[40px]'
        />
        <p className='text-[16px]'>!Clapzzy █▬█</p>
      </div>
      <div className='flex flex-row gap-3 items-center'>
        <div
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
              className="material-symbols-rounded bg-red-600"
              style={{ fontSize: 24 }}
            >mic_off</span>)

          }
        </div>
        <div
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
              className="material-symbols-rounded bg-red-600"
              style={{ fontSize: 24 }}
            >headset_off</span>)
          }
        </div>
        <span
          className="material-symbols-rounded"
          style={{ color: "#284B62", fontSize: 24 }}
        >headset_mic</span>
      </div>
    </div>


  )
}

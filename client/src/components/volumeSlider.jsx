import { useEffect } from "react"
export function VolumeSlider({ gainRef, micVolume, setMicVolume }) {
  if (!gainRef.current) {
    return
  }
  useEffect(() => {
    gainRef.current.gain.value = micVolume
  }, [micVolume])
  return (
    <>
      {gainRef.current && (
        <input
          className="w-full bg-[#7AB8C7] text rounded-md h-4"
          type='range'
          defaultValue="1"
          step="0.01"

          value={micVolume}
          onChange={(e) => setMicVolume(parseFloat(e.target.value))}
        />
      )}
    </>

  )
}

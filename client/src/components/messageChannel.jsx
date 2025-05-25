import { useState } from "react";

export function TextMessageChannel({ setCurrentChannel, currentChannel, channelId, channelName }) {
  const [isHovered, setIsHovered] = useState(false)

  const backgroundColor = currentChannel === channelName ? '#C1CBD1' : isHovered ? '#d1d9db' : '#dee8ea'

  return (
    <div
      style={{ backgroundColor }}
      className='w-full h-8 flex flex-row rounded-md items-center gap-2 px-3'
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => {
        setCurrentChannel(channelName)
      }}>
      <span
        className="material-symbols-rounded hover:bg-[]"
        style={{
          fontSize: 22,
          color: currentChannel === channelName ? "#284B62" : "#7AB8C7"
        }}
      >chat</span>
      <p className='text-[16px] mb-1'>{channelName}</p>
    </div>

  )
}

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

export function VoiceChatChannel({ voiceParticipants, voiceChatName, voiceChatIcon, setCurrentVoice, currentVoice, userInfo, imageUrls, remoteStream }) {
  const [isHovered, setIsHovered] = useState(false)
  const backgroundColor = currentVoice === voiceChatName ? '#C1CBD1' : isHovered ? '#d1d9db' : '#dee8ea'


  //TODO: add a way to interact with remoteStream
  return (
    <div className='flex flex-col'>
      <div
        style={{ backgroundColor }}
        className='w-full h-8 flex flex-row rounded-md items-center justify-between gap-2 px-3'
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => {
          setCurrentVoice(voiceChatName)
        }}>
        <div className='flex flex-row items-center gap-2'>
          <span
            className="material-symbols-rounded"
            style={{
              fontSize: 22,
              color: currentVoice === voiceChatName ? "#284B62" : "#7AB8C7"
            }}
          >{voiceChatIcon}</span>
          <p className='text-[16px] mb-1'>{voiceChatName}</p>
        </div>
        <div className='bg-[#284B62] rounded-full px-1'>
          <p className='text-[12px] text-white'>2/5</p>
        </div>
      </div>
      {/* voice chat participants */}
      {voiceParticipants?.length > 0 &&
        voiceParticipants.map(participant => (
          <div key={participant.username} className='gap-2 pl-3 my-2'>
            <div className='flex flex-row gap-2 items-center'>
              <img
                src={imageUrls[participant.pfpNum]}
                alt='profile picture'
                className='w-[24px] h-[24px]'
              />
              <p className='text-[16px]'>{participant.username}</p>
            </div>
          </div>
        ))
      }
      {currentVoice === voiceChatName && (
        <div className='gap-2 pl-3 my-2'>
          <div className='flex flex-row gap-2 items-center'>
            <img
              src={imageUrls[userInfo.pfpNum]}
              alt='profile picture'
              className='w-[24px] h-[24px]'
            />
            <p className='text-[16px]'>{userInfo.username}</p>
          </div>
        </div>
      )}
    </div>
  )
}

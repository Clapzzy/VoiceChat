import { TextMessageChannel, VoiceChatChannel } from "./messageChannel";

export function MessageChannelGroup({ setCurrentChannel, currentChannel, channelInfo }) {
  return (
    <div className=' w-full flex flex-col gap-3 select-none'>
      <p className=' text-[15]'>Text Channels</p>
      <div className='px-2 flex flex-col gap-2' >
        {channelInfo.map((item) => (
          <TextMessageChannel key={item.id} setCurrentChannel={setCurrentChannel} currentChannel={currentChannel} channelId={item.id} channelName={item.name} />
        ))}
      </div>
      <div className='w-full h-[1px] bg-[#C7C7C7]' />
    </div>

  )
}
export function VoiceChannelGroup({ userId, userInfo, voiceParticipants, setCurrentVoice, currentVoice, voiceChannelInfo, imageUrls, remoteStream }) {

  return (
    <div className=' w-full flex flex-col gap-3 mt-3'>
      <p className=' text-[15]'>Voice Channels</p>
      <div className='px-2 flex flex-col gap-2' >
        {/* voice chat channel singular */}
        {voiceChannelInfo.map((value) => (
          <VoiceChatChannel
            key={value.name}
            userId={userId}
            remoteStream={remoteStream}
            voiceParticipants={voiceParticipants?.[value.id]}
            imageUrls={imageUrls}
            userInfo={userInfo}
            setCurrentVoice={setCurrentVoice}
            currentVoice={currentVoice}
            voiceChatIcon={value.icon}
            voiceChatName={value.name}
          />
        ))}
      </div>
    </div>
  )
}

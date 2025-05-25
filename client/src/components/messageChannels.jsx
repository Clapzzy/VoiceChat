import { TextMessageChannel } from "./messageChannel";

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

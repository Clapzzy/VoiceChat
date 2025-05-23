export function MessageChannelGroup({ setCurrentChannel, currentChannel, channelIds }) {
  return (
    <div className=' w-full flex flex-col gap-3'>
      <p className=' text-[15]'>Text Channels</p>
      <div className='px-2 flex flex-col gap-2' >
        {channelIds.map((item) => (
          <MessageChannel setCurrentChannel={setCurrentChannel} currentChannel={currentChannel} channelId={item} />
        ))}
      </div>
      <div className='w-full h-[1px] bg-[#C7C7C7]' />
    </div>

  )
}

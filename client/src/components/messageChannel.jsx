export function MessageChannel({ setCurrentChannel, currentChannel, channelId }) {
  return (
    <div
      style={currentChannel == channelId ? { backgroundColor: "#C1CBD1" } : { backgroundColor: "#91B5B9" }}
      className='w-full h-8 flex flex-row rounded-md items-center gap-2 px-3'
      onClick={() => {
        setCurrentChannel(channelId)
      }}
    >284B62
      <span
        className="material-symbols-rounded"
        style={[{ fontSize: 22 }, currentChannel == channelId ? { color: "#284B62" } : { color: "#7AB8C7" }]}
      >chat</span>
      <p className='text-[16px] mb-1'>General Chat I</p>
    </div>

  )
}

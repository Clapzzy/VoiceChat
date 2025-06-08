import { useState } from "react";

export function TextChat({ currentChat, chatMessages, sendMessage, channelInfo, imageUrls }) {
  const [message, setMessage] = useState('')

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const trimmedMessage = message.trim()
      if (trimmedMessage) {
        sendMessage(trimmedMessage, channelInfo.find(value => value.name == currentChat))
        setMessage('')
      }
    }
  }

  return (
    <div className='bg-white flex-col grow h-fit w-fit hidden sm:flex min-w-64 z-10'>
      {/* the actual chat log */}
      {/* chat lable */}
      <div className="bg-white sticky line-clamp-none top-0 left-96 right-0 z-20">
        <div className='mt-4 mb-2 mx-6 flex flex-row items-center gap-3 select-none'>
          <span className="material-symbols-outlined" style={{ color: "#7AB8C7", fontSize: 28 }}>chat</span>
          <p className='text-[16px] pt-[1px]'>{currentChat}</p>
        </div>
        <div className='w-full h-[1px] mt-[14px] bg-[#E5E5E5]'></div>
      </div>
      {/*the container for the comments*/}
      <div className="flex flex-col min-w-0 h-full gap-3 pt-4 pb-6 pl-6 pr-2">
        {chatMessages && chatMessages?.[currentChat]?.map((message) => (
          <div className="flex flex-row gap-1.5 min-w-0 ">
            <img
              className="w-[40px] h-[40px]"
              alt="profile picture"
              src={imageUrls[message.pfpNum]}
            />
            <div className="flex flex-col gap-1 flex-auto min-w-0">
              <p className="text-[16px] color-[#284B62]">{message.username}</p>
              <p className="text-base break-words">
                {message.message}
              </p>
            </div>
          </div>
        ))}
      </div>
      {/* chat text box */}
      <div className='fixed z-20 bottom-0 left-96 right-0 pb-4 px-3'>
        <textarea
          placeholder='Message #general_chat_1'
          className='w-full bg-[#E7EFF0] border border-[#c7c7c7] shadow-md rounded-lg resize-none overflow-hidden p-4 placeholder:mb-1'
          rows={1}
          maxLength={700}
          value={message}
          onKeyDown={handleKeyDown}
          onChange={(e) => setMessage(e.target.value)}
          onInput={(e) => {
            e.target.style.height = 'auto';
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          style={{ minHeight: '56px' }}
        />
      </div>
    </div>
  )
}

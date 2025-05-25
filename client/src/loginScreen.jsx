
import { useEffect, useRef, useState } from 'react'
import { motion } from "motion/react"
import 'material-symbols'
import './App.css'

export function LoginScreen({ setUserInfo }) {
  const [currentPfp, setPfp] = useState(0)
  const [imageUrls, setImageUrls] = useState(null)
  const inputRef = useRef()
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const images = import.meta.glob('./assets/pfp*.png', {
      eager: true,
      query: '?url',
      import: 'default'
    });
    const urls = Object.values(images)

    setImageUrls(urls)
    setPfp(Math.floor(Math.random() * urls.length))
  }, [])

  const refreshPfp = () => {
    const randomIndex = Math.floor(Math.random() * imageUrls.length)
    setPfp(randomIndex)
  }

  const handleTap = () => {
    setRotation(prev => prev + 360);
  };

  const onGoNextPage = () => {
    if (!inputRef.current.value) return
    setUserInfo({
      userName: inputRef.current.value,
      pfpNum: currentPfp
    })
    console.log("Neshot")
  }


  return (
    <>
      <div className='w-screen h-screen'>
        <div className='m-6 flex flex-row gap-3 items-center select-none'>
          <span className="material-symbols-outlined select-none" style={{ color: "#7AB8C7", fontSize: 44 }}>adaptive_audio_mic</span>
          <p className='text-2xl pb-1 select-none'>QuickChat</p>
        </div>
        <div className='w-full h-full flex justify-center items-center'>
          <div className='w-[640px] p-9 bg-[#cae3e9] rounded-xl shadow-xl flex flex-col items-center '>
            <p className='w-fit text-4xl'>Welcome to QuickChat</p>
            <p className='w-fit text-2xl text-[#666666] mt-4'>choose a name and a picture</p>
            <motion.div
              initial="inactive"
              whileHover="active"
              variants={{
                active: { scale: 1.1 },
                inactive: { scale: 1 }
              }}
              className='relative w-16 h-16 inline-block mt-6 group'
              onClick={refreshPfp}
            >
              <motion.img
                variants={{
                  inactive: { filter: 'brightness(100%)' },
                  active: { filter: 'brightness(50%)' },
                }}
                transition={{
                  type: 'spring',
                  stiffness: 100,
                  damping: 10,
                  mass: 0.75,
                }}
                src={imageUrls?.[currentPfp]}
                alt='profile picture'
                className='w-16 h-16 ' />
              <motion.div
                variants={{
                  active: { opacity: 1 },
                  inactive: { opacity: 0 }
                }}
                onTap={handleTap}
                animate={{ rotate: rotation }}
                transition={{
                  type: 'spring',
                  stiffness: 100,
                  damping: 10,
                  mass: 0.75,
                }}
                className="absolute inset-0 flex items-center justify-center opacity-0"
                style={{ transformOrigin: 'center' }}
              >
                <span
                  className="material-symbols-outlined select-none"
                  style={{ color: '#7AB8C7', fontSize: 44 }}
                >
                  cycle
                </span>
              </motion.div>
            </motion.div>
            <input
              ref={inputRef}
              className="shadow-inner appearance-none border-2 border-[#79888c] focus:border-[#3D8A8F] rounded w-64 mt-2 py-2 px-3 text-white bg-[#91b5b9] leading-tight focus:outline-none focus:shadow-outline"
              id="username"
              maxLength={16}
              type="text"
              placeholder="Username" />

            <motion.button
              whileHover={{ backgroundColor: "#34617F" }}
              onClick={onGoNextPage}
              className='appearance-none shadow-md px-8 mt-16 py-2 flex flex-row bg-[#284b62] gap-3'
              style={{ backgroundColor: "#284B62" }}
            >
              <p className='text-white text-xl'>Continue</p>
              <span className="material-symbols-outlined" style={{ color: "white", fontSize: 30 }}>arrow_right_alt</span>
            </motion.button>
          </div>
        </div>
      </div >
    </>
  )
}

import { useState } from 'react'
import 'material-symbols'
import './App.css'
import { LoginScreen } from './loginScreen'
import { WebrtcChat } from './actualApp'

function App() {
  const [userInfo, setUserInfo] = useState(null)
  return (
    <>
      {userInfo
        ? (<WebrtcChat userInfo={userInfo} />)
        : (<LoginScreen setUserInfo={setUserInfo} />)
      }
    </>
  )
}

export default App

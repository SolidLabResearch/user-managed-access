
import './App.css';

import ClippedDrawer from "./components/Drawer";

export default function App() {

  return (
    <div className="App">
      <div className="header-greeting">
        <p>Logged in as:</p> 
        <p className="user-name">Auditor #3</p> 
        <img src="./profile.png"/>
      </div>
      <ClippedDrawer />
    </div>
  )
}
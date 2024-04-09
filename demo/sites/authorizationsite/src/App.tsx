import React from "react";
import { handleIncomingRedirect, getDefaultSession } from '@inrupt/solid-client-authn-browser';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect, useState} from 'react';

import './App.css';

import Home from './components/Home';
import Navigate from './components/Navigate';
import SolidAuth from './components/SolidAuth'

const rubenWebID = 'http://localhost:3000/ruben/profile/card#me'

export default function App() {

  // Ophalen van het Solid session object.
  const session = getDefaultSession()

  // De loggedIn variabele houdt de login status bij, 
  // en update de pagina wanneer de status verandert.
  const [loggedIn, setLoggedIn] = useState<boolean>(session.info.isLoggedIn)

  // De checkingLogin variabele houdt bij of onze initiële 
  // check voor login informatie is afgerond.
  const [checkingLogin, setCheckingLogin] = useState<boolean>(true)

  // Deze functie voert uit bij het updaten van de component.
  useEffect(() => {
    // Forceer hernieuwen van de pagina bij het veranderen van de login status.
    session.onLogin(() => setLoggedIn(true))
    session.onLogout(() => setLoggedIn(false))
    
    // Deze functie gaat na of we teruggestuurd zijn 
    // naar de huidige pagina door de Solid login pagina.
    handleIncomingRedirect({ restorePreviousSession: true })
      .then((info) => { 
        // Update de status van de component voor 
        // de login status en de login check status
        // op basis van het resultaat van de functie.
        // Voor meer informatie kan je de documentatie bekijken op
        // https://docs.inrupt.com/developer-tools/api/javascript/solid-client-authn-browser/functions.html#handleincomingredirect
        let status = info?.isLoggedIn || false
        if (status !== loggedIn) setLoggedIn(status)
        if (info) setCheckingLogin(false)
      })
      .catch(console.error)
  })  

  // return (
  //   <div className="App">
  //     {
  //       checkingLogin
  //       ? 
  //         <p>Loading Session information ...</p>
  //         : (
  //         <div>
  //           <SolidAuth loggedIn={loggedIn} />
  //           {loggedIn &&
  //             <BrowserRouter>
  //               <Navigate />
  //               <Routes>
  //                 <Route path='/' element={<Home />} />
  //                 <Route path='/query' element={<Query />} />
  //               </Routes>
  //             </BrowserRouter>
  //           }
  //         </div>
  //       )
  //     }
  //   </div>
  // )

  return (
    <div className="App">
      
              <BrowserRouter>
                <Navigate />
                <Routes>
                  <Route path='/' element={<Home />} />
                </Routes>
              </BrowserRouter>
    </div>
  )
}
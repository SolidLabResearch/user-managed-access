import { getDefaultSession } from "@inrupt/solid-client-authn-browser"

export default function SolidAuth(props: { loggedIn: boolean }) {  
  
  // Verkrijg login status van App component.
  const { loggedIn } = props

  // Haal het Solid session object op
  const session = getDefaultSession();
  const webId = session.info.webId
  
  // Afhandelen van login oproep
  function handleLogin(e: any) {
    e.preventDefault();
    
    // Verkrijg de Identity Provider waarde van het textveld.
    let idp = e.target[0].value

    // Voer de aanvraag uit om in te loggen.
    // Voor meer informatie ga naar
    // https://docs.inrupt.com/developer-tools/javascript/client-libraries/tutorial/authenticate-browser/
    session.login({
      oidcIssuer: idp,
      redirectUrl: window.location.href,
      clientName: "Webdevelopment Practicum 3 React Template"
    })
  }

  // Afhandelen van logout oproep.
  function handleLogout(e: any) { 
    e.preventDefault();
    session.logout()
  }

  if (!loggedIn) {
    // Als de gebruiker niet is ingelogd, toon dan het loginscherm.
    return (
      <div >
        <form onSubmit={handleLogin} style={{
          "display": "flex",
          "margin": "10%",
          "height": "100%",
          "flexDirection": "column"
        }}>
          <input type="text" placeholder="identity provider" style={{
              marginBottom: "1em"
          }}/>
          <input type="submit" value="Login"/>
        </form>
      </div>
    )
  } else { 
    // Als de gebruiker wel is ingelogd, toon dan de WebID en de logout knop.
    return (
      <div>
        <p style={{display: "inline-block", marginRight: "1em"}}>
          Logged in as: { webId }
        </p>
        <button onClick={ handleLogout }>Logout</button>
      </div>
    )
  }
}

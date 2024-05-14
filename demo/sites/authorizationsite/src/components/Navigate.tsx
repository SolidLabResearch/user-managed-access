
export default function Navigate() {
    // Component die de links naar de vershillende paginas bijhoudt.
    return (
        <div>
            <nav>
                <h3 className="header-title">My Datastore Companion</h3>
                <div className="header-greeting">
                    <p>Logged in as:</p> 
                    <p className="user-name">Ruben Verborgh</p> 
                    <img src="./profile.png"/>
                </div>
            </nav>
        </div>
    )
}

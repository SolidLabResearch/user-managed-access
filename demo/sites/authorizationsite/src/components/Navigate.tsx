import { Session } from "@inrupt/solid-client-authn-browser"
import { Parser, Store } from "n3"
import { useEffect, useState } from "react"

export default function Navigate({
    session
}: {
    session: Session
}) {
    console.log('session info', session.info)
    // Component die de links naar de vershillende paginas bijhoudt.
    const [name, setName] = useState<string>('Loading ...')
    const [img, setImg] = useState<string>('https://static.vecteezy.com/system/resources/previews/026/630/551/original/profile-icon-symbol-design-illustration-vector.jpg')
    useEffect(() => {
        async function getName() {
            if (!session.info.webId) return;
            const webId = session.info.webId
            const res = await session.fetch(session.info.webId)
            const parsed = new Parser({baseIRI: webId}).parse((await res.text()))
            const store = new Store()
            store.addQuads(parsed)
            console.log('store', JSON.stringify(store.getQuads(null, null, null, null), null, 2))
            const name = store.getQuads(webId, "http://xmlns.com/foaf/0.1/name", null, null)[0]?.object.value
            if (name) setName(name);
            const img = store.getQuads(webId, "http://xmlns.com/foaf/0.1/img", null, null)[0]?.object.value
            if (img) setImg(img);
        }
        getName()
    
    }, [session.info.isLoggedIn])
    
    return (
        <div>
            <nav>
                <h3 className="header-title">My Datastore Companion</h3>
                <div className="header-greeting">
                    <p>Logged in as:</p> 
                    <p className="user-name">{name}</p> 
                    <img src={img}/>
                </div>
            </nav>
        </div>
    )
}

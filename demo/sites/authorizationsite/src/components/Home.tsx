import { useEffect, useState } from "react";
import BasicTabs from "./Tabs";
import { Session } from "@inrupt/solid-client-authn-browser";

export default function Home({
    session
}: {
    session: Session
}) { 


    return (
        <div id="page-wrapper">
            <div id="page-container" className="rowcontainer">
                <BasicTabs session={session}/>
            </div>
        </div>
    )
}
